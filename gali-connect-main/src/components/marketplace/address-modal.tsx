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
  const [phone, setPhone] = useState(initialData?.phone || "9876543210");
  const [line1, setLine1] = useState(initialData?.line1 || "Flat 402, Green Valley Apartments");
  const [line2, setLine2] = useState(initialData?.line2 || "12th Main Road");
  const [city, setCity] = useState(initialData?.city || "Indiranagar, Bengaluru");
  const [state, setState] = useState(initialData?.state || "Karnataka");
  const [pincode, setPincode] = useState(initialData?.pincode || "560038");
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
      // The parent mutation onSuccess will handle the success toast and closing the modal.
      // But if the parent doesn't close it, we should ensure the state is reset.
    } catch (err) {
      // The parent mutation onError will handle the error toast.
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg bg-card border rounded-3xl p-6 shadow-glow max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            {initialData ? "Edit Address" : "Add Delivery Address"}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          {/* Label selector */}
          <div>
            <div className="mb-1.5 text-xs font-semibold text-foreground">Address Label</div>
            <div className="flex gap-2">
              {["Home", "Work", "Other"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setLabel(tag)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
                    label === tag
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Full Name</div>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="w-full rounded-2xl bg-muted border h-10 px-3 text-xs outline-none"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Phone Number *</div>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">
              Flat / House No. / Building *
            </div>
            <input
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              placeholder="e.g. B-402, Green Valley Apartments"
              className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          <label className="block">
            <div className="mb-1 text-xs font-semibold text-foreground">
              Street / Area / Landmark
            </div>
            <input
              value={line2}
              onChange={(e) => setLine2(e.target.value)}
              placeholder="e.g. Near Indiranagar Metro Station"
              className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="block col-span-2">
              <div className="mb-1 text-xs font-semibold text-foreground">City & Area *</div>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <label className="block">
              <div className="mb-1 text-xs font-semibold text-foreground">Pincode *</div>
              <input
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="560038"
                className="w-full rounded-2xl bg-muted border h-11 px-3 text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded accent-primary"
            />
            Make this my default delivery address
          </label>

          <div className="flex gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border bg-muted py-2.5 text-xs font-semibold text-muted-foreground hover:bg-card"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-2xl bg-primary text-primary-foreground font-semibold text-xs py-2.5 hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
