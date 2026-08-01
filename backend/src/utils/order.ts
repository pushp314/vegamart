import { randomInt } from "crypto";

import { ORDER_NUMBER_PREFIX } from "../constants";

export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase().padStart(8, "0");
  const random = randomInt(0, 36 ** 5)
    .toString(36)
    .toUpperCase()
    .padStart(5, "0");
  return `${ORDER_NUMBER_PREFIX}-${timestamp}${random}`;
}

export function generateInvoiceNumber(orderNumber: string): string {
  const suffix = orderNumber.replace(/[^A-Z0-9]/g, "").slice(-10);
  return `INV-${suffix}`;
}

export function generateDeliveryOtp(): string {
  return randomInt(100000, 1000000).toString();
}
