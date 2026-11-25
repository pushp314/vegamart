import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Search,
  Navigation,
  Check,
  Store,
  Sparkles,
  Loader2,
  Home,
  Briefcase,
  Plus,
  LogIn,
} from "lucide-react";
import { useLocation, ServiceableCity } from "@/hooks/use-location";
import { useAuth } from "@/context/auth-context";
import { AddressModal, AddressData } from "@/components/marketplace/address-modal";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface CitySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CitySelectorModal({ open, onOpenChange }: CitySelectorModalProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const {
    selectedCity,
    setSelectedCity,
    cities,
    addresses,
    setSelectedAddress,
    activeAddress,
    detectLocation,
    isLocating,
  } = useLocation();

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);

  // Filter cities: only show cities with actual stores (or matching active search)
  const filteredCities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) {
      // By default, only show cities that have vendors or the current selected city
      return cities.filter(
        (c) => c.vendor_count > 0 || c.city.toLowerCase() === selectedCity.toLowerCase()
      );
    }
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q))
    );
  }, [cities, searchTerm, selectedCity]);

  const handleSelectCity = (city: ServiceableCity) => {
    setSelectedCity(city.city);
    toast.success(`Delivery area set to ${city.city}`, {
      description: `Showing shops and fast delivery in ${city.city}, ${city.state || "Chhattisgarh"}.`,
    });
    onOpenChange(false);
  };

  const handleSelectAddress = (addr: any) => {
    setSelectedAddress(addr);
    toast.success(`Delivering to ${addr.label || addr.city}`, {
      description: addr.full_address || addr.line1 || addr.city,
    });
    onOpenChange(false);
  };

  const handleGpsDetect = async () => {
    try {
      const detectedCity = await detectLocation();
      if (detectedCity) {
        toast.success(`Location detected: ${detectedCity} 🎯`, {
          description: `Delivery area set to your current GPS position in ${detectedCity}.`,
        });
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not detect GPS location. Please choose an address or city.");
    }
  };

  const handleSaveNewAddress = async (data: AddressData) => {
    try {
      const res = await api.post<any>("/users/me/addresses", data);
      const newAddr = res?.data?.data || res?.data;
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      if (newAddr) {
        setSelectedAddress(newAddr);
      }
      toast.success("New delivery address saved!");
      setIsAddAddressOpen(false);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save address");
    }
  };

  const getAddressIcon = (label?: string) => {
    const lower = (label || "").toLowerCase();
    if (lower.includes("home")) return <Home className="h-4 w-4" />;
    if (lower.includes("work") || lower.includes("office")) return <Briefcase className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] rounded-2xl p-5 overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader className="text-left space-y-1 shrink-0 pb-1">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" />
              <DialogTitle className="text-lg font-bold font-display">
                Select Delivery Location
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose from your saved addresses or detect your current GPS location.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto space-y-4 pr-1 flex-1 py-1">
            {/* 1. GPS Auto-detect Button */}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGpsDetect}
                disabled={isLocating}
                className="w-full flex items-center justify-between h-12 rounded-xl border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary font-bold text-xs sm:text-sm transition-all"
              >
                <div className="flex items-center gap-2.5">
                  {isLocating ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Navigation className="h-4 w-4 text-primary fill-primary/20" />
                  )}
                  <span>{isLocating ? "Detecting current location..." : "Use Current Location (GPS)"}</span>
                </div>
                <span className="text-[11px] font-extrabold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Auto-detect
                </span>
              </Button>
            </div>

            {/* 2. Customer Saved Addresses */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Your Saved Addresses {addresses.length > 0 ? `(${addresses.length})` : ""}
                </span>
                {isAuthenticated && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddAddressOpen(true)}
                    className="h-7 px-2 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add New
                  </Button>
                )}
              </div>

              {isAuthenticated ? (
                addresses.length > 0 ? (
                  <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                    {addresses.map((addr: any) => {
                      const isSelected =
                        activeAddress?.id === addr.id ||
                        (!activeAddress?.id &&
                          (addr.is_default ||
                            (activeAddress?.full_address &&
                              activeAddress.full_address === addr.full_address)));

                      return (
                        <div
                          key={addr.id}
                          onClick={() => handleSelectAddress(addr)}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-left border cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                              : "border-border/70 hover:border-primary/40 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg mt-0.5 ${
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {getAddressIcon(addr.label)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                  {addr.label || "Delivery Address"}
                                </span>
                                {isSelected && (
                                  <span className="text-[10px] bg-primary text-primary-foreground font-bold px-1.5 py-0.2 rounded-full">
                                    Delivering Here
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                {addr.full_address || addr.line1 || "Saved address"}
                              </p>
                              <div className="text-[11px] font-medium text-muted-foreground/80 flex items-center gap-1.5 mt-0.5">
                                <span>{addr.city}</span>
                                {addr.pincode && <span>• {addr.pincode}</span>}
                                {addr.phone && <span>• 📞 {addr.phone}</span>}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground ml-2">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/80 p-4 text-center space-y-2 bg-muted/20">
                    <p className="text-xs text-muted-foreground">
                      You haven't saved any delivery addresses yet.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddAddressOpen(true)}
                      className="h-8 text-xs font-bold text-primary border-primary/40"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Delivery Address
                    </Button>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Have saved addresses?</span>
                    <p className="text-[11px]">Log in to access your saved home and work locations.</p>
                  </div>
                  <Button asChild size="sm" variant="default" className="h-8 text-xs font-bold shrink-0">
                    <Link to="/login">
                      <LogIn className="h-3.5 w-3.5 mr-1" /> Sign In
                    </Link>
                  </Button>
                </div>
              )}
            </div>

            {/* 3. Serviceable Delivery Cities */}
            <div className="space-y-2 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Serviceable Cities ({filteredCities.length})
                </span>
              </div>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search city or town (e.g. Bhilai, Sakti)..."
                  className="pl-8 h-9 rounded-xl text-xs bg-muted/40 border-muted"
                />
              </div>

              {/* Cities List */}
              <div className="space-y-1 max-h-[140px] overflow-y-auto pr-0.5">
                {filteredCities.length === 0 ? (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    No active cities match &quot;{searchTerm}&quot;. Try &quot;Use Current Location (GPS)&quot; above.
                  </div>
                ) : (
                  filteredCities.map((c) => {
                    const isSelected = selectedCity.trim().toLowerCase() === c.city.trim().toLowerCase();
                    return (
                      <button
                        key={c.city}
                        type="button"
                        onClick={() => handleSelectCity(c)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left border transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-xs"
                            : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <Store className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs truncate">{c.city}</span>
                              {isSelected && (
                                <span className="text-[9px] bg-primary text-primary-foreground font-bold px-1.5 py-0.2 rounded-full">
                                  Active
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                              <span>{c.city.toLowerCase() === "sakti" ? "Chhattisgarh" : (c.state || "Chhattisgarh")}</span>
                              {c.vendor_count > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    {c.vendor_count} {c.vendor_count === 1 ? "store" : "stores"}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground">
                            <Check className="h-3 w-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground flex items-center gap-1.5 justify-center shrink-0">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Fast hyper-local delivery from verified local vendors</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Address Modal for adding new addresses */}
      <AddressModal
        open={isAddAddressOpen}
        onClose={() => setIsAddAddressOpen(false)}
        onSave={handleSaveNewAddress}
      />
    </>
  );
}
