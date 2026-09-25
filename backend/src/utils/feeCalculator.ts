import { FeeConfig } from "../types/fees";

export interface FeeContext {
  cartTotal: number;
  numberOfStores: number;
  deliveryDistanceKm?: number;
  deliverySlot?: string;
  deliveryOption?: string; // e.g. "self_pickup", "booking", "delivery_partner", "shop_delivery"
  paymentMethod?: string; // e.g. "COD", "RAZORPAY", "UPI", "card"
  totalWeightKg?: number; // if available in future
  isRaining?: boolean;
  isPeakHour?: boolean;
}

export function computeCustomerFees(configs: FeeConfig[], context: FeeContext) {
  let totalPlatformFee = 0;
  const additionalCharges: { key?: string; name: string; amount: number; type?: string }[] = [];

  const opt = (context.deliveryOption || "").toLowerCase();
  const slot = (context.deliverySlot || "").toLowerCase();
  const isSelfPickup =
    opt === "self_pickup" ||
    slot.includes("self") ||
    slot.includes("pickup") ||
    slot.includes("takeaway") ||
    slot.includes("counter");
  const isAdvanceBooking =
    opt === "booking" ||
    slot.includes("advance") ||
    slot.includes("book");
  const isCod =
    String(context.paymentMethod || "").toUpperCase() === "COD";
  const isOnlinePayment =
    context.paymentMethod ? !isCod : false;

  for (const fee of configs) {
    const isEnabled = fee.enabled !== false && (fee as any).is_active !== false;
    if (!isEnabled) continue;

    const feeName = fee.name || (fee as any).title || "Extra Charge";
    const feeType = String(fee.type || "FIXED").toUpperCase();
    const feeAmount = Number(fee.amount || 0);

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
    if (feeType === "PERCENTAGE") {
      calculatedAmount = (context.cartTotal * feeAmount) / 100;
      if (fee.max_cap && fee.max_cap > 0 && calculatedAmount > fee.max_cap) {
        calculatedAmount = fee.max_cap;
      }
    } else {
      calculatedAmount = feeAmount;
    }

    // Apply specific dynamic rules based on fee key
    let finalAmount = 0;

    switch (fee.key) {
      case "SELF_PICKUP_FEE":
        if (isSelfPickup) {
          finalAmount = calculatedAmount;
        }
        break;

      case "ADVANCE_BOOKING_FEE":
        if (isAdvanceBooking) {
          finalAmount = calculatedAmount;
        }
        break;

      case "COD_FEE":
        if (isCod) {
          finalAmount = calculatedAmount;
        }
        break;

      case "PAYMENT_PROCESSING_FEE":
        if (isOnlinePayment) {
          finalAmount = calculatedAmount;
        }
        break;

      case "MULTI_STORE_PURCHASE_FEE":
        if (context.numberOfStores > 1) {
          finalAmount = calculatedAmount * (context.numberOfStores - 1);
        }
        break;

      case "DISTANCE_DELIVERY_FEE":
        if (!isSelfPickup) {
          if (context.deliveryDistanceKm && fee.conditions?.free_radius_km) {
            const extraKm = Math.max(0, context.deliveryDistanceKm - fee.conditions.free_radius_km);
            if (extraKm > 0) {
              finalAmount = extraKm * calculatedAmount;
            }
          } else if (context.deliveryDistanceKm) {
            finalAmount = calculatedAmount * Math.ceil(context.deliveryDistanceKm);
          }
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
        if (isAdvanceBooking || (context.deliverySlot && !context.deliverySlot.toLowerCase().includes("standard") && !context.deliverySlot.toLowerCase().includes("asap"))) {
          finalAmount = calculatedAmount;
        }
        break;

      case "CANCELLATION_FEE":
      case "RE_DELIVERY_FEE":
        finalAmount = 0;
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
        key: fee.key,
        name: feeName,
        amount: finalAmount,
        type: feeType,
      });
    }
  }

  return { totalPlatformFee, additionalCharges };
}
