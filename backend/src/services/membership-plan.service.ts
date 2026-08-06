import { Prisma } from "@prisma/client";
import { HttpStatus } from "../utils/httpStatus";
import { ApiError } from "../utils/ApiError";

import * as planRepo from "../repositories/membership-plan.repository";
import prisma from "../database/prisma";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function expiryFromBillingPeriod(period: string): Date | null {
  if (period === "lifetime") return null;
  const now = new Date();
  const next = new Date(now);
  if (period === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else if (period === "quarterly") {
    next.setMonth(next.getMonth() + 3);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export interface AssignPlanInput {
  membership_plan_id?: string | null;
  membership_tier?: string | null;
  membership_expires_at?: string | null;
  commission_rate?: number | null;
}

export const membershipPlanService = {
  async listPlans(includeInactive = false) {
    return planRepo.listAll(includeInactive);
  },

  async getPlan(id: string) {
    const plan = await planRepo.findById(id);
    if (!plan) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Membership plan not found.", { code: "NOT_FOUND" });
    }
    return plan;
  },

  async createPlan(input: {
    name: string;
    slug?: string;
    description?: string | null;
    price: number;
    billing_period: string;
    features: string[];
    product_limit: number;
    daily_order_limit?: number;
    commission_rate: number;
    includes_sponsorship: boolean;
    is_active: boolean;
    sort_order?: number;
  }) {
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
    if (await planRepo.findBySlug(slug)) {
      throw new ApiError(HttpStatus.CONFLICT, "A plan with this slug already exists.", {
        code: "PLAN_SLUG_TAKEN",
      });
    }
    return planRepo.create({
      name: input.name.trim(),
      slug,
      description: input.description ?? null,
      price: input.price,
      billing_period: input.billing_period,
      features: input.features as Prisma.InputJsonValue,
      product_limit: input.product_limit,
      daily_order_limit: input.daily_order_limit ?? 5,
      commission_rate: input.commission_rate,
      includes_sponsorship: input.includes_sponsorship,
      is_active: input.is_active,
      sort_order: input.sort_order ?? 0,
    });
  },

  async updatePlan(
    id: string,
    input: Partial<{
      name: string;
      slug?: string;
      description?: string | null;
      price: number;
      billing_period: string;
      features: string[];
      product_limit: number;
      daily_order_limit?: number;
      commission_rate: number;
      includes_sponsorship: boolean;
      is_active: boolean;
      sort_order: number;
    }>
  ) {
    await this.getPlan(id);

    const data: Prisma.VendorMembershipPlanUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      const existing = await planRepo.findBySlug(slug);
      if (existing && existing.id !== id) {
        throw new ApiError(HttpStatus.CONFLICT, "A plan with this slug already exists.", {
          code: "PLAN_SLUG_TAKEN",
        });
      }
      data.slug = slug;
    }
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) data.price = input.price;
    if (input.billing_period !== undefined) data.billing_period = input.billing_period;
    if (input.features !== undefined) data.features = input.features as Prisma.InputJsonValue;
    if (input.product_limit !== undefined) data.product_limit = input.product_limit;
    if (input.daily_order_limit !== undefined) data.daily_order_limit = input.daily_order_limit;
    if (input.commission_rate !== undefined) data.commission_rate = input.commission_rate;
    if (input.includes_sponsorship !== undefined)
      data.includes_sponsorship = input.includes_sponsorship;
    if (input.is_active !== undefined) data.is_active = input.is_active;
    if (input.sort_order !== undefined) data.sort_order = input.sort_order;

    return planRepo.update(id, data);
  },

  async deletePlan(id: string) {
    const plan = await this.getPlan(id);
    const vendorCount = await planRepo.countVendorsOnPlan(id);
    if (vendorCount > 0) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        `This plan is assigned to ${vendorCount} vendor(s). Deactivate it instead of deleting.`,
        { code: "PLAN_IN_USE" }
      );
    }
    return planRepo.remove(plan.id);
  },

  resolveExpiry(plan: { billing_period: string }, inputExpiry?: string | null): Date | null {
    if (inputExpiry !== undefined) {
      return inputExpiry ? new Date(inputExpiry) : null;
    }
    return expiryFromBillingPeriod(plan.billing_period);
  },

  async applyPlanToVendor(
    vendorId: string,
    planId: string | null | undefined,
    input: AssignPlanInput
  ) {
    let plan: planRepo.MembershipPlanRow | null = null;
    if (planId) {
      plan = await this.getPlan(planId);
    }

    const expiry = plan
      ? this.resolveExpiry(plan, input.membership_expires_at)
      : input.membership_expires_at
        ? new Date(input.membership_expires_at)
        : null;

    const data: Prisma.VendorProfileUpdateInput = {
      membership_plan: plan
        ? { connect: { id: plan.id } }
        : planId === null
          ? { disconnect: true }
          : undefined,
      membership_tier: plan
        ? plan.slug
        : input.membership_tier !== undefined && input.membership_tier !== null
          ? input.membership_tier
          : "basic",
      membership_expires_at: expiry,
      commission_rate:
        plan?.commission_rate !== undefined
          ? plan.commission_rate
          : input.commission_rate !== undefined && input.commission_rate !== null
            ? input.commission_rate
            : undefined,
      is_sponsored:
        plan?.includes_sponsorship !== undefined
          ? plan.includes_sponsorship
          : undefined,
    };

    const updated = await prisma.vendorProfile.update({
      where: { id: vendorId },
      data,
      include: {
        membership_plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            billing_period: true,
            features: true,
            product_limit: true,
            daily_order_limit: true,
            sort_order: true,
            commission_rate: true,
            includes_sponsorship: true,
          },
        },
      },
    });

    if (plan) {
      const activeSub = await prisma.vendorSubscription.findUnique({
        where: { vendor_id: vendorId },
        include: { plan: { select: { sort_order: true } } }
      });

      const subscription = await prisma.vendorSubscription.upsert({
        where: { vendor_id: vendorId },
        update: {
          plan_id: plan.id,
          status: "active",
          expires_at: expiry,
          updated_at: new Date()
        },
        create: {
          vendor_id: vendorId,
          plan_id: plan.id,
          status: "active",
          starts_at: new Date(),
          expires_at: expiry,
        }
      });

      let action = "created";
      if (activeSub) {
        if (activeSub.status === "pending") {
          action = "created";
        } else if (activeSub.plan_id === plan.id) {
          action = "renewed";
        } else {
          const previousTier = activeSub.plan?.sort_order ?? 0;
          action = plan.sort_order > previousTier ? "upgraded" : "downgraded";
        }
      }

      await prisma.subscriptionHistory.create({
        data: {
          subscription_id: subscription.id,
          action,
          previous_plan_id: activeSub?.plan_id || null,
          new_plan_id: plan.id
        }
      });
    } else if (planId === null) {
      const activeSub = await prisma.vendorSubscription.findUnique({
        where: { vendor_id: vendorId }
      });
      if (activeSub) {
        await prisma.vendorSubscription.update({
          where: { vendor_id: vendorId },
          data: { status: "canceled", auto_renew: false }
        });
        await prisma.subscriptionHistory.create({
          data: {
            subscription_id: activeSub.id,
            action: "canceled",
            previous_plan_id: activeSub.plan_id,
            new_plan_id: null
          }
        });
      }
    }

    return updated;
  },

  async getMyMembership(vendorId: string) {
    const vendor = await prisma.vendorProfile.findFirst({
      where: { id: vendorId, deleted_at: null },
      select: {
        membership_tier: true,
        membership_expires_at: true,
        commission_rate: true,
        is_sponsored: true,
        membership_plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            billing_period: true,
            features: true,
            product_limit: true,
            daily_order_limit: true,
            sort_order: true,
            commission_rate: true,
            includes_sponsorship: true,
          },
        },
        subscription: true,
      },
    });
    if (!vendor) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Vendor not found.", { code: "NOT_FOUND" });
    }

    const isExpired =
      vendor.membership_expires_at !== null &&
      vendor.membership_expires_at.getTime() <= Date.now();

    return {
      tier: vendor.membership_tier,
      plan: vendor.membership_plan,
      subscription: vendor.subscription,
      expires_at: vendor.membership_expires_at,
      is_expired: isExpired,
      commission_rate: vendor.commission_rate,
      is_sponsored: vendor.is_sponsored,
    };
  },
};
