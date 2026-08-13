import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { prisma } from "../database/prisma";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { vendorService } from "./vendor.service";
import { paymentService } from "./payment.service";
import {
  assertOrderTransition,
  cancelOrderLifecycle,
  refundOrderLifecycle,
} from "./order-lifecycle.service";
import * as orderRepo from "../repositories/order.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
import { completeDelivery, VENDOR_DELIVERY_STATES, verifyDeliveryOtp } from "./order-delivery.service";
import { ApiError, ForbiddenError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export interface OrderListQuery {
  page?: number;
  per_page?: number;
  status?: string;
}

const CUSTOMER_CANCELABLE = new Set(["PENDING", "CONFIRMED"]);

export const orderService = {
  async listMyOrders(userId: string, query: OrderListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await orderRepo.listOrders(
      { userId, status: query.status },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async listVendorOrders(userId: string, query: OrderListQuery) {
    const vendor = await vendorService.getMyVendor(userId);
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const { rows, total } = await orderRepo.listOrders(
      { vendorId: vendor.id, status: query.status },
      (page - 1) * perPage,
      perPage
    );
    return { rows, total, page, perPage };
  },

  async getOrderForUser(userId: string, orderId: string): Promise<orderRepo.OrderDetail> {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }
    return order;
  },

  async getOrderForVendor(userId: string, orderId: string): Promise<orderRepo.OrderDetail> {
    const vendor = await vendorService.getMyVendor(userId);
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.vendor_id !== vendor.id) {
      throw new ForbiddenError("You do not own this order.");
    }
    return order;
  },

  async cancelOrder(userId: string, orderId: string, input: { reason?: string }, req: Request): Promise<orderRepo.OrderRow> {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }
    if (order.status === "CANCELLED") {
      return order as unknown as orderRepo.OrderRow;
    }
    if (!CUSTOMER_CANCELABLE.has(order.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Order cannot be cancelled in its current status (${order.status}).`, {
        code: "NOT_CANCELLABLE",
      });
    }

    // Refund-first lifecycle: a failed refund leaves the order in its prior
    // state (payment still PAID, inventory still reserved) so cancellation can
    // be retried. The CANCELLED claim + inventory release are atomic.
    const updated = await cancelOrderLifecycle({
      order,
      reason: input.reason ?? null,
      actorType: "customer",
      actorId: userId,
      req,
    });

    await notificationService.orderStatus(userId, order.order_number, "Order cancelled", `Your order ${order.order_number} has been cancelled.`, {
      order_id: order.id,
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_CANCELLED, entityType: "order", entityId: order.id, newValues: { reason: input.reason ?? null } },
      req
    );

    return updated;
  },

  async transitionStatus(userId: string, orderId: string, input: { status: string; note?: string; otp_code?: string }, req: Request): Promise<orderRepo.OrderRow> {
    const vendor = await vendorService.getMyVendor(userId);
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.vendor_id !== vendor.id) {
      throw new ForbiddenError("You do not own this order.");
    }

    // Reject arbitrary/backwards transitions before any side effects run.
    assertOrderTransition(order.status, input.status);

    if (input.status === "CANCELLED") {
      const updated = await cancelOrderLifecycle({
        order,
        reason: input.note ?? null,
        actorType: "vendor",
        actorId: userId,
        req,
      });
      await notificationService.orderStatus(order.user_id, order.order_number, "Order update", `Your order ${order.order_number} is now cancelled.`, {
        order_id: order.id,
      });
      await auditService.record(
        { userId, action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED, entityType: "order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: "CANCELLED" } },
        req
      );
      return updated;
    }

    const timestamps: Record<string, Date> = {};
    switch (input.status) {
      case "CONFIRMED":
        timestamps.accepted_at = new Date();
        break;
      case "PREPARING":
        timestamps.prepared_at = new Date();
        break;
      case "PACKED":
        timestamps.packed_at = new Date();
        break;
      case "READY_FOR_PICKUP":
        break;
      case "OUT_FOR_DELIVERY":
        timestamps.started_at = new Date();
        break;
      case "DELIVERED":
        await verifyDeliveryOtp(order, input.otp_code ?? "", VENDOR_DELIVERY_STATES);
        timestamps.delivered_at = new Date();
        break;
      default:
        throw new ApiError(HttpStatus.BAD_REQUEST, `Unsupported status transition: ${input.status}.`, {
          code: "INVALID_STATUS",
        });
    }

    let updated: orderRepo.OrderRow;
    if (input.status === "DELIVERED") {
      updated = await completeDelivery({
        orderId: order.id,
        otp: input.otp_code ?? "",
        allowedStates: VENDOR_DELIVERY_STATES,
        note: input.note ?? "Order delivered.",
        actorType: "vendor",
        actorId: userId,
      });
    } else {
      updated = await orderRepo.updateOrderStatus(order.id, {
        status: input.status,
        note: input.note ?? `Status changed to ${input.status}.`,
        actorType: "vendor",
        actorId: userId,
        timestamps,
      });
    }

    if (input.status === "DELIVERED") {
      await notificationService.orderStatus(order.user_id, order.order_number, "Order delivered", `Your order ${order.order_number} has been delivered. Enjoy!`, {
        order_id: order.id,
      });
    } else {
      await notificationService.orderStatus(order.user_id, order.order_number, "Order update", `Your order ${order.order_number} is now ${input.status.replace(/_/g, " ").toLowerCase()}.`, {
        order_id: order.id,
      });
    }

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED, entityType: "order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: input.status } },
      req
    );

    return updated;
  },

  async getTimeline(orderId: string): Promise<orderRepo.OrderDetail["events"]> {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    return order.events;
  },

  async getInvoice(orderId: string): Promise<orderRepo.OrderDetail> {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (!order.invoice_number) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Invoice not generated yet.", { code: "NOT_FOUND" });
    }
    return order;
  },

  async requestRefund(userId: string, orderId: string, reason: string, req: Request): Promise<orderRepo.OrderRow> {
    const order = await orderRepo.findById(orderId);
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    if (order.user_id !== userId) {
      throw new ForbiddenError("You are not authorized to request a refund for this order.");
    }
    if (order.status !== "DELIVERED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Refunds can only be requested for delivered orders.", { code: "INVALID_STATUS" });
    }

    // Refund-first lifecycle: the order is only claimed REFUNDED after the money
    // has moved, so a failed refund leaves the delivered order recoverable.
    const updated = await refundOrderLifecycle({
      order,
      reason,
      actorType: "customer",
      actorId: userId,
      req,
    });

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED, entityType: "order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: "REFUNDED", reason } },
      req
    );

    await notificationService.orderStatus(order.user_id, order.order_number, "Refund Requested", `Your refund request for order ${order.order_number} is being processed.`, {
      order_id: order.id,
    });

    return updated;
  },

  async rejectOrderItem(userId: string, orderId: string, itemId: string, req: Request) {
    const vendor = await vendorService.getMyVendor(userId);
    const order = await orderRepo.findById(orderId);
    if (!order) throw new NotFoundError("Order not found");
    if (order.vendor_id !== vendor.id) throw new ForbiddenError("Not your order");

    if (!CUSTOMER_CANCELABLE.has(order.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Cannot modify order in status ${order.status}`);
    }

    const item = order.items?.find((i: any) => i.id === itemId);
    if (!item) throw new NotFoundError("Item not found in order");
    if (item.status === "rejected") throw new ApiError(HttpStatus.BAD_REQUEST, "Item is already rejected");

    // Atomic claim: only the first rejector flips the item to rejected, so a
    // replayed/concurrent call can never release the reservation twice.
    const claimed = await prisma.orderItem.updateMany({
      where: { id: itemId, status: "active" },
      data: { status: "rejected" },
    });
    if (claimed.count === 0) throw new ApiError(HttpStatus.BAD_REQUEST, "Item is already rejected");

    // Release the rejected item's reservation (made at checkout) so its stock
    // becomes available again.
    await inventoryRepo.releaseReserved(item.product_id, item.quantity);

    // If order was paid, issue partial refund for the item's total_price
    if (order.payment_status === "PAID" || order.payment_status === "PARTIALLY_REFUNDED") {
      const refundResult = (await paymentService.refund(
        userId,
        order.id,
        { reason: `Item out of stock: ${item.product_name}`, amount: Number(item.total_price) },
        req
      )) as { payment?: { status?: string } };
      if (refundResult?.payment?.status) {
        await orderRepo.updateOrder(order.id, {
          payment_status: refundResult.payment.status as never,
        });
      }
    }

    await notificationService.orderStatus(order.user_id, order.order_number, "Item Rejected", `The vendor rejected an item (${item.product_name}) from your order. A partial refund will be processed if paid online.`, { order_id: order.id });
    return { success: true, item_id: itemId };
  },
};
