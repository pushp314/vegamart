import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import {
  MapPin,
  AlertTriangle,
  Navigation,
  ArrowRight,
  X,
  Compass,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { AddressModal, AddressData } from "./address-modal";
import { toast } from "sonner";

const DISMISSED_SESSION_KEY = "vegamart_customer_location_prompt_dismissed";

export function CustomerLocationPromptModal() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isGuest } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressData | null>(null);

  // Only check for logged-in customers (not vendor/delivery/admin)
  const isCustomer =
    isAuthenticated &&
    !isGuest &&
    (!user?.role || user?.role === "customer");

  const { data: addrRes, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any>("/users/me/addresses"),
    enabled: isCustomer,
  });

  const rawAddresses = addrRes?.data?.data || addrRes?.data || [];
  const addresses: AddressData[] = Array.isArray(rawAddresses) ? rawAddresses : [];

  const isValidPin = (addr: AddressData | any) => {
    return Boolean(
      addr?.latitude &&
        addr?.longitude &&
        Number(addr.latitude) > 5 &&
        Number(addr.longitude) > 60
    );
  };

  const unpinnedAddresses = addresses.filter((a) => !isValidPin(a));
  const hasAnyPinnedAddress = addresses.some(isValidPin);

  useEffect(() => {
    if (!isCustomer || isLoading) return;

    // Check if user has dismissed prompt for this browser tab session
    const isDismissed = sessionStorage.getItem(DISMISSED_SESSION_KEY) === "true";
    if (isDismissed) return;

    // Trigger popup if user has saved addresses but NONE of them have GPS coordinates
    if (addresses.length > 0 && !hasAnyPinnedAddress) {
      setModalOpen(true);
    } else {
      setModalOpen(false);
    }
  }, [isCustomer, isLoading, addresses.length, hasAnyPinnedAddress]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_SESSION_KEY, "true");
    setModalOpen(false);
  };

  const handleOpenPinModal = (addr?: AddressData) => {
    const targetAddr = addr || unpinnedAddresses[0] || addresses[0];
    setEditingAddress(targetAddr || null);
    setAddressModalOpen(true);
  };

  const saveAddressMutation = useMutation({
    mutationFn: async (data: AddressData) => {
      const res =
        data.id && !data.id.startsWith("addr_")
          ? await api.put(`/users/me/addresses/${data.id}`, data)
          : await api.post("/users/me/addresses", data);

      if (!res.success) {
        throw new Error(res.error?.message || "Failed to update address location");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      toast.success("Delivery location pin saved successfully! 🎯");
      setAddressModalOpen(false);
      setEditingAddress(null);
      // Remove dismissal so next time it validates freshly
      sessionStorage.removeItem(DISMISSED_SESSION_KEY);
      setModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to save address location pin");
    },
  });

  // Don't render anything if conditions aren't met
  if (!isCustomer || !modalOpen || addresses.length === 0 || hasAnyPinnedAddress) {
    return (
      <>
        {addressModalOpen && (
          <AddressModal
            open={addressModalOpen}
            onClose={() => {
              setAddressModalOpen(false);
              setEditingAddress(null);
            }}
            onSave={(data) => saveAddressMutation.mutateAsync(data)}
            initialData={editingAddress}
          />
        )}
      </>
    );
  }

  const primaryAddress = unpinnedAddresses[0] || addresses[0];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-md rounded-3xl bg-card border border-border/80 shadow-2xl p-6 sm:p-7 text-card-foreground animate-in zoom-in-95 duration-200 overflow-hidden">
          {/* Subtle gradient banner */}
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-emerald-500" />

          {/* Close button (session dismiss) */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground grid place-items-center transition-colors"
            title="Remind me later"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Badge & Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold shadow-xs">
              <MapPin className="h-6 w-6 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
              </span>
            </div>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <AlertTriangle className="h-3 w-3" /> Location Update Compulsory
              </span>
              <h2 className="text-lg font-display font-bold text-foreground mt-0.5">
                Pin Your Delivery Location
              </h2>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            Vegamart delivery partners need your <strong className="text-foreground">exact GPS coordinates</strong> to deliver straight to your doorstep without calling for directions.
          </p>

          {/* Unpinned Address Info Card */}
          {primaryAddress && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3.5 mb-5 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-foreground capitalize">
                  {primaryAddress.label || primaryAddress.type || "Home Address"}
                </span>
                <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-300 uppercase bg-amber-500/15 px-2 py-0.5 rounded-md">
                  GPS Pin Missing
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {primaryAddress.line1}
                {primaryAddress.city ? `, ${primaryAddress.city}` : ""}
              </p>
            </div>
          )}

          {/* 3 Simple Methods info */}
          <div className="rounded-2xl bg-muted/40 p-3 mb-5 space-y-2 border border-border/50">
            <p className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> 3 Fast Ways to Set Location:
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-1 pl-1">
              <li className="flex items-center gap-1.5">
                <Navigation className="h-3 w-3 text-emerald-500 shrink-0" />
                <span><strong>1-Tap Live GPS</strong>: Auto-detects where you are right now.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Compass className="h-3 w-3 text-sky-500 shrink-0" />
                <span><strong>Paste Link / Friend</strong>: Paste Google Maps or WhatsApp location.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                <span><strong>Interactive Map</strong>: Drag & drop the red pin on the exact rooftop.</span>
              </li>
            </ul>
          </div>

          {/* Action CTAs */}
          <div className="space-y-2">
            <button
              onClick={() => handleOpenPinModal(primaryAddress)}
              className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <MapPin className="h-4 w-4" /> Pin Exact Delivery Location Now
              <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={handleDismiss}
              className="w-full h-9 rounded-xl text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              Remind me in next session
            </button>
          </div>
        </div>
      </div>

      {addressModalOpen && (
        <AddressModal
          open={addressModalOpen}
          onClose={() => {
            setAddressModalOpen(false);
            setEditingAddress(null);
          }}
          onSave={(data) => saveAddressMutation.mutateAsync(data)}
          initialData={editingAddress}
        />
      )}
    </>
  );
}
