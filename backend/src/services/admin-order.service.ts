import type { Request } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { NotFoundError, ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { parseDateParam } from "../utils/time";
import * as orderRepo from "../repositories/order.repository";
import {
  assertOrderTransition,
  cancelOrderLifecycle,
  refundOrderLifecycle,
} from "./order-lifecycle.service";
import { completeDelivery } from "./order-delivery.service";

export interface AdminOrderQuery {
  page?: number;
  per_page?: number;
  q?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  vendor_id?: string;
  from?: string;
  to?: string;
}

export const adminOrderService = {
  async list(query: AdminOrderQuery) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));

    const where: Prisma.MasterOrderWhereInput = {};

    if (query.status) {
      where.status = query.status.toUpperCase() as never;
    }
    if (query.payment_status) {
      where.payment_status = query.payment_status.toUpperCase() as never;
    }
    if (query.payment_method) {
      where.payment_method = query.payment_method.toUpperCase() as never;
    }
    if (query.vendor_id) {
      where.orders = { some: { vendor_id: query.vendor_id } };
    }
    if (query.from || query.to) {
      where.created_at = {};
      if (query.from) {
        const from = parseDateParam(query.from, false);
        if (from) where.created_at.gte = from;
      }
      if (query.to) {
        const to = parseDateParam(query.to, true);
        if (to) where.created_at.lte = to;
      }
    }
    if (query.q) {
      where.OR = [
        { order_number: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.masterOrder.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          order_number: true,
          status: true,
          total_amount: true,
          delivery_fee: true,
          tax: true,
          payment_method: true,
          payment_status: true,
          created_at: true,
          updated_at: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          delivery_partner: {
            select: {
              id: true,
              user: { select: { name: true, phone: true } },
            },
          },
          orders: {
            select: {
              delivery_note: true,
              payment: {
                select: {
                  id: true,
                  method: true,
                  amount: true,
                  status: true,
                  refund_amount: true,
                  refund_status: true,
                },
              },
              items: {
                select: {
                  product_name: true,
                  quantity: true,
                  image_url: true,
                  status: true,
                  product: {
                    select: {
                      images: {
                        select: { url: true },
                        take: 1,
                        orderBy: { sort_order: "asc" },
                      },
                    },
                  },
                },
              },
              vendor: { select: { id: true, business_name: true, slug: true, phone: true } },
            }
          }
        },
      }),
      prisma.masterOrder.count({ where }),
    ]);

    return {
      rows: rows.map((m) => {
        const firstOrder = m.orders[0];
        const items = m.orders.flatMap((o) => o.items);
        const vendors = m.orders.map((o) => o.vendor);
        return {
          id: m.id,
          order_number: m.order_number,
          status: m.status,
          total: Number(m.total_amount),
          delivery_fee: Number(m.delivery_fee),
          tax: Number(m.tax),
          discount: 0,
          payment_method: m.payment_method,
          payment_status: m.payment_status,
          delivery_note: firstOrder?.delivery_note,
          created_at: m.created_at,
          updated_at: m.updated_at,
          customer: m.customer
            ? { id: m.customer.id, name: m.customer.name, email: m.customer.email, phone: m.customer.phone }
            : null,
          vendors: vendors.length > 0 ? vendors : null,
          // Expose vendor as single to not break existing strict assumptions, or Multiple Stores
          vendor: vendors.length === 1 ? vendors[0] : { business_name: `${vendors.length} Stores`, phone: null, id: 'multiple' },
          delivery_partner: m.delivery_partner
            ? { id: m.delivery_partner.id, name: m.delivery_partner.user?.name ?? "Partner", phone: m.delivery_partner.user?.phone ?? null }
            : null,
          payment: firstOrder?.payment
            ? {
                id: firstOrder.payment.id,
                method: firstOrder.payment.method,
                amount: Number(firstOrder.payment.amount),
                status: firstOrder.payment.status,
                refund_amount: firstOrder.payment.refund_amount ? Number(firstOrder.payment.refund_amount) : null,
                refund_status: firstOrder.payment.refund_status,
              }
            : null,
          item_count: items.length,
          items: items.map((i) => ({
            product_name: i.product_name,
            quantity: i.quantity,
            image_url: i.image_url || i.product?.images?.[0]?.url || null,
            status: i.status,
          })),
        };
      }),
      total,
      page,
      perPage,
    };
  },

  async getById(orderId: string) {
    const mOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, avatar_url: true } },
        delivery_partner: {
          select: {
            id: true,
            vehicle_type: true,
            vehicle_number: true,
            user: { select: { name: true, phone: true } },
          },
        },
        address: true,
        orders: {
          include: {
            vendor: true,
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: {
                      select: { url: true },
                      take: 1,
                      orderBy: { sort_order: "asc" },
                    },
                  },
                }
              }
            },
            payment: true,
            events: {
              orderBy: { created_at: "desc" },
              take: 20,
            }
          }
        }
      },
    });

    if (!mOrder) {
      throw new NotFoundError("Order not found.");
    }
    
    const firstOrder = mOrder.orders[0];
    const items = mOrder.orders.flatMap((o) => o.items);
    const vendors = mOrder.orders.map((o) => o.vendor);

    // Grouping for store-wise breakdown
    const subOrders = mOrder.orders.map((o) => {
      const vendorCommissionRate = o.vendor.commission_rate?.toNumber() ?? 10;
      const commission = (o.total.toNumber() * vendorCommissionRate) / 100;
      const vendorEarnings = o.total.toNumber() - commission;
      
      return {
        order_number: o.order_number,
        status: o.status,
        vendor: o.vendor,
        total: o.total.toNumber(),
        commission,
        vendorEarnings,
        items: o.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          total_price: Number(i.total_price),
          product_name: i.product_name,
          unit: i.unit,
          image_url: i.image_url || i.product?.images?.[0]?.url || null,
          status: i.status,
        }))
      };
    });

    return {
      id: mOrder.id,
      order_number: mOrder.order_number,
      invoice_number: firstOrder?.invoice_number,
      status: mOrder.status,
      total: Number(mOrder.total_amount),
      items_subtotal: Number(mOrder.total_amount), // approximation
      delivery_fee: Number(mOrder.delivery_fee),
      tax: Number(mOrder.tax),
      discount: 0,
      payment_method: mOrder.payment_method,
      payment_status: mOrder.payment_status,
      delivery_note: firstOrder?.delivery_note,
      otp_code: firstOrder?.otp_code,
      created_at: mOrder.created_at,
      updated_at: mOrder.updated_at,
      accepted_at: firstOrder?.accepted_at,
      prepared_at: firstOrder?.prepared_at,
      packed_at: firstOrder?.packed_at,
      picked_up_at: firstOrder?.picked_up_at,
      delivered_at: firstOrder?.delivered_at,
      customer: mOrder.customer,
      vendors: vendors,
      vendor: vendors.length === 1 ? vendors[0] : { business_name: `${vendors.length} Stores`, phone: null, id: 'multiple' },
      delivery_partner: mOrder.delivery_partner,
      address: mOrder.address,
      sub_orders: subOrders, // Store-wise breakdown
      payment: firstOrder?.payment
        ? {
            id: firstOrder.payment.id,
            method: firstOrder.payment.method,
            amount: Number(firstOrder.payment.amount),
            status: firstOrder.payment.status,
          }
        : null,
      items: items.map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
        product_name: i.product_name,
        unit: i.unit,
        image_url: i.image_url || i.product?.images?.[0]?.url || null,
        status: i.status,
      })),
      events: firstOrder?.events || [],
    };
  },

  async updateStatus(
    adminUserId: string,
    orderId: string,
    status: string,
    reason: string | null,
    req: Request
  ) {
    const masterOrder = await prisma.masterOrder.findUnique({
      where: { id: orderId },
      include: { orders: true }
    });
    
    if (!masterOrder) {
       // fallback if it's a sub order id
       const order = await prisma.order.findUnique({ where: { id: orderId, deleted_at: null } });
       if (!order) throw new NotFoundError("Order not found.");
       return await this.updateSubOrderStatus(adminUserId, order.id, status, reason, req);
    }

    const mappedStatus = status.toUpperCase();
    if (masterOrder.status === mappedStatus) {
      return masterOrder;
    }

    if (mappedStatus === "CANCELLED") {
       // cancel all suborders
       for (const order of masterOrder.orders) {
          if (order.status !== "CANCELLED" && order.status !== "DELIVERED") {
              await cancelOrderLifecycle({
                order: order as any,
                reason,
                actorType: "admin",
                actorId: adminUserId,
                req,
              });
          }
       }
       await prisma.masterOrder.update({
         where: { id: masterOrder.id },
         data: { status: "CANCELLED" }
       });
    } else if (mappedStatus === "REFUNDED") {
       for (const order of masterOrder.orders) {
          if (order.status !== "REFUNDED") {
              await refundOrderLifecycle({
                order: order as any,
                reason,
                actorType: "admin",
                actorId: adminUserId,
                req,
              });
          }
       }
       await prisma.masterOrder.update({
         where: { id: masterOrder.id },
         data: { status: "REFUNDED" }
       });
    } else {
       await prisma.$transaction(async (tx) => {
         await tx.masterOrder.update({
           where: { id: masterOrder.id },
           data: { status: mappedStatus as any }
         });
         for (const order of masterOrder.orders) {
            await tx.order.update({
              where: { id: order.id },
              data: { status: mappedStatus as any }
            });
            await tx.orderEvent.create({
              data: {
                order_id: order.id,
                status: mappedStatus as any,
                note: reason ?? `Admin updated master order status to ${status}.`,
                actor_type: "admin",
                actor_id: adminUserId,
              }
            });
         }
       });
    }

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
        entityType: "masterOrder",
        entityId: orderId,
        oldValues: { status: masterOrder.status },
        newValues: { status: mappedStatus, reason },
      },
      req
    );

    return await prisma.masterOrder.findUnique({ where: { id: orderId } });
  },
  
  async updateSubOrderStatus(
    adminUserId: string,
    orderId: string,
    status: string,
    reason: string | null,
    req: Request
  ) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, deleted_at: null },
    });
    if (!order) {
      throw new NotFoundError("Order not found.");
    }
    const mappedStatus = status.toUpperCase();
    if (order.status === mappedStatus) {
      return order as unknown as orderRepo.OrderRow;
    }
    assertOrderTransition(order.status, mappedStatus);

    let updated: orderRepo.OrderRow;
    if (mappedStatus === "CANCELLED") {
      const detail = await orderRepo.findById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found.");
      }
      updated = await cancelOrderLifecycle({
        order: detail,
        reason,
        actorType: "admin",
        actorId: adminUserId,
        req,
      });
    } else if (mappedStatus === "REFUNDED") {
      const detail = await orderRepo.findById(orderId);
      if (!detail) {
        throw new NotFoundError("Order not found.");
      }
      updated = await refundOrderLifecycle({
        order: detail,
        reason,
        actorType: "admin",
        actorId: adminUserId,
        req,
      });
    } else if (mappedStatus === "DELIVERED") {
      updated = await completeDelivery({
        orderId,
        otp: "",
        allowedStates: ["READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"],
        note: reason ?? "Order marked as delivered by admin.",
        actorType: "admin",
        actorId: adminUserId,
        skipOtp: true,
      });
    } else {
      updated = await orderRepo.updateOrderStatus(orderId, {
        status: mappedStatus,
        note: reason ?? `Admin updated status to ${status}.`,
        actorType: "admin",
        actorId: adminUserId,
      });
    }

    return updated;
  },

  async bypassSubOrder(
    adminUserId: string,
    masterOrderId: string,
    subOrderId: string,
    req: Request
  ) {
    const detail = await orderRepo.findById(subOrderId);
    if (!detail) {
      throw new NotFoundError("Sub-order not found.");
    }
    if (detail.master_order_id !== masterOrderId) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Sub-order does not belong to this master order.");
    }
    
    // Admin forcibly cancels it, triggering partial refund
    const updated = await cancelOrderLifecycle({
      order: detail,
      reason: "Bypassed due to unresponsive/closed vendor.",
      actorType: "admin",
      actorId: adminUserId,
      req,
    });
    return updated;
  },

  async getDisputesAndRefunds(query: { page?: number; per_page?: number; status?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));
    const skip = (page - 1) * perPage;

    const where: Prisma.OrderWhereInput = {
      deleted_at: null,
      OR: [
        { refund_reason: { not: null } },
        { payment_status: { in: ["REFUNDED" as never, "PARTIALLY_REFUNDED" as never] } },
        {
          AND: [
            { status: "CANCELLED" as never },
            { payment_status: "PAID" as never },
          ],
        },
      ],
    };

    if (query.status === "PENDING") {
      where.payment_status = { in: ["PAID" as never, "PARTIALLY_REFUNDED" as never] };
      where.status = { not: "REFUNDED" as never };
    } else if (query.status === "REFUNDED") {
      where.payment_status = "REFUNDED" as never;
    }

    const [orders, total, refundStats] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          vendor: { select: { id: true, business_name: true, phone: true } },
          items: {
            select: {
              id: true,
              product_name: true,
              quantity: true,
              unit_price: true,
              total_price: true,
              status: true,
            },
          },
          payment: true,
        },
        orderBy: { updated_at: "desc" },
        skip,
        take: perPage,
      }),
      prisma.order.count({ where }),
      prisma.payment.aggregate({
        _sum: { refund_amount: true },
        where: { refund_amount: { gt: 0 } },
      }),
    ]);

    const pendingCount = await prisma.order.count({
      where: {
        deleted_at: null,
        OR: [
          { refund_reason: { not: null } },
          { AND: [{ status: "CANCELLED" as never }, { payment_status: "PAID" as never }] },
        ],
        payment_status: { in: ["PAID" as never, "PARTIALLY_REFUNDED" as never] },
      },
    });

    return {
      data: orders.map((o) => ({ ...o, user: (o as any).customer })),
      pagination: {
        page,
        per_page: perPage,
        total_items: total,
        total_pages: Math.ceil(total / perPage),
      },
      stats: {
        pending_count: pendingCount,
        total_refunded_amount: Number(refundStats._sum.refund_amount ?? 0),
        total_cases: total,
      },
    };
  },
};
