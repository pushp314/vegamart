import { useState } from "react";
import {
  Store,
  Bike,
  Sparkles,
  UserPlus,
  CheckCircle2,
  Loader2,
  KeyRound,
  Mail,
  User,
  Phone,
  MapPin,
  X,
} from "lucide-react";
import { api, formatErrorMessage } from "@/lib/api";
import { toast } from "sonner";

export function AdminCreatePartner() {
  const [partnerType, setPartnerType] = useState<"vendor" | "delivery">("vendor");

  // Common Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");

  // Vendor Fields
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("vegetables");
  const [vendorType, setVendorType] = useState<"shop" | "roaming">("shop");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [pincode, setPincode] = useState("");

  // Delivery Fields
  const [vehicleType, setVehicleType] = useState("Bike");

  const [loading, setLoading] = useState(false);
  const [lastCreated, setLastCreated] = useState<any>(null);

  const inputCls =
    "w-full rounded-2xl bg-muted/60 border border-border h-11 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all";
  const labelCls = "mb-1 text-xs font-bold text-muted-foreground";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !phone) {
      toast.error("Please fill in all required credentials");
      return;
    }

    setLoading(true);
    setLastCreated(null);

    try {
      // Step 1: Register User Account
      const authRes = await api.post<any>("/auth/register", {
        name,
        email,
        password,
      });

      if (!authRes.success || !authRes.data?.access_token) {
        setLoading(false);
        toast.error(authRes.error?.message || "Failed to create user account");
        return;
      }

      const tempToken = authRes.data.access_token;

      if (partnerType === "vendor") {
        if (!businessName || !address || !pincode) {
          setLoading(false);
          toast.error("Please fill in all store details");
          return;
        }

        // Step 2: Register Vendor using user token
        const vendorRes = await api.request<any>("/vendors/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tempToken}`,
          },
          body: JSON.stringify({
            business_name: businessName,
            category,
            vendor_type: vendorType,
            phone,
            address,
            city,
            state: "Karnataka",
            pincode,
            subscription_plan: "pro",
          }),
        });

        if (vendorRes.success) {
          const vId = vendorRes.data?.id || vendorRes.data?.data?.id;
          // Step 3: Approve vendor automatically
          if (vId) {
            const approveRes = await api.post<any>(`/admin/vendors/${vId}/review`, {
              decision: "approve",
            });
            if (!approveRes.success) {
              setLoading(false);
              toast.error(formatErrorMessage(approveRes.error, "Vendor created but failed to approve"));
              return;
            }
          }

          toast.success(`Vendor ${businessName} created and approved! Login credentials sent.`);
          setLastCreated({
            type: "Vendor",
            title: businessName,
            email,
            password,
            portalURL: "/vendor",
          });

          // Reset fields
          setName("");
          setEmail("");
          setPassword("");
          setBusinessName("");
          setPhone("");
          setAddress("");
        } else {
          toast.error(formatErrorMessage(vendorRes.error, "Failed to create vendor profile"));
        }
      } else {
        // Delivery Partner Creation
        const deliveryRes = await api.request<any>("/delivery/apply", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tempToken}`,
          },
          body: JSON.stringify({
            full_name: name,
            phone,
            vehicle_type: vehicleType,
            city,
          }),
        });

        if (deliveryRes.success) {
          const dId = deliveryRes.data?.id || deliveryRes.data?.data?.id;
          if (dId) {
            const approveRes = await api.post<any>(`/admin/delivery-partners/${dId}/review`, {
              decision: "approve",
            });
            if (!approveRes.success) {
              setLoading(false);
              toast.error(approveRes.error?.message || "Partner created but failed to approve");
              return;
            }
          }

          toast.success(`Delivery partner ${name} created and approved! Login credentials sent.`);
          setLastCreated({
            type: "Delivery Partner",
            title: name,
            email,
            password,
            portalURL: "/delivery",
          });

          // Reset fields
          setName("");
          setEmail("");
          setPassword("");
          setPhone("");
        } else {
          toast.error(deliveryRes.error?.message || "Failed to create delivery profile");
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred during creation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            Create Partner Account
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Directly onboard new vendors and delivery partners into the Vegamart system.
          </p>
        </div>
      </div>

      {/* Selector Cards */}
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <button
          type="button"
          onClick={() => setPartnerType("vendor")}
          className={`p-5 rounded-3xl border text-left transition-all ${
            partnerType === "vendor"
              ? "border-emerald-300 bg-emerald-50 ring-2 ring-emerald-500/20"
              : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 border border-emerald-200">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">Create Vendor</div>
              <div className="text-xs text-muted-foreground">Shop Merchant or Street Cart</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPartnerType("delivery")}
          className={`p-5 rounded-3xl border text-left transition-all ${
            partnerType === "delivery"
              ? "border-sky-300 bg-sky-50 ring-2 ring-sky-500/20"
              : "border-border bg-card hover:bg-muted/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-100 text-sky-600 border border-sky-200">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">Create Delivery Boy</div>
              <div className="text-xs text-muted-foreground">Rider / Fleet Executive</div>
            </div>
          </div>
        </button>
      </div>

      {/* Creation Confirmation Banner */}
      {lastCreated && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 flex items-start gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white font-black">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              {lastCreated.type} Account Approved
            </div>
            <h4 className="font-bold text-lg text-foreground">{lastCreated.title}</h4>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-4 pt-1 font-mono">
              <span>
                <strong className="text-foreground">Login ID:</strong> {lastCreated.email}
              </span>
              <span>
                <strong className="text-foreground">Password:</strong> {lastCreated.password}
              </span>
              <span>
                <strong className="text-foreground">Portal URL:</strong> {lastCreated.portalURL}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastCreated(null)}
            className="p-2 rounded-full text-emerald-700/60 hover:text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Form */}
      <form
        onSubmit={handleCreate}
        className="rounded-3xl border border-border bg-card p-6 max-w-2xl space-y-5 shadow-soft"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-emerald-600" />
          {partnerType === "vendor" ? "New Vendor Details" : "New Delivery Partner Details"}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className={labelCls}>Full Name *</div>
            <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
              <User className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Singh"
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className={labelCls}>Phone Number *</div>
            <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
              <Phone className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className={labelCls}>Login Email *</div>
            <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
              <Mail className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@vegamart.com"
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </label>

          <label className="block">
            <div className={labelCls}>Assign Password *</div>
            <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
              <KeyRound className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set secure password"
                required
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground font-mono"
              />
            </div>
          </label>
        </div>

        {partnerType === "vendor" ? (
          <>
            <div className="pt-2 border-t border-border/80">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-3">
                Store Configuration
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className={labelCls}>Business / Store Name *</div>
                <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
                  <Store className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ramesh Sabzi Bhandar"
                    required
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <label className="block">
                <div className={labelCls}>Vendor Model *</div>
                <select
                  value={vendorType}
                  onChange={(e) => setVendorType(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="shop">Fixed Shop / Merchant</option>
                  <option value="roaming">Roaming Street Cart</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className={labelCls}>Category *</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
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
                <div className={labelCls}>City</div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className={labelCls}>Street Address *</div>
                <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop No., Market Area"
                    required
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <label className="block">
                <div className={labelCls}>Pincode *</div>
                <input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="560038"
                  required
                  className={inputCls}
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="pt-2 border-t border-border/80">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-600 mb-3">
                Fleet Configuration
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className={labelCls}>Vehicle Type *</div>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className={inputCls}
                >
                  <option value="Bike">🏍️ Motorbike / Scooter</option>
                  <option value="EV Scooter">⚡ EV Scooter</option>
                  <option value="Bicycle">🚲 Bicycle</option>
                </select>
              </label>

              <label className="block">
                <div className={labelCls}>Operating City</div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-2xl h-12 font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
            partnerType === "vendor"
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20"
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="h-5 w-5" />
              Create & Approve{" "}
              {partnerType === "vendor" ? "Vendor Account" : "Delivery Partner Account"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
