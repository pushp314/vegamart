import type { Request } from "express";
import { Prisma } from "@prisma/client";

import prisma from "../database/prisma";
import { AUDIT_ACTIONS } from "../constants/auth";
import { auditService } from "./audit.service";
import * as deliveryRepo from "../repositories/delivery.repository";
import { cacheService } from "../database/cache";
import { ApiError, NotFoundError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";

export const deliveryService = {
  async getMyStats(userId: string) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalDeliveries,
      todayDeliveries,
      activeDeliveries,
      totalEarningsAgg,
      todayEarningsAgg,
      weeklyEarningsAgg,
      monthlyEarningsAgg,
      pendingEarningsAgg,
      recentDeliveries,
    ] = await Promise.all([
      prisma.order.count({
        where: { delivery_partner_id: partner.id, status: "DELIVERED", deleted_at: null },
      }),
      prisma.order.count({
        where: {
          delivery_partner_id: partner.id,
          status: "DELIVERED",
          updated_at: { gte: startOfDay },
          deleted_at: null,
        },
      }),
      prisma.order.count({
        where: {
          delivery_partner_id: partner.id,
          status: { in: ["PICKED_UP", "OUT_FOR_DELIVERY"] },
          deleted_at: null,
        },
      }),
      prisma.deliveryEarning.aggregate({
        where: { delivery_partner_id: partner.id },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfWeek },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: {
          delivery_partner_id: partner.id,
          created_at: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.deliveryEarning.aggregate({
        where: { delivery_partner_id: partner.id, status: "PENDING" },
        _sum: { amount: true },
      }),
      prisma.order.findMany({
        where: { delivery_partner_id: partner.id, deleted_at: null },
        orderBy: { updated_at: "desc" },
        take: 10,
        select: {
          id: true,
          order_number: true,
          status: true,
          total: true,
          delivery_fee: true,
          updated_at: true,
          vendor: { select: { business_name: true } },
        },
      }),
    ]);

    return {
      partner: {
        id: partner.id,
        rating: partner.rating,
        review_count: partner.review_count,
        is_available: partner.is_available,
        availability_status: partner.availability_status,
      },
      stats: {
        total_deliveries: totalDeliveries,
        today_deliveries: todayDeliveries,
        active_deliveries: activeDeliveries,
        total_earnings: Number(totalEarningsAgg._sum?.amount ?? 0),
        today_earnings: Number(todayEarningsAgg._sum?.amount ?? 0),
        weekly_earnings: Number(weeklyEarningsAgg._sum?.amount ?? 0),
        monthly_earnings: Number(monthlyEarningsAgg._sum?.amount ?? 0),
        pending_earnings: Number(pendingEarningsAgg._sum?.amount ?? 0),
      },
      recent_deliveries: recentDeliveries.map((d) => ({
        id: d.id,
        order_number: d.order_number,
        status: d.status.toLowerCase(),
        total: Number(d.total),
        delivery_fee: Number(d.delivery_fee),
        vendor_name: d.vendor?.business_name ?? "Vendor",
        updated_at: d.updated_at,
      })),
    };
  },

  async getMyEarnings(userId: string, query: { period?: string; page?: number; per_page?: number }) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const page = Math.max(1, query.page ?? 1);
    const perPage = Math.min(100, Math.max(1, query.per_page ?? 20));

    let dateFilter: Date | undefined;
    const now = new Date();
    if (query.period === "today") {
      dateFilter = new Date(now);
      dateFilter.setHours(0, 0, 0, 0);
    } else if (query.period === "week") {
      dateFilter = new Date(now);
      dateFilter.setDate(now.getDate() - 7);
    } else if (query.period === "month") {
      dateFilter = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const where: Prisma.DeliveryEarningWhereInput = {
      delivery_partner_id: partner.id,
    };
    if (dateFilter) {
      where.created_at = { gte: dateFilter };
    }

    const [earnings, total, totalAgg] = await Promise.all([
      prisma.deliveryEarning.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        select: {
          id: true,
          amount: true,
          status: true,
          type: true,
          created_at: true,
          order: {
            select: {
              id: true,
              order_number: true,
              total: true,
              vendor: { select: { business_name: true } },
            },
          },
        },
      }),
      prisma.deliveryEarning.count({ where }),
      prisma.deliveryEarning.aggregate({ where, _sum: { amount: true } }),
    ]);

    return {
      earnings: earnings.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        status: e.status.toLowerCase(),
        type: e.type.toLowerCase(),
        order_number: e.order?.order_number ?? null,
        order_total: e.order ? Number(e.order.total) : null,
        vendor_name: e.order?.vendor?.business_name ?? null,
        created_at: e.created_at,
      })),
      summary: {
        total_earnings: Number(totalAgg._sum?.amount ?? 0),
        period: query.period ?? "all",
      },
      pagination: {
        page,
        per_page: perPage,
        total,
        total_pages: Math.ceil(total / perPage),
      },
    };
  },

  async setAvailability(userId: string, isAvailable: boolean, req: Request) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }
    if (partner.status !== "APPROVED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Delivery partner must be approved.", {
        code: "DELIVERY_NOT_APPROVED",
      });
    }

    const availabilityStatus = isAvailable ? "ONLINE" : "OFFLINE";
    const updated = await deliveryRepo.updateDelivery(partner.id, {
      is_available: isAvailable,
      availability_status: availabilityStatus,
    });

    await cacheService.invalidateNamespace("delivery");
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: { is_available: isAvailable, availability_status: availabilityStatus },
      },
      req
    );

    return {
      id: updated.id,
      is_available: updated.is_available,
      availability_status: updated.availability_status,
    };
  },

  async updateProfile(userId: string, input: Record<string, unknown>, req: Request) {
    const partner = await deliveryRepo.findByUserId(userId);
    if (!partner) {
      throw new NotFoundError("Delivery partner profile not found.");
    }

    const allowed = ["vehicle_type", "vehicle_number", "license_number"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in input && input[key] !== undefined) {
        data[key] = input[key];
      }
    }

    if (Object.keys(data).length === 0) {
      return partner;
    }

    const updated = await deliveryRepo.updateDelivery(partner.id, data as never);
    await cacheService.invalidateNamespace("delivery");
    await auditService.record(
      {
        userId,
        action: AUDIT_ACTIONS.DELIVERY_REGISTERED,
        entityType: "delivery",
        entityId: partner.id,
        newValues: data,
      },
      req
    );

    return updated;
  },
};
