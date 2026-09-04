import { FeeConfig } from "../types/fees";

export interface FeeContext {
  cartTotal: number;
  numberOfStores: number;
  deliveryDistanceKm?: number;
  deliverySlot?: string;
  paymentMethod?: string; // e.g. "COD", "RAZORPAY"
  totalWeightKg?: number; // if available in future
  isRaining?: boolean;
  isPeakHour?: boolean;
}

export function computeCustomerFees(configs: FeeConfig[], context: FeeContext) {
  let totalPlatformFee = 0;
  const additionalCharges: { name: string; amount: number; type?: string }[] = [];

  for (const fee of configs) {
    if (!fee.enabled) continue;

    // Minimum order check
    if (fee.min_order_amount && context.cartTotal < fee.min_order_amount) {
      // Except for SMALL_ORDER_FEE which applies when cartTotal is LESS than min_order_amount
      if (fee.key !== "SMALL_ORDER_FEE") {
        continue; // Condition not met
      }
    } else if (fee.key === "SMALL_ORDER_FEE" && context.cartTotal >= fee.min_order_amount) {
      continue; // Order is large enough, no small order fee
    }

    // Determine base amount based on type
    let calculatedAmount = 0;
    if (fee.type === "PERCENTAGE") {
      calculatedAmount = (context.cartTotal * fee.amount) / 100;
      if (fee.max_cap && fee.max_cap > 0 && calculatedAmount > fee.max_cap) {
        calculatedAmount = fee.max_cap;
      }
    } else {
      calculatedAmount = fee.amount;
    }

    // Apply specific dynamic rules based on fee key
    let finalAmount = 0;

    switch (fee.key) {
      case "MULTI_STORE_PURCHASE_FEE":
        if (context.numberOfStores > 1) {
          finalAmount = calculatedAmount * (context.numberOfStores - 1);
        }
        break;

      case "DISTANCE_DELIVERY_FEE":
        if (context.deliveryDistanceKm && fee.conditions?.free_radius_km) {
          const extraKm = Math.max(0, context.deliveryDistanceKm - fee.conditions.free_radius_km);
          if (extraKm > 0) {
            finalAmount = extraKm * calculatedAmount;
          }
        } else if (context.deliveryDistanceKm) {
           finalAmount = calculatedAmount * Math.ceil(context.deliveryDistanceKm);
        }
        break;

      case "COD_FEE":
        if (context.paymentMethod === "COD") {
          finalAmount = calculatedAmount;
        }
        break;

      case "BAD_WEATHER_FEE":
        if (fee.conditions?.is_active_override || context.isRaining) {
          finalAmount = calculatedAmount;
        }
        break;

      case "LATE_NIGHT_DELIVERY_FEE":
        // Simplify by checking current hour for now, or dynamic via conditions
        const hour = new Date().getHours();
        if (hour >= 22 || hour <= 4) {
          finalAmount = calculatedAmount;
        }
        break;

      case "SCHEDULED_DELIVERY_FEE":
        if (context.deliverySlot && !context.deliverySlot.toLowerCase().includes("standard") && !context.deliverySlot.toLowerCase().includes("asap")) {
          finalAmount = calculatedAmount;
        }
        break;

      default:
        // By default, if enabled, apply the amount (e.g. PLATFORM_FEE, SERVICE_CHARGE)
        finalAmount = calculatedAmount;
        break;
    }

    finalAmount = Math.round(finalAmount * 100) / 100;

    if (finalAmount > 0) {
      totalPlatformFee += finalAmount;
      additionalCharges.push({
        name: fee.name,
        amount: finalAmount,
        type: fee.type
      });
    }
  }

  return { totalPlatformFee, additionalCharges };
}
