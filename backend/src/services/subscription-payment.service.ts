import type { Request } from "express";

import { env } from "../config";
import log from "../config/logger";
import prisma from "../database/prisma";
import { cacheService } from "../database/cache";
import { auditService } from "./audit.service";
import { notificationService } from "./notification.service";
import { membershipPlanService } from "./membership-plan.service";
import { razorpayGateway, subscriptionScheduleFor } from "../payments/razorpay.gateway";
import { ApiError } from "../utils/ApiError";
import { HttpStatus } from "../utils/httpStatus";
import { getByKey, upsertSetting } from "../repositories/settings.repository";

const PLAN_CACHE_KEY_PREFIX = "razorpay_plan";
const SUBSCRIPTION_SUCCESS_STATUSES = new Set(["active", "completed", "authenticated"]);

type PlanLike = {
  id: string;
  name: string;
  slug: string;
  price: { toNumber(): number } | number;
  billing_period: string;
};

async function resolveRazorpayPlanId(plan: PlanLike): Promise<string> {
  const price = typeof plan.price === "number" ? plan.price : plan.price.toNumber();
  const settingKey = `${PLAN_CACHE_KEY_PREFIX}:${plan.id}:${price}:${plan.billing_period}`;
  const cached = await getByKey(settingKey);
  if (cached && typeof cached.value === "object" && cached.value && "razorpay_plan_id" in cached.value) {
    return String((cached.value as { razorpay_plan_id: string }).razorpay_plan_id);
  }

  const schedule = subscriptionScheduleFor(plan.billing_period);
  const rzpPlan = await razorpayGateway.createPlan({
    name: `Vegamart ${plan.name}`,
    amountPaise: Math.round(price * 100),
    period: schedule.period,
    interval: schedule.interval,
    description: `Vegamart ${plan.name} membership (${plan.billing_period})`,
  });

  await upsertSetting({
    key: settingKey,
    value: { razorpay_plan_id: rzpPlan.id },
    type: "json",
    description: `Razorpay plan mapping for membership plan ${plan.id}`,
  });
  return rzpPlan.id;
}

async function findPaymentByRazorpaySubscription(subscriptionId: string) {
  return prisma.subscriptionPayment.findFirst({
    where: { razorpay_subscription_id: subscriptionId },
    include: { subscription: { include: { vendor: true } } },
  });
}

