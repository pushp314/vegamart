jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    vendorSubscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    subscriptionPayment: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../src/database/cache", () => ({
  cacheService: { invalidateNamespace: jest.fn() },
}));

jest.mock("../../src/services/audit.service", () => ({
  auditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/notification.service", () => ({
  notificationService: { vendor: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("../../src/services/membership-plan.service", () => ({
  membershipPlanService: {
    resolveExpiry: jest.fn(),
    getPlan: jest.fn(),
    applyPlanToVendor: jest.fn(),
    getMyMembership: jest.fn(),
  },
}));

jest.mock("../../src/payments/razorpay.gateway", () => ({
  razorpayGateway: {
    isConfigured: jest.fn(),
    createPlan: jest.fn(),
    createSubscription: jest.fn(),
    fetchSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    verifySubscriptionSignature: jest.fn(),
  },
  subscriptionScheduleFor: jest.fn(),
}));

jest.mock("../../src/repositories/settings.repository", () => ({
  getByKey: jest.fn().mockResolvedValue(null),
  upsertSetting: jest.fn().mockResolvedValue({ id: "s1" }),
}));

import prisma from "../../src/database/prisma";
import { razorpayGateway, subscriptionScheduleFor } from "../../src/payments/razorpay.gateway";
import { membershipPlanService } from "../../src/services/membership-plan.service";
import { subscriptionPaymentService } from "../../src/services/subscription-payment.service";

const db = prisma as any;
const gateway = razorpayGateway as jest.Mocked<typeof razorpayGateway>;
const membership = membershipPlanService as jest.Mocked<typeof membershipPlanService>;

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "p2",
    name: "Premium",
    slug: "premium",
    price: 499,
    billing_period: "monthly",
    ...overrides,
  };
}

function makeExisting(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub1",
    vendor_id: "v1",
    plan_id: "p1",
    status: "active",
    starts_at: new Date(),
    expires_at: null,
    auto_renew: true,
    razorpay_subscription_id: "sub_old123",
    payments: [],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  gateway.isConfigured.mockReturnValue(true);
  (subscriptionScheduleFor as jest.Mock).mockReturnValue({ period: "monthly", interval: 1, totalCount: 1200 });
  gateway.createPlan.mockResolvedValue({ id: "plan_rzp1" } as any);
  gateway.createSubscription.mockResolvedValue({ id: "sub_new456", short_url: "https://rzp.example/sub_new456" } as any);
  gateway.fetchSubscription.mockResolvedValue({ id: "sub_new456", short_url: "https://rzp.example/sub_new456" } as any);
  gateway.cancelSubscription.mockResolvedValue({ id: "sub_old123", status: "cancelled" } as any);
  membership.resolveExpiry.mockReturnValue(new Date("2027-01-01T00:00:00Z"));
  db.vendorSubscription.upsert.mockResolvedValue({ id: "sub1", plan_id: "p2" });
  db.vendorSubscription.update.mockResolvedValue({ id: "sub1", razorpay_subscription_id: "sub_new456" });
  db.subscriptionPayment.create.mockResolvedValue({ id: "pay1" });
  db.subscriptionPayment.updateMany.mockResolvedValue({ count: 1 });
});

describe("subscriptionPaymentService.initiate", () => {
  it("creates a fresh paid checkout when the vendor has no existing subscription", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(null);

    const result = await subscriptionPaymentService.initiate("v1", makePlan());

    expect(db.vendorSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan_id: "p2", status: "pending", auto_renew: true }),
      })
    );
    expect(gateway.createSubscription).toHaveBeenCalledTimes(1);
    expect(gateway.cancelSubscription).not.toHaveBeenCalled();
    expect(result.razorpay_subscription_id).toBe("sub_new456");
    expect(result.short_url).toBe("https://rzp.example/sub_new456");
  });

  it("cancels the existing active subscription before starting a plan-change checkout so only one sub is ever active", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(makeExisting());

    const result = await subscriptionPaymentService.initiate("v1", makePlan());

    expect(gateway.cancelSubscription).toHaveBeenCalledWith("sub_old123");
    expect(gateway.createSubscription).toHaveBeenCalledTimes(1);
    expect(db.subscriptionPayment.updateMany).not.toHaveBeenCalled();
    expect(result.razorpay_subscription_id).toBe("sub_new456");
  });

  it("fails pending payments of a superseded pending subscription", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(
      makeExisting({ status: "pending", payments: [{ id: "pay_old", status: "pending" }] })
    );

    await subscriptionPaymentService.initiate("v1", makePlan());

    expect(db.subscriptionPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["pay_old"] } },
        data: expect.objectContaining({ status: "failed", failed_reason: "Superseded by a new checkout." }),
      })
    );
  });

  it("rejects the new checkout when a live subscription cannot be cancelled (no two billable subs)", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(makeExisting());
    gateway.cancelSubscription.mockRejectedValue(new Error("already cancelled"));

    await expect(subscriptionPaymentService.initiate("v1", makePlan())).rejects.toMatchObject({
      code: "SUBSCRIPTION_SUPERSEDE_FAILED",
    });
    expect(gateway.createSubscription).not.toHaveBeenCalled();
  });

  it("tolerates a failed cancel for a stale pending subscription and still proceeds", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(
      makeExisting({ status: "pending", razorpay_subscription_id: "sub_stale", payments: [] })
    );
    gateway.cancelSubscription.mockRejectedValue(new Error("not found"));

    const result = await subscriptionPaymentService.initiate("v1", makePlan());

    expect(gateway.createSubscription).toHaveBeenCalledTimes(1);
    expect(result.razorpay_subscription_id).toBe("sub_new456");
  });

  it("skips cancel when the existing subscription is already canceled", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(
      makeExisting({ status: "canceled", razorpay_subscription_id: "sub_old123" })
    );

    await subscriptionPaymentService.initiate("v1", makePlan());

    expect(gateway.cancelSubscription).not.toHaveBeenCalled();
    expect(gateway.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("reuses an in-flight pending checkout for the SAME plan (idempotent retry)", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(
      makeExisting({
        status: "pending",
        plan_id: "p2",
        razorpay_subscription_id: "sub_existing",
        payments: [{ id: "pay1", status: "pending" }],
      })
    );

    const result = await subscriptionPaymentService.initiate("v1", makePlan());

    expect(gateway.cancelSubscription).not.toHaveBeenCalled();
    expect(gateway.createSubscription).not.toHaveBeenCalled();
    expect(result.razorpay_subscription_id).toBe("sub_existing");
  });

  it("does not reuse the checkout when the pending plan differs (old checkout superseded)", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(
      makeExisting({
        status: "pending",
        plan_id: "p1",
        razorpay_subscription_id: "sub_old",
        payments: [{ id: "pay1", status: "pending" }],
      })
    );

    const result = await subscriptionPaymentService.initiate("v1", makePlan());

    expect(gateway.createSubscription).toHaveBeenCalledTimes(1);
    expect(result.razorpay_subscription_id).toBe("sub_new456");
  });

  it("cleans up the newly created subscription if persistence fails after creation (no orphan)", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue(null);
    db.vendorSubscription.update.mockRejectedValue(new Error("db down"));

    await expect(subscriptionPaymentService.initiate("v1", makePlan())).rejects.toThrow("db down");
    expect(gateway.cancelSubscription).toHaveBeenCalledWith("sub_new456");
  });

  it("throws when payments are not configured", async () => {
    gateway.isConfigured.mockReturnValue(false);

    await expect(subscriptionPaymentService.initiate("v1", makePlan())).rejects.toMatchObject({
      code: "PAYMENTS_NOT_CONFIGURED",
    });
  });
});

