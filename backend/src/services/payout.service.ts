import log from "../config/logger";
import prisma from "../database/prisma";
import { razorpayGateway } from "../payments/razorpay.gateway";
import { settingsService } from "./settings.service";
import { SETTING_KEYS } from "../constants/settings";
import { notificationService } from "./notification.service";

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

  /**
   * Retrieves comprehensive wallet overview for a specific vendor.
   */
  async getVendorWalletOverview(vendorId: string) {
    const rawVendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: {
        user: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!rawVendor) {
      throw new Error("Vendor profile not found");
    }
    const vendor = rawVendor as any;

    // 1. Settled Earnings (Gross earned ready for withdrawal)
    const settledAgg = await prisma.vendorEarning.aggregate({
      where: { vendor_id: vendorId, status: "SETTLED" },
      _sum: { amount: true },
    });

    // 2. Pending Escrow (Earnings locked on active/in-transit orders)
    const pendingAgg = await prisma.vendorEarning.aggregate({
      where: { vendor_id: vendorId, status: "PENDING" },
      _sum: { amount: true },
    });

    // 3. Processed / Completed Withdrawals
    const completedWithdrawalsAgg = await (prisma as any).payoutRequest.aggregate({
      where: { vendor_id: vendorId, status: "COMPLETED" },
      _sum: { amount: true },
    });

    // 4. In-flight / Pending Withdrawal Requests
    const inFlightWithdrawalsAgg = await (prisma as any).payoutRequest.aggregate({
      where: {
        vendor_id: vendorId,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    });

    const totalSettledEarnings = Number(settledAgg._sum.amount ?? 0);
    const totalPendingEscrow = Number(pendingAgg._sum.amount ?? 0);
    const totalWithdrawn = Number(completedWithdrawalsAgg._sum.amount ?? 0);
    const inFlightWithdrawing = Number(inFlightWithdrawalsAgg._sum.amount ?? 0);

    // Available balance is total settled earnings minus what has already been withdrawn or is in-flight
    const availableBalance = Math.max(0, Math.round((totalSettledEarnings - totalWithdrawn - inFlightWithdrawing) * 100) / 100);

    // 5. Recent Withdrawal Requests
    const recentWithdrawals = await (prisma as any).payoutRequest.findMany({
      where: { vendor_id: vendorId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    // 6. Recent Line-by-Line Wallet Ledger (Earning credits, reversals, payouts)
    const recentEarnings = await prisma.vendorEarning.findMany({
      where: { vendor_id: vendorId },
      include: {
        order: {
          select: { order_number: true, total: true, status: true, created_at: true },
        },
      },
      orderBy: { created_at: "desc" },
      take: 20,
    });

    return {
      available_balance: availableBalance,
      pending_escrow: totalPendingEscrow,
      total_withdrawn: totalWithdrawn,
      in_flight_withdrawing: inFlightWithdrawing,
      lifetime_settled: totalSettledEarnings,
      commission_rate: Number(vendor.commission_rate ?? 5),
      bank_configured: Boolean(vendor.bank_account_number && vendor.bank_ifsc),
      bank_details: {
        bank_account_number: vendor.bank_account_number || null,
        bank_ifsc: vendor.bank_ifsc || null,
        bank_account_holder_name: vendor.bank_account_holder_name || null,
        bank_name: vendor.bank_name || null,
        upi_id: vendor.upi_id || null,
        razorpay_account_id: vendor.razorpay_account_id || null,
        payout_enabled: vendor.payout_enabled !== false,
      },
      recent_withdrawals: recentWithdrawals.map((w: any) => ({
        id: w.id,
        amount: Number(w.amount),
        payout_mode: w.payout_mode,
        account_number: w.account_number,
        ifsc_code: w.ifsc_code,
        upi_id: w.upi_id,
        status: w.status,
        utr_reference: w.utr_reference,
        notes: w.notes,
        created_at: w.created_at,
        processed_at: w.processed_at,
      })),
      wallet_ledger: recentEarnings.map((e) => ({
        id: e.id,
        type: e.type,
        status: e.status,
        amount: Number(e.amount),
        order_number: e.order?.order_number || null,
        order_total: e.order ? Number(e.order.total) : null,
        reference_id: e.reference_id,
        created_at: e.created_at,
      })),
    };
  },

  /**
   * Initiates an on-demand vendor payout withdrawal request.
   */
  async requestVendorWithdrawal(
    vendorId: string,
    input: { amount: number; payout_mode?: "BANK_TRANSFER" | "UPI"; notes?: string }
  ) {
    const rawVendor = await prisma.vendorProfile.findUnique({
      where: { id: vendorId },
      include: { user: true },
    });

    if (!rawVendor) {
      throw new Error("Vendor profile not found");
    }
    const vendor = rawVendor as any;

    if (vendor.payout_enabled === false) {
      throw new Error("Payouts are disabled for this account. Please contact support.");
    }

    const requestedAmount = Math.round(Number(input.amount) * 100) / 100;
    if (isNaN(requestedAmount) || requestedAmount < 100) {
      throw new Error("Minimum withdrawal amount is ₹100.");
    }

    const mode = input.payout_mode || (vendor.upi_id ? "UPI" : "BANK_TRANSFER");
    if (mode === "BANK_TRANSFER" && (!vendor.bank_account_number || !vendor.bank_ifsc)) {
      throw new Error("Please configure your Bank Account Number and IFSC Code before requesting a bank payout.");
    }
    if (mode === "UPI" && !vendor.upi_id) {
      throw new Error("Please configure your UPI ID before requesting a UPI payout.");
    }

    const overview = await this.getVendorWalletOverview(vendorId);
    if (requestedAmount > overview.available_balance) {
      throw new Error(`Insufficient available wallet balance. Maximum withdrawable: ₹${overview.available_balance.toFixed(2)}`);
    }

    const request = await (prisma as any).payoutRequest.create({
      data: {
        vendor_id: vendorId,
        amount: requestedAmount,
        payout_mode: mode,
        account_number: vendor.bank_account_number,
        ifsc_code: vendor.bank_ifsc,
        account_holder: vendor.bank_account_holder_name || vendor.owner_name || vendor.business_name,
        bank_name: vendor.bank_name,
        upi_id: vendor.upi_id,
        status: "PENDING",
        notes: input.notes || null,
      },
    });

    // Notify vendor
    if (vendor.user_id) {
      await notificationService.vendor(
        vendor.user_id,
        "Withdrawal Request Submitted 💸",
        `Your request for ₹${requestedAmount.toFixed(2)} via ${mode === "UPI" ? "UPI" : "Bank Transfer"} has been received. Funds will be transferred to your account shortly.`,
        { payout_request_id: request.id, amount: requestedAmount }
      );
    }

    // Auto-disburse if Razorpay Route Linked Account exists and Admin auto-payout is on
    const settings = await settingsService.getAllSettings();
    const isWalletEnabled = settings[SETTING_KEYS.VENDOR_WALLET_ENABLED] !== false;
    const payoutMode = (settings[SETTING_KEYS.VENDOR_PAYOUT_MODE] as string) || "razorpay_route";

    if (isWalletEnabled && payoutMode === "razorpay_route" && vendor.razorpay_account_id && razorpayGateway.isConfigured()) {
      try {
        const transferRes = await razorpayGateway.transferToLinkedAccount("direct_payout", {
          accountId: vendor.razorpay_account_id,
          amountPaise: Math.round(requestedAmount * 100),
          currency: "INR",
          notes: {
            payout_request_id: request.id,
            vendor_id: vendorId,
          },
        });

        const updated = await (prisma as any).payoutRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            utr_reference: (transferRes as any)?.id || (transferRes as any)?.items?.[0]?.id || `ROUTE-${Date.now()}`,
            processed_at: new Date(),
          },
        });

        if (vendor.user_id) {
          await notificationService.vendor(
            vendor.user_id,
            "Payout Disbursed to Bank 🎉",
            `₹${requestedAmount.toFixed(2)} has been credited to your linked account via Razorpay Route.`,
            { payout_request_id: request.id, amount: requestedAmount }
          );
        }

        return {
          success: true,
          request: updated,
          auto_settled: true,
          message: "Payout automatically transferred via Razorpay Route!",
        };
      } catch (err: any) {
        log.warn(`[payout] Auto-transfer via Route skipped for withdrawal ${request.id}: ${err.message}`);
      }
    }

    return {
      success: true,
      request,
      auto_settled: false,
      message: "Withdrawal request submitted successfully! Admin will process your payout.",
    };
  },

  /**
   * Admin approves or rejects a vendor payout request.
   */
  async adminProcessPayoutRequest(
    requestId: string,
    adminUserId: string,
    input: { action: "APPROVE" | "REJECT"; utr_reference?: string; admin_notes?: string }
  ) {
    const request = await (prisma as any).payoutRequest.findUnique({
      where: { id: requestId },
      include: {
        vendor: {
          include: { user: true },
        },
      },
    });

    if (!request) {
      throw new Error("Payout request not found");
    }

    if (request.status === "COMPLETED" || request.status === "REJECTED") {
      throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
    }

    const vendor = (request as any).vendor;
    const isApprove = input.action === "APPROVE";
    const ref = input.utr_reference || `BANK-UTR-${Date.now()}`;

    const updated = await (prisma as any).payoutRequest.update({
      where: { id: requestId },
      data: {
        status: isApprove ? "COMPLETED" : "REJECTED",
        utr_reference: isApprove ? ref : null,
        admin_notes: input.admin_notes || null,
        processed_by: adminUserId,
        processed_at: new Date(),
      },
    });

    if (vendor?.user_id) {
      if (isApprove) {
        await notificationService.vendor(
          vendor.user_id,
          "Payout Credited to Your Bank! 💸",
          `₹${Number(request.amount).toFixed(2)} has been transferred to your account (${request.payout_mode}) with UTR Ref: ${ref}.`,
          { payout_request_id: request.id, amount: Number(request.amount), utr: ref }
        );
      } else {
        await notificationService.vendor(
          vendor.user_id,
          "Withdrawal Request Declined ⚠️",
          `Your withdrawal request for ₹${Number(request.amount).toFixed(2)} was declined. Reason: ${input.admin_notes || "Please verify your bank details."}`,
          { payout_request_id: request.id, amount: Number(request.amount) }
        );
      }
    }

    return {
      success: true,
      request: updated,
      message: isApprove ? "Payout marked as completed." : "Payout request rejected.",
    };
  },

  /**
   * Admin lists all payout requests with status filter.
   */
  async adminListPayoutRequests(query?: { status?: string; vendorId?: string }) {
    const where: any = {};
    if (query?.status && query.status !== "ALL") {
      where.status = query.status;
    }
    if (query?.vendorId) {
      where.vendor_id = query.vendorId;
    }

    const requests = await (prisma as any).payoutRequest.findMany({
      where,
      include: {
        vendor: {
          include: {
            user: { select: { name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return requests.map((r: any) => ({
      id: r.id,
      vendor_id: r.vendor_id,
      vendor_name: r.vendor?.business_name || "Unknown Store",
      owner_name: r.vendor?.owner_name || r.vendor?.user?.name || "",
      amount: Number(r.amount),
      payout_mode: r.payout_mode,
      account_number: r.account_number,
      ifsc_code: r.ifsc_code,
      account_holder: r.account_holder,
      bank_name: r.bank_name,
      upi_id: r.upi_id,
      status: r.status,
      utr_reference: r.utr_reference,
      notes: r.notes,
      admin_notes: r.admin_notes,
      created_at: r.created_at,
      processed_at: r.processed_at,
    }));
  },

  /**
   * Exports line-by-line wallet statement CSV for vendor accounting.
   */
  async exportVendorWalletStatementCsv(vendorId: string): Promise<string> {
    const earnings = await prisma.vendorEarning.findMany({
      where: { vendor_id: vendorId },
      include: {
        order: { select: { order_number: true, total: true, status: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const headers = ["Date", "Order Number", "Transaction Type", "Order Value (INR)", "Net Earning (INR)", "Status", "Reference"];
    const rows = earnings.map((e) => [
      `"${new Date(e.created_at).toISOString()}"`,
      `"${e.order?.order_number || ""}"`,
      `"${e.type}"`,
      e.order ? Number(e.order.total).toFixed(2) : "0.00",
      Number(e.amount).toFixed(2),
      `"${e.status}"`,
      `"${e.reference_id || ""}"`,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  },

  /**
   * Live real-time UPI ID verification for vendors.
   */
  async verifyVendorUpi(upiId: string) {
    const result = await razorpayGateway.validateVpa(upiId);
    return result;
  },

  /**
   * Live real-time Bank Account & IFSC verification for vendors.
   */
  async verifyVendorBank(input: { accountNumber: string; ifsc: string; name?: string }) {
    const result = await razorpayGateway.validateBankAccount({
      accountNumber: input.accountNumber,
      ifsc: input.ifsc,
      name: input.name,
    });
    return result;
  },
};
