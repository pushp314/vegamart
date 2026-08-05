import { useState, useEffect } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Store, MapPin, Phone, CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/become-vendor")({
  head: () => ({ meta: [{ title: "Become a Vendor — Vegamart" }] }),
  component: BecomeVendorPage,
});

function BecomeVendorPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, register, refreshSession } = useAuth();

  // If user is already a vendor, redirect to vendor dashboard
  useEffect(() => {
    if (user?.role === "vendor") {
      navigate({ to: "/vendor" });
    }
  }, [user?.role, navigate]);

  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("vegetables");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [stateName, setStateName] = useState("Karnataka");
  const [pincode, setPincode] = useState("");
  const [description, setDescription] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState("basic");
  const [vendorType, setVendorType] = useState<"shop" | "roaming">("shop");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated && (!authName || !authEmail || !authPassword)) {
      toast.error("Please fill in all required account details");
      return;
    }
    if (!businessName || !phone || !address || !pincode) {
      toast.error("Please fill in all required business details");
      return;
    }

    setSubmitting(true);

    try {
      // Step 1: Create user account if not authenticated
      if (!isAuthenticated) {
        const authRes = await register({
          name: authName,
          email: authEmail,
          password: authPassword,
          role: "vendor",
        });

        if (!authRes.success) {
          setSubmitting(false);
          toast.error(authRes.message || "Failed to create user account");
          return;
        }
      }

      // Step 2: Register as a vendor
      const res = await api.post("/vendors", {
        business_name: businessName,
        category,
        roaming: vendorType === "roaming",
        phone,
        address,
        city,
        state: stateName,
        pincode,
        description: description || undefined,
      });

      setSubmitting(false);

      if (res.success) {
        // Set the subscription plan immediately after creation
        if (subscriptionPlan !== "basic") {
          await api.put("/vendors/me", { subscription_plan: subscriptionPlan });
        }
        
        await refreshSession();
        setSubmitted(true);
        toast.success("Vendor application submitted successfully!");
      } else {
        toast.error(res.error?.message || "Failed to submit vendor application");
      }
    } catch (err) {
      setSubmitting(false);
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6">
        {submitted ? (
          <div className="rounded-3xl border bg-card p-8 text-center space-y-4 shadow-soft max-w-md mx-auto">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="font-display text-2xl font-bold">Application Submitted!</h2>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your store profile is created! You can now add products and manage your store for
              free. Select a subscription plan when you are ready to publish your shop live on
              Vegamart.
            </p>
            <div className="pt-2">
              <button
                onClick={() =>
                  navigate({ to: "/vendor" })
                }
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-bold text-xs px-6 py-3 shadow-md hover:bg-primary/90"
              >
                Go to {vendorType === "roaming" ? "Street Vendor Portal" : "Merchant Dashboard"}{" "}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <form className="w-full space-y-3.5" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between pb-2.5 border-b border-border">
              <div>
                <h1 className="font-display text-xl font-black text-foreground">
                  Quick Vendor Registration
                </h1>
                <p className="text-xs font-medium text-muted-foreground">
                  Register your store for free • Go live anytime on Vegamart
                </p>
              </div>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-extrabold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Free Signup
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left Column: Account & Business Info */}
              <div className="space-y-5">
                {!isAuthenticated && (
                  <div className="space-y-4 pb-4 border-b border-border">
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-600">
                      1. Account Details
                    </div>
                    <label className="block">
                      <div className="mb-1.5 text-xs font-bold text-foreground">Full Name *</div>
                      <input
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="e.g. Raju Kumar"
                        required
                        className="w-full rounded-2xl bg-muted border border-border h-12 px-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <div className="mb-1.5 text-xs font-bold text-foreground">
                          Email Address *
                        </div>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="email@example.com"
                          required
                          className="w-full rounded-2xl bg-muted border border-border h-12 px-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </label>
                      <label className="block">
                        <div className="mb-1.5 text-xs font-bold text-foreground">Password *</div>
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full rounded-2xl bg-muted border border-border h-12 px-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <div className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  {isAuthenticated ? "1. Business Information" : "2. Business Information"}
                </div>

                {/* Vendor Model Selection */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-foreground">Select Vendor Model *</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setVendorType("shop")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        vendorType === "shop"
                          ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-sm"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Store
                          className={`h-5 w-5 ${vendorType === "shop" ? "text-emerald-600" : "text-muted-foreground"}`}
                        />
                        <span className="font-extrabold text-sm text-foreground">Fixed Shop</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-normal">
                        Physical grocery, bakery, or store
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setVendorType("roaming")}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        vendorType === "roaming"
                          ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20 shadow-sm"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles
                          className={`h-5 w-5 ${vendorType === "roaming" ? "text-emerald-600" : "text-muted-foreground"}`}
                        />
                        <span className="font-extrabold text-sm text-foreground">Street Cart</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-normal">
                        Roaming push-cart seller
                      </p>
                    </button>
                  </div>
                </div>

                <label className="block">
                  <div className="mb-1.5 text-xs font-bold text-foreground">
                    Business / Store Name *
                  </div>
                  <div className="flex items-center rounded-2xl bg-muted border border-border h-12 px-4 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Raju Fresh Sabzi Mart"
                      required
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none"
                    />
                  </div>
                </label>
              </div>

              {/* Right Column: Category & Location */}
              <div className="space-y-5">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-600">
                  Location & Category
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="mb-1.5 text-xs font-bold text-foreground">Category *</div>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-2xl bg-muted border border-border h-12 px-3 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    >
                      <option value="vegetables">🥦 Vegetables & Sabzi</option>
                      <option value="fruits">🍎 Fresh Fruits</option>
                      <option value="dairy">🥛 Dairy & Milk</option>
                      <option value="bakery">🥐 Bakery & Snacks</option>
                      <option value="juice">☕ Chai & Juice</option>
                      <option value="grocery">🛒 Grocery</option>
                    </select>
                  </label>

                  <label className="block">
                    <div className="mb-1.5 text-xs font-bold text-foreground">Phone Number *</div>
                    <div className="flex items-center rounded-2xl bg-muted border border-border h-12 px-3 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                      <span className="text-xs font-bold text-muted-foreground mr-2 pr-2 border-r">
                        +91
                      </span>
                      <input
                        inputMode="numeric"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9876543210"
                        required
                        className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none"
                      />
                    </div>
                  </label>
                </div>

                <label className="block">
                  <div className="mb-1.5 text-xs font-bold text-foreground">Street Address *</div>
                  <div className="flex items-center rounded-2xl bg-muted border border-border h-12 px-4 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Shop 4, Gali 12, Main Market"
                      required
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm font-medium outline-none"
                    />
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <div className="mb-1.5 text-xs font-bold text-foreground">City</div>
                    <input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full rounded-2xl bg-muted border border-border h-12 px-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-1.5 text-xs font-bold text-foreground">Pincode *</div>
                    <input
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="560038"
                      required
                      className="w-full rounded-2xl bg-muted border border-border h-12 px-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  </label>
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary text-primary-foreground font-extrabold text-base h-13 shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.99]"
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        Complete Vendor Setup <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
