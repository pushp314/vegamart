const fs = require('fs');
const path = 'backend/src/services/delivery.service.ts';
let code = fs.readFileSync(path, 'utf8');

// 1. Remove orderRepo import (line 3)
code = code.replace('import * as orderRepo from "../repositories/order.repository";\n', '');

// 2. Remove realtime import (line 4)
code = code.replace('import { realtime } from "../realtime/realtime";\n', '');

// 3. Remove ORDER_STATUS_MAP
code = code.replace(`const ORDER_STATUS_MAP: Record<string, string> = {
  accepted: "CONFIRMED",
  preparing: "PREPARING",
  packed: "PACKED",
  ready_for_pickup: "READY_FOR_PICKUP",
  picked_up: "PICKED_UP",
  out_for_delivery: "OUT_FOR_DELIVERY",
  // "delivered" is intentionally NOT mapped here. Marking an order DELIVERED
  // requires OTP verification through the dedicated delivered endpoint.
};

`, '');

// 4. Remove extractGatewayMethod
code = code.replace(`// The Razorpay payment entity stored in \`payments.gateway_response\` carries the
// real instrument the customer used (upi / card / netbanking / emi / wallet),
// which is more specific than the order-level \`payment_method\` (RAZORPAY/COD).
function extractGatewayMethod(
  payment: { gateway_response?: unknown } | null | undefined,
): string | null {
  if (!payment?.gateway_response) return null;
  const gw = payment.gateway_response as { method?: string } | null;
  return gw?.method ?? null;
}

`, '');

// 5. Remove assertDeliveryTransition and DELIVERY_TRANSITIONS
code = code.replace(`// Forward-only state machine for the delivery-partner status endpoint.
// DELIVERED is never a target here (OTP-gated endpoint only), and backwards
// transitions are rejected. OUT_FOR_DELIVERY is only reachable after PICKED_UP,
// so a partner cannot skip the pickup step before completing a delivery.
const DELIVERY_TRANSITIONS: Record<string, Set<string>> = {
  PENDING: new Set(["CONFIRMED"]),
  CONFIRMED: new Set([
    "CONFIRMED",
    "PREPARING",
    "PACKED",
    "READY_FOR_PICKUP",
    "PICKED_UP",
  ]),
  PREPARING: new Set(["PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP"]),
  PACKED: new Set(["PACKED", "READY_FOR_PICKUP", "PICKED_UP"]),
  READY_FOR_PICKUP: new Set(["READY_FOR_PICKUP", "PICKED_UP"]),
  PICKED_UP: new Set(["PICKED_UP", "OUT_FOR_DELIVERY"]),
  OUT_FOR_DELIVERY: new Set(["OUT_FOR_DELIVERY"]),
  DELIVERED: new Set([]),
  CANCELLED: new Set([]),
  REFUNDED: new Set([]),
  RETURNED: new Set([]),
  FAILED: new Set([]),
};

function assertDeliveryTransition(current: string, next: string): void {
  const allowed = DELIVERY_TRANSITIONS[current];
  if (!allowed || !allowed.has(next)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      \`Cannot transition order from \${current} to \${next}.\`,
      { code: "INVALID_STATUS" },
    );
  }
}

`, '');

// 6. Remove imports from order-delivery.service and order-lifecycle.service
code = code.replace(`import {
  completeDelivery,
  DELIVERY_PARTNER_DELIVERY_STATES,
  verifyDeliveryOtp,
} from "./order-delivery.service";
import { assertOrderTransition } from "./order-lifecycle.service";
`, '');

// 7. Remove resolveTrackingAccess and TrackingViewer type
code = code.replace(`type TrackingViewer =
  | { kind: "customer"; canSeeDriverInfo: false }
  | { kind: "delivery"; canSeeDriverInfo: boolean }
  | { kind: "vendor"; canSeeDriverInfo: true }
  | { kind: "admin"; canSeeDriverInfo: true };

/**
 * Resolves what tracking data a requester may see for an order.
 *
 * - Customers may only track their own orders (never another customer's).
 * - Delivery partners may track orders assigned to them, plus orders that are
 *   still unassigned in the requests queue (explicitly available to them).
 * - Vendors may track orders for their own store; admins may track anything.
 * - Driver PII (name/phone/vehicle) is only granted to the assigned partner,
 *   the order's vendor, and admins - never to customers or random users.
 */
async function resolveTrackingAccess(
  user: TrackingRequester,
  order: import("../repositories/order.repository").OrderDetail,
): Promise<TrackingViewer> {
  if (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN) {
    return { kind: "admin", canSeeDriverInfo: true };
  }

  if (user.role === ROLES.CUSTOMER) {
    if (order.user_id !== user.id) {
      throw new ForbiddenError("You can only track your own orders.");
    }
    return { kind: "customer", canSeeDriverInfo: false };
  }

  if (user.role === ROLES.DELIVERY_PARTNER) {
    const partner = await deliveryRepo.findByUserId(user.id);
    if (!partner) {
      throw new ForbiddenError("Delivery partner profile not found.");
    }
    if (order.delivery_partner_id === partner.id) {
      return { kind: "delivery", canSeeDriverInfo: true };
    }
    if (
      order.delivery_partner_id === null &&
      (AVAILABLE_DELIVERY_REQUEST_STATUSES as readonly string[]).includes(
        order.status,
      )
    ) {
      return { kind: "delivery", canSeeDriverInfo: false };
    }
    throw new ForbiddenError("You can only track orders assigned to you.");
  }

  if (user.role === ROLES.VENDOR) {
    const vendor = await vendorRepo.findByUserId(user.id);
    if (!vendor || vendor.id !== order.vendor_id) {
      throw new ForbiddenError("You can only track orders for your own store.");
    }
    return { kind: "vendor", canSeeDriverInfo: true };
  }

  throw new ForbiddenError(
    "You are not allowed to view this order's tracking.",
  );
}

`, '');

// 8. Fix updated variable
code = code.replace('const updated = await deliveryRepo.updateDelivery', 'await deliveryRepo.updateDelivery');

fs.writeFileSync(path, code);