export const subscriptionPaymentService = {
  async initiate(vendorId: string, plan: PlanLike): Promise<{
    razorpay_subscription_id: string;
    short_url: string | null;
    key_id: string;
    amount: number;
    currency: string;
    billing_period: string;
  }> {
    if (!razorpayGateway.isConfigured()) {
      throw new ApiError(HttpStatus.BAD_GATEWAY, "Online payments are not configured. Please contact support.", {
        code: "PAYMENTS_NOT_CONFIGURED",
      });
    }

    const price = typeof plan.price === "number" ? plan.price : plan.price.toNumber();
    const schedule = subscriptionScheduleFor(plan.billing_period);
    const razorpayPlanId = await resolveRazorpayPlanId(plan);
    const expiry = membershipPlanService.resolveExpiry(plan);

    const existingPending = await prisma.vendorSubscription.findUnique({
      where: { vendor_id: vendorId },
      include: { payments: { where: { status: "pending" }, take: 1 } },
    });

    if (existingPending?.status === "pending") {
      await prisma.subscriptionPayment.updateMany({
        where: { id: { in: existingPending.payments.map((p) => p.id) } },
        data: { status: "failed", failed_reason: "Superseded by a new checkout." },
      });
      if (existingPending.razorpay_subscription_id) {
        try {
          await razorpayGateway.cancelSubscription(existingPending.razorpay_subscription_id);
        } catch (error) {
          log.warn(`[subscription] Could not cancel superseded razorpay subscription ${existingPending.razorpay_subscription_id}`, {
            context: "subscription",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const subscription = await prisma.vendorSubscription.upsert({
      where: { vendor_id: vendorId },
      update: {
        plan_id: plan.id,
        status: "pending",
        expires_at: expiry,
        auto_renew: true,
        updated_at: new Date(),
      },
      create: {
        vendor_id: vendorId,
        plan_id: plan.id,
        status: "pending",
        starts_at: new Date(),
        expires_at: expiry,
        auto_renew: true,
      },
    });

    const rzpSubscription = await razorpayGateway.createSubscription({
      planId: razorpayPlanId,
      totalCount: schedule.totalCount,
      notes: { vendor_id: vendorId, plan_id: plan.id, subscription_id: subscription.id },
    });

    await prisma.vendorSubscription.update({
      where: { id: subscription.id },
      data: { razorpay_subscription_id: rzpSubscription.id },
    });

    await prisma.subscriptionPayment.create({
      data: {
        subscription_id: subscription.id,
        amount: price,
        currency: "INR",
        status: "pending",
        payment_method: "razorpay",
        razorpay_subscription_id: rzpSubscription.id,
      },
    });

    await cacheService.invalidateNamespace("vendor");
    return {
      razorpay_subscription_id: rzpSubscription.id,
      short_url: rzpSubscription.short_url ?? null,
      key_id: env.RAZORPAY_KEY_ID,
      amount: price,
      currency: "INR",
      billing_period: plan.billing_period,
    };
  },

  async verifyAndActivate(
    vendorId: string,
    input: { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string },
    req: Request
  ) {
    const payment = await findPaymentByRazorpaySubscription(input.razorpay_subscription_id);
    if (!payment || payment.subscription.vendor_id !== vendorId) {
      throw new ApiError(HttpStatus.NOT_FOUND, "Subscription checkout not found.", { code: "NOT_FOUND" });
    }
    if (payment.subscription.status === "canceled") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "This subscription was canceled.", { code: "SUBSCRIPTION_CANCELED" });
    }
    if (payment.status === "paid") {
      return { payment, membership: await membershipPlanService.getMyMembership(vendorId) };
    }

    const valid = razorpayGateway.verifySubscriptionSignature({
      paymentId: input.razorpay_payment_id,
      subscriptionId: input.razorpay_subscription_id,
      signature: input.razorpay_signature,
    });
    if (!valid) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid payment signature.", { code: "INVALID_SIGNATURE" });
    }

    const rzpSubscription = await razorpayGateway.fetchSubscription(input.razorpay_subscription_id);
    if (!SUBSCRIPTION_SUCCESS_STATUSES.has(rzpSubscription.status)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, `Subscription is not active (status: ${rzpSubscription.status}).`, {
        code: "SUBSCRIPTION_NOT_ACTIVE",
      });
    }

    const plan = await membershipPlanService.getPlan(payment.subscription.plan_id);
    await membershipPlanService.applyPlanToVendor(vendorId, plan.id, {});

    const paidPayment = await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: {
        status: "paid",
        razorpay_payment_id: input.razorpay_payment_id,
        razorpay_signature: input.razorpay_signature,
        gateway_response: { subscription_status: rzpSubscription.status } as never,
      },
    });

    await cacheService.invalidateNamespace("vendor");
    await cacheService.invalidateNamespace("product");

    const membership = await membershipPlanService.getMyMembership(vendorId);
    const expiryLabel = membership.expires_at
      ? ` until ${new Date(membership.expires_at).toLocaleDateString()}`
      : "";
    await notificationService.vendor(
      payment.subscription.vendor.user_id,
      `Membership activated: ${plan.name}`,
      `Your ${plan.name} plan is now active${expiryLabel}. Enjoy your new features.`,
      {
        vendor_id: vendorId,
        plan_id: plan.id,
        tier: plan.slug,
        expires_at: membership.expires_at?.toISOString() ?? null,
      }
    );

    await auditService.record(
      {
        userId: payment.subscription.vendor.user_id,
        action: "VENDOR_MEMBERSHIP_PURCHASED",
        entityType: "vendor",
        entityId: vendorId,
        newValues: { membership_plan_id: plan.id, membership_tier: plan.slug, razorpay_subscription_id: input.razorpay_subscription_id },
      },
      req
    );

    return { payment: paidPayment, membership };
  },

  async handleSubscriptionWebhook(event: string, subscriptionEntity: Record<string, unknown>, paymentEntity?: Record<string, unknown> | null): Promise<boolean> {
    const rzpSubscriptionId = subscriptionEntity.id as string | undefined;
    if (!rzpSubscriptionId) return false;

    const subscription = await prisma.vendorSubscription.findUnique({
      where: { razorpay_subscription_id: rzpSubscriptionId },
      include: { vendor: { select: { user_id: true } } },
    });
    if (!subscription) {
      log.warn(`[subscription] Webhook for unknown razorpay subscription ${rzpSubscriptionId}`, { context: "subscription" });
      return false;
    }

    switch (event) {
      case "subscription.charged": {
        const rzpPaymentId = paymentEntity?.id as string | undefined;
        if (rzpPaymentId) {
          const existing = await prisma.subscriptionPayment.findUnique({ where: { razorpay_payment_id: rzpPaymentId } });
          if (existing) return true;
        }
        const plan = await membershipPlanService.getPlan(subscription.plan_id);
        await membershipPlanService.applyPlanToVendor(subscription.vendor_id, plan.id, {});

        const paymentStatus = (subscriptionEntity.status as string) ?? "active";
        await prisma.subscriptionPayment.upsert({
          where: { razorpay_subscription_id: rzpSubscriptionId },
          update: {
            status: "paid",
            payment_method: "razorpay",
            razorpay_payment_id: rzpPaymentId ?? null,
            gateway_response: paymentEntity as never,
            failed_reason: null,
          },
          create: {
            subscription_id: subscription.id,
            amount: plan.price,
            currency: "INR",
            status: "paid",
            payment_method: "razorpay",
            razorpay_subscription_id: rzpSubscriptionId,
            razorpay_payment_id: rzpPaymentId ?? null,
            gateway_response: paymentEntity as never,
          },
        });
        await cacheService.invalidateNamespace("vendor");
        await cacheService.invalidateNamespace("product");

        const active = SUBSCRIPTION_SUCCESS_STATUSES.has(paymentStatus) || subscription.status !== "pending";
        await notificationService.vendor(
          subscription.vendor.user_id,
          active ? "Subscription payment received" : "Subscription activated",
          active
            ? `Your ${plan.name} plan was charged successfully.`
            : `Your ${plan.name} plan is now active.`,
          { vendor_id: subscription.vendor_id, plan_id: plan.id, razorpay_subscription_id: rzpSubscriptionId }
        );
        break;
      }
      case "subscription.activated":
        await prisma.vendorSubscription.update({
          where: { id: subscription.id },
          data: { status: "active", auto_renew: true },
        });
        await cacheService.invalidateNamespace("vendor");
        break;
      case "subscription.completed":
        await prisma.vendorSubscription.update({
          where: { id: subscription.id },
          data: { status: "completed", auto_renew: false },
        });
        await cacheService.invalidateNamespace("vendor");
        break;
      case "subscription.cancelled":
        await prisma.vendorSubscription.update({
          where: { id: subscription.id },
          data: { status: "canceled", auto_renew: false },
        });
        await cacheService.invalidateNamespace("vendor");
        break;
      case "subscription.paused":
        await prisma.vendorSubscription.update({
          where: { id: subscription.id },
          data: { status: "halted" },
        });
        break;
      case "subscription.resumed":
        await prisma.vendorSubscription.update({
          where: { id: subscription.id },
          data: { status: "active", auto_renew: true },
        });
        break;
      default:
        return false;
    }
    return true;
  },

  async markPaymentFailed(rzpSubscriptionId: string, failureReason?: string | null): Promise<void> {
    const payment = await prisma.subscriptionPayment.findFirst({
      where: { razorpay_subscription_id: rzpSubscriptionId, status: "pending" },
    });
    if (payment) {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: "failed", failed_reason: failureReason ?? "Payment failed." },
      });
    }
  },

  async cancelPaidSubscription(vendorId: string): Promise<void> {
    const subscription = await prisma.vendorSubscription.findUnique({ where: { vendor_id: vendorId } });
    if (subscription?.razorpay_subscription_id) {
      try {
        await razorpayGateway.cancelSubscription(subscription.razorpay_subscription_id);
      } catch (error) {
        log.error(`[subscription] Failed to cancel razorpay subscription ${subscription.razorpay_subscription_id}`, {
          context: "subscription",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await membershipPlanService.applyPlanToVendor(vendorId, null, {});
    await cacheService.invalidateNamespace("vendor");
    await cacheService.invalidateNamespace("product");
  },
};
