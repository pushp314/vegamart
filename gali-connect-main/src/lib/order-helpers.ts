import {
  Bike,
  User,
  Store,
  ShoppingCart,
  Banknote,
  Smartphone,
  CreditCard,
  Wallet,
  CheckCircle2,
  Clock,
  Calendar,
  XCircle,
  RotateCcw,
} from "lucide-react";

export interface OrderStatusInfo {
  status: string;
  label: string;
  shortLabel: string;
  badge: string;
  desc: string;
  colorClass: string;
  badgeBg: string;
  icon: typeof Clock;
  stepIndex: number;
}

export function getOrderStatusInfo(status?: string | null): OrderStatusInfo {
  const s = String(status || "pending").trim().toLowerCase();

  if (s === "pending" || s === "booked" || s === "booking") {
    return {
      status: "pending",
      label: "Order Booked",
      shortLabel: "Booked",
      badge: "📋 Order Booked",
      desc: "Booking received & sent to merchant",
      colorClass: "text-amber-800 bg-amber-50 border-amber-300",
      badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
      icon: Clock,
      stepIndex: 0,
    };
  }

  if (s === "confirmed" || s === "accepted") {
    return {
      status: "confirmed",
      label: "Order Confirmed",
      shortLabel: "Confirmed",
      badge: "✅ Confirmed",
      desc: "Merchant confirmed and accepted the booking",
      colorClass: "text-blue-800 bg-blue-50 border-blue-300",
      badgeBg: "bg-blue-100 text-blue-900 border-blue-300",
      icon: CheckCircle2,
      stepIndex: 1,
    };
  }

  if (s === "preparing" || s === "processing") {
    return {
      status: "preparing",
      label: "Preparing / Packing",
      shortLabel: "Preparing",
      badge: "🍳 Preparing",
      desc: "Merchant is packing your fresh items",
      colorClass: "text-indigo-800 bg-indigo-50 border-indigo-300",
      badgeBg: "bg-indigo-100 text-indigo-900 border-indigo-300",
      icon: Clock,
      stepIndex: 2,
    };
  }

  if (s === "packed") {
    return {
      status: "packed",
      label: "Packed & Ready",
      shortLabel: "Packed",
      badge: "📦 Packed",
      desc: "Order is packed and ready for dispatch",
      colorClass: "text-purple-800 bg-purple-50 border-purple-300",
      badgeBg: "bg-purple-100 text-purple-900 border-purple-300",
      icon: CheckCircle2,
      stepIndex: 2,
    };
  }

  if (s === "ready_for_pickup") {
    return {
      status: "ready_for_pickup",
      label: "Ready for Pickup",
      shortLabel: "Ready for Pickup",
      badge: "🏪 Ready for Pickup",
      desc: "Order ready for takeaway or courier pickup",
      colorClass: "text-cyan-800 bg-cyan-50 border-cyan-300",
      badgeBg: "bg-cyan-100 text-cyan-900 border-cyan-300",
      icon: Store,
      stepIndex: 2,
    };
  }

  if (s === "picked_up" || s === "out_for_delivery") {
    return {
      status: "out_for_delivery",
      label: "Out for Delivery",
      shortLabel: "Out for Delivery",
      badge: "🏍️ Out for Delivery",
      desc: "Delivery partner on the way with your order",
      colorClass: "text-orange-800 bg-orange-50 border-orange-300",
      badgeBg: "bg-orange-100 text-orange-900 border-orange-300",
      icon: Bike,
      stepIndex: 3,
    };
  }

  if (s === "delivered") {
    return {
      status: "delivered",
      label: "Delivered 🎉",
      shortLabel: "Delivered",
      badge: "🎉 Delivered",
      desc: "Order delivered safely",
      colorClass: "text-emerald-800 bg-emerald-50 border-emerald-300",
      badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
      icon: CheckCircle2,
      stepIndex: 4,
    };
  }

  if (s === "cancelled") {
    return {
      status: "cancelled",
      label: "Cancelled",
      shortLabel: "Cancelled",
      badge: "❌ Cancelled",
      desc: "Order was cancelled",
      colorClass: "text-rose-800 bg-rose-50 border-rose-300",
      badgeBg: "bg-rose-100 text-rose-900 border-rose-300",
      icon: XCircle,
      stepIndex: -1,
    };
  }

  if (s === "refunded") {
    return {
      status: "refunded",
      label: "Refunded",
      shortLabel: "Refunded",
      badge: "↩️ Refunded",
      desc: "Payment refunded to customer",
      colorClass: "text-slate-800 bg-slate-50 border-slate-300",
      badgeBg: "bg-slate-100 text-slate-900 border-slate-300",
      icon: RotateCcw,
      stepIndex: -1,
    };
  }

  return {
    status: s,
    label: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " "),
    shortLabel: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " "),
    badge: `📋 ${s.replace(/_/g, " ")}`,
    desc: `Status: ${s.replace(/_/g, " ")}`,
    colorClass: "text-slate-800 bg-slate-50 border-slate-300",
    badgeBg: "bg-slate-100 text-slate-900 border-slate-300",
    icon: Clock,
    stepIndex: 0,
  };
}

