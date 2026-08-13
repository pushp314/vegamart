import { Prisma } from "@prisma/client";
import type { OrderStatus } from "@prisma/client";

import prisma from "../database/prisma";
import { OTP_MAX_ATTEMPTS } from "../constants";
import * as inventoryRepo from "../repositories/inventory.repository";
import { createOrderEarnings } from "./earning.service";
import type { OrderRow } from "../repositories/order.repository";
import { safeEqual } from "../utils/crypto";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

// A delivery partner may only mark an order DELIVERED after the order has been
// picked up (ASSIGNED -> ACCEPTED -> PICKED_UP -> DELIVERED). OUT_FOR_DELIVERY
// is a downstream state of PICKED_UP in the existing model, so it is allowed too.
export const DELIVERY_PARTNER_DELIVERY_STATES = ["PICKED_UP", "OUT_FOR_DELIVERY"] as const;

// Vendors completing self-delivery / self-pickup hand-overs may mark DELIVERED
// from READY_FOR_PICKUP (the point where the parcel leaves the store).
export const VENDOR_DELIVERY_STATES = ["READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"] as const;

export type DeliveryCompletableState = (typeof DELIVERY_PARTNER_DELIVERY_STATES)[number];

export interface DeliveryOtpOrder {
  id: string;
  status: string;
  otp_code: string | null;
  otp_expires_at: Date | null;
  otp_attempts: number;
}

export function assertValidDeliveryOtp(otp: string): void {
  if (!/^\d{6}$/.test(otp)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery OTP must be exactly 6 digits.", { code: "INVALID_OTP" });
  }
}

/**
 * Verifies a delivery OTP without mutating the order.
 *
 * Guards (in order):
 *  1. OTP must be exactly 6 digits.
 *  2. The order must be in a state from which DELIVERED is reachable.
 *  3. An OTP must exist for the order.
 *  4. The OTP must not have expired.
 *  5. The failed-attempt budget must not be exhausted.
 *  6. The OTP value must match (timing-safe).
 *
 * On a value mismatch the attempt counter is incremented atomically (bounded by
 * OTP_MAX_ATTEMPTS) and an INVALID_OTP error is thrown. On success the caller
 * must still commit the completion through `completeDelivery`, which re-checks
 * the OTP atomically inside the transaction to close any check-then-act race.
 */
export async function verifyDeliveryOtp(order: DeliveryOtpOrder, otp: string, allowedStates: readonly string[]): Promise<void> {
  assertValidDeliveryOtp(otp);

  if (!allowedStates.includes(order.status)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Order cannot be marked as delivered from its current status (${order.status}).`,
      { code: "INVALID_DELIVERY_STATE" }
    );
  }

  if (!order.otp_code) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery OTP.", { code: "INVALID_OTP" });
  }

  if (order.otp_expires_at != null && order.otp_expires_at.getTime() < Date.now()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "This delivery OTP has expired.", { code: "OTP_EXPIRED" });
  }

  if (order.otp_attempts >= OTP_MAX_ATTEMPTS) {
    throw new ApiError(
      HttpStatus.TOO_MANY_REQUESTS,
      "Too many incorrect OTP attempts. Please request a new code.",
      { code: "OTP_ATTEMPTS_EXCEEDED" }
    );
  }

  if (!safeEqual(order.otp_code, otp)) {
    await prisma.order.updateMany({
      where: { id: order.id, otp_attempts: { lt: OTP_MAX_ATTEMPTS } },
      data: { otp_attempts: { increment: 1 } },
    });
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid delivery OTP.", { code: "INVALID_OTP" });
  }
}

export interface CompleteDeliveryInput {
  orderId: string;
  /** Set for the delivery-partner flow so the atomic claim is scoped to the assigned partner. */
  partnerId?: string | null;
  otp: string;
  allowedStates: readonly string[];
  note?: string | null;
  actorType: "delivery" | "vendor" | "admin";
  actorId: string;
  /** Admin override: commit DELIVERED without requiring the OTP to match. */
  skipOtp?: boolean;
}

/**
 * Commits the DELIVERED transition exactly once and consumes reserved inventory
 * inside a single transaction.
 *
 * The conditional `updateMany` is the atomic guard: it only matches when the
 * order is still in an allowed previous state, the OTP still matches, and (for
 * the partner flow) the order is still assigned to the same partner. Any
 * concurrent/replayed completion finds `count === 0`, so inventory is consumed
 * only by the transition that actually wins the race. The OTP is cleared on
 * success (replay prevention).
 */
export async function completeDelivery(input: CompleteDeliveryInput): Promise<OrderRow> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();

    const where: Prisma.OrderWhereInput = {
      id: input.orderId,
      status: { in: [...input.allowedStates] as OrderStatus[] },
    };
    if (!input.skipOtp) {
      where.otp_code = input.otp;
    }
    if (input.partnerId) {
      where.delivery_partner_id = input.partnerId;
    }

    const claimed = await tx.order.updateMany({
      where,
      data: {
        status: "DELIVERED" as Prisma.OrderUpdateManyMutationInput["status"],
        delivered_at: now,
        otp_code: null,
        otp_expires_at: null,
        otp_attempts: 0,
      },
    });

    if (claimed.count === 0) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        "This order cannot be marked as delivered in its current state.",
        { code: "INVALID_DELIVERY_STATE" }
      );
    }

    await inventoryRepo.consumeQuantityForOrder(input.orderId, tx);

    await tx.orderEvent.create({
      data: {
        status: "DELIVERED" as Prisma.OrderEventCreateInput["status"],
        note: input.note ?? "Order delivered.",
        actor_type: input.actorType,
        actor_id: input.actorId,
        order: { connect: { id: input.orderId } },
      },
    });

    await tx.deliveryTracking.upsert({
      where: { order_id: input.orderId },
      update: { status: "DELIVERED" as never },
      create: { order_id: input.orderId, status: "DELIVERED" as never },
    });

    // Immutable earning ledger rows are created in the same transaction that
    // wins the atomic DELIVERED claim, so replayed/raced completions (count === 0)
    // can never double-create vendor or delivery earnings.
    const row = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: { select: { total_price: true, status: true } },
        vendor: { select: { commission_rate: true } },
      },
    });
    if (row) {
      await createOrderEarnings(
        {
          id: row.id,
          vendor_id: row.vendor_id,
          delivery_partner_id: row.delivery_partner_id,
          items_subtotal: row.items_subtotal.toNumber(),
          delivery_fee: row.delivery_fee.toNumber(),
          discount: row.discount.toNumber(),
          commission_rate: row.vendor?.commission_rate.toNumber() ?? 0,
          items: row.items.map((item) => ({
            total_price: item.total_price.toNumber(),
            status: item.status,
          })),
        },
        tx
      );
    }

    return row as unknown as OrderRow;
  });
}
