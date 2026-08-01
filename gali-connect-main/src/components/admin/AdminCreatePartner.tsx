import { useState } from "react";
import { Store, Bike, Sparkles, UserPlus, CheckCircle2, Loader2, KeyRound, Mail, User, Phone, MapPin } from "lucide-react";
import { api } from "@/lib/api";
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
      const apiBase = import.meta.env.VITE_API_BASE_URL || (window.location.hostname === "localhost" ? "http://localhost:8080/api/v1" : "/api/v1");

      if (partnerType === "vendor") {
        if (!businessName || !address || !pincode) {
          setLoading(false);
          toast.error("Please fill in all store details");
          return;
        }

        // Step 2: Register Vendor using user token
        const rawRes = await fetch(`${apiBase}/vendors/register`, {
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
        const vendorRes = await rawRes.json();

        if (vendorRes.success) {
          const vId = vendorRes.data?.id || vendorRes.data?.data?.id;
          // Step 3: Approve vendor automatically
          if (vId) {
            await api.put(`/admin/vendors/${vId}/approve`);
          }

          toast.success(`Vendor ${businessName} created and approved! Login credentials sent.`);
          setLastCreated({
            type: "Vendor",
            title: businessName,
            email,
            password,
            portalURL: vendorType === "roaming" ? "/vendor/roaming" : "/vendor",
          });

          // Reset fields
          setName("");
          setEmail("");
          setPassword("");
          setBusinessName("");
          setPhone("");
          setAddress("");
        } else {
          toast.error(vendorRes.error?.message || "Failed to create vendor profile");
        }
      } else {
        // Delivery Partner Creation
        const rawRes = await fetch(`${apiBase}/delivery/apply`, {
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
        const deliveryRes = await rawRes.json();

        if (deliveryRes.success) {
          const dId = deliveryRes.data?.id || deliveryRes.data?.data?.id;
          if (dId) {
            await api.put(`/admin/delivery/${dId}/approve`);
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
    <div className="space-y-6 text-white animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight">Create Partner Account</h2>
          <p className="text-zinc-400 text-sm mt-1">Directly onboard new vendors and delivery partners into the Vegamart system.</p>
        </div>
      </div>

      {/* Selector Cards */}
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <button
          type="button"
          onClick={() => setPartnerType("vendor")}
          className={`p-5 rounded-3xl border text-left transition-all ${
            partnerType === "vendor"
              ? "border-emerald-500 bg-emerald-950/40 ring-2 ring-emerald-500/20"
              : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100">Create Vendor</div>
              <div className="text-xs text-zinc-400">Shop Merchant or Street Cart</div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setPartnerType("delivery")}
          className={`p-5 rounded-3xl border text-left transition-all ${
            partnerType === "delivery"
              ? "border-sky-500 bg-sky-950/40 ring-2 ring-sky-500/20"
              : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-zinc-100">Create Delivery Boy</div>
              <div className="text-xs text-zinc-400">Rider / Fleet Executive</div>
            </div>
          </div>
        </button>
      </div>

      {/* Creation Confirmation Banner */}
      {lastCreated && (
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/40 p-6 flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-black font-black">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {lastCreated.type} Account Approved
            </div>
            <h4 className="font-bold text-lg text-white">{lastCreated.title}</h4>
            <div className="text-xs text-zinc-300 flex flex-wrap gap-4 pt-1 font-mono">
              <span><strong>Login ID:</strong> {lastCreated.email}</span>
              <span><strong>Password:</strong> {lastCreated.password}</span>
              <span><strong>Portal URL:</strong> {lastCreated.portalURL}</span>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleCreate} className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 max-w-2xl space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-emerald-400" />
          {partnerType === "vendor" ? "New Vendor Details" : "New Delivery Partner Details"}
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className="mb-1 text-xs font-bold text-zinc-300">Full Name *</div>
            <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
              <User className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Singh"
                required
                className="w-full bg-transparent text-sm text-white outline-none"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-bold text-zinc-300">Phone Number *</div>
            <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
              <Phone className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                required
                className="w-full bg-transparent text-sm text-white outline-none"
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <div className="mb-1 text-xs font-bold text-zinc-300">Login Email *</div>
            <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
              <Mail className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="partner@vegamart.com"
                required
                className="w-full bg-transparent text-sm text-white outline-none"
              />
            </div>
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-bold text-zinc-300">Assign Password *</div>
            <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
              <KeyRound className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Set secure password"
                required
                className="w-full bg-transparent text-sm text-white outline-none font-mono"
              />
            </div>
          </label>
        </div>

        {partnerType === "vendor" ? (
          <>
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">Store Configuration</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Business / Store Name *</div>
                <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
                  <Store className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
                  <input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Ramesh Sabzi Bhandar"
                    required
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Vendor Model *</div>
                <select
                  value={vendorType}
                  onChange={(e) => setVendorType(e.target.value as any)}
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm font-bold text-white outline-none"
                >
                  <option value="shop">Fixed Shop / Merchant</option>
                  <option value="roaming">Roaming Street Cart</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Category *</div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm font-bold text-white outline-none"
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
                <div className="mb-1 text-xs font-bold text-zinc-300">City</div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm text-white outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Street Address *</div>
                <div className="flex items-center rounded-2xl bg-black border border-zinc-800 h-11 px-3">
                  <MapPin className="h-4 w-4 text-zinc-500 mr-2 shrink-0" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Shop No., Market Area"
                    required
                    className="w-full bg-transparent text-sm text-white outline-none"
                  />
                </div>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Pincode *</div>
                <input
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="560038"
                  required
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm text-white outline-none"
                />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-3">Fleet Configuration</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Vehicle Type *</div>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm font-bold text-white outline-none"
                >
                  <option value="Bike">🏍️ Motorbike / Scooter</option>
                  <option value="EV Scooter">⚡ EV Scooter</option>
                  <option value="Bicycle">🚲 Bicycle</option>
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs font-bold text-zinc-300">Operating City</div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full rounded-2xl bg-black border border-zinc-800 h-11 px-3 text-sm text-white outline-none"
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
              ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
              : "bg-sky-500 hover:bg-sky-400 text-black shadow-lg shadow-sky-500/20"
          }`}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="h-5 w-5" />
              Create & Approve {partnerType === "vendor" ? "Vendor Account" : "Delivery Partner Account"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