export interface DeliveryOptionInfo {
  id: "delivery_partner" | "self_pickup" | "vendor_comes_to_me" | "shop_delivery" | "booking";
  label: string;
  shortLabel: string;
  badge: string;
  desc: string;
  icon: typeof Bike | typeof Calendar;
  colorClass: string;
  badgeBg: string;
}

export function getDeliveryOptionInfo(deliveryNote?: string | null, fallbackOption?: string | null): DeliveryOptionInfo {
  const raw = String(deliveryNote || fallbackOption || "Delivery partner").trim().toLowerCase();

  if (raw.includes("booking") || raw.includes("advance")) {
    return {
      id: "booking",
      label: "Advance Booking",
      shortLabel: "Advance Booking",
      badge: "📅 Advance Booking",
      desc: "Advance scheduled booking for customer pickup or delivery",
      icon: Calendar,
      colorClass: "text-blue-700 bg-blue-50 border-blue-200",
      badgeBg: "bg-blue-100 text-blue-800 border-blue-300",
    };
  }

  if (raw.includes("self") || raw.includes("pickup") || raw.includes("takeaway")) {
    return {
      id: "self_pickup",
      label: "Self Pickup (Takeaway)",
      shortLabel: "Self Pickup",
      badge: "🚶 Self Pickup",
      desc: "Customer will collect the order directly from the store/cart",
      icon: User,
      colorClass: "text-purple-700 bg-purple-50 border-purple-200",
      badgeBg: "bg-purple-100 text-purple-800 border-purple-300",
    };
  }

  if (raw.includes("vendor") || raw.includes("comes") || raw.includes("cart")) {
    return {
      id: "vendor_comes_to_me",
      label: "Vendor Comes to Me (Street Cart)",
      shortLabel: "Vendor Comes to Me",
      badge: "🛒 Vendor Comes to Me",
      desc: "Moving street cart / vendor travels to customer location",
      icon: ShoppingCart,
      colorClass: "text-orange-700 bg-orange-50 border-orange-200",
      badgeBg: "bg-orange-100 text-orange-800 border-orange-300",
    };
  }

  if (raw.includes("shop")) {
    return {
      id: "shop_delivery",
      label: "Shop Direct Delivery",
      shortLabel: "Shop Delivery",
      badge: "🏪 Shop Delivery",
      desc: "Merchant delivers directly using store staff",
      icon: Store,
      colorClass: "text-teal-700 bg-teal-50 border-teal-200",
      badgeBg: "bg-teal-100 text-teal-800 border-teal-300",
    };
  }

  return {
    id: "delivery_partner",
    label: "VegaMart Home Delivery",
    shortLabel: "Home Delivery",
    badge: "🏍️ Home Delivery",
    desc: "Assigned delivery partner will deliver to door",
    icon: Bike,
    colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    badgeBg: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
}

export interface PaymentOptionInfo {
  method: "COD" | "UPI" | "CARD" | "WALLET" | "ONLINE";
  label: string;
  shortLabel: string;
  isPrepaid: boolean;
  instruction: string;
  icon: typeof Banknote;
  colorClass: string;
  statusText: string;
  statusColorClass: string;
  statusIcon: typeof CheckCircle2;
  isPartialAdvance: boolean;
  advancePaid: number;
  balanceAmount: number;
  totalAmount: number;
  summaryText: string;
}

export function getPaymentMethodInfo(
  paymentMethod?: string | null,
  paymentStatus?: string | null,
  totalAmount?: number,
  isSelfPickup: boolean = false,
  advancePaidAmount?: number | null
): PaymentOptionInfo {
  const pm = String(paymentMethod || "cod").trim().toUpperCase();
  const ps = String(paymentStatus || "PENDING").trim().toUpperCase();
  const tot = Math.max(0, Number(totalAmount || 0));

  let isPrepaid = true;
  let method: PaymentOptionInfo["method"] = "ONLINE";
  let icon = CreditCard;
  let colorClass = "text-sky-700 bg-sky-50 border-sky-200";

  if (pm === "COD" || pm.includes("CASH")) {
    method = "COD";
    isPrepaid = false;
    icon = Banknote;
    colorClass = "text-amber-700 bg-amber-50 border-amber-200";
  } else if (pm === "WALLET") {
    method = "WALLET";
    icon = Wallet;
    colorClass = "text-purple-700 bg-purple-50 border-purple-200";
  } else if (pm === "UPI") {
    method = "UPI";
    icon = Smartphone;
    colorClass = "text-emerald-700 bg-emerald-50 border-emerald-200";
  } else if (pm === "CARD") {
    method = "CARD";
    icon = CreditCard;
    colorClass = "text-indigo-700 bg-indigo-50 border-indigo-200";
  }

  const isPaid = ps === "PAID" || ps === "CAPTURED" || ps === "SUCCESS";
  const rawAdv = advancePaidAmount != null ? Number(advancePaidAmount) : null;
  const adv = isPaid
    ? (rawAdv != null ? rawAdv : tot)
    : 0;

  const isPartialAdvance = isPrepaid && isPaid && adv > 0 && adv < tot;
  const balanceAmount = isPrepaid
    ? (isPaid ? Math.max(0, Math.round((tot - adv) * 100) / 100) : tot)
    : tot;

  let label = "Paid Online (Razorpay)";
  let shortLabel = "Online";
  let instruction = "Payment completed and verified online. Do not collect cash.";

  if (method === "COD") {
    label = isSelfPickup ? "Pay at Store Counter (Takeaway)" : "Cash on Delivery (COD)";
    shortLabel = isSelfPickup ? "Pay at Store" : "COD";
    instruction = isSelfPickup
      ? `Pay ₹${tot.toFixed(2)} cash or UPI directly at store counter upon pickup.`
      : `Collect ₹${tot.toFixed(2)} in cash or UPI QR from customer upon delivery.`;
  } else if (isPartialAdvance) {
    label = `Advance Paid Online (${method === "UPI" ? "UPI" : method === "CARD" ? "Card" : "Online"})`;
    shortLabel = `Advance ₹${adv.toFixed(2)}`;
    instruction = `Advance of ₹${adv.toFixed(2)} received online. Please collect balance ₹${balanceAmount.toFixed(2)} at store counter / upon collection.`;
  } else if (isPaid) {
    label = method === "UPI" ? "Online UPI (Paid in Full)" : method === "CARD" ? "Card Payment (Paid in Full)" : "Paid Online (Full Payment)";
    shortLabel = "Fully Paid";
    instruction = `Full payment of ₹${tot.toFixed(2)} verified online. Do not collect cash.`;
  } else {
    label = method === "UPI" ? "Online UPI (Pending)" : method === "CARD" ? "Card (Pending)" : "Online Payment (Pending)";
    shortLabel = "Payment Pending";
    instruction = "Online payment was not completed or verified.";
  }

  let statusText = "Payment Pending";
  let statusColorClass = "bg-amber-100 text-amber-800 border-amber-200";
  let statusIcon = Clock;

  if (isPaid) {
    if (isPartialAdvance) {
      statusText = `Advance Paid: ₹${adv.toFixed(2)}`;
      statusColorClass = "bg-teal-100 text-teal-800 border-teal-200";
      statusIcon = CheckCircle2;
    } else {
      statusText = "Full Online Payment Successful";
      statusColorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
      statusIcon = CheckCircle2;
    }
  } else if (ps === "REFUNDED") {
    statusText = "Fully Refunded";
    statusColorClass = "bg-slate-100 text-slate-700 border-slate-200";
    statusIcon = RotateCcw;
  } else if (ps === "PARTIALLY_REFUNDED") {
    statusText = "Partially Refunded";
    statusColorClass = "bg-orange-100 text-orange-800 border-orange-200";
    statusIcon = RotateCcw;
  } else if (ps === "FAILED") {
    statusText = "Payment Failed";
    statusColorClass = "bg-rose-100 text-rose-800 border-rose-200";
    statusIcon = XCircle;
  }

  const summaryText = isPartialAdvance
    ? `Advance Paid ₹${adv.toFixed(2)} + Balance ₹${balanceAmount.toFixed(2)} = Total ₹${tot.toFixed(2)}`
    : isPaid
      ? `Fully Paid Online ₹${tot.toFixed(2)}`
      : `Total Payable: ₹${tot.toFixed(2)}`;

  return {
    method,
    label,
    shortLabel,
    isPrepaid,
    instruction,
    icon,
    colorClass,
    statusText,
    statusColorClass,
    statusIcon,
    isPartialAdvance,
    advancePaid: adv,
    balanceAmount,
    totalAmount: tot,
    summaryText,
  };
}
