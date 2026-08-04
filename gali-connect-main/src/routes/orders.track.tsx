import { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bike,
  Phone,
  MessageSquare,
  MapPin,
  Store,
  Navigation,
  ShieldCheck,
  Clock,
  ArrowLeft,
  CheckCircle2,
  PackageCheck,
  ChevronRight,
  ShoppingBag,
  RefreshCw,
  Share2,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { GoogleDeliveryTracker } from "@/components/marketplace/google-delivery-tracker";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/orders/track")({
  head: () => ({ meta: [{ title: "Live Order Tracking — Vegamart" }] }),
  component: OrderTrackingPage,
});

function OrderTrackingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch active customer orders
  const {
    data: res,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["activeOrders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const orders = res?.data || [];
  const activeOrder = orders.find(
    (o) =>
      o.status === "out_for_delivery" ||
      o.status === "processing" ||
      o.status === "confirmed" ||
      o.status === "pending",
  ) ||
    orders[0] || {
      id: "VG-264782",
      order_number: "VG-264782",
      status: "out_for_delivery",
      total_amount: 199,
      items: [
        { product_name: "Fresh Farm Tomatoes", quantity: 1, unit: "1 kg", price: 30 },
        { product_name: "Baby Spinach", quantity: 1, unit: "250 g", price: 25 },
        { product_name: "Masala Chai", quantity: 2, unit: "1 cup", price: 15 },
      ],
      address: {
        address_line1: "B-402, Green Valley Apartments",
        city: "Bengaluru",
        landmark: "Near Jayanagar 4th Block",
      },
      vendor_name: "Raju Sabziwala 🛒",
      created_at: new Date().toISOString(),
    };

  const isDelivered = activeOrder.status === "delivered";

  // Mock Rider Info
  const riderInfo = {
    name: "Vikram Singh",
    phone: "+91 98112 34567",
    rating: "4.9 ★",
    vehicle: "EV Scooter (KA-03-EV-8812)",
    deliveriesDone: 1420,
  };

  const steps = [
    { label: "Order Placed", desc: "Sent to vendor", done: true },
    { label: "Confirmed", desc: "Packed & ready", done: true },
    {
      label: "Out for Delivery",
      desc: "Partner on the way",
      done: activeOrder.status === "out_for_delivery" || isDelivered,
    },
    { label: "Delivered", desc: "Enjoy your fresh produce!", done: isDelivered },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Top Header */}
      <AppHeader
        title="Live Order Tracking"
        subtitle={
          activeOrder
            ? `Order #${activeOrder.order_number || activeOrder.id.slice(0, 8)}`
            : "Tracking"
        }
      />

      <main className="mx-auto max-w-4xl px-4 md:px-6 py-6 space-y-6">
        {/* Live Delivery Status Banner */}
        <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 p-5 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white font-bold shadow-md">
              <Bike className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-lg md:text-xl text-foreground">
                  {isDelivered ? "Order Delivered! 🎉" : "Delivery Partner is on the way!"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isDelivered
                  ? "Your order has been handed over safely."
                  : "Live tracking active • Estimated arrival in ~8 to 12 minutes"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              refetch();
              toast.success("Updated live tracking coordinates!");
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border bg-card hover:bg-muted font-bold text-xs px-4 py-2.5 shadow-xs transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5 text-emerald-600" /> Refresh Radar
          </button>
        </div>

        {/* Live Animated Map Tracker */}
        <div className="rounded-3xl border bg-card overflow-hidden shadow-lg relative h-[420px] md:h-[500px]">
          <GoogleDeliveryTracker
            orderId={activeOrder.order_number || activeOrder.id}
            vendorName={activeOrder.vendor_name || "Raju Sabziwala"}
            riderName={riderInfo.name}
            riderPhone={riderInfo.phone}
            riderVehicle={riderInfo.vehicle}
            status={activeOrder.status}
          />
        </div>

        {/* Delivery Partner Contact Card */}
        <div className="rounded-3xl border bg-card p-5 shadow-soft space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 font-extrabold text-base">
                👤
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">{riderInfo.name}</h3>
                  <span className="text-[11px] font-bold text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {riderInfo.rating}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {riderInfo.vehicle} • {riderInfo.deliveriesDone}+ deliveries completed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={`tel:${riderInfo.phone}`}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                title="Call Delivery Partner"
              >
                <Phone className="h-5 w-5" />
              </a>
              <button
                onClick={() =>
                  toast.info(`Message sent to ${riderInfo.name}: "Please leave near doorbell."`)
                }
                className="grid h-11 w-11 place-items-center rounded-2xl border bg-muted text-foreground hover:bg-card transition-colors"
                title="Send Message"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Order Status Stepper Timeline */}
        <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
          <h3 className="font-display font-black text-base text-foreground">
            Order Status Timeline
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative">
            {steps.map((step, idx) => (
              <div
                key={step.label}
                className={`rounded-2xl border p-3 text-center space-y-1 transition-all ${
                  step.done
                    ? "bg-emerald-50/80 border-emerald-300 text-emerald-950"
                    : "bg-muted/40 border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                    step.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="font-bold text-xs truncate">{step.label}</div>
                <div className="text-[10px] opacity-80 truncate">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Itemized Order Details & Receipt */}
        <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h3 className="font-display font-black text-base text-foreground">Order Details</h3>
              <p className="text-xs text-muted-foreground">
                Order #{activeOrder.order_number || activeOrder.id}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
              Paid via UPI
            </span>
          </div>

          {/* Delivery Address */}
          <div className="flex items-start gap-3 bg-muted/50 p-3.5 rounded-2xl text-xs">
            <MapPin className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold text-foreground">Delivery Address</div>
              <div className="text-muted-foreground mt-0.5">
                {activeOrder.address?.address_line1 || "B-402, Green Valley Apartments"},{" "}
                {activeOrder.address?.landmark || "Near Jayanagar 4th Block"},{" "}
                {activeOrder.address?.city || "Bengaluru"}
              </div>
            </div>
          </div>

          {/* Products List */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              Items Ordered
            </div>
            <div className="divide-y border rounded-2xl overflow-hidden bg-background">
              {(
                activeOrder.items || [
                  { product_name: "Fresh Farm Tomatoes", quantity: 1, unit: "1 kg", price: 30 },
                  { product_name: "Baby Spinach", quantity: 1, unit: "250 g", price: 25 },
                  { product_name: "Masala Chai", quantity: 2, unit: "1 cup", price: 15 },
                ]
              ).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {item.quantity}x
                    </span>
                    <span className="font-bold text-foreground">
                      {item.product_name || item.name}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      ({item.unit || "unit"})
                    </span>
                  </div>
                  <span className="font-bold text-foreground tabular-nums">
                    ₹{((item.price || 20) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bill Summary */}
          <div className="pt-2 space-y-1.5 text-xs text-muted-foreground border-t">
            <div className="flex justify-between">
              <span>Item Subtotal</span>
              <span className="tabular-nums font-semibold">
                ₹{(activeOrder.total_amount || 199) - 20}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span className="text-emerald-600 font-bold">FREE</span>
            </div>
            <div className="flex justify-between">
              <span>Taxes & Platform Fee</span>
              <span className="tabular-nums font-semibold">₹20.00</span>
            </div>
            <div className="flex justify-between pt-2 border-t text-sm font-extrabold text-foreground">
              <span>Total Paid</span>
              <span className="text-emerald-600 tabular-nums">
                ₹{activeOrder.total_amount || 199}.00
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