describe("subscriptionPaymentService.verifyAndActivate", () => {
  const req = { user: { id: "u1" }, ip: "1.2.3.4" } as any;

  function makePayment(overrides: Record<string, unknown> = {}) {
    return {
      id: "pay1",
      subscription_id: "sub1",
      subscription: {
        id: "sub1",
        vendor_id: "v1",
        status: "pending",
        plan_id: "p2",
        vendor: { user_id: "u1" },
      },
      status: "pending",
      ...overrides,
    };
  }

  beforeEach(() => {
    gateway.verifySubscriptionSignature.mockReturnValue(true);
    gateway.fetchSubscription.mockResolvedValue({ id: "sub_new456", status: "active" } as any);
    membership.getPlan.mockResolvedValue(makePlan() as any);
    membership.applyPlanToVendor.mockResolvedValue({} as any);
    membership.getMyMembership.mockResolvedValue({
      tier: "premium",
      expires_at: new Date(),
      is_expired: false,
    } as any);
    db.subscriptionPayment.update.mockResolvedValue({ id: "pay1", status: "paid" } as any);
  });

  it("rejects verification for an unknown checkout", async () => {
    db.subscriptionPayment.findFirst.mockResolvedValue(null);

    await expect(
      subscriptionPaymentService.verifyAndActivate("v1", {
        razorpay_subscription_id: "x",
        razorpay_payment_id: "pay_x",
        razorpay_signature: "sig",
      }, req)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects verification for a cancelled subscription", async () => {
    db.subscriptionPayment.findFirst.mockResolvedValue({
      ...makePayment(),
      subscription: { ...(makePayment().subscription as any), status: "canceled" },
    } as any);

    await expect(
      subscriptionPaymentService.verifyAndActivate("v1", {
        razorpay_subscription_id: "sub_new456",
        razorpay_payment_id: "pay_x",
        razorpay_signature: "sig",
      }, req)
    ).rejects.toMatchObject({ code: "SUBSCRIPTION_CANCELED" });
  });

  it("activates membership and marks the payment paid when the signature is valid", async () => {
    db.subscriptionPayment.findFirst.mockResolvedValue(makePayment() as any);

    const result = await subscriptionPaymentService.verifyAndActivate("v1", {
      razorpay_subscription_id: "sub_new456",
      razorpay_payment_id: "pay_act",
      razorpay_signature: "sig",
    }, req);

    expect(membership.applyPlanToVendor).toHaveBeenCalledWith("v1", "p2", {});
    expect(db.subscriptionPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay1" },
        data: expect.objectContaining({ status: "paid", razorpay_payment_id: "pay_act" }),
      })
    );
    expect(result.membership.tier).toBe("premium");
  });

  it("returns the existing membership without re-processing when already paid", async () => {
    db.subscriptionPayment.findFirst.mockResolvedValue(makePayment({ status: "paid" }) as any);

    const result = await subscriptionPaymentService.verifyAndActivate("v1", {
      razorpay_subscription_id: "sub_new456",
      razorpay_payment_id: "pay_x",
      razorpay_signature: "sig",
    }, req);

    expect(membership.applyPlanToVendor).not.toHaveBeenCalled();
    expect(result.payment).toBeDefined();
  });

  it("rejects an invalid signature", async () => {
    gateway.verifySubscriptionSignature.mockReturnValue(false);
    db.subscriptionPayment.findFirst.mockResolvedValue(makePayment() as any);

    await expect(
      subscriptionPaymentService.verifyAndActivate("v1", {
        razorpay_subscription_id: "sub_new456",
        razorpay_payment_id: "pay_x",
        razorpay_signature: "bad",
      }, req)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });
});