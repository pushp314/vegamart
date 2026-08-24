import { useState } from "react";
import { X, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface AddressData {
  id?: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number | null;
  longitude?: number | null;
  full_address?: string | null;
  area?: string | null;
  type?: string | null;
  is_default: boolean;
}

interface AddressModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (address: AddressData) => void | Promise<any>;
  initialData?: AddressData | null;
}

export function AddressModal({ open, onClose, onSave, initialData }: AddressModalProps) {
  const [label, setLabel] = useState(initialData?.label || "Home");
  const [fullName, setFullName] = useState(initialData?.full_name || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [line1, setLine1] = useState(initialData?.line1 || "");
  const [line2, setLine2] = useState(initialData?.line2 || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [state, setState] = useState(initialData?.state || "");
  const [pincode, setPincode] = useState(initialData?.pincode || "");
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !fullName || !phone || !line1 || !pincode) {
      toast.error("Please fill in all required address fields");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: initialData?.id || `addr_${Date.now()}`,
        label,
        full_name: fullName,
        phone,
        line1,
        line2,
        city,
        state,
        pincode,
        is_default: isDefault,
      });
      // Parent mutation onSuccess handles the success toast and closing the modal.
    } catch (err) {
      // Parent mutation onError handles the error toast.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-[28px] sm:rounded-3xl shadow-glow max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 sm:px-6 py-4 bg-card shrink-0">
          <div className="flex items-center gap-2.5 font-display text-base sm:text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            {initialData ? "Edit Address" : "Add Delivery Address"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="address-form"
          className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-4"
          onSubmit={handleSubmit}
        >
          {/* Label selector */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">Address Label</div>
            <div className="flex gap-2">
              {["Home", "Work", "Other"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setLabel(tag)}
                  className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                    label === tag
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Full Name *</div>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Phone Number *</div>
              <input
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">
              Flat / House No. / Building *
            </div>
            <input
              required
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="e.g. Flat 302, Green Heights"
              className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">
              Street / Area / Landmark
            </div>
            <input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              placeholder="e.g. Near Daily Market, Main Road"
              className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </label>

          <div className="grid grid-cols-3 gap-2.5">
            <label className="block col-span-2">
              <div className="mb-1 text-xs font-semibold text-foreground">City & Area *</div>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Sakti"
                className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Pincode *</div>
              <input
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 495689"
                className="w-full rounded-2xl bg-muted border border-border h-11 px-3.5 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            </label>
          </div>

          <label className="flex items-center gap-2.5 pt-2 text-xs font-semibold text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
            Make this my default delivery address
          </label>
        </form>

        {/* Sticky Footer CTA - Always visible & easily accessible */}
        <div className="p-4 sm:p-5 border-t border-border bg-card/95 backdrop-blur-md sticky bottom-0 z-10 flex gap-2.5 shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-muted py-3 text-xs font-bold text-muted-foreground hover:bg-card hover:text-foreground transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="address-form"
            disabled={saving}
            className="flex-[2] rounded-2xl bg-primary text-primary-foreground font-bold text-xs py-3 hover:bg-primary/90 flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (initialData ? "Update Address" : "Save Address")}
          </button>
        </div>
      </div>
    </div>
  );
}
