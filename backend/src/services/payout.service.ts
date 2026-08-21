import log from "../config/logger";
import prisma from "../database/prisma";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { settingsService } from "./settings.service";
import { SETTING_KEYS } from "../constants/settings";

export interface VendorBankInput {
  bank_account_number?: string | null;
  bank_ifsc?: string | null;
  bank_account_holder_name?: string | null;
  bank_name?: string | null;
  upi_id?: string | null;
}

export const payoutService = {
  /**
   * Synchronizes or creates a Razorpay Route Linked Sub-Merchant Account
   * for a vendor when valid bank credentials are provided.
   */
  async syncVendorLinkedAccount(vendorId: string, bankInput: VendorBankInput) {
    const rawVendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!rawVendor) return null;
    const vendor = rawVendor as any;

    const accountNumber = bankInput.bank_account_number || vendor.bank_account_number;
    const ifscCode = bankInput.bank_ifsc || vendor.bank_ifsc;
    const beneficiaryName =
      bankInput.bank_account_holder_name ||
      vendor.bank_account_holder_name ||
      vendor.owner_name ||
      vendor.business_name;

    // Only attempt Razorpay Linked Account creation if gateway is configured,
    // mandatory bank fields are present, and account is not already linked.
    if (!razorpayGateway.isConfigured() || !accountNumber || !ifscCode || !beneficiaryName) {
      return null;
    }

    if (vendor.razorpay_account_id) {
      return vendor.razorpay_account_id as string;
    }

    try {
      const linked = await razorpayGateway.createLinkedAccount({
        name: vendor.owner_name || vendor.user?.name || vendor.business_name,
        email: vendor.user?.email || "",
        phone: vendor.phone || vendor.user?.phone || undefined,
        businessName: vendor.business_name,
        accountNumber,
        ifscCode,
        beneficiaryName,
        notes: {
          vendor_id: vendor.id,
          user_id: vendor.user_id,
        },
      });

      if (linked?.id) {
        await prisma.vendorProfile.update({
          where: { id: vendor.id },
          data: { razorpay_account_id: linked.id } as any,
        });

        log.info(`[payout] Created Razorpay Linked Account ${linked.id} for vendor ${vendor.id}`);
        return linked.id;
      }
    } catch (err: any) {
      log.warn(`[payout] Could not create Razorpay linked account for vendor ${vendor.id}: ${err.message}`);
    }

    return null;
  },

  /**
   * Transfers the vendor's net share for a paid order via Razorpay Route,
   * respecting the Admin Wallet feature toggle.
   */
  async settleVendorOrderEarnings(orderId: string, paymentId?: string | null) {
    // 1. Check Admin Feature Switch
    const settings = await settingsService.getAllSettings();
    const isWalletEnabled = settings[SETTING_KEYS.VENDOR_WALLET_ENABLED] !== false;

    if (!isWalletEnabled) {
      log.info(`[payout] Vendor wallet/payout feature is disabled in Admin Settings. Skipping automatic transfer for order ${orderId}.`);
      return { settled: false, reason: "WALLET_DISABLED_BY_ADMIN" };
    }

    const payoutMode = (settings[SETTING_KEYS.VENDOR_PAYOUT_MODE] as string) || "razorpay_route";

    const earning = await prisma.vendorEarning.findFirst({
      where: { order_id: orderId, type: "ORDER_COMMISSION" },
      include: { vendor: true, order: true },
    });

    if (!earning) {
      return { settled: false, reason: "NO_EARNING_FOUND" };
    }

    if (earning.status === "SETTLED") {
      return { settled: true, alreadySettled: true };
    }

    const vendor = (earning as any).vendor;
    const netPaise = Math.round(Number(earning.amount) * 100);
    if (netPaise <= 0) {
      await prisma.vendorEarning.update({
        where: { id: earning.id },
        data: { status: "SETTLED" },
      });
      return { settled: true, amount: 0 };
    }

    // If Razorpay Route is active and order was paid online with a gateway payment ID
    if (payoutMode === "razorpay_route" && paymentId && vendor?.razorpay_account_id && razorpayGateway.isConfigured()) {
      try {
        const transferRes = await razorpayGateway.transferToLinkedAccount(paymentId, {
          accountId: vendor.razorpay_account_id,
          amountPaise: netPaise,
          currency: "INR",
          notes: {
            order_id: orderId,
            vendor_id: earning.vendor_id,
            earning_id: earning.id,
          },
        });

        await prisma.vendorEarning.update({
          where: { id: earning.id },
          data: { status: "SETTLED" },
        });

        log.info(`[payout] Transferred ₹${Number(earning.amount)} to vendor ${earning.vendor_id} linked account ${vendor.razorpay_account_id}`);
        return { settled: true, transfer: transferRes };
      } catch (err: any) {
        log.error(`[payout] Route transfer failed for order ${orderId}: ${err.message}`);
        return { settled: false, reason: err.message };
      }
    }

    // In manual or sandbox mode without linked accounts, keep as SETTLED in ledger
    if (!razorpayGateway.isConfigured() || !vendor?.razorpay_account_id) {
      await prisma.vendorEarning.update({
        where: { id: earning.id },
        data: { status: "SETTLED" },
      });
      return { settled: true, mode: "LEDGER_ONLY" };
    }

    return { settled: false, reason: "PENDING_ACCOUNT_LINK" };
  },

  /**
   * Retrieves high-level payout metrics across all vendors for the Admin Payouts Hub.
   */
  async getPayoutSummary() {
    const [pendingAgg, settledAgg, pendingVendorsCount, totalLinkedAccounts] = await Promise.all([
      prisma.vendorEarning.aggregate({
        where: { status: "PENDING" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.vendorEarning.aggregate({
        where: { status: "SETTLED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.vendorEarning.groupBy({
        by: ["vendor_id"],
        where: { status: "PENDING" },
      }),
      prisma.vendorProfile.count({
        where: {
          OR: [
            { bank_account_number: { not: null } },
            { razorpay_account_id: { not: null } },
            { upi_id: { not: null } },
          ],
        } as any,
      }),
    ]);

    return {
      total_pending_amount: Number(pendingAgg._sum.amount ?? 0),
      total_pending_records: pendingAgg._count.id ?? 0,
      total_settled_amount: Number(settledAgg._sum.amount ?? 0),
      total_settled_records: settledAgg._count.id ?? 0,
      vendors_awaiting_payout: pendingVendorsCount.length,
      total_linked_accounts: totalLinkedAccounts,
    };
  },

  /**
   * Lists all vendors with pending payout balances, banking credentials, and eligibility.
   */
  async getVendorsWithPendingPayouts() {
    const pendingEarnings = await prisma.vendorEarning.findMany({
      where: { status: "PENDING" },
      include: {
        vendor: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
    });

    const vendorMap = new Map<string, any>();

    for (const earn of pendingEarnings) {
      const v = (earn as any).vendor;
      if (!v) continue;

      if (!vendorMap.has(v.id)) {
        vendorMap.set(v.id, {
          vendor_id: v.id,
          business_name: v.business_name,
          owner_name: v.owner_name || v.user?.name || "Vendor Owner",
          phone: v.phone || v.user?.phone || "",
          email: v.user?.email || "",
          bank_account_number: v.bank_account_number || null,
          bank_ifsc: v.bank_ifsc || null,
          bank_account_holder_name: v.bank_account_holder_name || null,
          bank_name: v.bank_name || null,
          upi_id: v.upi_id || null,
          razorpay_account_id: v.razorpay_account_id || null,
          payout_enabled: v.payout_enabled !== false,
          has_valid_bank: Boolean(v.bank_account_number && v.bank_ifsc),
          pending_amount: 0,
          unsettled_orders_count: 0,
        });
      }

      const item = vendorMap.get(v.id)!;
      item.pending_amount = Math.round((item.pending_amount + Number(earn.amount)) * 100) / 100;
      item.unsettled_orders_count += 1;
    }

    return Array.from(vendorMap.values()).sort((a, b) => b.pending_amount - a.pending_amount);
  },

  /**
   * Disburses pending earnings for a specific vendor.
   */
  async disburseVendorPayout(
    vendorId: string,
    options?: {
      mode?: "DIRECT_TRANSFER" | "MANUAL_SETTLE";
      reference?: string;
      adminUserId?: string;
    }
  ) {
    const mode = options?.mode || "MANUAL_SETTLE";
    const ref = options?.reference || `PAYOUT-${Date.now()}-${vendorId.slice(0, 6).toUpperCase()}`;

    const vendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const pendingEarnings = await prisma.vendorEarning.findMany({
      where: { vendor_id: vendorId, status: "PENDING" },
    });

    if (pendingEarnings.length === 0) {
      return { success: true, settled_count: 0, total_amount: 0, message: "No pending earnings found." };
    }

    const totalAmount = pendingEarnings.reduce((sum, e) => sum + Number(e.amount), 0);
    const roundedTotal = Math.round(totalAmount * 100) / 100;

    // Execute atomic settlement
    await prisma.vendorEarning.updateMany({
      where: {
        vendor_id: vendorId,
        status: "PENDING",
      },
      data: {
        status: "SETTLED",
      },
    });

    log.info(`[payout] Admin disbursed ₹${roundedTotal} to vendor ${vendorId} via ${mode} (Ref: ${ref})`);

    return {
      success: true,
      vendor_id: vendorId,
      vendor_name: vendor.business_name,
      settled_count: pendingEarnings.length,
      total_amount: roundedTotal,
      reference: ref,
      mode,
    };
  },

  /**
   * Batch disburses all pending vendor earnings.
   */
  async disburseAllPendingPayouts(options?: { adminUserId?: string; reference?: string }) {
    const vendors = await this.getVendorsWithPendingPayouts();
    const results = [];

    for (const v of vendors) {
      if (v.pending_amount > 0) {
        const res = await this.disburseVendorPayout(v.vendor_id, {
          mode: "MANUAL_SETTLE",
          reference: options?.reference,
          adminUserId: options?.adminUserId,
        });
        results.push(res);
      }
    }

    const totalDisbursed = results.reduce((sum, r) => sum + r.total_amount, 0);

    return {
      success: true,
      vendors_count: results.length,
      total_disbursed: Math.round(totalDisbursed * 100) / 100,
      details: results,
    };
  },

  /**
   * Generates a CSV file formatted for Bank NEFT/RTGS Batch Payout uploads.
   */
  async exportPayoutsCsv(): Promise<string> {
    const vendors = await this.getVendorsWithPendingPayouts();

    const headers = [
      "Vendor Business Name",
      "Account Holder Name",
      "Bank Account Number",
      "IFSC Code",
      "Bank Name",
      "UPI ID",
      "Pending Amount (INR)",
      "Unsettled Orders",
      "Vendor ID",
    ];

    const rows = vendors.map((v) => [
      `"${(v.business_name || "").replace(/"/g, '""')}"`,
      `"${(v.bank_account_holder_name || v.owner_name || "").replace(/"/g, '""')}"`,
      `"${(v.bank_account_number || "").replace(/"/g, '""')}"`,
      `"${(v.bank_ifsc || "").replace(/"/g, '""')}"`,
      `"${(v.bank_name || "").replace(/"/g, '""')}"`,
      `"${(v.upi_id || "").replace(/"/g, '""')}"`,
      v.pending_amount.toFixed(2),
      v.unsettled_orders_count,
      `"${v.vendor_id}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },
};
