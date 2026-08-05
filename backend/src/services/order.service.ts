import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { vendorService } from "./vendor.service";
import * as orderRepo from "../repositories/order.repository";
import * as inventoryRepo from "../repositories/inventory.repository";
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
    if (!CUSTOMER_CANCELABLE.has(order.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Order cannot be cancelled in its current status (${order.status}).`, {
        code: "NOT_CANCELLABLE",
      });
    }

    const updated = await orderRepo.updateOrderStatus(order.id, {
      status: "CANCELLED",
      note: input.reason ? `Cancelled by customer: ${input.reason}` : "Cancelled by customer.",
      actorType: "customer",
      actorId: userId,
      timestamps: { cancelled_at: new Date(), cancel_reason: input.reason ?? null },
    });

    if (order.payment_status === "PAID") {
      await inventoryRepo.releaseQuantityForOrder(order.id);
    }

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
        timestamps.delivered_at = new Date();
        await inventoryRepo.consumeQuantityForOrder(order.id);
        break;
      default:
        throw new ApiError(HttpStatus.BAD_REQUEST, `Unsupported status transition: ${input.status}.`, {
          code: "INVALID_STATUS",
        });
    }

    const updated = await orderRepo.updateOrderStatus(order.id, {
      status: input.status,
      note: input.note ?? `Status changed to ${input.status}.`,
      actorType: "vendor",
      actorId: userId,
      timestamps,
    });

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

    const updated = await orderRepo.updateOrderStatus(orderId, {
      status: "REFUNDED",
      note: `Refund requested: ${reason}`,
      actorType: "customer",
      actorId: userId,
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
};
