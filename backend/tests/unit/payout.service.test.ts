import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { payoutService } from "../../src/services/payout.service";
import { razorpayGateway } from "../../src/payments/razorpay.gateway";
import { settingsService } from "../../src/services/settings.service";
import prisma from "../../src/database/prisma";

jest.mock("../../src/payments/razorpay.gateway", () => ({
  razorpayGateway: {
    isConfigured: jest.fn(),
    createLinkedAccount: jest.fn(),
    transferToLinkedAccount: jest.fn(),
    createDirectPayout: jest.fn(),
  },
}));

jest.mock("../../src/services/settings.service", () => ({
  settingsService: {
    getAllSettings: jest.fn(),
  },
}));

jest.mock("../../src/database/prisma", () => ({
  __esModule: true,
  default: {
    vendorProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    vendorEarning: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("payoutService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("syncVendorLinkedAccount", () => {
    it("creates a Razorpay linked account when gateway is configured and mandatory fields are provided", async () => {
      (razorpayGateway.isConfigured as any).mockReturnValue(true);
      (prisma.vendorProfile.findUnique as any).mockResolvedValue({
        id: "v-1",
        user_id: "u-1",
        business_name: "Fresh Veggies",
        owner_name: "Ramesh Kumar",
        phone: "+919876543210",
        user: { name: "Ramesh", email: "ramesh@example.com", phone: "+919876543210" },
        razorpay_account_id: null,
      });

      (razorpayGateway.createLinkedAccount as any).mockResolvedValue({
        id: "acc_123456",
        type: "route",
        status: "created",
      });

      (prisma.vendorProfile.update as any).mockResolvedValue({});

      const accountId = await payoutService.syncVendorLinkedAccount("v-1", {
        bank_account_number: "123456789012",
        bank_ifsc: "HDFC0001234",
        bank_account_holder_name: "Ramesh Kumar",
      });

      expect(accountId).toBe("acc_123456");
      expect(razorpayGateway.createLinkedAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          accountNumber: "123456789012",
          ifscCode: "HDFC0001234",
          beneficiaryName: "Ramesh Kumar",
        })
      );
      expect(prisma.vendorProfile.update).toHaveBeenCalledWith({
        where: { id: "v-1" },
        data: { razorpay_account_id: "acc_123456" },
      });
    });

    it("returns null if Razorpay is not configured", async () => {
      (razorpayGateway.isConfigured as any).mockReturnValue(false);
      (prisma.vendorProfile.findUnique as any).mockResolvedValue({
        id: "v-1",
        user: { name: "Ramesh", email: "ramesh@example.com" },
        razorpay_account_id: null,
      });

      const accountId = await payoutService.syncVendorLinkedAccount("v-1", {
        bank_account_number: "123456789012",
        bank_ifsc: "HDFC0001234",
      });

      expect(accountId).toBeNull();
      expect(razorpayGateway.createLinkedAccount).not.toHaveBeenCalled();
    });
  });

  describe("settleVendorOrderEarnings", () => {
    it("skips transfer when vendor wallet is disabled in Admin Settings", async () => {
      (settingsService.getAllSettings as any).mockResolvedValue({
        "platform.vendor_wallet_enabled": false,
      });

      const result = await payoutService.settleVendorOrderEarnings("order-1", "pay-1");
      expect(result.settled).toBe(false);
      expect(result.reason).toBe("WALLET_DISABLED_BY_ADMIN");
      expect(razorpayGateway.transferToLinkedAccount).not.toHaveBeenCalled();
    });

    it("keeps earnings in escrow hold instead of immediately transferring (FLAW 6 FIX)", async () => {
      (settingsService.getAllSettings as any).mockResolvedValue({
        "platform.vendor_wallet_enabled": true,
        "platform.vendor_payout_mode": "razorpay_route",
      });

      (prisma.vendorEarning.findFirst as any).mockResolvedValue({
        id: "earn-1",
        order_id: "order-1",
        vendor_id: "v-1",
        amount: { toString: () => "450.00" },
        status: "PENDING",
      });

      const result = await payoutService.settleVendorOrderEarnings("order-1", "pay-1");

      // Earnings should stay in PENDING escrow — no immediate transfer
      expect(result.settled).toBe(false);
      expect(result.reason).toBe("IN_ESCROW_HOLD");
      expect(razorpayGateway.transferToLinkedAccount).not.toHaveBeenCalled();
      expect(prisma.vendorEarning.update).not.toHaveBeenCalled();
    });
  });
});
