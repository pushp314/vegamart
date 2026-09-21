import type { Request } from "express";
import { Prisma } from "@prisma/client";
import type { OrderStatus, MasterOrderStatus } from "@prisma/client";

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import { NotFoundError, ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { parseDateParam } from "../utils/time";
import { generateInvoiceNumber } from "../utils/order";
import * as orderRepo from "../repositories/order.repository";
import {
  assertOrderTransition,
  cancelOrderLifecycle,
  refundOrderLifecycle,
} from "./order-lifecycle.service";
import { completeDelivery } from "./order-delivery.service";
import { notificationService } from "./notification.service";
import { realtime } from "../realtime/realtime";

export function mapStatusToPrisma(inputStatus: string): { subStatus: OrderStatus; masterStatus: MasterOrderStatus } {
  const s = String(inputStatus || "").trim().toUpperCase();
  switch (s) {
    case "PENDING":
    case "BOOKED":
    case "BOOKING":
      return { subStatus: "PENDING", masterStatus: "PENDING" };
    case "CONFIRMED":
    case "ACCEPTED":
      return { subStatus: "CONFIRMED", masterStatus: "ACCEPTED" };
    case "PREPARING":
    case "PROCESSING":
      return { subStatus: "PREPARING", masterStatus: "ACCEPTED" };
    case "PACKED":
      return { subStatus: "PACKED", masterStatus: "ACCEPTED" };
    case "READY_FOR_PICKUP":
      return { subStatus: "READY_FOR_PICKUP", masterStatus: "PICKUP_IN_PROGRESS" };
    case "PICKED_UP":
      return { subStatus: "PICKED_UP", masterStatus: "PICKUP_IN_PROGRESS" };
    case "OUT_FOR_DELIVERY":
      return { subStatus: "OUT_FOR_DELIVERY", masterStatus: "OUT_FOR_DELIVERY" };
    case "DELIVERED":
      return { subStatus: "DELIVERED", masterStatus: "DELIVERED" };
    case "CANCELLED":
      return { subStatus: "CANCELLED", masterStatus: "CANCELLED" };
    case "REFUNDED":
      return { subStatus: "REFUNDED", masterStatus: "REFUNDED" };
    case "RETURNED":
      return { subStatus: "RETURNED", masterStatus: "REFUNDED" };
    case "FAILED":
      return { subStatus: "FAILED", masterStatus: "FAILED" };
    default:
      return { subStatus: "PENDING", masterStatus: "PENDING" };
  }
}

export function computeEffectiveMasterStatus(masterStatus: string, subStatuses: string[]): string {
  if (["DELIVERED", "CANCELLED", "REFUNDED", "FAILED"].includes(masterStatus)) {
    return masterStatus;
  }
  if (!subStatuses || subStatuses.length === 0) {
    if (masterStatus === "ACCEPTED") return "CONFIRMED";
    return masterStatus;
  }
  if (
    subStatuses.every((s) => ["DELIVERED", "CANCELLED", "REFUNDED", "FAILED"].includes(s)) &&
    subStatuses.some((s) => s === "DELIVERED")
  ) {
    return "DELIVERED";
  }
  if (masterStatus === "OUT_FOR_DELIVERY" || subStatuses.some((s) => s === "OUT_FOR_DELIVERY")) {
    return "OUT_FOR_DELIVERY";
  }
  if (subStatuses.some((s) => ["READY_FOR_PICKUP", "PICKED_UP", "PICKUP_IN_PROGRESS"].includes(s))) {
    return "READY_FOR_PICKUP";
  }
  if (subStatuses.some((s) => s === "PACKED")) {
    return "PACKED";
  }
  if (subStatuses.some((s) => s === "PREPARING")) {
    return "PREPARING";
  }
  if (subStatuses.some((s) => s === "CONFIRMED")) {
    return "CONFIRMED";
  }
  if (masterStatus === "ACCEPTED") {
    return "CONFIRMED";
  }
  return masterStatus;
}

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

    if (query.status && query.status.toUpperCase() !== "ALL") {
      const s = query.status.toUpperCase();
      const validMasterStatuses = [
        "PENDING",
        "ACCEPTED",
        "PICKUP_IN_PROGRESS",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
        "FAILED",
      ];
      if (s === "CONFIRMED") {
        where.OR = [
          { status: "ACCEPTED" },
          { orders: { some: { status: "CONFIRMED" } } },
        ];
      } else if (s === "PREPARING") {
        where.orders = { some: { status: "PREPARING" } };
      } else if (s === "PACKED") {
        where.orders = { some: { status: "PACKED" } };
      } else if (s === "READY_FOR_PICKUP") {
        where.orders = { some: { status: "READY_FOR_PICKUP" } };
      } else if (validMasterStatuses.includes(s)) {
        where.OR = [
          { status: s as any },
          { orders: { some: { status: s as any } } },
        ];
      } else {
        where.orders = { some: { status: s as any } };
      }
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
          platform_fee: true,
          additional_charges: true,
          payment_method: true,
          payment_status: true,
          created_at: true,
          updated_at: true,
          customer: { select: { id: true, name: true, email: true, phone: true } },
          delivery_partner: {
            select: {
              id: true,
              vehicle_type: true,
              vehicle_number: true,
              user: { select: { name: true, phone: true } },
            },
          },
          orders: {
            select: {
              id: true,
              order_number: true,
              invoice_number: true,
              discount: true,
              status: true,
              delivery_note: true,
              eta_minutes: true,
              delivery_partner: {
                select: {
                  id: true,
                  vehicle_type: true,
                  vehicle_number: true,
                  user: { select: { name: true, phone: true } },
                },
              },
              payment: {
                select: {
                  id: true,
                  method: true,
                  amount: true,
                  status: true,
                  razorpay_order_id: true,
                  razorpay_payment_id: true,
                  refund_amount: true,
                  refund_status: true,
                },
              },
              items: {
                select: {
                  product_name: true,
                  unit: true,
                  quantity: true,
                  unit_price: true,
                  total_price: true,
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
              vendor: {
                select: {
                  id: true,
                  business_name: true,
                  phone: true,
                  address: true,
                  city: true,
                  state: true,
                  pincode: true,
                  latitude: true,
                  longitude: true,
                },
              },
            }
          }
        },
      }),
      prisma.masterOrder.count({ where }),
    ]);

    const mappedRows = rows.map((m) => {
        const firstOrder = m.orders[0];
        const items = m.orders.flatMap((o) => o.items);
        const vendors = m.orders.map((o) => o.vendor);
        const subPartners = m.orders.map((o) => o.delivery_partner).filter(Boolean);
        const activeEtaMinutes = m.orders.find((o) => o.eta_minutes != null)?.eta_minutes || firstOrder?.eta_minutes || null;

        let partner = m.delivery_partner
          ? {
              id: m.delivery_partner.id,
              name: m.delivery_partner.user?.name ?? "Partner",
              phone: m.delivery_partner.user?.phone ?? null,
              vehicle_type: m.delivery_partner.vehicle_type,
              vehicle_number: m.delivery_partner.vehicle_number,
            }
          : null;

        if (!partner && subPartners.length > 0) {
          const uniquePartnerIds = new Set(subPartners.map((p) => p!.id));
          if (uniquePartnerIds.size === 1) {
            const p = subPartners[0]!;
            partner = {
              id: p.id,
              name: p.user?.name ?? "Partner",
              phone: p.user?.phone ?? null,
              vehicle_type: p.vehicle_type,
              vehicle_number: p.vehicle_number,
            };
          } else {
            partner = {
              id: "multiple",
              name: `${uniquePartnerIds.size} Partners`,
              phone: null,
              vehicle_type: "Multi-Store",
              vehicle_number: "",
            };
          }
        }

        const effectiveStatus = computeEffectiveMasterStatus(
          m.status,
          m.orders.map((o) => o.status)
        );

        const masterDiscount = m.orders.reduce((sum, o) => sum + Number(o.discount || 0), 0);
        const invoiceNumber = firstOrder?.invoice_number || generateInvoiceNumber(m.order_number);

        return {
          id: m.id,
          order_number: m.order_number,
          invoice_number: invoiceNumber,
          status: effectiveStatus,
          raw_master_status: m.status,
          total: Number(m.total_amount),
          delivery_fee: Number(m.delivery_fee),
          tax: Number(m.tax),
          discount: masterDiscount,
          platform_fee: Number(m.platform_fee || 0),
          additional_charges: m.additional_charges || [],
          payment_method: m.payment_method,
          payment_status: m.payment_status,
          delivery_note: firstOrder?.delivery_note,
          delivery_slot: firstOrder?.delivery_note,
          delivery_option: firstOrder?.delivery_note,
          eta_minutes: activeEtaMinutes,
          created_at: m.created_at,
          updated_at: m.updated_at,
          customer: m.customer
            ? { id: m.customer.id, name: m.customer.name, email: m.customer.email, phone: m.customer.phone }
            : null,
          vendors: vendors.length > 0 ? vendors : null,
          vendor: vendors.length === 1 ? vendors[0] : { business_name: `${vendors.length} Stores`, phone: null, id: 'multiple' },
          delivery_partner: partner,
          payment: firstOrder?.payment
            ? {
                id: firstOrder.payment.id,
                method: firstOrder.payment.method,
                amount: Number(firstOrder.payment.amount),
                status: firstOrder.payment.status,
                razorpay_order_id: firstOrder.payment.razorpay_order_id || null,
                razorpay_payment_id: firstOrder.payment.razorpay_payment_id || null,
                refund_amount: firstOrder.payment.refund_amount ? Number(firstOrder.payment.refund_amount) : null,
                refund_status: firstOrder.payment.refund_status,
              }
            : null,
          item_count: items.length,
          items: items.map((i) => ({
            product_name: i.product_name,
            unit: i.unit,
            quantity: i.quantity,
            unit_price: Number(i.unit_price),
            total_price: Number(i.total_price),
            image_url: i.image_url || i.product?.images?.[0]?.url || null,
            status: i.status,
          })),
        };
      });

    return {
      rows: mappedRows,
      data: mappedRows,
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
        payment: true,
        orders: {
          include: {
            vendor: true,
            delivery_partner: {
              select: {
                id: true,
                vehicle_type: true,
                vehicle_number: true,
                user: { select: { name: true, phone: true } },
              },
            },
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
        id: o.id,
        order_number: o.order_number,
        invoice_number: o.invoice_number || generateInvoiceNumber(o.order_number),
        status: o.status,
        vendor: o.vendor,
        total: o.total.toNumber(),
        items_subtotal: o.items_subtotal ? o.items_subtotal.toNumber() : 0,
        delivery_fee: o.delivery_fee ? o.delivery_fee.toNumber() : 0,
        tax: o.tax ? o.tax.toNumber() : 0,
        discount: o.discount ? o.discount.toNumber() : 0,
        commission,
        vendorEarnings,
        eta_minutes: o.eta_minutes ?? null,
        delivery_partner: o.delivery_partner
          ? {
              id: o.delivery_partner.id,
              name: o.delivery_partner.user?.name ?? "Partner",
              phone: o.delivery_partner.user?.phone ?? null,
              vehicle_type: o.delivery_partner.vehicle_type,
              vehicle_number: o.delivery_partner.vehicle_number,
              user: o.delivery_partner.user
                ? { name: o.delivery_partner.user.name, phone: o.delivery_partner.user.phone }
                : null,
            }
          : null,
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

    const subPartners = mOrder.orders.map((o) => o.delivery_partner).filter(Boolean);
    let masterPartner = mOrder.delivery_partner
      ? {
          id: mOrder.delivery_partner.id,
          name: mOrder.delivery_partner.user?.name ?? "Partner",
          phone: mOrder.delivery_partner.user?.phone ?? null,
          vehicle_type: mOrder.delivery_partner.vehicle_type,
          vehicle_number: mOrder.delivery_partner.vehicle_number,
          user: mOrder.delivery_partner.user
            ? { name: mOrder.delivery_partner.user.name, phone: mOrder.delivery_partner.user.phone }
            : null,
        }
      : null;

    if (!masterPartner && subPartners.length > 0) {
      const uniquePartnerIds = new Set(subPartners.map((p) => p!.id));
      if (uniquePartnerIds.size === 1) {
        const p = subPartners[0]!;
        masterPartner = {
          id: p.id,
          name: p.user?.name ?? "Partner",
          phone: p.user?.phone ?? null,
          vehicle_type: p.vehicle_type,
          vehicle_number: p.vehicle_number,
          user: p.user ? { name: p.user.name, phone: p.user.phone } : null,
        };
      } else {
        masterPartner = {
          id: "multiple",
          name: `${uniquePartnerIds.size} Partners`,
          phone: null,
          vehicle_type: "Multi-Store",
          vehicle_number: "",
          user: null,
        };
      }
    }

    const itemsSubtotal = items
      .filter((i: any) => i.status !== "rejected")
      .reduce((sum: number, i: any) => sum + Number(i.unit_price) * Number(i.quantity), 0);

    const effectiveStatus = computeEffectiveMasterStatus(
      mOrder.status,
      mOrder.orders.map((o) => o.status)
    );

    const activePayment = mOrder.payment || firstOrder?.payment;
    const masterDiscount = mOrder.orders.reduce((sum, o) => sum + Number(o.discount || 0), 0);
    const invoiceNumber = firstOrder?.invoice_number || generateInvoiceNumber(mOrder.order_number);
    const activeCouponCode = (firstOrder as any)?.coupon?.code || (firstOrder as any)?.coupon_id || (mOrder as any).coupon_code || null;

    return {
      id: mOrder.id,
      order_number: mOrder.order_number,
      invoice_number: invoiceNumber,
      status: effectiveStatus,
      raw_master_status: mOrder.status,
      total: Number(mOrder.total_amount),
      items_subtotal: itemsSubtotal,
      delivery_fee: Number(mOrder.delivery_fee),
      tax: Number(mOrder.tax),
      platform_fee: Number(mOrder.platform_fee || 0),
      additional_charges: mOrder.additional_charges || [],
      discount: masterDiscount,
      coupon_code: activeCouponCode,
      payment_method: mOrder.payment_method,
      payment_status: mOrder.payment_status,
      delivery_note: firstOrder?.delivery_note,
      delivery_slot: firstOrder?.delivery_note,
      delivery_option: firstOrder?.delivery_note,
      otp_code: firstOrder?.otp_code,
      eta_minutes: mOrder.orders.find((o) => o.eta_minutes != null)?.eta_minutes || firstOrder?.eta_minutes || null,
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
      delivery_partner: masterPartner,
      address: mOrder.address,
      sub_orders: subOrders, // Store-wise breakdown
      payment: activePayment
        ? {
            id: activePayment.id,
            method: activePayment.method,
            amount: Number(activePayment.amount),
            status: activePayment.status,
            razorpay_order_id: activePayment.razorpay_order_id || null,
            razorpay_payment_id: activePayment.razorpay_payment_id || null,
            refund_amount: activePayment.refund_amount ? Number(activePayment.refund_amount) : null,
            refund_status: activePayment.refund_status || null,
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

    const { subStatus: mappedSubStatus, masterStatus: mappedMasterStatus } = mapStatusToPrisma(status);

    const currentEffective = computeEffectiveMasterStatus(
      masterOrder.status,
      masterOrder.orders.map((o) => o.status)
    );

    if (currentEffective === mappedSubStatus && masterOrder.status === mappedMasterStatus) {
      return await this.getById(orderId);
    }

    const now = new Date();

    if (mappedSubStatus === "CANCELLED") {
       // cancel all suborders
       for (const order of masterOrder.orders) {
          if (order.status !== "CANCELLED" && order.status !== "DELIVERED") {
              const fullOrder = await orderRepo.findById(order.id);
              if (fullOrder) {
                await cancelOrderLifecycle({
                  order: fullOrder,
                  reason: reason ?? "Cancelled by admin",
                  actorType: "admin",
                  actorId: adminUserId,
                  req,
                });
              }
          }
       }
       await prisma.masterOrder.update({
         where: { id: masterOrder.id },
         data: { status: "CANCELLED" }
       });
    } else if (mappedSubStatus === "REFUNDED") {
       for (const order of masterOrder.orders) {
          if (order.status !== "REFUNDED") {
              const fullOrder = await orderRepo.findById(order.id);
              if (fullOrder) {
                await refundOrderLifecycle({
                  order: fullOrder,
                  reason: reason ?? "Refunded by admin",
                  actorType: "admin",
                  actorId: adminUserId,
                  req,
                });
              }
          }
       }
       await prisma.masterOrder.update({
         where: { id: masterOrder.id },
         data: { status: "REFUNDED" }
       });
    } else if (mappedSubStatus === "DELIVERED") {
       // Force deliver all active suborders
       for (const order of masterOrder.orders) {
         if (order.status !== "DELIVERED" && order.status !== "CANCELLED") {
           try {
             await completeDelivery({
               orderId: order.id,
               otp: "",
               skipOtp: true,
               allowedStates: [
                 "PENDING",
                 "CONFIRMED",
                 "PREPARING",
                 "PACKED",
                 "READY_FOR_PICKUP",
                 "PICKED_UP",
                 "OUT_FOR_DELIVERY",
               ],
               note: reason ?? "Force delivered by admin.",
               actorType: "admin",
               actorId: adminUserId,
             });
           } catch {
             await prisma.order.update({
               where: { id: order.id },
               data: {
                 status: "DELIVERED",
                 delivered_at: now,
                 otp_code: null,
               },
             });
             await prisma.orderEvent.create({
               data: {
                 order_id: order.id,
                 status: "DELIVERED",
                 note: reason ?? "Force delivered by admin.",
                 actor_type: "admin",
                 actor_id: adminUserId,
               },
             });
           }
         }
       }
       await prisma.masterOrder.update({
         where: { id: masterOrder.id },
         data: { status: "DELIVERED", payment_status: "PAID" },
       });
       await prisma.payment.updateMany({
         where: { master_order_id: masterOrder.id, status: "PENDING" },
         data: { status: "PAID" },
       }).catch(() => {});
    } else {
       await prisma.$transaction(async (tx) => {
         await tx.masterOrder.update({
           where: { id: masterOrder.id },
           data: { status: mappedMasterStatus }
         });

         for (const order of masterOrder.orders) {
            if (order.status === "DELIVERED" || order.status === "CANCELLED") {
              continue;
            }

            const updateData: Prisma.OrderUpdateInput = {
              status: mappedSubStatus,
            };
            if (mappedSubStatus === "CONFIRMED") updateData.accepted_at = now;
            if (mappedSubStatus === "PREPARING") updateData.prepared_at = now;
            if (mappedSubStatus === "PACKED") updateData.packed_at = now;
            if (mappedSubStatus === "OUT_FOR_DELIVERY") updateData.picked_up_at = now;

            await tx.order.update({
              where: { id: order.id },
              data: updateData,
            });

            await tx.orderEvent.create({
              data: {
                order_id: order.id,
                status: mappedSubStatus,
                note: reason ?? `Admin updated status to ${mappedSubStatus}.`,
                actor_type: "admin",
                actor_id: adminUserId,
              }
            });

            if (mappedSubStatus === "OUT_FOR_DELIVERY") {
              await tx.deliveryTracking.upsert({
                where: { order_id: order.id },
                update: { status: "OUT_FOR_DELIVERY" as never },
                create: { order_id: order.id, status: "OUT_FOR_DELIVERY" as never },
              }).catch(() => {});
            }
         }
       });
    }

    // Customer Notification
    const statusMessages: Record<string, { title: string; body: string }> = {
      CONFIRMED: {
        title: "Order confirmed ✅",
        body: `Your order #${masterOrder.order_number} has been confirmed!`,
      },
      PREPARING: {
        title: "Order being prepared 🍳",
        body: `Your order #${masterOrder.order_number} is being prepared.`,
      },
      PACKED: {
        title: "Order packed 📦",
        body: `Your order #${masterOrder.order_number} has been packed.`,
      },
      READY_FOR_PICKUP: {
        title: "Ready for pickup 🏪",
        body: `Your order #${masterOrder.order_number} is ready for pickup!`,
      },
      OUT_FOR_DELIVERY: {
        title: "Out for delivery 🛵",
        body: `Your order #${masterOrder.order_number} is on its way!`,
      },
      DELIVERED: {
        title: "Order delivered 🎉",
        body: `Your order #${masterOrder.order_number} has been delivered. Enjoy!`,
      },
      CANCELLED: {
        title: "Order cancelled ❌",
        body: `Your order #${masterOrder.order_number} has been cancelled.`,
      },
    };

    const msg = statusMessages[mappedSubStatus];
    if (msg && masterOrder.user_id) {
      await notificationService.orderStatus(
        masterOrder.user_id,
        masterOrder.order_number,
        msg.title,
        msg.body,
        { order_id: masterOrder.id }
      ).catch(() => {});
    }

    // Real-time broadcast
    realtime.publishOrderStatus(masterOrder.id, mappedSubStatus);
    for (const order of masterOrder.orders) {
      realtime.publishOrderStatus(order.id, mappedSubStatus);
    }

    await auditService.record(
      {
        userId: adminUserId,
        action: AUDIT_ACTIONS.ORDER_STATUS_CHANGED,
        entityType: "masterOrder",
        entityId: orderId,
        oldValues: { status: masterOrder.status, effectiveStatus: currentEffective },
        newValues: { status: mappedMasterStatus, subStatus: mappedSubStatus, reason },
      },
      req
    );

    return await this.getById(orderId);
  },
  
  async updateSubOrderStatus(
    adminUserId: string,
    orderId: string,
    status: string,
    reason: string | null,
    req: Request
  ) {
    let subOrders = (await prisma.order.findMany({
      where: {
        OR: [{ id: orderId }, { master_order_id: orderId }],
        deleted_at: null,
      },
    })) || [];

    if (subOrders.length === 0) {
      const masterOrder = await prisma.masterOrder.findUnique({
        where: { id: orderId },
        include: { orders: { where: { deleted_at: null } } },
      });
      if (masterOrder && masterOrder.orders && masterOrder.orders.length > 0) {
        subOrders = masterOrder.orders;
      } else {
        const singleOrder = await prisma.order.findUnique({
          where: { id: orderId, deleted_at: null },
        });
        if (singleOrder) {
          subOrders = [singleOrder];
        }
      }
    }

    if (subOrders.length === 0) {
      throw new NotFoundError("Order not found.");
    }

    const { subStatus: mappedStatus, masterStatus: mappedMasterStatus } = mapStatusToPrisma(status);

    let lastUpdated: any = null;
    for (const order of subOrders) {
      if (order.status === mappedStatus) {
        lastUpdated = order;
        continue;
      }

      assertOrderTransition(order.status, mappedStatus);

      if (mappedStatus === "CANCELLED") {
        const detail = await orderRepo.findById(order.id);
        if (detail) {
          lastUpdated = await cancelOrderLifecycle({
            order: detail,
            reason: reason ?? "Cancelled by admin",
            actorType: "admin",
            actorId: adminUserId,
            req,
          });
        }
      } else if (mappedStatus === "REFUNDED") {
        const detail = await orderRepo.findById(order.id);
        if (detail) {
          lastUpdated = await refundOrderLifecycle({
            order: detail,
            reason: reason ?? "Refunded by admin",
            actorType: "admin",
            actorId: adminUserId,
            req,
          });
        }
      } else if (mappedStatus === "DELIVERED") {
        lastUpdated = await completeDelivery({
          orderId: order.id,
          otp: "",
          allowedStates: ["PENDING", "CONFIRMED", "PREPARING", "PACKED", "READY_FOR_PICKUP", "PICKED_UP", "OUT_FOR_DELIVERY"],
          note: reason ?? "Order marked as delivered by admin.",
          actorType: "admin",
          actorId: adminUserId,
          skipOtp: true,
        });
      } else {
        lastUpdated = await orderRepo.updateOrderStatus(order.id, {
          status: mappedStatus,
          note: reason ?? `Admin updated status to ${mappedStatus}.`,
          actorType: "admin",
          actorId: adminUserId,
        });
      }
    }

    for (const o of subOrders) {
      realtime.publishOrderStatus(o.id, mappedStatus);
      if (o.master_order_id) {
        realtime.publishOrderStatus(o.master_order_id, mappedStatus);
      }
    }

    const masterId = subOrders[0]?.master_order_id || (subOrders[0]?.id === orderId ? null : orderId);
    if (masterId) {
      try {
        await prisma.masterOrder.update({
          where: { id: masterId },
          data: { status: mappedMasterStatus },
        });
      } catch {
        // Best-effort update of masterOrder status
      }
    }

    return lastUpdated || subOrders[0];
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
