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
  Store,
  Clock,
  ShoppingBag,
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

const PAYMENTS = [
  { v: "upi", icon: Smartphone, label: "UPI", desc: "PhonePe, GPay, Paytm" },
  { v: "card", icon: CreditCard, label: "Card", desc: "Visa, Mastercard, RuPay" },
  { v: "cod", icon: Banknote, label: "Cash on delivery", desc: "Pay the delivery partner" },
];

function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    items,
    subtotal,
    deliveryFee,
    tax,
    discount,
    total,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    summary,
  } = useCart();

  const [payment, setPayment] = useState("upi");
  const [deliveryOption, setDeliveryOption] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");

  const { data: publicSettingsRes } = useQuery({
    queryKey: ["publicSettings"],
    queryFn: () => api.get<any>("/settings/public"),
  });
  const publicSettings = publicSettingsRes?.data || {};
  const isVegaMartFleetEnabled = publicSettings?.["platform.vegamart_delivery_enabled"] !== false;
  const hasActiveDeliveryPartners = !!publicSettings.has_active_delivery_partners && isVegaMartFleetEnabled;
  const platformDeliveryEta = publicSettings?.["platform.default_delivery_eta"] || "20-30 mins";

  // Extract vendor delivery configurations from checkout summary or first item's vendor
  const vendorGroup = summary?.groups?.[0];
  const firstVendor = (items[0]?.product?.vendor as any) || {};
  const vendorId = items[0]?.product?.vendor_id || (items[0]?.product as any)?.vendorId || null;

  const { data: vendorDetailRes } = useQuery({
    queryKey: ["checkoutVendor", vendorId],
    queryFn: () => api.get<any>(`/vendors/${vendorId}`),
    enabled: !!vendorId,
  });

  const vendorData = vendorDetailRes?.data || firstVendor;
  const vendorName = vendorGroup?.vendor_name || vendorData?.business_name || vendorData?.name || "Local Store";
  const vendorEta = vendorData?.estimated_delivery_time || vendorGroup?.estimated_delivery_time || "20-30 mins";
  const vendorAddress = vendorData?.address || vendorGroup?.vendor_address || "";
  const isStoreOpen = vendorData?.is_open !== false;

  const rawConfigs = vendorGroup?.delivery_configs || vendorData?.delivery_configs;

  const bookingConfig = rawConfigs?.booking ?? { enabled: false, advance_percentage: 20, min_order: 0, estimated_time: "1-2 days" };
  const selfPickupConfig = rawConfigs?.self_pickup ?? {
    enabled: true,
    advance_percentage: vendorGroup?.advance_payment_percentage ?? 10,
    min_order: 0,
    estimated_time: "15 mins",
  };
  const shopDeliveryConfig = rawConfigs?.shop_delivery ?? {
    enabled: !!(items.some((i) => !!(i.product?.vendor?.provides_delivery || (i.product as any)?.vendor_provides_delivery))),
    delivery_fee: vendorGroup?.delivery_fee ?? 30,
    min_order: 0,
    estimated_time: "30-45 mins",
  };
  const deliveryPartnerConfig = rawConfigs?.delivery_partner ?? {
    enabled: true,
  };

  const adminDeliveryFee = vendorGroup?.admin_delivery_fee ?? publicSettings.delivery_fee ?? 30;
  const adminMinOrder = vendorGroup?.admin_min_order ?? publicSettings.min_order_value ?? 0;
  const adminFreeDeliveryThreshold = vendorGroup?.admin_free_delivery_threshold ?? publicSettings.free_delivery_threshold ?? 0;

  const isRoamingVendor = items.some(
    (i) =>
      (i.product?.vendor as any)?.vendor_type === "roaming" ||
      !!(i.product?.vendor as any)?.provides_vendor_comes_to_me
  );

  interface CheckoutDeliveryOption {
    id: string;
    label: string;
    desc: string;
    icon: string;
    eta: string;
    advancePct: number;
    minOrder: number;
    fee: number;
  }

  const DELIVERY_OPTIONS: CheckoutDeliveryOption[] = [
    ...(isRoamingVendor
      ? [{ id: "vendor_comes_to_me", label: "Vendor comes to me", desc: "Moving street cart arrives at your door", icon: "🛒", eta: "~15-20 mins", advancePct: 0, minOrder: 0, fee: 0 }]
      : []),
    ...(bookingConfig.enabled
      ? [
          {
            id: "booking",
            label: "Advance Booking",
            desc: `Advance scheduled booking (${bookingConfig.advance_percentage}% upfront)`,
            icon: "📅",
            eta: `~${bookingConfig.estimated_time || "1-2 days"}`,
            advancePct: Number(bookingConfig.advance_percentage) || 20,
            minOrder: Number(bookingConfig.min_order) || 0,
            fee: 0,
          },
        ]
      : []),
    ...(selfPickupConfig.enabled
      ? [
          {
            id: "self_pickup",
            label: "Self Pickup",
            desc: `Collect at store counter (${selfPickupConfig.advance_percentage}% upfront)`,
            icon: "🚶",
            eta: `Ready in ~${selfPickupConfig.estimated_time || "15 mins"}`,
            advancePct: Number(selfPickupConfig.advance_percentage) || 10,
            minOrder: Number(selfPickupConfig.min_order) || 0,
            fee: 0,
          },
        ]
      : []),
    ...(shopDeliveryConfig.enabled
      ? [
          {
            id: "shop_delivery",
            label: "Shop Direct Delivery",
            desc: `Delivered by store staff (₹${shopDeliveryConfig.delivery_fee})`,
            icon: "🏪",
            eta: `~${shopDeliveryConfig.estimated_time || vendorEta}`,
            advancePct: 0,
            minOrder: Number(shopDeliveryConfig.min_order) || 0,
            fee: Number(shopDeliveryConfig.delivery_fee) || 0,
          },
        ]
      : []),
    ...(deliveryPartnerConfig.enabled && hasActiveDeliveryPartners
      ? [
          {
            id: "delivery_partner",
            label: "VegaMart Home Delivery",
            desc: `Express rider delivery (₹${adminDeliveryFee})`,
            icon: "🏍️",
            eta: `~${platformDeliveryEta || vendorEta}`,
            advancePct: 0,
            minOrder: Number(adminMinOrder) || 0,
            fee: (adminFreeDeliveryThreshold > 0 && subtotal >= adminFreeDeliveryThreshold) ? 0 : Number(adminDeliveryFee) || 30,
          },
        ]
      : []),
  ];

  const effectiveOptions: CheckoutDeliveryOption[] = DELIVERY_OPTIONS.length > 0 ? DELIVERY_OPTIONS : [
    { id: "self_pickup", label: "Self Pickup", desc: "Store pickup", icon: "🚶", eta: "Ready in ~15 mins", advancePct: 10, minOrder: 0, fee: 0 }
  ];

  useEffect(() => {
    setDeliveryOption((i) => Math.min(i, Math.max(0, effectiveOptions.length - 1)));
  }, [effectiveOptions.length]);

  const { data: offersRes } = useQuery({
    queryKey: ["availableOffers"],
    queryFn: () => api.get<any>("/coupons/available"),
  });
  const AVAILABLE_OFFERS = offersRes?.data || [];

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const { user, isAuthenticated, isGuest, isLoading: authLoading } = useAuth();
  const { data: addrRes, isLoading: loadingAddr } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<AddressData[]>("/users/me/addresses"),
    enabled: !!user,
  });

  const addresses = addrRes?.data || [];
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      setSelectedAddressId(addresses[0]?.id ?? "");
    }
  }, [addresses, selectedAddressId]);

  const selectedAddress = addresses.find((a: any) => a.id === selectedAddressId) || addresses[0];

  const createAddressMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post<any>("/users/me/addresses", data);
      if (!res.success) {
        throw new Error(res.error?.message || "Failed to save address");
      }
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setAddressModalOpen(false);
      const addrId = res?.id;
      if (addrId) {
        setSelectedAddressId(addrId);
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: (data: any) => api.post<any>("/payments/verify", data),
  });

  // Opens the Razorpay modal for every online order and resolves ONLY when the
  // backend has confirmed the payment (signature + amount + order mapping). Modal
  // dismissal and verification failures reject, so the caller never clears the
  // cart, never shows success, and never navigates to the success page unless the
  // payment was genuinely captured.
  const runRazorpayFlow = async (orders: any[]) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error("Razorpay SDK failed to load. Are you online?");
    }
    const RazorpayCtor = (window as any).Razorpay;
    for (const entry of orders) {
      const order = entry?.order;
      const pay = entry?.payment;
      if (!order || !pay?.razorpay_order_id) continue;
      await new Promise<void>((resolve, reject) => {
        // Once Razorpay has returned a payment response, the modal auto-closes and
        // some SDK builds fire `ondismiss` alongside `handler`. Track that a payment
        // was received so an auto-close is never misreported as a user cancellation.
        let paymentReceived = false;
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
          amount: Math.round((pay?.amount ?? order.total ?? total) * 100), // use backend-computed payment amount (paise)
          currency: "INR",
          name: "Vegamart",
          description: `Order ${order.order_number}`,
          order_id: pay.razorpay_order_id,
          handler: async (response: any) => {
            paymentReceived = true;
            try {
              const res = await verifyMutation.mutateAsync({
                razorpay_order_id: pay.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (res?.success) {
                resolve();
              } else {
                reject(
                  new Error(
                    res?.error?.message || "Payment verification failed. Please contact support.",
                  ),
                );
              }
            } catch {
              reject(new Error("Payment verification failed. Please contact support."));
            }
          },
          modal: {
            ondismiss: () => {
              if (paymentReceived) return;
              reject(new Error("Payment was cancelled. Your order has not been charged."));
            },
          },
          prefill: {
            name: user?.name || "Customer",
            email: user?.email || "",
            contact: selectedAddress?.phone || "9999999999",
          },
          theme: {
            color: "#10b981",
          },
        };
        const paymentObject = new RazorpayCtor(options);
        paymentObject.open();
      });
    }
  };

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post<any>("/orders", data);
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || "Failed to place order");
      }
      return res.data;
    },
    onSuccess: async (res) => {
      const orders: any[] = res?.orders ?? [];
      const firstOrder = orders[0]?.order ?? null;
      if (payment === "upi" || payment === "card") {
        try {
          await runRazorpayFlow(orders);
        } catch (err) {
          // Immediately cancel the created pending order(s) so unpaid orders never remain active/booked in the system!
          await Promise.allSettled(
            orders.map((entry: any) =>
              entry?.order?.id
                ? api.post(`/orders/${entry.order.id}/cancel`, { reason: "Payment cancelled by customer" })
                : Promise.resolve()
            )
          );
          const message =
            err instanceof Error
              ? err.message
              : "Payment could not be completed. Your order was not placed.";
          toast.error(message);
          return;
        }
        clearCart();
        toast.success("Payment successful!");
        navigate({ to: "/order-success", search: { orderId: firstOrder?.id || "" } });
      } else {
        clearCart();
        toast.success("Order placed successfully via COD!");
        navigate({ to: "/order-success", search: { orderId: firstOrder?.id || "" } });
      }
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    },
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
    if (!isMinOrderMet) {
      toast.error(`Minimum order of ₹${optionMinOrder} is required for ${selectedOptionObj.label}. Please add ₹${deficitAmount.toFixed(2)} more to proceed.`);
      return;
    }

    createOrderMutation.mutate({
      address_id: selectedAddress.id,
      payment_method: payment,
      coupon_code: appliedCoupon || undefined,
      delivery_slot: selectedOptionObj.label,
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        selected_unit: item.selectedVariant || item.product.unit,
      })),
    });
  };

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

  const selectedOptionObj = effectiveOptions[deliveryOption] || effectiveOptions[0];
  const selectedDeliveryId = selectedOptionObj.id;
  const isAdvanceOption = selectedDeliveryId === "self_pickup" || selectedDeliveryId === "booking";

  const displayDeliveryFee = selectedOptionObj.fee;
  const finalOrderTotal = Math.max(0, subtotal + displayDeliveryFee + tax - discount);
  const advancePct = selectedOptionObj.advancePct;
  const upfrontPaymentAmount = isAdvanceOption && payment !== "cod"
    ? (advancePct === 0 ? finalOrderTotal : Math.max(1, Math.round(finalOrderTotal * (advancePct / 100) * 100) / 100))
    : finalOrderTotal;

  const optionMinOrder = selectedOptionObj.minOrder || 0;
  const isMinOrderMet = optionMinOrder <= 0 || subtotal >= optionMinOrder;
  const deficitAmount = Math.max(0, optionMinOrder - subtotal);

  return (
    <div className="min-h-screen bg-background pb-32 md:pb-16">
      <AppHeader title="Checkout" subtitle="Confirm your order" />

      <main className="mx-auto max-w-6xl px-4 md:px-6 lg:px-8 pt-4 md:pt-8 space-y-6">
        <div className="md:grid md:grid-cols-[1fr_380px] md:gap-6 lg:gap-8">
          <div className="space-y-4">
            {/* Store & Estimated Delivery Time Header */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-500/20">
                    <Store className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-display text-base font-bold text-foreground truncate">
                        {vendorName}
                      </h2>
                      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                        {isStoreOpen ? "🟢 Open" : "🔴 Closed"}
                      </span>
                    </div>
                    {vendorAddress ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {vendorAddress}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {items.length} {items.length === 1 ? "item" : "items"} in cart
                      </p>
                    )}
                  </div>
                </div>

                {/* Vendor Estimated Delivery Time Badge */}
                <div className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/10 border border-emerald-500/30 px-4 py-2.5 rounded-2xl shrink-0 shadow-xs">
                  <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white font-bold shrink-0 shadow-xs">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Est. Delivery Time
                    </div>
                    <div className="font-display text-sm font-black text-emerald-950 dark:text-emerald-200 flex items-center gap-1">
                      ⚡ {vendorEta}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Address Selection */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              {loadingAddr ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading addresses...
                </div>
              ) : addresses.length > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-100 text-primary">
                        <Home className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Delivery Address
                        </div>
                        <div className="font-display text-sm font-bold text-foreground">
                          {selectedAddress?.label || "Select an address"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setAddressModalOpen(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Add New
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {addresses.map((a: any) => {
                      const active = a.id === selectedAddressId;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelectedAddressId(a.id)}
                          className={`w-full flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                            active
                              ? "border-primary bg-emerald-50/60"
                              : "border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          <span
                            className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                              active ? "border-primary bg-primary" : "border-border"
                            }`}
                          >
                            {active && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground">{a.label}</span>
                              {a.is_default && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {a.full_name} · {a.line1}
                              {a.line2 ? `, ${a.line2}` : ""}, {a.city} — {a.pincode}
                            </p>
                            <p className="text-[11px] font-semibold text-foreground mt-0.5">
                              {a.phone}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold">No saved addresses</div>
                  <button
                    onClick={() => setAddressModalOpen(true)}
                    className="text-primary text-xs font-bold hover:underline"
                  >
                    Add New
                  </button>
                </div>
              )}
            </section>

            {/* Checkout Delivery Options */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold">Delivery Options</h2>
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {effectiveOptions.length} available
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {effectiveOptions.map((opt, i) => {
                  const active = i === deliveryOption;
                  const meetsMin = (opt.minOrder || 0) <= 0 || subtotal >= (opt.minOrder || 0);

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDeliveryOption(i)}
                      className={`rounded-2xl border-2 p-4 text-left transition-all flex flex-col justify-between gap-2.5 relative ${
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                          : "border-border hover:border-primary/30 bg-card"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl leading-none">{opt.icon}</span>
                        <div className="flex flex-wrap gap-1 items-center justify-end">
                          {opt.eta && (
                            <span className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" /> {opt.eta}
                            </span>
                          )}
                          {opt.minOrder > 0 && (
                            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                              meetsMin ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}>
                              Min ₹{opt.minOrder}
                            </span>
                          )}
                          {opt.advancePct > 0 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              {opt.advancePct}% Advance
                            </span>
                          )}
                          {opt.fee === 0 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              Free
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold leading-tight text-foreground">{opt.label}</div>
                        <div className="text-[10.5px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!isMinOrderMet && (
                <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 p-3.5 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-200">
                  <span className="text-base shrink-0">⚠️</span>
                  <div className="leading-snug">
                    <strong>Minimum order requirement not met for {selectedOptionObj.label}:</strong> Minimum cart total of <strong>₹{optionMinOrder}</strong> required. Add <strong>₹{deficitAmount.toFixed(2)}</strong> more to your cart to use this delivery option.
                  </div>
                </div>
              )}
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
                    <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Available Offers
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                      {AVAILABLE_OFFERS.length === 0 && (
                        <div className="text-[11px] text-muted-foreground py-2">
                          No offers available currently.
                        </div>
                      )}
                      {AVAILABLE_OFFERS.map((offer: any) => (
                        <button
                          key={offer.code}
                          onClick={async () => {
                            const res = await applyCoupon(offer.code);
                            if (res.success) toast.success("Coupon applied!");
                            else toast.error(res.message);
                          }}
                          className="shrink-0 flex flex-col items-start gap-1 rounded-2xl border border-dashed border-emerald-500/50 bg-emerald-50/50 p-3 text-left transition-colors hover:bg-emerald-50 w-32"
                        >
                          <div className="font-bold text-emerald-700 text-[11px] bg-emerald-100 px-1.5 py-0.5 rounded-md">
                            {offer.code}
                          </div>
                          <div className="text-[10.5px] font-medium text-emerald-900 leading-tight">
                            {offer.desc}
                          </div>
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
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                        {appliedCoupon} Applied
                      </div>
                      <div className="text-[10px] font-medium text-emerald-600 mt-0.5">
                        You saved ₹{discount.toFixed(2)} on this order
                      </div>
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

              <div className="flex items-center justify-between text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-2xl">
                <span className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                  <Clock className="h-3.5 w-3.5 text-emerald-600" /> Estimated Time:
                </span>
                <span className="font-extrabold text-emerald-700 dark:text-emerald-300 text-xs">
                  {selectedOptionObj.eta || vendorEta}
                </span>
              </div>

              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Item Subtotal</span>
                  <span className="font-semibold tabular-nums">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    {displayDeliveryFee === 0 ? "FREE" : `₹${displayDeliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes & Charges (GST)</span>
                  <span className="font-semibold tabular-nums">₹{tax.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Coupon Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                  </div>
                )}
              </dl>

              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold">Total Order Value</span>
                  <span className="font-display text-sm font-bold tabular-nums">
                    ₹{finalOrderTotal.toFixed(2)}
                  </span>
                </div>
                {isAdvanceOption && payment !== "cod" && advancePct > 0 && advancePct < 100 && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-xs font-semibold">{advancePct}% Upfront ({selectedOptionObj.label})</span>
                    <span className="text-xs font-bold tabular-nums">
                      ₹{upfrontPaymentAmount.toFixed(2)}
                    </span>
                  </div>
                )}
                {isAdvanceOption && payment !== "cod" && advancePct > 0 && advancePct < 100 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="text-xs font-medium">Balance at Collection</span>
                    <span className="text-xs font-medium tabular-nums">
                      ₹{(finalOrderTotal - upfrontPaymentAmount).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-display text-sm font-bold">
                    {isAdvanceOption && payment !== "cod" ? "To Pay Now" : "Total Payable"}
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums text-primary">
                    ₹{upfrontPaymentAmount.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground bg-muted p-2.5 rounded-2xl">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                Verified &amp; Protected by Razorpay 256-bit SSL
              </div>

              {!isMinOrderMet ? (
                <div className="hidden md:block text-center p-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-amber-800">
                  Add ₹{deficitAmount.toFixed(2)} more for {selectedOptionObj.label}
                </div>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={createOrderMutation.isPending || items.length === 0}
                  className="hidden md:flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createOrderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isAdvanceOption && payment !== "cod" && advancePct > 0 && advancePct < 100 ? `Pay ₹${upfrontPaymentAmount.toFixed(2)} Advance & Place Order` : "Place Order"} <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
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
                {isAdvanceOption && payment !== "cod" && advancePct > 0 && advancePct < 100 ? `To Pay Now (${advancePct}%)` : "Total Payable"}
              </div>
              <div className="font-display text-lg font-bold leading-none tabular-nums">
                ₹{upfrontPaymentAmount.toFixed(2)}
              </div>
            </div>
            {!isMinOrderMet ? (
              <div className="text-center bg-amber-400 text-amber-950 font-bold text-[11px] px-3 py-2 rounded-2xl shadow-xs">
                Min ₹{optionMinOrder} Req.
              </div>
            ) : (
              <button
                onClick={handlePlaceOrder}
                disabled={createOrderMutation.isPending || items.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-emerald-900 font-bold text-xs h-11 px-4 shadow-xs hover:bg-emerald-50 disabled:opacity-50"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isAdvanceOption && payment !== "cod" && advancePct > 0 && advancePct < 100
                      ? `Pay ₹${upfrontPaymentAmount.toFixed(2)} Advance`
                      : "Place Order"}{" "}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
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
