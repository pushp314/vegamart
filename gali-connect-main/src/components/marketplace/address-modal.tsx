import { useState } from "react";
import { X, MapPin, Loader2, Navigation, CheckCircle2, LocateFixed, ExternalLink } from "lucide-react";
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
  map_url?: string | null;
  exact_location?: string | null;
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
  const [latitude, setLatitude] = useState<number | null>(initialData?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialData?.longitude ?? null);
  const [mapUrl, setMapUrl] = useState<string | null>(
    initialData?.map_url ??
      (initialData?.latitude && initialData?.longitude
        ? `https://www.google.com/maps?q=${initialData.latitude},${initialData.longitude}`
        : null)
  );
  const [exactLocation, setExactLocation] = useState<string | null>(
    initialData?.exact_location ?? null
  );
  const [isLocating, setIsLocating] = useState(false);
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lng);

        const directGmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setMapUrl(directGmapsUrl);

        try {
          // Free Nominatim reverse geocoding to auto-fill street, area, city, and pincode
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { "Accept-Language": "en" } }
          );

          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};

            const streetName =
              addr.road || addr.street || addr.residential || addr.neighbourhood || "";
            const areaName =
              addr.suburb || addr.neighbourhood || addr.village || addr.subdistrict || "";
            const cityName =
              addr.city || addr.town || addr.village || addr.state_district || addr.county || "";
            const stateName = addr.state || "";
            const pincodeVal = addr.postcode || "";

            const rawLocStr =
              data.display_name ||
              [streetName, areaName, cityName, pincodeVal].filter(Boolean).join(", ");
            const fetchedLocStr = rawLocStr ? String(rawLocStr).slice(0, 480) : "";
            setExactLocation(fetchedLocStr);

            if (streetName && (!line1 || line1.length < 5)) {
              setLine1(streetName);
            }
            if (areaName && (!line2 || line2.length < 5)) {
              setLine2(areaName);
            }
            if (cityName) setCity(cityName);
            if (stateName) setState(stateName);
            if (pincodeVal) setPincode(pincodeVal);

            toast.success("📍 Exact GPS location detected & address details auto-filled!");
          } else {
            setExactLocation(`GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            toast.success("📍 Exact GPS coordinates pinned!");
          }
        } catch {
          setExactLocation(`GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          toast.success("📍 Exact GPS coordinates pinned!");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          toast.error("Location permission denied. Please allow location access in your browser settings.");
        } else {
          toast.error("Unable to retrieve location. Please check your GPS signal.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

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
        label: label.trim().slice(0, 60),
        full_name: fullName.trim().slice(0, 100),
        phone: phone.trim().slice(0, 20),
        line1: line1.trim().slice(0, 200),
        line2: line2 ? line2.trim().slice(0, 200) : "",
        city: (city.trim() || "City").slice(0, 100),
        state: (state.trim() || "State").slice(0, 100),
        pincode: (pincode.trim() || "000000").slice(0, 10),
        latitude,
        longitude,
        map_url: mapUrl ? mapUrl.trim().slice(0, 500) : null,
        exact_location: exactLocation ? exactLocation.trim().slice(0, 490) : null,
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
          {/* Quick Auto-Detect GPS Location Banner */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
                <LocateFixed className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <span>Use Current Location</span>
                  {latitude && longitude && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 text-[10px] font-extrabold px-1.5 py-0.2">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Pinned
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {latitude && longitude
                    ? `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
                    : "Auto-detects GPS so delivery boy navigates directly to your doorstep"}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={isLocating}
              onClick={handleUseCurrentLocation}
              className="shrink-0 flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Locating…
                </>
              ) : latitude && longitude ? (
                <>
                  <Navigation className="h-3 w-3" /> Update GPS
                </>
              ) : (
                <>
                  <LocateFixed className="h-3.5 w-3.5" /> Detect Location
                </>
              )}
            </button>
          </div>

          {/* Exact Fetched GPS Location Display */}
          {exactLocation && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Exact Fetched GPS Location (Shared with Delivery Boy):</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pl-5">
                {exactLocation}
              </p>
              {mapUrl && (
                <div className="pl-5 pt-0.5">
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Preview on Google Maps
                  </a>
                </div>
              )}
            </div>
          )}

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
