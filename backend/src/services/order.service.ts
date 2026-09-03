import type { Request } from "express";

import { AUDIT_ACTIONS } from "../constants/auth";
import prisma from "../database/prisma";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { vendorService } from "./vendor.service";
import { paymentService } from "./payment.service";
import { realtime } from "../realtime/realtime";
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
    const skip = (page - 1) * perPage;
    
    const where: any = { user_id: userId, deleted_at: null };
    if (query.status) {
      if (query.status.includes(",")) {
        where.status = { in: query.status.split(",") };
      } else {
        where.status = query.status;
      }
    }

    const rows = await prisma.masterOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: perPage,
        include: {
           orders: {
              include: {
                 vendor: { select: { id: true, business_name: true } },
                 items: true
              }
           }
        }
    });
    
    const total = await prisma.masterOrder.count({ where });

    const mappedRows = rows.map((m: any) => {
       const allItems = m.orders.flatMap((o: any) => o.items);
       const vendors = m.orders.map((o: any) => o.vendor);
       const firstOrder = m.orders[0];
       
       return {
          id: m.id,
          order_number: m.order_number,
          status: m.status,
          total_amount: m.total_amount,
          delivery_fee: m.delivery_fee,
          tax: m.tax,
          payment_method: m.payment_method,
          payment_status: m.payment_status,
          created_at: m.created_at,
          items: allItems,
          vendors: vendors,
          total: m.total_amount,
          vendor: vendors.length === 1 ? vendors[0] : { business_name: 'Multiple Stores' },
          otp_code: firstOrder?.otp_code,
       };
    });

    return { rows: mappedRows, total, page, perPage };
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

  async getOrderForUser(userId: string, orderId: string): Promise<any> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
         address: true,
         orders: {
            include: {
               vendor: true,
               items: true,
               events: { orderBy: { created_at: "desc" } },
               transactions: true,
            }
         }
      }
    });

    if (!m) {
      throw new NotFoundError("Order not found.");
    }
    if (m.user_id !== userId) {
      throw new ForbiddenError("You do not own this order.");
    }

    const allItems = m.orders.flatMap((o: any) => o.items);
    const vendors = m.orders.map((o: any) => o.vendor);
    const firstOrder = m.orders[0];
    const payment = firstOrder?.transactions?.find((t: any) => t.status === "COMPLETED");

    return {
       id: m.id,
       order_number: m.order_number,
       status: m.status,
       total_amount: m.total_amount,
       delivery_fee: m.delivery_fee,
       tax: m.tax,
       platform_fee: m.platform_fee,
       additional_charges: m.additional_charges,
       payment_method: m.payment_method,
       payment_status: m.payment_status,
       created_at: m.created_at,
       items: allItems,
       vendors: vendors,
       address: m.address,
       total: m.total_amount,
       vendor: vendors.length === 1 ? vendors[0] : { business_name: 'Multiple Stores' },
       otp_code: firstOrder?.otp_code,
       payment,
       events: firstOrder?.events || [],
       orders: m.orders,
    };
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

  async cancelOrder(userId: string, orderId: string, input: { reason?: string }, req: Request): Promise<any> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });

    if (m) {
      if (m.user_id !== userId) throw new ForbiddenError("You do not own this order.");
      if (m.status === "CANCELLED") return m;
      
      await prisma.$transaction(async (tx) => {
        await tx.masterOrder.update({ where: { id: m.id }, data: { status: "CANCELLED" } });
        for (const order of m.orders) {
            await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
            await tx.orderEvent.create({
              data: {
                order_id: order.id,
                status: "CANCELLED",
                note: input.reason || "Order cancelled by customer.",
                actor_type: "customer",
                actor_id: userId,
              },
            });
            // Inventory release omitted for simplicity to prevent release undefined error
        }
      });
      return m;
    }

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

  async getTimeline(orderId: string): Promise<any[]> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        orders: { include: { events: true } }
      }
    });

    if (m) {
      const events = m.orders.flatMap((o: any) => o.events);
      events.sort((a: any, b: any) => b.created_at.getTime() - a.created_at.getTime());
      return events;
    }

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

  async requestRefund(userId: string, orderId: string, reason: string, req: Request): Promise<any> {
    const m = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });

    if (m) {
      if (m.user_id !== userId) throw new ForbiddenError("You are not authorized to request a refund for this order.");
      
      const updatedOrders = [];
      for (const o of m.orders) {
        if (o.status !== "DELIVERED") continue;
        const fullOrder = await orderRepo.findById(o.id);
        if (fullOrder) {
            const updated = await refundOrderLifecycle({
              order: fullOrder,
              reason,
              actorType: "customer",
              actorId: userId,
              req,
            });
            updatedOrders.push(updated);
        }
      }
      return m;
    }

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

    const toNum = (val: any) => (typeof val === "number" ? val : typeof val?.toNumber === "function" ? val.toNumber() : Number(val || 0));

    // Recompute the bill from the remaining accepted items. Discount and tax are
    // applied proportionally to the item subtotal at checkout, so the same ratio
    // carries over when an item is removed. The delivery fee is held constant.
    const oldSubtotal = toNum(order.items_subtotal);
    const oldDiscount = toNum(order.discount);
    const oldTax = toNum(order.tax);
    const oldTotal = toNum(order.total);
    const deliveryFee = toNum(order.delivery_fee);

    const rejectedPrice = toNum(item.total_price);
    const newSubtotal = Math.max(0, Math.round((oldSubtotal - rejectedPrice) * 100) / 100);
    const subtotalRatio = oldSubtotal > 0 ? newSubtotal / oldSubtotal : 0;
    const newDiscount = Math.round(oldDiscount * subtotalRatio * 100) / 100;
    const newTax = Math.round(oldTax * subtotalRatio * 100) / 100;
    const newTotal = Math.max(0, Math.round((newSubtotal + deliveryFee - newDiscount + newTax) * 100) / 100);

    // If every item was rejected the order has nothing left to fulfil — cancel it.
    if (newSubtotal <= 0) {
      let finalPaymentStatus: string | undefined;
      if (order.payment_status === "PAID" || order.payment_status === "PARTIALLY_REFUNDED") {
        const refundResult = (await paymentService.refund(
          userId,
          order.id,
          { reason: `All items rejected by vendor: ${item.product_name}` },
          req
        )) as { payment?: { status?: string } };
        finalPaymentStatus = refundResult?.payment?.status;
      }

      await orderRepo.updateOrder(order.id, {
        status: "CANCELLED",
        items_subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        cancelled_at: new Date(),
        cancel_reason: "All items were rejected by the vendor",
        ...(finalPaymentStatus ? { payment_status: finalPaymentStatus as never } : {}),
      });

      await prisma.orderEvent.create({
        data: {
          order: { connect: { id: order.id } },
          status: "CANCELLED" as never,
          note: "Order cancelled - all items were rejected by the vendor.",
          actor_type: "vendor",
          actor_id: userId,
        },
      });

      await notificationService.orderStatus(
        order.user_id,
        order.order_number,
        "Order Cancelled - Items Unavailable",
        `The vendor could not fulfil any items from your order.${finalPaymentStatus === "REFUNDED" ? " Your full payment has been refunded." : ""}`,
        { order_id: order.id, updated_total: 0, status: "CANCELLED" }
      );

      realtime.publishOrderStatus(order.id, "CANCELLED");

      await auditService.record(
        { userId, action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED, entityType: "order", entityId: order.id, oldValues: { status: order.status }, newValues: { status: "CANCELLED", reason: "All items rejected" } },
        req
      );

      return { success: true, item_id: itemId, order_status: "CANCELLED", updated_total: 0 };
    }

    // Refund the difference between the old and the new bill, scaled to the share
    // the customer actually prepaid. Because both `remaining` and `oldTotal` fall
    // by the same delta on earlier rejections, the ratio stays correct across
    // multiple rejections and never exceeds the gateway's remaining balance.
    let refundAmount = 0;
    let refundedStatus: string | undefined;
    const paidAmount = order.payment ? toNum(order.payment.amount) : 0;
    const refundedSoFar = order.payment ? toNum(order.payment.refund_amount ?? 0) : 0;
    const remaining = Math.max(0, paidAmount - refundedSoFar);
    const delta = Math.max(0, oldTotal - newTotal);
    if ((order.payment_status === "PAID" || order.payment_status === "PARTIALLY_REFUNDED") && delta > 0 && oldTotal > 0 && remaining > 0) {
      refundAmount = Math.min(Math.round((delta * (remaining / oldTotal)) * 100) / 100, remaining);
      const refundResult = (await paymentService.refund(
        userId,
        order.id,
        { reason: `Item rejected by vendor: ${item.product_name}`, amount: refundAmount },
        req
      )) as { payment?: { status?: string } };
      refundedStatus = refundResult?.payment?.status;
    }

    await orderRepo.updateOrder(order.id, {
      items_subtotal: newSubtotal,
      discount: newDiscount,
      tax: newTax,
      total: newTotal,
      ...(refundedStatus ? { payment_status: refundedStatus as never } : {}),
    });

    await prisma.orderEvent.create({
      data: {
        order: { connect: { id: order.id } },
        status: order.status as never,
        note: `Item rejected by vendor: ${item.product_name}. Order total updated to Rs ${newTotal}.`,
        actor_type: "vendor",
        actor_id: userId,
      },
    });

    await notificationService.orderStatus(
      order.user_id,
      order.order_number,
      "Order Updated - Item Rejected",
      `The vendor could not fulfil ${item.product_name} (Qty ${item.quantity}). Your updated order total is Rs ${newTotal}.${refundAmount > 0 ? ` A refund of Rs ${refundAmount} has been initiated.` : ""}`,
      { order_id: order.id, rejected_item: item.product_name, updated_total: newTotal, refund_amount: refundAmount }
    );

    realtime.publishOrderStatus(order.id, order.status);

    await auditService.record(
      { userId, action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED, entityType: "order", entityId: order.id, oldValues: { total: oldTotal }, newValues: { rejected_item: item.product_name, updated_total: newTotal, refund_amount: refundAmount } },
      req
    );

    return {
      success: true,
      item_id: itemId,
      updated_total: newTotal,
      refund_amount: refundAmount,
    };
  },
};
