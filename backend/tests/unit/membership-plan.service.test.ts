import { Prisma } from "@prisma/client";

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    vendorProfile: {
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    vendorSubscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    subscriptionHistory: {
      create: jest.fn(),
    },
  },
}));

jest.mock("../../src/repositories/membership-plan.repository", () => ({
  findById: jest.fn(),
  findBySlug: jest.fn(),
  listAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  countVendorsOnPlan: jest.fn(),
}));

import prisma from "../../src/database/prisma";
import { membershipPlanService } from "../../src/services/membership-plan.service";

const db = prisma as any;

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Premium",
    slug: "premium",
    description: null,
    price: new Prisma.Decimal(499),
    billing_period: "monthly",
    features: [],
    product_limit: 100,
    daily_order_limit: 50,
    commission_rate: new Prisma.Decimal(3),
    includes_sponsorship: true,
    is_active: true,
    sort_order: 2,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  db.vendorProfile.update.mockResolvedValue({ id: "v1" });
  db.vendorSubscription.findUnique.mockResolvedValue(null);
  db.vendorSubscription.upsert.mockResolvedValue({ id: "sub1", plan_id: "p1" });
  db.subscriptionHistory.create.mockResolvedValue({ id: "h1" });
});

describe("membershipPlanService.applyPlanToVendor", () => {
  it("assigns a plan without overriding vendor's commission_rate", async () => {
    const membershipRepo = jest.requireMock("../../src/repositories/membership-plan.repository");
    membershipRepo.findById.mockResolvedValue(makePlan());

    const result = await membershipPlanService.applyPlanToVendor("v1", "p1", {});

    expect(db.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({
        membership_tier: "premium",
        membership_plan: { connect: { id: "p1" } },
        commission_rate: undefined,
        is_sponsored: true,
      }),
      include: expect.anything(),
    });
    expect(db.vendorSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ plan_id: "p1", status: "active" }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ id: "v1" }));
    expect(db.subscriptionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "created",
          new_plan_id: "p1",
          previous_plan_id: null,
        }),
      })
    );
  });

  it("leaves commission_rate untouched when a plan is removed without explicit commission input", async () => {
    const result = await membershipPlanService.applyPlanToVendor("v1", null, {});

    expect(db.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({
        membership_tier: "basic",
        membership_plan: { disconnect: true },
        commission_rate: undefined,
        is_sponsored: false,
      }),
      include: expect.anything(),
    });
    expect(result).toEqual(expect.objectContaining({ id: "v1" }));
  });

  it("updates commission_rate when explicitly supplied by admin", async () => {
    await membershipPlanService.applyPlanToVendor("v1", "p1", { commission_rate: 12 });

    expect(db.vendorProfile.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: expect.objectContaining({ commission_rate: 12 }),
      include: expect.anything(),
    });
  });

  it("records a history entry when an existing subscription is canceled on removal", async () => {
    db.vendorSubscription.findUnique.mockResolvedValue({ id: "sub_old", plan_id: "p1", status: "active" });

    await membershipPlanService.applyPlanToVendor("v1", null, {});

    expect(db.vendorSubscription.update).toHaveBeenCalledWith({
      where: { vendor_id: "v1" },
      data: expect.objectContaining({ status: "canceled", auto_renew: false }),
    });
    expect(db.subscriptionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "canceled",
          previous_plan_id: "p1",
          new_plan_id: null,
        }),
      })
    );
  });

  it("marks subscription history as upgraded when moving to a higher-tier plan", async () => {
    const membershipRepo = jest.requireMock("../../src/repositories/membership-plan.repository");
    membershipRepo.findById.mockResolvedValue(makePlan());
    db.vendorSubscription.findUnique.mockResolvedValue({ id: "sub1", plan_id: "p0" });
    db.vendorSubscription.upsert.mockResolvedValue({ id: "sub1", plan_id: "p1" });

    await membershipPlanService.applyPlanToVendor("v1", "p1", {});

    expect(db.subscriptionHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "upgraded",
          previous_plan_id: "p0",
          new_plan_id: "p1",
        }),
      })
    );
  });
});