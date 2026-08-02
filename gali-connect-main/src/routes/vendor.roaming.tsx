import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Wifi,
  WifiOff,
  MapPin,
  Package,
  Bell,
  Store,
  Battery,
  ArrowRight,
  User,
  QrCode,
  X,
  Loader2,
  Megaphone,
  Send,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Compass,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/context/auth-context";
import { authStorage } from "@/lib/api";
import { addStreetBroadcast } from "@/lib/street-broadcasts";

export const Route = createFileRoute("/vendor/roaming")({
  component: RoamingVendorDashboard,
});

function RoamingVendorDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Schedule Broadcast Form State
  const [bcastStreet, setBcastStreet] = useState("4th Main Rd, Jayanagar 4th Block");
  const [bcastTime, setBcastTime] = useState("Today at 5:30 PM");
  const [bcastProduce, setBcastProduce] = useState("Fresh Farm Tomatoes, Baby Spinach, Shimla Mirch");
  const [bcastNote, setBcastNote] = useState("Fresh morning harvest! ₹5 off on Palak bunches.");
  const [isPublishingBcast, setIsPublishingBcast] = useState(false);

  // Role Protection
  useEffect(() => {
    if (user && user.role !== "vendor") {
      toast.error("Access restricted to registered Vendors only.");
      if (user.role === "delivery") navigate({ to: "/delivery" });
      else if (user.role === "admin" || user.role === "super_admin") navigate({ to: "/admin" });
      else navigate({ to: "/" });
    }
  }, [user, navigate]);

  // Live Location & Broadcast States
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [incomingAlert, setIncomingAlert] = useState<{
    address: string;
    note?: string;
    customer_name?: string;
    time: string;
  } | null>(null);

  // Fetch Vendor Profile
  const { data: vendorRes } = useQuery({
    queryKey: ["vendorProfile"],
    queryFn: () => api.get<{ data: any }>("/vendors/me"),
  });
  const vendor = vendorRes?.data?.data || vendorRes?.data;

  // Fetch Categories for product creation
  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ data: any }>("/categories"),
  });
  const rawCategories = categoriesRes?.data?.data || categoriesRes?.data || [];
  const categoriesList = Array.isArray(rawCategories) ? rawCategories : [];
  const defaultCategoryId = categoriesList[0]?.id || "00000000-0000-0000-0000-000000000001";

  // Fetch Vendor Earnings
  const { data: earningsRes } = useQuery({
    queryKey: ["vendorEarnings"],
    queryFn: () => api.get<{ data: any }>("/vendors/me/earnings"),
  });
  const earnings = earningsRes?.data?.data || earningsRes?.data || { today_earnings: 0, total_orders: 0 };

  // Listen for incoming Gali Bell alerts via WebSocket
  useEffect(() => {
    if (!vendor?.id) return;

    const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsURL = baseURL.replace("http://", "ws://").replace("https://", "wss://");
    const token = authStorage.getAccessToken();
    const ws = new WebSocket(
      `${wsURL}/api/v1/vendors/${vendor.id}/stream-alerts${token ? `?token=${encodeURIComponent(token)}` : ""}`
    );

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "gali_bell_alert" && payload.data) {
          const data = payload.data;
          setIncomingAlert({
            address: data.address,
            note: data.note,
            customer_name: data.customer_name || "Customer",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
          toast.success(`🔔 Street Call! ${data.address} requested your cart!`);
          if ("vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        }
      } catch (err) {
        console.error("Alert WS error:", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [vendor?.id]);

  // Local inventory state with persistence fallback
  const [localInventory, setLocalInventory] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("vegamart_cart_inventory");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Fetch Vendor Products
  const { data: productsRes, isLoading: isProductsLoading } = useQuery({
    queryKey: ["vendorProducts", vendor?.id],
    queryFn: () => api.get<any[]>(`/products?vendor_id=${vendor?.id}`),
    enabled: !!vendor?.id,
  });

  const remoteProducts = Array.isArray(productsRes?.data)
    ? productsRes.data
    : (productsRes?.data as any)?.data || [];
  
  const inventory = remoteProducts.length > 0 ? remoteProducts : localInventory;

  // Toggle Product Stock Mutation
  const toggleStockMutation = useMutation({
    mutationFn: ({ id, inStock }: { id: string; inStock: boolean }) =>
      api.put(`/products/${id}`, { is_active: inStock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorProducts", vendor?.id] });
    },
  });

  const toggleInventoryItem = (id: string, currentStatus: boolean) => {
    const updated = inventory.map((item: any) =>
      item.id === id ? { ...item, is_active: !currentStatus } : item
    );
    setLocalInventory(updated);
    localStorage.setItem("vegamart_cart_inventory", JSON.stringify(updated));
    toggleStockMutation.mutate({ id, inStock: !currentStatus });
  };

  // Add New Product State & Submit
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [isSubmittingProd, setIsSubmittingProd] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState("");
  const [newProdUnit, setNewProdUnit] = useState("1 kg");

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    setIsSubmittingProd(true);

    const newItem = {
      id: `prod-${Date.now()}`,
      name: newProdName,
      price: parseFloat(newProdPrice),
      mrp: parseFloat(newProdPrice) * 1.2,
      unit: newProdUnit,
      is_active: true,
    };

    const updated = [newItem, ...inventory];
    setLocalInventory(updated);
    localStorage.setItem("vegamart_cart_inventory", JSON.stringify(updated));

    setShowAddProduct(false);
    setNewProdName("");
    setNewProdPrice("");
    toast.success(`Added ${newItem.name} to cart inventory!`);

    if (vendor?.id) {
      try {
        await api.post("/products", {
          vendor_id: vendor.id,
          category_id: defaultCategoryId,
          name: newItem.name,
          price: newItem.price,
          mrp: newItem.mrp,
          unit: newItem.unit,
          is_active: true,
        });
        queryClient.invalidateQueries({ queryKey: ["vendorProducts", vendor.id] });
      } catch (err) {
        console.warn("Backend add product sync:", err);
      }
    }
    setIsSubmittingProd(false);
  };

  // Seed default street products if empty
  const [isSeeding, setIsSeeding] = useState(false);
  const seedDefaultItems = async () => {
    setIsSeeding(true);
    const defaults = [
      { id: `seed-1-${Date.now()}`, name: "Fresh Tomatoes", price: 40, unit: "1 kg", is_active: true },
      { id: `seed-2-${Date.now()}`, name: "Organic Spinach", price: 25, unit: "1 bunch", is_active: true },
      { id: `seed-3-${Date.now()}`, name: "Fresh Potatoes", price: 35, unit: "1 kg", is_active: true },
      { id: `seed-4-${Date.now()}`, name: "Red Onions", price: 45, unit: "1 kg", is_active: true },
      { id: `seed-5-${Date.now()}`, name: "Robusta Bananas", price: 60, unit: "1 dozen", is_active: true },
    ];

    setLocalInventory(defaults);
    localStorage.setItem("vegamart_cart_inventory", JSON.stringify(defaults));
    toast.success("Added 5 fresh cart items to your inventory!");

    if (vendor?.id) {
      try {
        for (const item of defaults) {
          await api.post("/products", {
            vendor_id: vendor.id,
            category_id: defaultCategoryId,
            name: item.name,
            price: item.price,
            mrp: item.price * 1.2,
            unit: item.unit,
            is_active: true,
          });
        }
        queryClient.invalidateQueries({ queryKey: ["vendorProducts", vendor.id] });
      } catch (e) {
        console.warn("Backend seeding sync:", e);
      }
    }
    setIsSeeding(false);
  };

  // Turn ON / Start GPS Location Broadcast Flow
  const startLocationBroadcast = () => {
    if (!("geolocation" in navigator)) {
      setLocationErrorMessage(
        "GPS Geolocation is not supported by your browser. Please try another browser or mobile device."
      );
      setShowLocationModal(true);
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setIsOnline(true);
        setIsLocating(false);
        setShowLocationModal(false);

        // Send location update to backend database
        api
          .put("/vendors/me/location", { lat: coords.lat, lng: coords.lng })
          .catch(console.error);

        // Set vendor status to OPEN
        api
          .put("/vendors/me/toggle-availability", { is_open: true })
          .catch(console.error);

        toast.success(
          `📡 LIVE GPS Broadcasting Active! Coordinates: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
        );
      },
      (err) => {
        setIsLocating(false);
        let msg =
          "Device location is turned OFF or permission was denied. Please turn ON location services in your phone or browser settings to share your live cart location with customers.";
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Location Permission Denied! Please enable location access in your mobile settings or browser URL bar (Lock 🔒 icon) to share live GPS.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "GPS Signal Unavailable! Please check if Mobile Location / Location Services is turned ON.";
        }
        setLocationErrorMessage(msg);
        setShowLocationModal(true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // Mock Fallback Location Activation
  const useMockLocation = () => {
    const coords = { lat: 12.9716, lng: 77.6412 };
    setLocation(coords);
    setIsOnline(true);
    setShowLocationModal(false);

    api.put("/vendors/me/location", { lat: coords.lat, lng: coords.lng }).catch(console.error);
    api.put("/vendors/me/toggle-availability", { is_open: true }).catch(console.error);

    toast.success("📡 Active with Simulated Bengaluru GPS (12.9716, 77.6412)");
  };

  // Watch position when online
  useEffect(() => {
    let watchId: number;

    if (isOnline) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(coords);
            api.put("/vendors/me/location", coords).catch(console.error);
          },
          (err) => console.error("Watch location error:", err),
          { enableHighAccuracy: true, maximumAge: 10000 }
        );
      }
    } else {
      setLocation(null);
    }

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline]);

  const toggleOnline = () => {
    if (isOnline) {
      setIsOnline(false);
      setLocation(null);
      api.put("/vendors/me/toggle-availability", { is_open: false }).catch(console.error);
      toast.info("🔴 Live GPS Broadcasting Stopped (Offline)");
    } else {
      startLocationBroadcast();
    }
  };

  const handlePublishSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcastStreet || !bcastTime) {
      toast.error("Please fill in Street and Arrival Time");
      return;
    }
    setIsPublishingBcast(true);
    try {
      await addStreetBroadcast({
        vendorId: vendor?.id || "vendor-1",
        vendorName: vendor?.business_name || "Appnity Softwares (Roaming Cart)",
        vendorType: "roaming",
        phone: vendor?.phone || "+919876543210",
        street: bcastStreet,
        arrivalTime: bcastTime,
        produce: bcastProduce,
        note: bcastNote,
      });
      toast.success("📢 Today's Street Schedule published successfully!");
    } catch (err) {
      toast.error("Failed to publish schedule");
    } finally {
      setIsPublishingBcast(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-emerald-500/30 pb-24">
      {/* Top Command Bar */}
      <header className="border-b bg-card/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white font-extrabold text-lg shadow-sm">
            🛒
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-base md:text-lg text-foreground">
                {vendor?.business_name || "Raju Sabziwala"}
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                Roaming Cart
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {vendor?.profile?.category || "Vegetables & Fruits"} • Hyperlocal Street Control
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/vendor"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted px-3 py-2 rounded-2xl border transition-colors"
          >
            <Store className="h-4 w-4" /> Shop Portal
          </Link>
          <button
            onClick={() => setShowQR(true)}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold bg-amber-500 text-slate-950 px-3.5 py-2 rounded-2xl shadow-md hover:bg-amber-400 transition-colors"
          >
            <QrCode className="h-4 w-4" /> Pay QR
          </button>
        </div>
      </header>

      {/* Main Dashboard Container */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {/* Incoming Gali Bell Alert Banner */}
        {incomingAlert && (
          <div className="rounded-3xl border-2 border-emerald-500 bg-emerald-500/15 p-5 shadow-lg animate-bounce flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <Bell className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Gali Bell Call • {incomingAlert.time}
                  </span>
                </div>
                <h3 className="font-extrabold text-base text-foreground mt-1">
                  Customer {incomingAlert.customer_name} is calling your cart!
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  📍 {incomingAlert.address} {incomingAlert.note ? `• "${incomingAlert.note}"` : ""}
                </p>
              </div>
            </div>

            <button
              onClick={() => setIncomingAlert(null)}
              className="inline-flex items-center gap-1 rounded-2xl bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 shadow-md"
            >
              <CheckCircle2 className="h-4 w-4" /> Acknowledge Call
            </button>
          </div>
        )}

        {/* Live GPS Broadcasting Radar Hero Control */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 rounded-3xl border bg-card p-6 shadow-soft space-y-5 relative overflow-hidden flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-5 w-5 text-emerald-600" />
                  <h2 className="font-display font-black text-lg text-foreground">
                    Live GPS Radar Broadcast
                  </h2>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shadow-xs ${
                    isOnline
                      ? "bg-emerald-500 text-white"
                      : "bg-rose-500/10 text-rose-600 border border-rose-200"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOnline ? "bg-white animate-ping" : "bg-rose-500"
                    }`}
                  />
                  {isOnline ? "ONLINE • BROADCASTING" : "OFFLINE"}
                </span>
              </div>

              <p className="text-xs text-muted-foreground mt-1">
                Share your live cart location on the map so customers in nearby streets can track your cart in real-time.
              </p>
            </div>

            {/* Interactive Radar Control Button */}
            <div className="py-4 text-center space-y-4">
              <button
                onClick={toggleOnline}
                disabled={isLocating}
                className={`relative group mx-auto flex flex-col items-center justify-center h-44 w-44 rounded-full transition-all shadow-xl ${
                  isOnline
                    ? "bg-emerald-600 text-white ring-8 ring-emerald-500/30 hover:bg-emerald-700"
                    : "bg-slate-900 text-white ring-8 ring-slate-800/60 hover:bg-slate-800"
                }`}
              >
                {isLocating ? (
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
                ) : isOnline ? (
                  <Wifi className="h-10 w-10 text-white animate-pulse" />
                ) : (
                  <WifiOff className="h-10 w-10 text-rose-400" />
                )}

                <span className="mt-2 font-black text-xs uppercase tracking-wider">
                  {isLocating
                    ? "Fetching GPS..."
                    : isOnline
                    ? "BROADCASTING ACTIVE"
                    : "TAP TO BROADCAST LOCATION"}
                </span>

                {isOnline && location && (
                  <span className="text-[11px] font-mono text-emerald-200 mt-1">
                    {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                  </span>
                )}
              </button>

              <div className="text-xs text-center">
                {isOnline ? (
                  <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                    🟢 Your cart is visible to nearby customers on Gali Radar!
                  </p>
                ) : (
                  <p className="text-muted-foreground font-semibold">
                    👉 Tap the button above to request mobile/web location permission & start broadcasting.
                  </p>
                )}
              </div>
            </div>

            <Link
              to="/street-vendors"
              target="_blank"
              className="inline-flex items-center justify-center gap-2 w-full rounded-2xl border bg-muted/60 hover:bg-muted font-bold text-xs h-11 text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-emerald-600" /> See Live Customer Radar View ↗
            </Link>
          </div>

          {/* Today's Gali Schedule Form Card */}
          <div className="md:col-span-6 rounded-3xl border bg-card p-6 shadow-soft space-y-4">
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-emerald-600" />
              <h2 className="font-display font-black text-lg text-foreground">
                Tell Customers I'm Coming Today!
              </h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Broadcast your street route and expected arrival time so customers can wait for your cart.
            </p>

            <form onSubmit={handlePublishSchedule} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Target Street / Area
                </label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                  <input
                    type="text"
                    value={bcastStreet}
                    onChange={(e) => setBcastStreet(e.target.value)}
                    placeholder="e.g. 4th Main Rd, Jayanagar 4th Block"
                    className="w-full rounded-2xl border bg-background pl-9 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Arrival Time / Schedule
                </label>
                <div className="relative mt-1">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-emerald-600" />
                  <input
                    type="text"
                    value={bcastTime}
                    onChange={(e) => setBcastTime(e.target.value)}
                    placeholder="e.g. Today at 5:30 PM"
                    className="w-full rounded-2xl border bg-background pl-9 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Fresh Stock Highlights
                </label>
                <input
                  type="text"
                  value={bcastProduce}
                  onChange={(e) => setBcastProduce(e.target.value)}
                  placeholder="e.g. Fresh Farm Tomatoes, Palak, Shimla Mirch"
                  className="w-full mt-1 rounded-2xl border bg-background px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Custom Note / Offer
                </label>
                <input
                  type="text"
                  value={bcastNote}
                  onChange={(e) => setBcastNote(e.target.value)}
                  placeholder="e.g. Fresh morning harvest! ₹5 off on Palak."
                  className="w-full mt-1 rounded-2xl border bg-background px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={isPublishingBcast}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs h-12 shadow-md hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-2"
              >
                {isPublishingBcast ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Publish Today's Arrival Schedule 🚀
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* 1-Click Cart Inventory Management */}
        <div className="rounded-3xl border bg-card p-6 shadow-soft space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-600" />
                <h2 className="font-display font-black text-lg text-foreground">
                  1-Click Live Cart Inventory
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle products on/off as you sell items directly from your cart on the street.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {inventory.length === 0 && (
                <button
                  onClick={seedDefaultItems}
                  disabled={isSeeding}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs px-3.5 py-2 hover:bg-emerald-100 transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isSeeding ? "Seeding..." : "+ Add 5 Fresh Produce Items"}
                </button>
              )}
              <button
                onClick={() => setShowAddProduct(true)}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs px-4 py-2 shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>
          </div>

          {/* Product Items List Grid */}
          {isProductsLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Loading cart inventory...</div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Package className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="font-bold text-sm text-foreground">No items on your cart yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Click "+ Add 5 Fresh Produce Items" or "+ Add Item" above to add items to your live cart catalog.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inventory.map((item: any) => {
                const active = item.is_active !== false;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all ${
                      active
                        ? "bg-background border-emerald-500/30 shadow-xs"
                        : "bg-muted/40 opacity-60 border-border"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-foreground truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground font-semibold">
                        ₹{item.price}{" "}
                        <span className="text-[11px] font-normal">/ {item.unit || "unit"}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleInventoryItem(item.id, active)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shrink-0 ${
                        active
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-muted text-muted-foreground border"
                      }`}
                    >
                      {active ? "In Stock 🟢" : "Out of Stock 🔴"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Location Permission Modal Alert */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs grid place-items-center p-4">
          <div className="w-full max-w-md bg-card border rounded-3xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-800 font-bold">
                <Compass className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-foreground">
                  Turn ON Mobile/Device Location
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{locationErrorMessage}</p>
              </div>
            </div>

            <div className="bg-muted/60 p-4 rounded-2xl text-xs space-y-2 border">
              <div className="font-bold text-foreground">📱 How to enable location:</div>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                <li>
                  <strong>Phone/Mobile:</strong> Open Settings ➔ Location ➔ Turn ON Location Services.
                </li>
                <li>
                  <strong>Web Browser:</strong> Click the Lock (🔒) or Tune icon next to the URL bar ➔ Allow Location access.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={startLocationBroadcast}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white font-extrabold text-xs h-11 hover:bg-emerald-700 transition-colors"
              >
                Try Requesting Location Again 📡
              </button>
              <button
                onClick={useMockLocation}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs h-11 hover:bg-amber-100 transition-colors"
              >
                Use Simulated Bengaluru GPS (Fallback)
              </button>
              <button
                onClick={() => setShowLocationModal(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border text-muted-foreground font-semibold text-xs h-10 hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Item Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs grid place-items-center p-4">
          <div className="w-full max-w-sm bg-card border rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-lg text-foreground">
                Add Item to Cart
              </h3>
              <button
                onClick={() => setShowAddProduct(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                  Item Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Farm Tomatoes"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full mt-1 rounded-2xl border bg-background px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="40"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full mt-1 rounded-2xl border bg-background px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase text-muted-foreground">
                    Unit
                  </label>
                  <select
                    value={newProdUnit}
                    onChange={(e) => setNewProdUnit(e.target.value)}
                    className="w-full mt-1 rounded-2xl border bg-background px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1 kg">1 kg</option>
                    <option value="500 g">500 g</option>
                    <option value="250 g">250 g</option>
                    <option value="1 bunch">1 bunch</option>
                    <option value="1 pc">1 pc</option>
                    <option value="1 dozen">1 dozen</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingProd}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-slate-950 font-extrabold text-xs h-11 shadow-md hover:bg-amber-400 transition-colors mt-2"
              >
                {isSubmittingProd ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save & Publish to Cart"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pay QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs grid place-items-center p-4">
          <div className="w-full max-w-xs bg-card border rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-black text-base text-foreground">
                Accept UPI Payment
              </h3>
              <button
                onClick={() => setShowQR(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner">
              {/* Simulated QR Code SVG */}
              <svg className="h-44 w-44 mx-auto" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="white" />
                <path
                  d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M22,22 h6 v6 h-6 z"
                  fill="black"
                />
                <path
                  d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M72,22 h6 v6 h-6 z"
                  fill="black"
                />
                <path
                  d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M22,72 h6 v6 h-6 z"
                  fill="black"
                />
                <circle cx="50" cy="50" r="10" fill="#059669" />
              </svg>
            </div>

            <div>
              <p className="font-extrabold text-sm text-foreground">
                {vendor?.business_name || "Vegamart Vendor"}
              </p>
              <p className="text-xs text-muted-foreground">UPI ID: vegamart.vendor@upi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
