import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  CreditCard,
  Smartphone,
  Banknote,
  ShieldCheck,
  ArrowRight,
  Home,
  MapPin,
  Loader2,
  Tag,
  CheckCircle2,
  X,
  User,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useCart } from "@/context/cart-context";
import { AddressModal, AddressData } from "@/components/marketplace/address-modal";

import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Vegamart" }] }),
  component: Checkout,
});

const SLOTS = [
  { label: "Express", desc: "~15 min" },
  { label: "1 hour", desc: "By 6:30 PM" },
  { label: "Schedule", desc: "Pick time" },
];

const PAYMENTS = [
  { v: "upi", icon: Smartphone, label: "UPI", desc: "PhonePe, GPay, Paytm" },
  { v: "card", icon: CreditCard, label: "Card", desc: "Visa, Mastercard, RuPay" },
  { v: "cod", icon: Banknote, label: "Cash on delivery", desc: "Pay the delivery partner" },
];

function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, subtotal, deliveryFee, tax, discount, total, clearCart, appliedCoupon, applyCoupon, removeCoupon } = useCart();

  const [payment, setPayment] = useState("upi");
  const [slot, setSlot] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [couponInput, setCouponInput] = useState("");

  const AVAILABLE_OFFERS = [
    { code: "VEGA50", desc: "Flat ₹50 OFF" },
    { code: "FREEDEL", desc: "Free Delivery" },
  ];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: addrRes, isLoading: loadingAddr } = useQuery({ 
    queryKey: ["addresses"], 
    queryFn: () => api.get<{ data: any[] }>("/users/me/addresses"),
    enabled: !!user
  });
  
  const addresses = (addrRes?.data as unknown as any[]) || [];
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
       setSelectedAddressId(addresses[0].id);
    }
  }, [addresses, selectedAddressId]);

  const selectedAddress = addresses.find((a: any) => a.id === selectedAddressId) || addresses[0];

  // Auth Guard: Require Login to Checkout
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader title="Checkout" subtitle="Login Required" />
        <main className="flex-1 max-w-md w-full mx-auto px-6 py-16 text-center flex flex-col justify-center items-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-soft">
            <User className="h-10 w-10" />
          </div>
          <h2 className="mt-6 font-display text-2xl font-bold">Login Required to Checkout</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-xs">
            Please log in to your account to select your delivery address and place your order.
          </p>
          <div className="mt-6 w-full space-y-3">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 shadow-md hover:bg-primary/90"
            >
              Log In to Continue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const createAddressMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post<any>("/users/me/addresses", data);
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to save address");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: any) => api.post<{ data: any }>("/checkout/create-order", data),
    onSuccess: async (res) => {
      const order = res.data?.data;
      if (payment === "upi" || payment === "card") {
         setCreatedOrder(order);
         const resScript = await loadRazorpayScript();
         if (!resScript) {
            toast.error("Razorpay SDK failed to load. Are you online?");
            return;
         }
         
         const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
            amount: Math.round(total * 100), // convert to paise
            currency: "INR",
            name: "Vegamart",
            description: `Order ${order.order_number}`,
            order_id: order.razorpay_order_id, 
            handler: function (response: any) {
               // In a real app we'd verify this via backend webhook or explicit route
               // For now, we trust the frontend success callback
               handlePaymentSuccess(response.razorpay_payment_id, order?.id);
            },
            prefill: {
               name: user?.name || "Customer",
               email: user?.email || "",
               contact: selectedAddress?.phone || "9999999999"
            },
            theme: {
               color: "#10b981"
            }
         };
         
         const paymentObject = new (window as any).Razorpay(options);
         paymentObject.open();

      } else {
         clearCart();
         toast.success("Order placed successfully via COD!");
         navigate({ to: "/order-success", search: { orderId: order?.id || "" } });
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to place order");
    }
  });

  const handlePlaceOrder = () => {
    if (items.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }
    if (!selectedAddress || !selectedAddress.id) {
      toast.error("Please add and select a valid delivery address.");
      return;
    }
    
    createOrderMutation.mutate({
       address_id: selectedAddress.id,
       payment_method: payment,
       delivery_slot: SLOTS[slot].label
    });
  };

  const handlePaymentSuccess = (paymentId: string, orderId?: string) => {
    clearCart();
    toast.success("Payment successful!");
    navigate({ to: "/order-success", search: { orderId: orderId || createdOrder?.id || "" } });
  };

  const handleSaveAddress = (data: AddressData) => {
    createAddressMutation.mutate(data, {
      onSuccess: (res: any) => {
        // the backend should return the created address
        const addrId = res.data?.id;
        if (addrId) {
          setSelectedAddressId(addrId);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-16">
      <AppHeader title="Checkout" subtitle="Confirm your order" />

      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 space-y-6">
        <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 lg:gap-8">
          <div className="space-y-4">
            {/* Address Selection */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              {loadingAddr ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/> Loading addresses...</div>
              ) : selectedAddress ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-100 text-primary">
                        <Home className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Delivery Address ({selectedAddress.label})
                        </div>
                        <div className="font-display text-sm font-bold text-foreground">
                          {selectedAddress.full_name}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAddressModalOpen(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Change
                    </button>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed pl-11">
                    {selectedAddress.line1}, {selectedAddress.line2 && `${selectedAddress.line2}, `}
                    {selectedAddress.city} — <strong>{selectedAddress.pincode}</strong>
                  </p>
                  <p className="text-xs font-semibold text-foreground pl-11 mt-1">
                    {selectedAddress.phone}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">No saved addresses</div>
                  <button onClick={() => setAddressModalOpen(true)} className="text-primary text-xs font-bold hover:underline">Add New</button>
                </div>
              )}
            </section>

            {/* Delivery Slot */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <h2 className="font-display text-base font-bold">Delivery Slot</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {SLOTS.map((s, i) => {
                  const active = i === slot;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setSlot(i)}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        active
                          ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="text-xs font-bold">{s.label}</div>
                      <div
                        className={`mt-0.5 text-[10.5px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                      >
                        {s.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Payment Method */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <h2 className="font-display text-base font-bold">Payment Method</h2>
              <div className="mt-3 space-y-2">
                {PAYMENTS.map((p) => {
                  const active = payment === p.v;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.v}
                      type="button"
                      onClick={() => setPayment(p.v)}
                      className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                        active
                          ? "border-primary bg-emerald-50/50 shadow-xs"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-xl ${
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground">{p.label}</div>
                        <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                      </div>
                      <span
                        className={`grid h-5 w-5 place-items-center rounded-full border ${
                          active ? "border-primary bg-primary" : "border-border"
                        }`}
                      >
                        {active && <span className="h-2 w-2 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Offers For You */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display text-base font-bold">Offers & Benefits</h2>
              </div>
              
              {!appliedCoupon ? (
                <>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="flex-1 rounded-xl border bg-muted/50 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-bold tracking-wide"
                    />
                    <button
                      onClick={async () => {
                        if (!couponInput) return;
                        const res = await applyCoupon(couponInput);
                        if (res.success) toast.success("Coupon applied!");
                        else toast.error(res.message);
                        setCouponInput("");
                      }}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Available Offers</div>
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {AVAILABLE_OFFERS.map((offer) => (
                        <button
                          key={offer.code}
                          onClick={async () => {
                            const res = await applyCoupon(offer.code);
                            if (res.success) toast.success("Coupon applied!");
                            else toast.error(res.message);
                          }}
                          className="shrink-0 flex flex-col items-start gap-1 rounded-2xl border border-dashed border-emerald-500/50 bg-emerald-50/50 p-3 text-left transition-colors hover:bg-emerald-50 w-32"
                        >
                          <div className="font-bold text-emerald-700 text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded-md">{offer.code}</div>
                          <div className="text-[10.5px] font-medium text-emerald-900 leading-tight">{offer.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <div>
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">{appliedCoupon} Applied</div>
                      <div className="text-[10px] font-medium text-emerald-600 mt-0.5">You saved ₹{discount.toFixed(2)} on this order</div>
                    </div>
                  </div>
                  <button
                    onClick={removeCoupon}
                    className="text-rose-500 hover:text-rose-700 p-1"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* Bill Summary */}
          <aside>
            <section className="rounded-3xl bg-card border p-5 shadow-soft md:sticky md:top-24 space-y-3">
              <h2 className="font-display text-base font-bold">Bill Summary</h2>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item Subtotal</span>
                  <span className="font-semibold tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {deliveryFee === 0 ? "FREE" : `₹${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes & Charges (5% GST)</span>
                  <span className="font-semibold tabular-nums">₹{tax.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
              </dl>

              <div className="pt-3 border-t flex items-center justify-between">
                <span className="font-display text-sm font-bold">Total Payable</span>
                <span className="font-display text-xl font-bold tabular-nums text-primary">
                  ₹{total.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground bg-muted p-2.5 rounded-2xl">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                Verified &amp; Protected by Razorpay 256-bit SSL
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={createOrderMutation.isPending || items.length === 0}
                className="hidden md:flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Place Order <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </section>
          </aside>
        </div>
      </main>

      {/* Sticky Mobile Checkout Bar */}
      <div
        className="md:hidden fixed inset-x-0 z-40 pointer-events-none"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-md px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-3xl bg-primary text-primary-foreground p-2 pl-5 shadow-glow">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                Total Payable
              </div>
              <div className="font-display text-lg font-bold leading-none tabular-nums">
                ₹{total.toFixed(2)}
              </div>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={createOrderMutation.isPending || items.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-white text-emerald-900 font-bold text-xs h-11 px-4 shadow-xs hover:bg-emerald-50 disabled:opacity-50"
            >
              {createOrderMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Place Order <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <AddressModal
        open={addressModalOpen}
        onClose={() => setAddressModalOpen(false)}
        onSave={(data) => createAddressMutation.mutateAsync(data)}
      />

    </div>
  );
}
