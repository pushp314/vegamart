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
  Plus,
  Percent,
  AlertTriangle,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useCart } from "@/context/cart-context";
import { AddressModal, AddressData } from "@/components/marketplace/address-modal";
import { PaymentFailureModal } from "@/components/checkout/PaymentFailureModal";
import { Label } from "@/components/ui/label";

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
    taxRatePercent,
    discount,
    total,
    clearCart,
    appliedCoupon,
    applyCoupon,
    removeCoupon,
    summary,
  } = useCart();

  const [payment, setPayment] = useState("upi");
  const [paymentType, setPaymentType] = useState<"FULL" | "ADVANCE">("FULL");
  const [deliveryOption, setDeliveryOption] = useState(0);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [failureModalOpen, setFailureModalOpen] = useState(false);
  const [pendingFailedOrders, setPendingFailedOrders] = useState<any[]>([]);
  const [paymentFailureReason, setPaymentFailureReason] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const bookingConfig = rawConfigs?.booking ?? {
    enabled: false,
    advance_percentage: 20,
    min_order: 0,
    estimated_time: "1-2 days",
    online_payment_enabled: true,
    cod_enabled: false,
    full_payment_enabled: true,
    advance_payment_enabled: true,
  };
  const selfPickupConfig = rawConfigs?.self_pickup ?? {
    enabled: true,
    advance_percentage: vendorGroup?.advance_payment_percentage ?? 10,
    min_order: 0,
    estimated_time: "15 mins",
    online_payment_enabled: true,
    cod_enabled: true,
    full_payment_enabled: true,
    advance_payment_enabled: true,
  };
  const shopDeliveryConfig = rawConfigs?.shop_delivery ?? {
    enabled: !!(items.some((i) => !!(i.product?.vendor?.provides_delivery || (i.product as any)?.vendor_provides_delivery))),
    delivery_fee: vendorGroup?.delivery_fee ?? 30,
    min_order: 0,
    estimated_time: "30-45 mins",
    online_payment_enabled: true,
    cod_enabled: true,
    full_payment_enabled: true,
    advance_payment_enabled: false,
    advance_percentage: 20,
  };
  const deliveryPartnerConfig = rawConfigs?.delivery_partner ?? {
    enabled: true,
    online_payment_enabled: true,
    cod_enabled: true,
    full_payment_enabled: true,
    advance_payment_enabled: false,
    advance_percentage: 20,
  };

  const adminDeliveryFee = vendorGroup?.admin_delivery_fee ?? publicSettings.delivery_fee ?? 30;
  const adminMinOrder = vendorGroup?.admin_min_order ?? publicSettings.min_order_value ?? 0;
  const adminFreeDeliveryThreshold = vendorGroup?.admin_free_delivery_threshold ?? publicSettings.free_delivery_threshold ?? 0;

  const isRoamingVendor = items.some(
    (i) =>
      (i.product?.vendor as any)?.vendor_type === "roaming" ||
      !!(i.product?.vendor as any)?.provides_vendor_comes_to_me
  );

  // Multi-vendor consolidated delivery detection
  const uniqueVendorIds = new Set(items.map((i) => i.product?.vendor_id || (i.product as any)?.vendorId).filter(Boolean));
  const isMultiVendorCart = uniqueVendorIds.size > 1;
  const isConsolidatedDelivery = summary?.is_consolidated_delivery || (isMultiVendorCart && isVegaMartFleetEnabled);
  const consolidatedDeliveryFee = isConsolidatedDelivery ? (summary?.delivery_fee ?? adminDeliveryFee) : 0;

  interface CheckoutDeliveryOption {
    id: string;
    label: string;
    desc: string;
    icon: string;
    eta: string;
    advancePct: number;
    minOrder: number;
    fee: number;
    onlinePaymentEnabled: boolean;
    codEnabled: boolean;
    fullPaymentEnabled: boolean;
    advancePaymentEnabled: boolean;
  }

  const DELIVERY_OPTIONS: CheckoutDeliveryOption[] = [
    ...(isRoamingVendor
      ? [{
          id: "vendor_comes_to_me",
          label: "Vendor comes to me",
          desc: "Moving street cart arrives at your door",
          icon: "🛒",
          eta: `~${vendorEta || "15-20 mins"}`,
          advancePct: 0,
          minOrder: 0,
          fee: 0,
          onlinePaymentEnabled: true,
          codEnabled: true,
          fullPaymentEnabled: true,
          advancePaymentEnabled: false,
        }]
      : []),
    ...(bookingConfig.enabled
      ? [
          {
            id: "booking",
            label: "Advance Booking",
            desc: `Advance scheduled booking${bookingConfig.advance_payment_enabled ? ` (${bookingConfig.advance_percentage}% upfront)` : ""}`,
            icon: "📅",
            eta: `~${bookingConfig.estimated_time || "1-2 days"}`,
            advancePct: Number(bookingConfig.advance_percentage) || 20,
            minOrder: Number(bookingConfig.min_order) || 0,
            fee: 0,
            onlinePaymentEnabled: bookingConfig.online_payment_enabled !== false,
            codEnabled: Boolean(bookingConfig.cod_enabled),
            fullPaymentEnabled: bookingConfig.full_payment_enabled !== false,
            advancePaymentEnabled: Boolean(bookingConfig.advance_payment_enabled),
          },
        ]
      : []),
    ...(selfPickupConfig.enabled
      ? [
          {
            id: "self_pickup",
            label: "Self Pickup",
            desc: `Collect at store counter${selfPickupConfig.advance_payment_enabled ? ` (${selfPickupConfig.advance_percentage}% upfront)` : ""}`,
            icon: "🚶",
            eta: `Ready in ~${selfPickupConfig.estimated_time || "15 mins"}`,
            advancePct: Number(selfPickupConfig.advance_percentage) || 10,
            minOrder: Number(selfPickupConfig.min_order) || 0,
            fee: 0,
            onlinePaymentEnabled: selfPickupConfig.online_payment_enabled !== false,
            codEnabled: selfPickupConfig.cod_enabled !== false,
            fullPaymentEnabled: selfPickupConfig.full_payment_enabled !== false,
            advancePaymentEnabled: Boolean(selfPickupConfig.advance_payment_enabled),
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
            advancePct: Number(shopDeliveryConfig.advance_percentage) || 20,
            minOrder: Number(shopDeliveryConfig.min_order) || 0,
            fee: Number(shopDeliveryConfig.delivery_fee) || 0,
            onlinePaymentEnabled: shopDeliveryConfig.online_payment_enabled !== false,
            codEnabled: shopDeliveryConfig.cod_enabled !== false,
            fullPaymentEnabled: shopDeliveryConfig.full_payment_enabled !== false,
            advancePaymentEnabled: Boolean(shopDeliveryConfig.advance_payment_enabled),
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
            advancePct: Number(deliveryPartnerConfig.advance_percentage) || 20,
            minOrder: Number(adminMinOrder) || 0,
            fee: (adminFreeDeliveryThreshold > 0 && subtotal >= adminFreeDeliveryThreshold) ? 0 : Number(adminDeliveryFee) || 30,
            onlinePaymentEnabled: deliveryPartnerConfig.online_payment_enabled !== false,
            codEnabled: deliveryPartnerConfig.cod_enabled !== false,
            fullPaymentEnabled: deliveryPartnerConfig.full_payment_enabled !== false,
            advancePaymentEnabled: Boolean(deliveryPartnerConfig.advance_payment_enabled),
          },
        ]
      : []),
  ];

  // When multi-vendor cart with consolidated VegaMart delivery, show only delivery_partner option
  const consolidatedOptions: CheckoutDeliveryOption[] = isConsolidatedDelivery
    ? [{
        id: "delivery_partner",
        label: "VegaMart Home Delivery",
        desc: `All stores picked up by VegaMart rider (₹${consolidatedDeliveryFee === 0 ? "Free" : consolidatedDeliveryFee})`,
        icon: "🏍️",
        eta: `~${platformDeliveryEta || vendorEta}`,
        advancePct: Number(deliveryPartnerConfig.advance_percentage) || 20,
        minOrder: Number(adminMinOrder) || 0,
        fee: consolidatedDeliveryFee,
        onlinePaymentEnabled: deliveryPartnerConfig.online_payment_enabled !== false,
        codEnabled: deliveryPartnerConfig.cod_enabled !== false,
        fullPaymentEnabled: deliveryPartnerConfig.full_payment_enabled !== false,
        advancePaymentEnabled: Boolean(deliveryPartnerConfig.advance_payment_enabled),
      }]
    : DELIVERY_OPTIONS;

  const effectiveOptions: CheckoutDeliveryOption[] = (isConsolidatedDelivery ? consolidatedOptions : DELIVERY_OPTIONS).length > 0
    ? (isConsolidatedDelivery ? consolidatedOptions : DELIVERY_OPTIONS)
    : [
    {
      id: "self_pickup",
      label: "Self Pickup",
      desc: "Store pickup",
      icon: "🚶",
      eta: `Ready in ~${selfPickupConfig.estimated_time || "15 mins"}`,
      advancePct: 10,
      minOrder: 0,
      fee: 0,
      onlinePaymentEnabled: true,
      codEnabled: true,
      fullPaymentEnabled: true,
      advancePaymentEnabled: true,
    }
  ];

  useEffect(() => {
    setDeliveryOption((i) => Math.min(i, Math.max(0, effectiveOptions.length - 1)));
  }, [effectiveOptions.length]);

  const selectedOptionObj = effectiveOptions[deliveryOption] || effectiveOptions[0];

  // Auto-synchronize Payment Type (Full vs Advance) & Payment Method (Online vs COD)
  useEffect(() => {
    if (!selectedOptionObj) return;

    // 1. Sync Payment Type
    if (!selectedOptionObj.fullPaymentEnabled && selectedOptionObj.advancePaymentEnabled) {
      setPaymentType("ADVANCE");
    } else if (selectedOptionObj.fullPaymentEnabled && !selectedOptionObj.advancePaymentEnabled) {
      setPaymentType("FULL");
    }

    // 2. Sync Payment Method
    if (!selectedOptionObj.onlinePaymentEnabled && selectedOptionObj.codEnabled) {
      setPayment("cod");
    } else if (selectedOptionObj.onlinePaymentEnabled && !selectedOptionObj.codEnabled && payment === "cod") {
      setPayment("upi");
    }
  }, [selectedOptionObj]);

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

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

  const selectedAddress = addresses.find((a: any) => a.id === selectedAddressId) || addresses[0];

  // Geofence & Delivery Radius calculation
  const vendorLat = vendorData?.latitude || vendorGroup?.latitude;
  const vendorLng = vendorData?.longitude || vendorGroup?.longitude;
  const vendorDeliveryRadius = Number(vendorData?.delivery_radius_km || 5);
  
  const addressLat = selectedAddress?.latitude ? Number(selectedAddress.latitude) : null;
  const addressLng = selectedAddress?.longitude ? Number(selectedAddress.longitude) : null;

  let deliveryDistanceKm: number | null = null;
  if (vendorLat && vendorLng && addressLat && addressLng) {
    deliveryDistanceKm = calculateDistanceKm(addressLat, addressLng, Number(vendorLat), Number(vendorLng));
  }

  const isSelfPickup = selectedOptionObj?.id === "self_pickup";
  const isOutOfDeliveryRadius = !isSelfPickup && deliveryDistanceKm !== null && deliveryDistanceKm > vendorDeliveryRadius;

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

  const handleRetryRazorpayFlow = async (ordersList: any[]) => {
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      throw new Error("Razorpay SDK failed to load. Are you online?");
    }
    const RazorpayCtor = (window as any).Razorpay;
    for (const entry of ordersList) {
      const orderId = entry?.order?.id || entry?.id;
      if (!orderId) continue;

      const retryRes = await api.post<any>(`/payments/${orderId}/retry`, {});
      if (!retryRes.success || !retryRes.data) {
        throw new Error(retryRes.error?.message || "Failed to initialize payment retry.");
      }
      const retryData = retryRes.data;

      await new Promise<void>((resolve, reject) => {
        let paymentReceived = false;
        const options = {
          key: retryData.key || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
          amount: Math.round((retryData.amount || total) * 100),
          currency: retryData.currency || "INR",
          name: "Vegamart",
          description: `Order ${retryData.order_number}`,
          order_id: retryData.razorpay_order_id,
          handler: async (response: any) => {
            paymentReceived = true;
            try {
              const res = await verifyMutation.mutateAsync({
                razorpay_order_id: retryData.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (res?.success) {
                clearCart();
                toast.success("Payment successful!");
                navigate({ to: "/order-success", search: { orderId } });
                resolve();
              } else {
                reject(new Error(res?.error?.message || "Payment verification failed."));
              }
            } catch {
              reject(new Error("Payment verification failed."));
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
      clearCart();
      toast.success("Order placed successfully via Cash on Delivery!");
      navigate({ to: "/order-success", search: { orderId: res?.data?.master_order_id || "" } });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to place order");
    },
  });

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty!");
      return;
    }
    if (!selectedAddress || !selectedAddress.id) {
      toast.error("Please add and select a valid delivery address.");
      return;
    }
    if (isOutOfDeliveryRadius) {
      toast.error(
        `Selected address (${deliveryDistanceKm} km away) is outside ${vendorName}'s delivery limit of ${vendorDeliveryRadius} km. Please select a delivery address in Sakti District or choose Self Pickup.`
      );
      return;
    }
    if (!selectedOptionObj.onlinePaymentEnabled && !selectedOptionObj.codEnabled) {
      toast.error(`No payment methods are available for ${selectedOptionObj.label}. Please choose another delivery option.`);
      return;
    }
    if (!isMinOrderMet) {
      toast.error(`Minimum order of ₹${optionMinOrder} is required for ${selectedOptionObj.label}. Please add ₹${deficitAmount.toFixed(2)} more to proceed.`);
      return;
    }

    const payload = {
      address_id: selectedAddress.id,
      payment_method: payment,
      payment_type: paymentType,
      coupon_code: appliedCoupon || undefined,
      delivery_slot: selectedOptionObj.label,
      items: items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
        selected_unit: item.selectedVariant || item.product.unit,
      })),
    };

    // 1. COD Orders are created immediately as CONFIRMED / UNPAID
    if (payment === "cod") {
      createOrderMutation.mutate(payload);
      return;
    }

    // 2. Online Payment (UPI / Card): Orders are ONLY created after verified payment
    setIsProcessingPayment(true);
    try {
      // Step A: Initiate payment session without writing order to DB
      const initRes = await api.post<any>("/payments/initiate-checkout", payload);
      if (!initRes.success || !initRes.data) {
        throw new Error(initRes.error?.message || "Failed to initiate online payment session.");
      }
      const sessionData = initRes.data;

      // Step B: Load Razorpay SDK and open payment modal
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Payment gateway SDK failed to load. Please check your internet connection.");
      }

      const RazorpayCtor = (window as any).Razorpay;
      await new Promise<void>((resolve, reject) => {
        let paymentReceived = false;
        const options = {
          key: sessionData.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_xxxxxxxxxxxx",
          amount: Math.round(sessionData.amount),
          currency: sessionData.currency || "INR",
          name: "Vegamart",
          description: `Checkout (${items.length} items)`,
          order_id: sessionData.razorpay_order_id,
          handler: async (response: any) => {
            paymentReceived = true;
            try {
              // Step C: Server-side cryptographic verification and atomic order creation
              const verifyRes = await api.post<any>("/payments/verify-and-create-order", {
                razorpay_order_id: sessionData.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                checkout_payload: sessionData.checkout_payload || payload,
              });

              if (verifyRes.success && verifyRes.data) {
                clearCart();
                toast.success("Payment successful! Your order has been placed.");
                const firstOrder = verifyRes.data?.orders?.[0]?.order;
                navigate({ to: "/order-success", search: { orderId: verifyRes?.data?.master_order_id || "" } });
                resolve();
              } else {
                reject(new Error(verifyRes.error?.message || "Payment verification failed on server."));
              }
            } catch (err: any) {
              reject(err instanceof Error ? err : new Error("Payment verification failed on server."));
            }
          },
          modal: {
            ondismiss: () => {
              if (paymentReceived) return;
              reject(new Error("Payment was cancelled. Your order was not placed and your cart is saved."));
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
    } catch (err: any) {
      toast.info(err?.message || "Payment was not completed.");
    } finally {
      setIsProcessingPayment(false);
    }
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

  const displayDeliveryFee = selectedOptionObj.fee;
  
  let displayTax = tax;
  if (selectedOptionObj.id === "delivery_partner" && displayDeliveryFee > 0) {
    displayTax = tax + (displayDeliveryFee * taxRatePercent) / 100;
  }

  const finalOrderTotal = Math.max(0, subtotal + displayDeliveryFee + displayTax - discount);
  const isAdvanceSelected = paymentType === "ADVANCE" && selectedOptionObj.advancePaymentEnabled && payment !== "cod";
  const advancePct = selectedOptionObj.advancePct || 20;
  const upfrontPaymentAmount = isAdvanceSelected
    ? (advancePct <= 0 || advancePct >= 100 ? finalOrderTotal : Math.max(1, Math.round(finalOrderTotal * (advancePct / 100) * 100) / 100))
    : (payment === "cod" ? 0 : finalOrderTotal);
  const balanceDue = Math.max(0, finalOrderTotal - (payment === "cod" ? 0 : upfrontPaymentAmount));

  const optionMinOrder = selectedOptionObj.minOrder || 0;
  const isMinOrderMet = optionMinOrder <= 0 || subtotal >= optionMinOrder;
  const deficitAmount = Math.max(0, optionMinOrder - subtotal);

  // Filter available payment methods based on selected delivery option
  const availablePayments = PAYMENTS.filter((p) => {
    if (p.v === "cod") {
      return selectedOptionObj.codEnabled;
    } else {
      return selectedOptionObj.onlinePaymentEnabled;
    }
  });

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
                        {isConsolidatedDelivery
                          ? `${uniqueVendorIds.size} Stores`
                          : vendorName}
                      </h2>
                      {isConsolidatedDelivery ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-100 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-300 dark:border-blue-800">
                          📦 Combined Order
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                          {isStoreOpen ? "🟢 Open" : "🔴 Closed"}
                        </span>
                      )}
                    </div>
                    {isConsolidatedDelivery ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {summary?.groups?.map((g: any) => g.vendor_name).join(", ") || "Multiple vendors"}
                      </p>
                    ) : vendorAddress ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {vendorAddress}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-2xl bg-muted/60 p-2.5 px-3.5 border border-border/50 text-xs self-start sm:self-auto">
                  <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none">Option Time</span>
                    <span className="font-bold text-foreground">{selectedOptionObj.eta || vendorEta}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Delivery Address */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold">Delivery Address</h2>
                <button
                  onClick={() => setAddressModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add New
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {addresses.length === 0 ? (
                  <div className="text-center py-6 border border-dashed rounded-2xl p-4 bg-muted/30">
                    <p className="text-xs text-muted-foreground">No saved addresses found.</p>
                    <button
                      onClick={() => setAddressModalOpen(true)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Address
                    </button>
                  </div>
                ) : (
                  addresses.map((a: any) => {
                    const active = selectedAddress?.id === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setSelectedAddressId(a.id)}
                        className={`w-full flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          active
                            ? "border-primary bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
                            : "border-border hover:border-primary/40 bg-card"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl ${
                            active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold capitalize text-foreground">
                              {a.type || "Home"}
                            </span>
                            {a.is_default && (
                              <span className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                Default
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {a.line1}, {a.city}, {a.pincode}
                          </p>
                        </div>
                        <span
                          className={`mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                            active ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })
                )}

                {/* 📍 Out of Delivery Radius Geo-Fence Warning */}
                {isOutOfDeliveryRadius && selectedAddress && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-2.5 mt-2 animate-in fade-in">
                    <div className="flex items-center gap-2 font-bold text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Address Out of Delivery Zone ({deliveryDistanceKm} km away)</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {vendorName} currently delivers within a maximum of <strong className="text-foreground">{vendorDeliveryRadius} km</strong> (Sakti District). Your selected address in <strong className="text-foreground">{selectedAddress.city || selectedAddress.area || "selected location"}</strong> is beyond the deliverable zone.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAddressModalOpen(true)}
                        className="text-xs font-bold px-3 py-1 rounded-xl bg-card border border-border hover:bg-muted text-foreground transition-colors"
                      >
                        Change Delivery Address
                      </button>
                      {selfPickupConfig.enabled && (
                        <button
                          type="button"
                          onClick={() => {
                            const idx = effectiveOptions.findIndex((o) => o.id === "self_pickup");
                            if (idx >= 0) setDeliveryOption(idx);
                          }}
                          className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                        >
                          Switch to Self Pickup
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Delivery Options */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="font-display text-base font-bold">Delivery &amp; Pickup Options</h2>
                  <p className="text-xs text-muted-foreground">
                    {isConsolidatedDelivery
                      ? "VegaMart handles all store pickups for you"
                      : "Select how you want to receive your order"}
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {effectiveOptions.length} available
                </span>
              </div>

              {/* Multi-store consolidated delivery info banner */}
              {isConsolidatedDelivery && (
                <div className="mb-3 flex items-start gap-2.5 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 animate-in fade-in">
                  <span className="text-lg shrink-0 mt-[-1px]">📦</span>
                  <div>
                    <strong>Multi-store order — Single delivery charge!</strong>
                    <p className="mt-0.5 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
                      Your cart has items from {uniqueVendorIds.size} different stores. A VegaMart rider will pick up from all stores and deliver everything together with just one delivery fee{consolidatedDeliveryFee === 0 ? " (Free!)" : ` of ₹${consolidatedDeliveryFee}`}.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {effectiveOptions.map((opt, i) => {
                  const active = deliveryOption === i;
                  const meetsMin = opt.minOrder <= 0 || subtotal >= opt.minOrder;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDeliveryOption(i)}
                      className={`relative flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all ${
                        active
                          ? "border-primary bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 bg-card"
                      } ${!meetsMin ? "opacity-90" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xl shrink-0">{opt.icon}</span>
                        <div className="flex items-center gap-1 flex-wrap justify-end">
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
                          {opt.fee === 0 && (
                            <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                              Free Delivery
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
            </section>

            {/* Payment Method & Type Controls */}
            <section className="rounded-3xl bg-card border p-5 shadow-soft space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold">Payment Method &amp; Type</h2>
                  <p className="text-xs text-muted-foreground">Configured independently for {selectedOptionObj.label}</p>
                </div>
              </div>

              {/* 1. Payment Type Selector: Full Payment vs Advance Payment */}
              {selectedOptionObj.fullPaymentEnabled && selectedOptionObj.advancePaymentEnabled ? (
                <div className="rounded-2xl bg-muted/40 border p-3.5 space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-primary" /> Choose Payment Type
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Full Payment Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentType("FULL")}
                      className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                        paymentType === "FULL"
                          ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">💯 Full Payment (100%)</span>
                        <span className={`grid h-4 w-4 place-items-center rounded-full border ${paymentType === "FULL" ? "border-primary bg-primary" : "border-border"}`}>
                          {paymentType === "FULL" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Pay total ₹{finalOrderTotal.toFixed(2)} right now.
                      </p>
                    </button>

                    {/* Advance Payment Option */}
                    <button
                      type="button"
                      onClick={() => setPaymentType("ADVANCE")}
                      className={`flex flex-col rounded-xl border p-3 text-left transition-all ${
                        paymentType === "ADVANCE"
                          ? "border-purple-600 bg-purple-500/10 shadow-xs ring-2 ring-purple-500/20"
                          : "border-border hover:border-purple-500/40 bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-foreground">⏳ Advance ({advancePct}%)</span>
                        <span className={`grid h-4 w-4 place-items-center rounded-full border ${paymentType === "ADVANCE" ? "border-purple-600 bg-purple-600" : "border-border"}`}>
                          {paymentType === "ADVANCE" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Pay ₹{((finalOrderTotal * (advancePct / 100))).toFixed(2)} now, ₹{(finalOrderTotal - (finalOrderTotal * (advancePct / 100))).toFixed(2)} on arrival.
                      </p>
                    </button>
                  </div>
                </div>
              ) : selectedOptionObj.advancePaymentEnabled ? (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-xs text-purple-900 dark:text-purple-200">
                  <Percent className="h-4 w-4 text-purple-600 shrink-0" />
                  <div>
                    <strong>Advance Payment Required ({advancePct}%):</strong> Store requires an upfront token payment of {advancePct}% for {selectedOptionObj.label}.
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-900 dark:text-emerald-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <strong>Full Payment (100%):</strong> Total order value is paid upfront or via cash on delivery.
                  </div>
                </div>
              )}

              {/* 2. Payment Method Selector */}
              {availablePayments.length === 0 ? (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                  <span>⚠️</span>
                  <span>No payment methods are enabled by the vendor for {selectedOptionObj.label}. Please select another delivery option.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {availablePayments.map((p) => {
                    const active = payment === p.v;
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.v}
                        type="button"
                        onClick={() => setPayment(p.v)}
                        className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${
                          active
                            ? "border-primary bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
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
              )}
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
                  <span className="font-semibold tabular-nums">₹{displayTax.toFixed(2)}</span>
                </div>
                {summary?.additional_charges && summary.additional_charges.length > 0 && summary.additional_charges.map((charge: any) => (
                  <div key={charge.id} className="flex justify-between">
                    <span className="text-muted-foreground">{charge.name}</span>
                    <span className="font-semibold tabular-nums">₹{Number(charge.amount).toFixed(2)}</span>
                  </div>
                ))}

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

                {/* Advance vs Remaining Breakdown */}
                {isAdvanceSelected && (
                  <>
                    <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                      <span className="text-xs font-semibold">{advancePct}% Advance (Online)</span>
                      <span className="text-xs font-bold tabular-nums">
                        ₹{upfrontPaymentAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-xs font-medium">Balance due on delivery/pickup</span>
                      <span className="text-xs font-medium tabular-nums">
                        ₹{balanceDue.toFixed(2)}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="font-display text-sm font-bold">
                    {isAdvanceSelected ? "To Pay Now" : (payment === "cod" ? "Pay on Delivery/Pickup" : "Total Payable")}
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums text-primary">
                    ₹{(payment === "cod" ? finalOrderTotal : upfrontPaymentAmount).toFixed(2)}
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
              ) : isOutOfDeliveryRadius ? (
                <div className="hidden md:block text-center p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs font-bold space-y-1">
                  <div>Out of Delivery Range ({deliveryDistanceKm} km)</div>
                  <div className="text-[10px] font-normal text-muted-foreground">Store limit: {vendorDeliveryRadius} km (Sakti District)</div>
                </div>
              ) : availablePayments.length === 0 ? (
                <div className="hidden md:block text-center p-3 rounded-2xl bg-destructive/10 text-destructive text-xs font-bold border border-destructive/20">
                  Payment unavailable for this delivery option
                </div>
              ) : (
                <button
                  onClick={handlePlaceOrder}
                  disabled={createOrderMutation.isPending || isProcessingPayment || items.length === 0 || isOutOfDeliveryRadius}
                  className="hidden md:flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-sm h-12 shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createOrderMutation.isPending || isProcessingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isAdvanceSelected
                        ? `Pay ₹${upfrontPaymentAmount.toFixed(2)} Advance & Place Order`
                        : payment === "cod"
                        ? "Place Order (Cash on Delivery)"
                        : `Pay ₹${finalOrderTotal.toFixed(2)} & Place Order`}{" "}
                      <ArrowRight className="h-4 w-4" />
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
                {isAdvanceSelected
                  ? `Pay Now (${advancePct}%)`
                  : payment === "cod"
                  ? "Due on Delivery"
                  : "Total Payable"}
              </div>
              <div className="font-display text-lg font-bold leading-none tabular-nums">
                ₹{(payment === "cod" ? finalOrderTotal : upfrontPaymentAmount).toFixed(2)}
              </div>
            </div>
            {!isMinOrderMet ? (
              <div className="text-center bg-amber-400 text-amber-950 font-bold text-[11px] px-3 py-2 rounded-2xl shadow-xs">
                Min ₹{optionMinOrder} Req.
              </div>
            ) : isOutOfDeliveryRadius ? (
              <div className="text-center bg-amber-400 text-amber-950 font-bold text-[11px] px-3 py-2 rounded-2xl shadow-xs">
                Out of Range ({deliveryDistanceKm}km)
              </div>
            ) : availablePayments.length === 0 ? (
              <div className="text-center bg-destructive text-destructive-foreground font-bold text-[11px] px-3 py-2 rounded-2xl">
                Unavailable
              </div>
            ) : (
              <button
                onClick={handlePlaceOrder}
                disabled={createOrderMutation.isPending || isProcessingPayment || items.length === 0 || isOutOfDeliveryRadius}
                className="inline-flex items-center gap-2 rounded-2xl bg-white text-emerald-900 font-bold text-xs h-11 px-4 shadow-xs hover:bg-emerald-50 disabled:opacity-50"
              >
                {createOrderMutation.isPending || isProcessingPayment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isAdvanceSelected
                      ? `Pay ₹${upfrontPaymentAmount.toFixed(2)} Advance`
                      : payment === "cod"
                      ? "Place Order (COD)"
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

      <PaymentFailureModal
        isOpen={failureModalOpen}
        onClose={() => setFailureModalOpen(false)}
        orders={pendingFailedOrders}
        errorMessage={paymentFailureReason}
        onRetryRazorpay={handleRetryRazorpayFlow}
      />
    </div>
  );
}
