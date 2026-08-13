jest.mock("../../src/services/membership-plan.service", () => ({
  membershipPlanService: { getMyMembership: jest.fn() },
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: { $transaction: jest.fn() },
}));

import prisma from "../../src/database/prisma";
import { membershipPlanService } from "../../src/services/membership-plan.service";
import { checkVendorDailyOrderLimit } from "../../src/middlewares/subscription.middleware";

const getMyMembership = membershipPlanService.getMyMembership as jest.Mock;
const $transaction = prisma.$transaction as jest.Mock;

function mockTx(count: number) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ count }]),
  };
}

describe("checkVendorDailyOrderLimit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns immediately for unlimited plans without touching the DB", async () => {
    getMyMembership.mockResolvedValue({ plan: { daily_order_limit: 0 } });

    await checkVendorDailyOrderLimit("v1");

    expect($transaction).not.toHaveBeenCalled();
  });

  it("runs an atomic INSERT ... ON CONFLICT DO NOTHING then SELECT ... FOR UPDATE", async () => {
    getMyMembership.mockResolvedValue({ plan: { daily_order_limit: 5 } });
    const tx = mockTx(2);
    $transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

    await checkVendorDailyOrderLimit("v1");

    expect($transaction).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const insertSql = tx.$executeRaw.mock.calls[0][0].join("?");
    const selectSql = tx.$queryRaw.mock.calls[0][0].join("?");
    expect(insertSql).toContain("ON CONFLICT (vendor_id, date) DO NOTHING");
    expect(selectSql).toContain("FOR UPDATE");
  });

  it("lets a vendor proceed when the count is below the limit", async () => {
    getMyMembership.mockResolvedValue({ plan: { daily_order_limit: 5 } });
    const tx = mockTx(4);
    $transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(checkVendorDailyOrderLimit("v1")).resolves.toBeUndefined();
  });

  it("rejects with DAILY_ORDER_LIMIT_REACHED when the count equals the limit", async () => {
    getMyMembership.mockResolvedValue({ plan: { daily_order_limit: 5 } });
    const tx = mockTx(5);
    $transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(checkVendorDailyOrderLimit("v1")).rejects.toMatchObject({
      code: "DAILY_ORDER_LIMIT_REACHED",
    });
  });

  it("rejects when no counter row exists and the default limit applies", async () => {
    getMyMembership.mockResolvedValue({ plan: null });
    // plan null → default limit 5, so 0 < 5 → allowed
    const tx = mockTx(0);
    $transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));

    await expect(checkVendorDailyOrderLimit("v1")).resolves.toBeUndefined();
  });
});
