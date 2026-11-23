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
import { MapPin, Search, Navigation, Check, Store, Sparkles, Loader2 } from "lucide-react";
import { useLocation, ServiceableCity } from "@/hooks/use-location";
import { toast } from "sonner";

interface CitySelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CitySelectorModal({ open, onOpenChange }: CitySelectorModalProps) {
  const { selectedCity, setSelectedCity, cities, detectLocation, isLocating } = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.city.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q))
    );
  }, [cities, searchTerm]);

  const handleSelectCity = (city: ServiceableCity) => {
    setSelectedCity(city.city);
    toast.success(`Delivery city set to ${city.city}`, {
      description: `Showing shops and fast delivery available in ${city.city}.`,
    });
    onOpenChange(false);
  };

  const handleGpsDetect = async () => {
    try {
      const detectedCity = await detectLocation();
      if (detectedCity) {
        toast.success(`Detected location: ${detectedCity}`, {
          description: `Delivery area set to ${detectedCity}.`,
        });
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Could not detect location. Please select your city manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[95vw] rounded-2xl p-5 overflow-hidden">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold font-display">
              Choose your Delivery City
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Select your city or district to discover local vendors and check delivery availability.
          </DialogDescription>
        </DialogHeader>

        {/* GPS Location Button */}
        <div className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleGpsDetect}
            disabled={isLocating}
            className="w-full flex items-center justify-between h-12 rounded-xl border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary text-primary font-medium text-xs sm:text-sm transition-all"
          >
            <div className="flex items-center gap-2.5">
              {isLocating ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Navigation className="h-4 w-4 text-primary fill-primary/20" />
              )}
              <span>{isLocating ? "Detecting nearest city..." : "Use Current Location (GPS)"}</span>
            </div>
            <span className="text-[11px] font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
              Auto-detect
            </span>
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search city or town (e.g. Sakti, Raigarh)..."
            className="pl-9 h-10 rounded-xl text-xs sm:text-sm bg-muted/40 border-muted"
          />
        </div>

        {/* Available Cities List */}
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1">
            Serviceable Cities ({filteredCities.length})
          </div>

          {filteredCities.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No cities match &quot;{searchTerm}&quot;. VegaMart is rapidly expanding!
            </div>
          ) : (
            filteredCities.map((c) => {
              const isSelected = selectedCity.trim().toLowerCase() === c.city.trim().toLowerCase();
              return (
                <button
                  key={c.city}
                  type="button"
                  onClick={() => handleSelectCity(c)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Store className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{c.city}</span>
                        {isSelected && (
                          <span className="text-[10px] bg-primary text-primary-foreground font-bold px-1.5 py-0.2 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{c.state || "India"}</span>
                        <span>•</span>
                        {c.vendor_count > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {c.vendor_count} {c.vendor_count === 1 ? "store" : "stores"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Coming soon</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shrink-0 text-primary-foreground">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground flex items-center gap-1.5 justify-center">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Expanding soon to more areas across Chhattisgarh & India</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
