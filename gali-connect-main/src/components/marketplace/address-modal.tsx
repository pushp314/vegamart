import { useState, lazy, Suspense } from "react";
import {
  X,
  MapPin,
  Loader2,
  Navigation,
  CheckCircle2,
  LocateFixed,
  ExternalLink,
  Link2,
  Search,
  Compass,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// Lazy-load interactive map for client-side rendering safety
const AddressPinMap = lazy(() =>
  import("./AddressPinMap").then((m) => ({ default: m.AddressPinMap }))
);

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

type LocationMode = "gps" | "link" | "map";

function extractCoordinatesFromInput(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Match raw coordinates: "21.9588, 82.9588" or "21.9588 82.9588"
  const coordMatch = trimmed.match(/([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)/);
  if (coordMatch && coordMatch[1] && coordMatch[2]) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Match ?q=lat,lng in Google Maps URLs
  const qMatch = trimmed.match(/[?&]q=([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
  if (qMatch && qMatch[1] && qMatch[2]) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Match @lat,lng in Google Maps URLs
  const atMatch = trimmed.match(/@([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
  if (atMatch && atMatch[1] && atMatch[2]) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Match destination=lat,lng
  const destMatch = trimmed.match(/destination=([-+]?\d{1,2}\.\d+),([-+]?\d{1,3}\.\d+)/);
  if (destMatch && destMatch[1] && destMatch[2]) {
    return { lat: parseFloat(destMatch[1]), lng: parseFloat(destMatch[2]) };
  }

  return null;
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

  const [locationMode, setLocationMode] = useState<LocationMode>("gps");
  const [pastedLink, setPastedLink] = useState("");
  const [isParsingLink, setIsParsingLink] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isDefault, setIsDefault] = useState(initialData?.is_default || false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  // Reverse geocode lat/lng to fill street, area, city, pincode
  const reverseGeocode = async (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
    setMapUrl(`https://www.google.com/maps?q=${lat},${lng}`);

    try {
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

        if (streetName && (!line1 || line1.length < 5)) setLine1(streetName);
        if (areaName && (!line2 || line2.length < 5)) setLine2(areaName);
        if (cityName) setCity(cityName);
        if (stateName) setState(stateName);
        if (pincodeVal) setPincode(pincodeVal);

        toast.success("📍 Exact GPS location pinned & address details auto-filled!");
      } else {
        setExactLocation(`GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        toast.success("📍 GPS coordinates pinned successfully!");
      }
    } catch {
      setExactLocation(`GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      toast.success("📍 GPS coordinates pinned successfully!");
    }
  };

  // Method 1: Auto-Detect Live GPS
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocating(false);
        await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setIsLocating(false);
        if (err.code === 1) {
          toast.error("Location permission denied. Please allow location access or paste a Google Maps link below.");
        } else {
          toast.error("Unable to retrieve location. Please check GPS signal or paste a Google Maps link below.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Method 2: Paste Google Maps Link or Coordinates (Order for Friend)
  const handleApplyPastedLink = async () => {
    if (!pastedLink.trim()) {
      toast.error("Please paste a Google Maps link or coordinates");
      return;
    }

    setIsParsingLink(true);
    try {
      const coords = extractCoordinatesFromInput(pastedLink);
      if (coords) {
        await reverseGeocode(coords.lat, coords.lng);
        setPastedLink("");
        setIsParsingLink(false);
        return;
      }

      // If text/place query without raw lat/lng, attempt Nominatim geocoding
      const query = pastedLink.trim();
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + " Sakti Chhattisgarh India"
        )}&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );

      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0 && results[0].lat && results[0].lon) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          await reverseGeocode(lat, lng);
          setPastedLink("");
          setIsParsingLink(false);
          return;
        }
      }

      toast.error(
        "Could not extract coordinates from this link. Please enter raw coordinates (e.g. 21.9588, 82.9588) or use the map pin."
      );
    } catch {
      toast.error("Failed to parse link. Please enter coordinates or use the map pin.");
    } finally {
      setIsParsingLink(false);
    }
  };

  // Method 3: Pin on Map
  const handleMapPinChange = async (lat: number, lng: number) => {
    await reverseGeocode(lat, lng);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check mandatory fields
    if (!label || !fullName || !phone || !line1 || !pincode) {
      toast.error("Please fill in all required address fields");
      return;
    }

    // MANDATORY GPS PIN VALIDATION
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      toast.error(
        "📍 Please pin your delivery location using Live GPS, a Google Maps link, or the map so your delivery partner can reach your doorstep directly!"
      );
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
        map_url: mapUrl ? mapUrl.trim().slice(0, 500) : `https://www.google.com/maps?q=${latitude},${longitude}`,
        exact_location: exactLocation ? exactLocation.trim().slice(0, 490) : null,
        is_default: isDefault,
      });
    } catch (err) {
      // Parent mutation onError handles toast
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
      <div className="w-full max-w-lg bg-card border-t sm:border border-border rounded-t-[28px] sm:rounded-3xl shadow-glow max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-2 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 sm:px-6 py-4 bg-card shrink-0">
          <div className="flex items-center gap-2.5 font-display text-base sm:text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <div>{initialData ? "Edit Address" : "Add Delivery Address"}</div>
              <p className="text-[11px] font-normal text-muted-foreground">
                Set exact GPS coordinates for hassle-free delivery
              </p>
            </div>
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
          {/* STEP 1: COMPULSORY LOCATION SETTER (3 Easy Options) */}
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
                <Compass className="h-4 w-4" />
                <span>1. Pin Delivery Location (Required *)</span>
              </div>
              {latitude && longitude ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Pinned ({latitude.toFixed(4)}, {longitude.toFixed(4)})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-extrabold px-2 py-0.5 border border-rose-300 dark:border-rose-800 animate-pulse">
                  <AlertCircle className="h-3 w-3 text-rose-600" /> Required
                </span>
              )}
            </div>

            {/* 3 Option Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-muted/80 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setLocationMode("gps")}
                className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  locationMode === "gps"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LocateFixed className="h-3.5 w-3.5 text-emerald-600" />
                <span>Live GPS</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationMode("link")}
                className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  locationMode === "link"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Paste Google Maps link or coordinates (great for ordering for friends)"
              >
                <Link2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Paste Link / Friend</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationMode("map")}
                className={`py-2 px-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  locationMode === "map"
                    ? "bg-card text-foreground shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 text-rose-600" />
                <span>Pin on Map</span>
              </button>
            </div>

            {/* TAB CONTENT 1: Live GPS */}
            {locationMode === "gps" && (
              <div className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
                <div className="text-xs">
                  <div className="font-bold text-foreground">Detect My Current Location</div>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Uses your phone/browser GPS to pinpoint your exact doorstep.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isLocating}
                  onClick={handleUseCurrentLocation}
                  className="shrink-0 flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Detecting…
                    </>
                  ) : (
                    <>
                      <LocateFixed className="h-3.5 w-3.5" />
                      <span>{latitude && longitude ? "Update GPS" : "Detect Location"}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TAB CONTENT 2: Paste Google Maps Link / WhatsApp Location / Coordinates */}
            {locationMode === "link" && (
              <div className="space-y-2 bg-card p-3 rounded-xl border border-border/70 shadow-2xs">
                <div className="text-xs">
                  <div className="font-bold text-foreground flex items-center gap-1">
                    <span>Paste Location Link or Coordinates</span>
                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.2 rounded">
                      Order for a Friend
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    Paste a Google Maps link, WhatsApp shared location, or raw coordinates (e.g. <code>21.9588, 82.9588</code>).
                  </p>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={pastedLink}
                      onChange={(e) => setPastedLink(e.target.value)}
                      placeholder="Paste https://maps.app.goo.gl/... or 21.958, 82.958"
                      className="w-full rounded-xl bg-muted border border-border h-10 px-3 text-xs outline-none focus:border-primary transition-all font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isParsingLink || !pastedLink.trim()}
                    onClick={handleApplyPastedLink}
                    className="shrink-0 flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isParsingLink ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" /> Apply Pin
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Draggable Pin on Interactive Map */}
            {locationMode === "map" && (
              <div className="space-y-2 bg-card p-2 rounded-xl border border-border/70 shadow-2xs">
                <Suspense
                  fallback={
                    <div className="h-[260px] w-full rounded-2xl bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading interactive map…
                    </div>
                  }
                >
                  <AddressPinMap
                    latitude={latitude}
                    longitude={longitude}
                    onLocationChange={handleMapPinChange}
                  />
                </Suspense>
              </div>
            )}

            {/* Pinned Success Card (Always Visible Once Location is Selected) */}
            {latitude && longitude && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 space-y-1 text-xs">
                <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Exact Delivery Coordinates Pinned</span>
                  </span>
                  {mapUrl && (
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Test in Google Maps
                    </a>
                  )}
                </div>

                {exactLocation && (
                  <p className="text-[11px] text-muted-foreground leading-tight pt-0.5">
                    {exactLocation}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: ADDRESS LABELS & CONTACT */}
          <div className="space-y-3 pt-1">
            <div className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              2. Address & Contact Details
            </div>

            {/* Label selector */}
            <div>
              <div className="mb-1 text-xs font-semibold text-foreground">Address Label</div>
              <div className="flex gap-2">
                {["Home", "Work", "Other"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setLabel(tag)}
                    className={`flex-1 rounded-xl border py-2 text-xs font-bold transition-all ${
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
                <div className="mb-1 text-xs font-semibold text-foreground">Recipient Name *</div>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ketan Dewangan"
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
                placeholder="e.g. Near Daily Market, Ward 5"
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
                placeholder="e.g. Jhulkadam Road, Near Hospital"
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

            <label className="flex items-center gap-2.5 pt-1 text-xs font-semibold text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded accent-primary cursor-pointer"
              />
              Make this my default delivery address
            </label>
          </div>
        </form>

        {/* Sticky Footer CTA - Always visible */}
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
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : initialData ? (
              "Update Address"
            ) : (
              "Save & Pin Address"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
