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

  verifyWebhookSignature(input: { body: string; signature: string }): boolean {
    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return false;
    }
    const expected = hmacSha256Hex(input.body, secret);
    return safeEqualHashes(expected, input.signature);
  },
};
