import { env } from "../config";
import log from "../config/logger";
import { hmacSha256Hex, safeEqualHashes } from "../utils/crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  currency: string;
  status: string;
  attempts: number;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  error_description?: string | null;
  created_at: number;
}

export interface RazorpayPlan {
  id: string;
  entity: string;
  period: string;
  interval: number;
  item: { name: string; amount: number; currency: string; description?: string };
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  status: string; // created, authenticated, active, pending, halted, cancelled, completed, expired
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  quantity: number;
  notes?: Record<string, string>;
  charge_at?: number | null;
  start_at?: number | null;
  end_at?: number | null;
  total_count: number;
  paid_count: number;
  remaining_count: number;
  customer_notify: boolean;
  short_url?: string | null;
  created_at: number;
}

export interface SubscriptionSchedule {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  totalCount: number;
}

const MAX_SUBSCRIPTION_YEARS = 100;

export function subscriptionScheduleFor(billingPeriod: string): SubscriptionSchedule {
  switch (billingPeriod) {
    case "yearly":
      return { period: "yearly", interval: 1, totalCount: MAX_SUBSCRIPTION_YEARS };
    case "quarterly":
      return { period: "monthly", interval: 3, totalCount: MAX_SUBSCRIPTION_YEARS * 4 };
    case "lifetime":
      return { period: "monthly", interval: 1, totalCount: 1 };
    case "weekly":
      return { period: "weekly", interval: 1, totalCount: MAX_SUBSCRIPTION_YEARS * 52 };
    case "daily":
      return { period: "daily", interval: 1, totalCount: MAX_SUBSCRIPTION_YEARS * 365 };
    default:
      return { period: "monthly", interval: 1, totalCount: MAX_SUBSCRIPTION_YEARS * 12 };
  }
}

export function isRazorpayConfigured(): boolean {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function authHeader(): string {
  const credentials = `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

async function request<T>(path: string, options: { method?: string; body?: Record<string, unknown> } = {}): Promise<T> {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured.");
  }
  const res = await fetch(`${RAZORPAY_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    log.error(`[razorpay] API error ${res.status}`, { context: "razorpay", path, response: json });
    throw new Error(`Razorpay API error: ${res.status} ${JSON.stringify(json)}`);
  }
  return json as T;
}

export const razorpayGateway = {
  isConfigured: isRazorpayConfigured,

  async createOrder(input: { amountPaise: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<RazorpayOrder> {
    return request<RazorpayOrder>("/orders", {
      method: "POST",
      body: {
        amount: input.amountPaise,
        currency: input.currency,
        receipt: input.receipt,
        notes: input.notes,
      },
    });
  },

  async fetchPayment(paymentId: string): Promise<RazorpayPayment> {
    return request<RazorpayPayment>(`/payments/${paymentId}`);
  },

  async refundPayment(paymentId: string, input: { amountPaise?: number; notes?: string } = {}): Promise<{ id: string; status: string }> {
    const body: Record<string, unknown> = {};
    if (input.amountPaise !== undefined) body.amount = input.amountPaise;
    if (input.notes !== undefined) body.notes = input.notes;
    return request<{ id: string; status: string }>(`/payments/${paymentId}/refund`, { method: "POST", body });
  },

  verifySignature(input: { orderId: string; paymentId: string; signature: string }): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return false;
    }
    const payload = `${input.orderId}|${input.paymentId}`;
    const expected = hmacSha256Hex(payload, secret);
    return safeEqualHashes(expected, input.signature);
  },

  verifySubscriptionSignature(input: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return false;
    }
    const payload = `${input.paymentId}|${input.subscriptionId}`;
    const expected = hmacSha256Hex(payload, secret);
    return safeEqualHashes(expected, input.signature);
  },

  async createPlan(input: { name: string; amountPaise: number; period: string; interval: number; description?: string }): Promise<RazorpayPlan> {
    return request<RazorpayPlan>("/plans", {
      method: "POST",
      body: {
        period: input.period,
        interval: input.interval,
        item: {
          name: input.name,
          amount: input.amountPaise,
          currency: "INR",
          description: input.description,
        },
      },
    });
  },

  async createSubscription(input: { planId: string; totalCount: number; notes?: Record<string, string>; quantity?: number }): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>("/subscriptions", {
      method: "POST",
      body: {
        plan_id: input.planId,
        total_count: input.totalCount,
        quantity: input.quantity ?? 1,
        customer_notify: 1,
        notes: input.notes,
      },
    });
  },

  async fetchSubscription(id: string): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>(`/subscriptions/${id}`);
  },

  async cancelSubscription(id: string): Promise<RazorpaySubscription> {
    return request<RazorpaySubscription>(`/subscriptions/${id}/cancel`, { method: "POST" });
  },

  verifyWebhookSignature(input: { body: string; signature: string }): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return false;
    }
    const expected = hmacSha256Hex(input.body, secret);
    return safeEqualHashes(expected, input.signature);
  },
};
