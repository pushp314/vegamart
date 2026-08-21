import type { Request } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { NotFoundError } from "../utils/ApiError";
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

    const where: Prisma.OrderWhereInput = { deleted_at: null };

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
      where.vendor_id = query.vendor_id;
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
      prisma.order.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          delivery_fee: true,
          tax: true,
          discount: true,
          payment_method: true,
          payment_status: true,
          delivery_note: true,
          created_at: true,
          updated_at: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          vendor: { select: { id: true, business_name: true, slug: true, phone: true } },
          delivery_partner: {
            select: {
              id: true,
              user: { select: { name: true, phone: true } },
            },
          },
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
          _count: { select: { items: true } },
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
        },
      }),
      prisma.order.count({ where }),
    ]);

    return {
      rows: rows.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        total: Number(o.total),
        delivery_fee: Number(o.delivery_fee),
        tax: Number(o.tax),
        discount: Number(o.discount),
        payment_method: o.payment_method,
        payment_status: o.payment_status,
        delivery_note: o.delivery_note,
        created_at: o.created_at,
        updated_at: o.updated_at,
        customer: o.customer
          ? { id: o.customer.id, name: o.customer.name, email: o.customer.email, phone: o.customer.phone }
          : null,
        vendor: o.vendor
          ? { id: o.vendor.id, business_name: o.vendor.business_name, slug: o.vendor.slug, phone: o.vendor.phone }
          : null,
        delivery_partner: o.delivery_partner
          ? { id: o.delivery_partner.id, name: o.delivery_partner.user?.name ?? "Partner", phone: o.delivery_partner.user?.phone ?? null }
          : null,
        payment: o.payment
          ? {
              id: o.payment.id,
              method: o.payment.method,
              amount: Number(o.payment.amount),
              status: o.payment.status,
              refund_amount: o.payment.refund_amount ? Number(o.payment.refund_amount) : null,
              refund_status: o.payment.refund_status,
            }
          : null,
        item_count: o._count.items,
        items: o.items.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          image_url: i.image_url || i.product?.images?.[0]?.url || null,
          status: i.status,
        })),
      })),
      total,
      page,
      perPage,
    };
  },

  async getById(orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, deleted_at: null },
      select: {
        id: true,
        order_number: true,
        invoice_number: true,
        status: true,
        total: true,
        items_subtotal: true,
        delivery_fee: true,
        tax: true,
        discount: true,
        payment_method: true,
        payment_status: true,
        delivery_note: true,
        otp_code: true,
        created_at: true,
        updated_at: true,
        accepted_at: true,
        prepared_at: true,
        packed_at: true,
        picked_up_at: true,
        delivered_at: true,
        customer: { select: { id: true, name: true, email: true, phone: true, avatar_url: true } },
        vendor: {
          select: {
            id: true,
            business_name: true,
            slug: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        delivery_partner: {
          select: {
            id: true,
            vehicle_type: true,
            vehicle_number: true,
            user: { select: { name: true, phone: true } },
          },
        },
        address: {
          select: {
            id: true,
            label: true,
            full_address: true,
            landmark: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
            phone: true,
            latitude: true,
            longitude: true,
          },
        },
        payment: {
          select: {
            id: true,
            status: true,
            method: true,
            razorpay_order_id: true,
            razorpay_payment_id: true,
            amount: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unit_price: true,
            total_price: true,
            product_name: true,
            unit: true,
            status: true,
            image_url: true,
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
            },
          },
        },
        events: {
          orderBy: { created_at: "desc" },
          take: 20,
          select: {
            id: true,
            status: true,
            note: true,
            actor_type: true,
            created_at: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found.");
    }

    return {
      ...order,
      total: Number(order.total),
      items_subtotal: Number(order.items_subtotal),
      delivery_fee: Number(order.delivery_fee),
      tax: Number(order.tax),
      discount: Number(order.discount),
      payment: order.payment
        ? { ...order.payment, amount: Number(order.payment.amount) }
        : null,
      items: order.items.map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total_price: Number(i.total_price),
        product_name: i.product_name,
        unit: i.unit,
        image_url: i.image_url || i.product?.images?.[0]?.url || null,
        status: i.status,
      })),
    };
  },

  async updateStatus(
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

    // Admin overrides must trigger the same side effects as the primary flows:
    // CANCELLED runs the refund-first cancel saga, REFUNDED runs the refund-
    // first refund saga, and DELIVERED consumes inventory + creates earnings.
    // All other transitions are plain, machine-validated status updates.
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

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
        entityType: "order",
        entityId: orderId,
        oldValues: { status: order.status },
        newValues: { status: mappedStatus, reason },
      },
      req
    );

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
