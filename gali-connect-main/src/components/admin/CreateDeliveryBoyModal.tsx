import { useState, useEffect } from "react";
import {
  XCircle,
  Loader2,
  UserPlus,
  CheckCircle2,
  Mail,
  User,
  Phone,
  KeyRound,
  Bike,
  Hash,
  FileBadge,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface CreateDeliveryBoyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const inputCls =
  "w-full rounded-2xl bg-muted/60 border border-border h-11 px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all";
const labelCls = "mb-1 text-xs font-bold text-muted-foreground";

interface CreatedPartnerPayload {
  id: string;
  user?: { name?: string };
}

interface CreatedPartnerInfo {
  name: string;
  email: string;
  password: string;
}

export function CreateDeliveryBoyModal({ open, onClose, onCreated }: CreateDeliveryBoyModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicleType, setVehicleType] = useState("Motorbike / Scooter");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<CreatedPartnerInfo | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setVehicleType("Motorbike / Scooter");
      setVehicleNumber("");
      setLicenseNumber("");
      setLoading(false);
      setCreated(null);
    }
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      toast.error("Name, email and password are required");
      return;
    }

    setLoading(true);
    setCreated(null);

    try {
      const res = await api.post<CreatedPartnerPayload>("/admin/delivery-partners", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        vehicle_type: vehicleType,
        vehicle_number: vehicleNumber.trim() || undefined,
        license_number: licenseNumber.trim() || undefined,
      });

      if (!res.success) {
        toast.error(res.error?.message || "Failed to create delivery boy");
        setLoading(false);
        return;
      }

      const partner = res.data as CreatedPartnerPayload | undefined;
      setCreated({ name: partner?.user?.name || name, email, password });
      toast.success("Delivery boy created and approved!");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-card border border-border w-full max-w-2xl rounded-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          className="absolute right-6 top-6 p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <XCircle className="h-6 w-6" />
        </button>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
                <Bike className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-black font-display text-foreground">
                Create Delivery Boy
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Add a new rider to the fleet. The account is created and approved instantly.
            </p>
          </div>

          {created && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Rider Account Approved
              </div>
              <h4 className="font-bold text-lg text-foreground">{created.name}</h4>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-4 pt-1 font-mono">
                <span>
                  <strong className="text-foreground">Login ID:</strong> {created.email}
                </span>
                <span>
                  <strong className="text-foreground">Password:</strong> {created.password}
                </span>
                <span>
                  <strong className="text-foreground">Portal:</strong> /delivery
                </span>
              </div>
            </div>
          )}

          {!created && (
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  <div className={labelCls}>Phone Number</div>
                  <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
                    <Phone className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="9876543210"
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
                      placeholder="rider@vegamart.com"
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
                    <option value="Motorbike / Scooter">🏍️ Motorbike / Scooter</option>
                    <option value="EV Scooter">⚡ EV Scooter</option>
                    <option value="Bicycle">🚲 Bicycle</option>
                  </select>
                </label>

                <label className="block">
                  <div className={labelCls}>Vehicle Number</div>
                  <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
                    <Hash className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="KA-01-AB-1234"
                      className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground uppercase"
                    />
                  </div>
                </label>
              </div>

              <label className="block">
                <div className={labelCls}>Driving License Number</div>
                <div className="flex items-center rounded-2xl bg-muted/60 border border-border h-11 px-3">
                  <FileBadge className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                  <input
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder="KA20190001234"
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground uppercase"
                  />
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-sky-600 h-12 font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.98] hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-5 w-5" />
                    Create & Approve Delivery Boy
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
