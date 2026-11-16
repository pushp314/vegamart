import { razorpayGateway } from "../payments/razorpay.gateway";
import prisma from "../database/prisma";
import log from "../config/logger";
import { env } from "../config";

export interface RazorpayOverview {
  is_configured: boolean;
  merchant_key_id: string | null;
  currency: string;
  balances: {
    current_unsettled_balance: number;
    total_withdrawn_to_bank: number;
    gross_online_collected: number;
    total_gateway_fees: number;
    total_taxes: number;
    total_refunded: number;
    net_earned: number;
  };
  settlements_summary: {
    total_count: number;
    processed_count: number;
    latest_settlement: {
      id: string;
      amount: number;
      status: string;
      utr: string;
      date: string;
      timestamp: number;
    } | null;
  };
  payments_summary: {
    total_count: number;
    captured_count: number;
    failed_count: number;
  };
  db_metrics: {
    total_db_orders_paid_online: number;
    total_db_online_volume: number;
  };
  on_demand: {
    allowed: boolean;
    max_amount?: number;
    min_amount?: number;
    instant_settlement_enabled?: boolean;
    message?: string;
  };
  dashboard_url: string;
}

export const adminRazorpayService = {
  async getOverview(): Promise<RazorpayOverview> {
    const isConfigured = razorpayGateway.isConfigured();
    const maskedKey = env.RAZORPAY_KEY_ID
      ? `${env.RAZORPAY_KEY_ID.slice(0, 8)}...${env.RAZORPAY_KEY_ID.slice(-4)}`
      : null;

    // Database online transactions summary
    const dbAgg = await prisma.payment.aggregate({
      where: { status: "PAID", method: "RAZORPAY" },
      _sum: { amount: true },
      _count: { id: true },
    }).catch(() => ({ _sum: { amount: null }, _count: { id: 0 } }));

    const dbMetrics = {
      total_db_orders_paid_online: dbAgg._count?.id ?? 0,
      total_db_online_volume: Number(dbAgg._sum?.amount ?? 0),
    };

    if (!isConfigured) {
      return {
        is_configured: false,
        merchant_key_id: null,
        currency: "INR",
        balances: {
          current_unsettled_balance: 0,
          total_withdrawn_to_bank: 0,
          gross_online_collected: dbMetrics.total_db_online_volume,
          total_gateway_fees: 0,
          total_taxes: 0,
          total_refunded: 0,
          net_earned: dbMetrics.total_db_online_volume,
        },
        settlements_summary: {
          total_count: 0,
          processed_count: 0,
          latest_settlement: null,
        },
        payments_summary: {
          total_count: dbMetrics.total_db_orders_paid_online,
          captured_count: dbMetrics.total_db_orders_paid_online,
          failed_count: 0,
        },
        db_metrics: dbMetrics,
        on_demand: {
          allowed: false,
          message: "Razorpay keys not configured",
        },
        dashboard_url: "https://dashboard.razorpay.com",
      };
    }

    try {
      // 1. Fetch live settlements (withdrawals)
      const settlementsRes = await razorpayGateway.fetchSettlements({ count: 100 });
      const settlements = settlementsRes?.items || [];

      let totalWithdrawnPaise = 0;
      let processedSettlementsCount = 0;
      let latestSettlement: any = null;

      for (const s of settlements) {
        if (s.status === "processed") {
          processedSettlementsCount++;
          totalWithdrawnPaise += s.amount || 0;
          if (!latestSettlement || s.created_at > latestSettlement.timestamp) {
            latestSettlement = {
              id: s.id,
              amount: Number(((s.amount || 0) / 100).toFixed(2)),
              status: s.status,
              utr: s.utr || "N/A",
              date: new Date(s.created_at * 1000).toISOString(),
              timestamp: s.created_at,
            };
          }
        }
      }

      // 2. Fetch live payments
      const paymentsRes = await razorpayGateway.fetchPayments({ count: 100 });
      const payments = paymentsRes?.items || [];

      let capturedSumPaise = 0;
      let feeSumPaise = 0;
      let taxSumPaise = 0;
      let refundSumPaise = 0;
      let capturedCount = 0;
      let failedCount = 0;

      for (const p of payments) {
        if (p.status === "captured") {
          capturedCount++;
          capturedSumPaise += p.amount || 0;
          feeSumPaise += p.fee || 0;
          taxSumPaise += p.tax || 0;
          refundSumPaise += p.amount_refunded || 0;
        } else if (p.status === "failed") {
          failedCount++;
        }
      }

      const totalWithdrawn = Number((totalWithdrawnPaise / 100).toFixed(2));
      const grossCollected = Number((capturedSumPaise / 100).toFixed(2));
      const totalFees = Number((feeSumPaise / 100).toFixed(2));
      const totalTaxes = Number((taxSumPaise / 100).toFixed(2));
      const totalRefunded = Number((refundSumPaise / 100).toFixed(2));
      const netEarned = Number(((capturedSumPaise - feeSumPaise - taxSumPaise - refundSumPaise) / 100).toFixed(2));
      const currentUnsettledBalance = Math.max(0, Number((netEarned - totalWithdrawn).toFixed(2)));

      // 3. Check on-demand settlement features
      const onDemand = await razorpayGateway.fetchOnDemandFeatures();

      return {
        is_configured: true,
        merchant_key_id: maskedKey,
        currency: "INR",
        balances: {
          current_unsettled_balance: currentUnsettledBalance,
          total_withdrawn_to_bank: totalWithdrawn,
          gross_online_collected: grossCollected,
          total_gateway_fees: totalFees,
          total_taxes: totalTaxes,
          total_refunded: totalRefunded,
          net_earned: netEarned,
        },
        settlements_summary: {
          total_count: settlements.length,
          processed_count: processedSettlementsCount,
          latest_settlement: latestSettlement,
        },
        payments_summary: {
          total_count: payments.length,
          captured_count: capturedCount,
          failed_count: failedCount,
        },
        db_metrics: dbMetrics,
        on_demand: onDemand,
        dashboard_url: "https://dashboard.razorpay.com/app/settlements",
      };
    } catch (err: any) {
      log.error("[adminRazorpayService] Failed to load overview:", err);
      return {
        is_configured: true,
        merchant_key_id: maskedKey,
        currency: "INR",
        balances: {
          current_unsettled_balance: 0,
          total_withdrawn_to_bank: 0,
          gross_online_collected: dbMetrics.total_db_online_volume,
          total_gateway_fees: 0,
          total_taxes: 0,
          total_refunded: 0,
          net_earned: dbMetrics.total_db_online_volume,
        },
        settlements_summary: {
          total_count: 0,
          processed_count: 0,
          latest_settlement: null,
        },
        payments_summary: {
          total_count: dbMetrics.total_db_orders_paid_online,
          captured_count: dbMetrics.total_db_orders_paid_online,
          failed_count: 0,
        },
        db_metrics: dbMetrics,
        on_demand: {
          allowed: false,
          message: err.message,
        },
        dashboard_url: "https://dashboard.razorpay.com/app/settlements",
      };
    }
  },

  async listSettlements(query: { count?: number; skip?: number } = {}) {
    if (!razorpayGateway.isConfigured()) {
      return { items: [], count: 0, has_more: false };
    }
    const count = Math.min(100, Math.max(1, query.count ?? 50));
    const skip = Math.max(0, query.skip ?? 0);

    const res = await razorpayGateway.fetchSettlements({ count, skip });
    const items = (res.items || []).map((s) => ({
      id: s.id,
      amount: Number(((s.amount || 0) / 100).toFixed(2)),
      fees: Number(((s.fees || 0) / 100).toFixed(2)),
      tax: Number(((s.tax || 0) / 100).toFixed(2)),
      status: s.status,
      utr: s.utr || "N/A",
      created_at: s.created_at,
      date: new Date(s.created_at * 1000).toISOString(),
      currency: s.currency || "INR",
    }));

    return {
      items,
      count: items.length,
      has_more: res.has_more ?? false,
    };
  },

  async listPayments(query: { count?: number; skip?: number } = {}) {
    if (!razorpayGateway.isConfigured()) {
      return { items: [], count: 0, has_more: false };
    }
    const count = Math.min(100, Math.max(1, query.count ?? 50));
    const skip = Math.max(0, query.skip ?? 0);

    const res = await razorpayGateway.fetchPayments({ count, skip });
    const items = (res.items || []).map((p: any) => ({
      id: p.id,
      order_id: p.order_id,
      amount: Number(((p.amount || 0) / 100).toFixed(2)),
      fee: Number(((p.fee || 0) / 100).toFixed(2)),
      tax: Number(((p.tax || 0) / 100).toFixed(2)),
      status: p.status,
      method: p.method,
      vpa: p.vpa || p.upi?.vpa || null,
      bank: p.bank || null,
      email: p.email || null,
      contact: p.contact || null,
      created_at: p.created_at,
      date: new Date(p.created_at * 1000).toISOString(),
      error_description: p.error_description || null,
      error_reason: p.error_reason || null,
    }));

    return {
      items,
      count: items.length,
      has_more: res.has_more ?? false,
    };
  },

  async triggerInstantSettlement(input: { amount?: number; settle_full_balance?: boolean }) {
    if (!razorpayGateway.isConfigured()) {
      throw new Error("Razorpay is not configured");
    }
    const amountPaise = input.amount && input.amount > 0 ? Math.round(input.amount * 100) : undefined;
    return razorpayGateway.createOnDemandSettlement({
      amountPaise,
      settle_full_balance: input.settle_full_balance ?? (amountPaise ? false : true),
      description: "On-demand withdrawal triggered from VegaMart Admin",
    });
  },
};
