import { useRef } from "react";
import { format } from "date-fns";
import {
  Printer,
  Share2,
  CheckCircle2,
  Clock,
  Phone,
  Store,
  User,
  Bike,
  CreditCard,
  Receipt,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export interface OrderInvoiceModalProps {
  order: any | null;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  isVendorSlip?: boolean;
}

export function OrderInvoiceModal({
  order,
  isOpen,
  onClose,
  title,
  isVendorSlip = false,
}: OrderInvoiceModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch Public Settings for Platform GSTIN, Support Phone, and Platform Info
  const { data: publicSettingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
  });
  const publicSettings = publicSettingsRes?.data?.data || publicSettingsRes?.data || {};

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/orders/${order.id}/track`;
      navigator.clipboard.writeText(url);
      toast.success("Order link copied to clipboard!");
    }
  };

  // Resolve values
  const ordNo = order.order_number || order.id?.slice(0, 8);
  const invNo =
    order.invoice_number ||
    `INV-${String(ordNo)
      .replace(/[^A-Z0-9]/gi, "")
      .slice(-10)
      .toUpperCase()}`;

  const orderDate = order.created_at
    ? format(new Date(order.created_at), "dd MMMM yyyy, hh:mm a")
    : format(new Date(), "dd MMMM yyyy, hh:mm a");

  // Customer info
  const customerName =
    order.customer?.name || order.user?.name || order.address?.label || "Valued Customer";
  const customerPhone = order.customer?.phone || order.user?.phone || order.address?.phone || "N/A";
  const customerEmail = order.customer?.email || order.user?.email || null;
  const addressFull =
    order.address?.full_address ||
    [order.address?.address_line1, order.address?.street_address, order.address?.city]
      .filter(Boolean)
      .join(", ") ||
    "Delivery Address on file";
  const addressLandmark = order.address?.landmark;
  const addressCityState = [
    order.address?.city,
    order.address?.state,
    order.address?.pincode ? `- ${order.address.pincode}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Vendor / Store info
  const storeName =
    order.vendor?.business_name ||
    (order.vendors && order.vendors.length > 1
      ? `${order.vendors.length} Partner Stores (Multi-Store Order)`
      : order.vendors?.[0]?.business_name || "VegaMart Verified Merchant Store");

  const storePhone =
    order.vendor?.phone ||
    order.vendors?.[0]?.phone ||
    publicSettings?.["platform.support_phone"] ||
    null;

  const storeAddress =
    order.vendor?.address ||
    order.vendors?.[0]?.address ||
    publicSettings?.["platform.address"] ||
    "Hyperlocal Hub, India";

  const platformName = publicSettings?.["platform.name"] || "VegaMart";
  const platformGstin = publicSettings?.["platform.gstin"] || null;
  const platformPhone = publicSettings?.["platform.support_phone"] || "+91 99999 99999";
  const platformEmail = publicSettings?.["platform.support_email"] || "support@vegamart.com";

  // Delivery partner info
  const partnerName = order.delivery_partner?.name || order.delivery_partner?.user?.name || null;
  const partnerPhone = order.delivery_partner?.phone || order.delivery_partner?.user?.phone || null;
  const partnerVehicle = order.delivery_partner?.vehicle_type
    ? `${order.delivery_partner.vehicle_type} ${
        order.delivery_partner.vehicle_number ? `(${order.delivery_partner.vehicle_number})` : ""
      }`
    : null;

  // Items
  const items = Array.isArray(order.items) ? order.items : [];
  const acceptedItems = items.filter((i: any) => i.status !== "rejected");
  const rejectedItems = items.filter((i: any) => i.status === "rejected");

  const computedSubtotal = acceptedItems.reduce(
    (sum: number, i: any) => sum + Number(i.unit_price || i.price || 0) * Number(i.quantity || 1),
    0,
  );
  const itemsSubtotal = computedSubtotal > 0 ? computedSubtotal : Number(order.items_subtotal || 0);

  const deliveryFee = Number(order.delivery_fee || order.master_order?.delivery_fee || 0);
  const tax = Number(order.tax || order.master_order?.tax || 0);
  const platformFee = Number(order.platform_fee || order.master_order?.platform_fee || 0);
  const discount = Number(order.discount || order.master_order?.discount || 0);
  const couponCode = order.coupon_code || order.coupon?.code || order.master_order?.coupon_code;

  let additionalCharges: any[] = [];
  const rawAddCharges = order.additional_charges || order.master_order?.additional_charges;
  if (Array.isArray(rawAddCharges)) {
    additionalCharges = rawAddCharges;
  } else if (typeof rawAddCharges === "string") {
    try {
      additionalCharges = JSON.parse(rawAddCharges);
    } catch {}
  }

  const addChargesTotal = additionalCharges.reduce(
    (acc: number, c: any) => acc + Number(c.amount || 0),
    0,
  );
  const totalAmount = Number(
    order.total ||
      order.total_amount ||
      order.master_order?.total_amount ||
      itemsSubtotal + deliveryFee + tax + platformFee + addChargesTotal - discount,
  );

  // Delivery type & helpers
  const isSelfPickup =
    String(order.delivery_option || order.delivery_note || "")
      .toLowerCase()
      .includes("pickup") ||
    String(order.delivery_slot || "")
      .toLowerCase()
      .includes("pickup");

  // Payment info
  const pMethod = String(order.payment?.method || order.payment_method || "COD").toUpperCase();
  const pStatus = String(order.payment?.status || order.payment_status || "PENDING").toUpperCase();
  const isPaid = pStatus === "PAID" || pStatus === "SUCCESS" || pStatus === "COMPLETED";
  const rzpPaymentId = order.payment?.razorpay_payment_id || order.payment?.transaction_id || null;

  const isPartialAdvance =
    pMethod === "PARTIAL_ONLINE" ||
    (order.payment?.amount != null &&
      Number(order.payment.amount) > 0 &&
      Number(order.payment.amount) < totalAmount - 0.5);
  const advancePaid = isPartialAdvance ? Number(order.payment?.amount || 0) : 0;
  const balanceToCollect = isPartialAdvance ? Math.max(0, totalAmount - advancePaid) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden bg-background text-foreground max-h-[92vh] flex flex-col border border-border shadow-2xl print:max-h-none print:h-auto print:border-none print:shadow-none print:p-0 print:static print:w-full">
        {/* Modal Top Actions Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40 print:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Receipt className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">
                {title ||
                  (isVendorSlip ? "Merchant Order Packing Slip" : "Tax Invoice & Bill Receipt")}
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                Order #{ordNo} • {invNo}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 rounded-xl"
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              className="h-8 px-3 text-xs font-bold gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </Button>
          </div>
        </div>

        {/* PRINTABLE INVOICE BODY */}
        <div
          ref={printRef}
          className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 print:overflow-visible print:p-6 print:text-black bg-card print:bg-white"
        >
          {/* 1. BRANDING & INVOICE HEADER */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-emerald-600 font-display">
                  {platformName}
                </span>
                <span className="text-[11px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300/60 print:border-black print:text-black print:bg-gray-100">
                  {isVendorSlip ? "PACKING SLIP" : "TAX INVOICE"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground print:text-gray-700">
                Fresh Fruits, Vegetables & Daily Essentials Hyperlocal Network
              </p>
              {platformGstin && (
                <p className="text-[11px] font-mono text-muted-foreground print:text-gray-700">
                  GSTIN:{" "}
                  <strong className="text-foreground print:text-black">{platformGstin}</strong>
                </p>
              )}
              <p className="text-[10px] text-muted-foreground print:text-gray-600 font-mono">
                Support: {platformPhone} • {platformEmail}
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1 font-mono text-xs">
              <div className="text-xs font-bold text-foreground print:text-black uppercase">
                Invoice No:{" "}
                <span className="font-extrabold text-emerald-700 print:text-black">{invNo}</span>
              </div>
              <div className="text-muted-foreground print:text-gray-700">
                Order Ref: <strong className="text-foreground print:text-black">#{ordNo}</strong>
              </div>
              <div className="text-muted-foreground print:text-gray-700">
                Date & Time: {orderDate}
              </div>
              <div className="pt-1 flex items-center sm:justify-end gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    isPaid
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 print:border-black print:text-black"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30 print:border-black print:text-black"
                  }`}
                >
                  {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {isPaid ? "PAID" : pMethod === "COD" ? "CASH ON DELIVERY" : "PAYMENT PENDING"}
                </span>
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border text-foreground print:border-black">
                  {String(order.status || "CONFIRMED").toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* 2. BILLED BY & BILLED TO DETAILS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Merchant / Seller Box */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-1.5 print:border-gray-400 print:bg-transparent">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-emerald-600 print:text-black" />
                Sold By (Merchant / Store)
              </span>
              <p className="font-bold text-sm text-foreground print:text-black">{storeName}</p>
              <p className="text-muted-foreground print:text-gray-700 leading-relaxed">
                {storeAddress}
              </p>
              {storePhone && (
                <p className="text-muted-foreground print:text-gray-700 flex items-center gap-1 pt-0.5">
                  <Phone className="h-3 w-3" /> {storePhone}
                </p>
              )}
              {order.vendor?.gstin && (
                <p className="text-[11px] font-mono text-muted-foreground print:text-gray-700">
                  GSTIN:{" "}
                  <strong className="text-foreground print:text-black">{order.vendor.gstin}</strong>
                </p>
              )}
            </div>

            {/* Customer & Delivery Destination Box */}
            <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-1.5 print:border-gray-400 print:bg-transparent">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-emerald-600 print:text-black" />
                Billed & Delivered To (Customer)
              </span>
              <p className="font-bold text-sm text-foreground print:text-black">{customerName}</p>
              <p className="text-muted-foreground print:text-gray-700 flex items-center gap-1">
                <Phone className="h-3 w-3" /> {customerPhone}
              </p>
              {customerEmail && (
                <p className="text-[11px] text-muted-foreground print:text-gray-700">
                  {customerEmail}
                </p>
              )}
              <div className="pt-1 text-[11px] text-muted-foreground print:text-gray-700 border-t border-border/60 print:border-gray-300">
                <p className="font-medium text-foreground print:text-black leading-snug">
                  {addressFull}
                </p>
                {addressLandmark && (
                  <p>
                    <strong>Landmark:</strong> {addressLandmark}
                  </p>
                )}
                {addressCityState && <p>{addressCityState}</p>}
              </div>
            </div>
          </div>

          {/* 3. LOGISTICS & FULFILLMENT BAR */}
          <div className="rounded-xl bg-muted/30 border border-border/80 px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 print:border-gray-400 print:bg-transparent">
            <div className="flex items-center gap-2">
              <Bike className="h-4 w-4 text-emerald-600 print:text-black" />
              <span className="font-medium text-muted-foreground print:text-gray-700">
                Delivery Mode:{" "}
                <strong className="text-foreground print:text-black">
                  {isSelfPickup ? "Store Self-Pickup" : "Doorstep Delivery"}
                </strong>
              </span>
            </div>

            {partnerName ? (
              <div className="flex items-center gap-2 font-medium">
                <span className="text-muted-foreground print:text-gray-700">Rider:</span>
                <span className="font-bold text-foreground print:text-black">
                  {partnerName} {partnerPhone ? `(${partnerPhone})` : ""}
                </span>
                {partnerVehicle && (
                  <span className="text-[11px] text-muted-foreground print:text-gray-600">
                    • {partnerVehicle}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground italic print:text-gray-600">
                {isSelfPickup ? "Picked up directly from store" : "Standard Local Delivery"}
              </span>
            )}
          </div>

          {/* 4. ITEMIZED PRODUCTS TABLE */}
          <div className="rounded-2xl border border-border overflow-hidden print:border-gray-400">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground print:bg-gray-100 print:text-black print:border-gray-400">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 w-24">Unit / Pack</th>
                  <th className="py-2.5 px-3 w-16 text-center">Qty</th>
                  <th className="py-2.5 px-3 w-24 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 w-28 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 print:divide-gray-300">
                {acceptedItems.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 1);
                  const unitPrice = Number(item.unit_price || item.price || 0);
                  const lineTotal = Number(item.total_price || unitPrice * qty);
                  const itemName = item.product_name || item.name || item.product?.name || "Item";
                  const unitSize = item.unit || item.selected_unit || item.product?.unit || "1 pc";

                  return (
                    <tr key={idx} className="hover:bg-muted/20 print:bg-transparent">
                      <td className="py-2.5 px-3 text-center text-muted-foreground print:text-gray-600 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground print:text-black">
                        {itemName}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground print:text-gray-700 font-mono">
                        {unitSize}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-foreground print:text-black tabular-nums">
                        {qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground print:text-gray-700 tabular-nums">
                        ₹{unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground print:text-black tabular-nums">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}

                {/* Rejected / Unavailable Items (if any) */}
                {rejectedItems.map((item: any, idx: number) => {
                  const qty = Number(item.quantity || 1);
                  const unitPrice = Number(item.unit_price || item.price || 0);
                  const itemName = item.product_name || item.name || item.product?.name || "Item";

                  return (
                    <tr key={`rej-${idx}`} className="bg-rose-50/40 print:bg-gray-50 opacity-75">
                      <td className="py-2 px-3 text-center text-rose-500 font-mono">—</td>
                      <td className="py-2 px-3 line-through text-muted-foreground print:text-gray-600">
                        {itemName}
                        <span className="block text-[10px] text-rose-600 font-bold no-underline">
                          Unavailable & excluded from bill
                        </span>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground line-through">
                        {item.unit || "1 pc"}
                      </td>
                      <td className="py-2 px-3 text-center line-through">{qty}</td>
                      <td className="py-2 px-3 text-right font-mono line-through">
                        ₹{unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-rose-600 font-bold">
                        ₹0.00
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 5. FINANCIAL BREAKDOWN & PAYMENT SUMMARY */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            {/* Left Box: Payment Details & Order Note */}
            <div className="space-y-3">
              <div className="rounded-2xl border border-border p-4 bg-muted/20 space-y-2 text-xs print:border-gray-400 print:bg-transparent">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-emerald-600 print:text-black" />
                  Payment Summary
                </span>

                <div className="flex justify-between items-center pt-1 border-t border-border/60 print:border-gray-300">
                  <span className="text-muted-foreground print:text-gray-700">Payment Mode:</span>
                  <strong className="text-foreground print:text-black">{pMethod}</strong>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground print:text-gray-700">Payment Status:</span>
                  <span
                    className={`font-bold ${
                      isPaid
                        ? "text-emerald-600 print:text-black"
                        : "text-amber-600 print:text-black"
                    }`}
                  >
                    {isPaid ? "PAID ONLINE" : pMethod === "COD" ? "PAY ON DELIVERY" : "PENDING"}
                  </span>
                </div>

                {rzpPaymentId && (
                  <div className="flex justify-between items-center text-[11px] font-mono">
                    <span className="text-muted-foreground print:text-gray-700">
                      Transaction ID:
                    </span>
                    <span className="text-foreground print:text-black">{rzpPaymentId}</span>
                  </div>
                )}

                {order.otp_code && (
                  <div className="pt-2 border-t border-border/60 print:border-gray-300 text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Delivery Verification Code (OTP)
                    </span>
                    <span className="text-lg font-black font-mono tracking-widest text-emerald-700 print:text-black">
                      {order.otp_code}
                    </span>
                  </div>
                )}
              </div>

              {order.delivery_note && (
                <div className="text-[11px] text-muted-foreground bg-muted/20 p-3 rounded-xl border border-border print:border-gray-300">
                  <strong>Delivery Instruction:</strong> {order.delivery_note}
                </div>
              )}
            </div>

            {/* Right Box: Charges Calculation */}
            <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2 text-xs print:border-gray-400 print:bg-transparent">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600 block mb-1">
                Charges & Taxes Breakdown
              </span>

              <div className="flex justify-between text-muted-foreground print:text-gray-700">
                <span>Items Subtotal</span>
                <span className="font-mono tabular-nums font-semibold text-foreground print:text-black">
                  ₹{itemsSubtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground print:text-gray-700">
                <span>Delivery Fee</span>
                <span className="font-mono tabular-nums font-semibold text-foreground print:text-black">
                  {deliveryFee > 0 ? `+ ₹${deliveryFee.toFixed(2)}` : "FREE"}
                </span>
              </div>

              {tax > 0 && (
                <div className="flex justify-between text-muted-foreground print:text-gray-700">
                  <span>Taxes (GST)</span>
                  <span className="font-mono tabular-nums font-semibold text-foreground print:text-black">
                    + ₹{tax.toFixed(2)}
                  </span>
                </div>
              )}

              {platformFee > 0 && (
                <div className="flex justify-between text-muted-foreground print:text-gray-700">
                  <span>Platform / Handling Fee</span>
                  <span className="font-mono tabular-nums font-semibold text-foreground print:text-black">
                    + ₹{platformFee.toFixed(2)}
                  </span>
                </div>
              )}

              {additionalCharges.map((ch: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between text-muted-foreground print:text-gray-700"
                >
                  <span>{ch.name || ch.title || "Extra Charge"}</span>
                  <span className="font-mono tabular-nums font-semibold text-foreground print:text-black">
                    + ₹{Number(ch.amount || 0).toFixed(2)}
                  </span>
                </div>
              ))}

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 print:text-black font-medium">
                  <span className="flex items-center gap-1">
                    Coupon Discount
                    {couponCode && (
                      <span className="text-[10px] uppercase font-mono px-1 bg-emerald-100 text-emerald-800 rounded">
                        {couponCode}
                      </span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums font-bold">- ₹{discount.toFixed(2)}</span>
                </div>
              )}

              {Number(order.payment?.refund_amount ?? 0) > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Refund for Out-of-Stock Item(s)</span>
                  <span className="font-mono tabular-nums font-bold">
                    - ₹{Number(order.payment?.refund_amount ?? 0).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-border print:border-black flex justify-between items-center text-sm font-black text-foreground print:text-black">
                <span>Grand Total</span>
                <span className="text-base font-black font-mono text-emerald-600 print:text-black tabular-nums">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>

              {isPartialAdvance && (
                <div className="pt-2 border-t border-border/70 space-y-1 text-xs">
                  <div className="flex justify-between font-semibold text-emerald-700 dark:text-emerald-300 print:text-black">
                    <span>Advance Paid Online ({order.payment?.method || "UPI/Card"}):</span>
                    <span className="font-mono tabular-nums font-bold">
                      - ₹{advancePaid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-amber-800 dark:text-amber-300 print:text-black">
                    <span>Balance Due on Delivery / Store:</span>
                    <span className="font-mono tabular-nums text-sm">
                      ₹{balanceToCollect.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 6. STATUTORY DISCLAIMER & FOOTER */}
          <div className="border-t pt-4 text-center space-y-1 text-[10px] text-muted-foreground print:text-gray-600">
            <p className="font-medium">
              This is a computer-generated tax invoice and does not require a physical signature.
            </p>
            <p>
              Issued by {platformName} for and on behalf of the registered merchant under Rule 46 of
              the CGST Rules, 2017.
            </p>
            <p className="font-mono">
              Thank you for shopping with {platformName}! For assistance, email {platformEmail} or
              visit {typeof window !== "undefined" ? window.location.origin : "vegamart.com"}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
