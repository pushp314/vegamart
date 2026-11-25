import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { citiesMatch, normalizeCityName } from "@/lib/deliverability";

export interface AppLocation {
  latitude: number;
  longitude: number;
  line1?: string;
  city?: string;
  state?: string;
  is_default?: boolean;
}

export interface ServiceableCity {
  city: string;
  state: string;
  vendor_count: number;
  open_vendor_count: number;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number;
}

const CITY_STORAGE_KEY = "vegamart_selected_city";
const SELECTED_ADDRESS_KEY = "vegamart_selected_address_id";
const GEO_LOC_STORAGE_KEY = "vegamart_geo_loc";
const CITY_CHANGE_EVENT = "vegamart_city_changed";
const GEO_CHANGE_EVENT = "vegamart_geo_changed";
const ADDRESS_CHANGE_EVENT = "vegamart_address_changed";

export const KNOWN_CITY_COORDS: Record<string, { lat: number; lng: number; state: string }> = {
  bhilai: { lat: 21.1938, lng: 81.3509, state: "Chhattisgarh" },
  durg: { lat: 21.1904, lng: 81.2849, state: "Chhattisgarh" },
  raipur: { lat: 21.2514, lng: 81.6296, state: "Chhattisgarh" },
  bilaspur: { lat: 22.0797, lng: 82.1409, state: "Chhattisgarh" },
  sakti: { lat: 21.959, lng: 82.961, state: "Chhattisgarh" },
  raigarh: { lat: 21.8974, lng: 83.395, state: "Chhattisgarh" },
  korba: { lat: 22.3595, lng: 82.7501, state: "Chhattisgarh" },
  rajnandgaon: { lat: 21.0972, lng: 81.0282, state: "Chhattisgarh" },
  janjgir: { lat: 22.011, lng: 82.5789, state: "Chhattisgarh" },
  champa: { lat: 22.0355, lng: 82.6524, state: "Chhattisgarh" },
  bengaluru: { lat: 12.9716, lng: 77.5946, state: "Karnataka" },
};

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function readStoredGeoLoc(): AppLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GEO_LOC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.latitude === "number" &&
      typeof parsed.longitude === "number" &&
      parsed.latitude > 5 &&
      parsed.longitude > 60
    ) {
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  return null;
}

export function useLocation() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch serviceable cities from backend (filtered by active vendor availability)
  const { data: citiesRes, isLoading: isLoadingCities } = useQuery({
    queryKey: ["serviceableCities"],
    queryFn: () => api.get<ServiceableCity[]>("/locations/cities"),
    staleTime: 60 * 1000,
  });

  const cities: ServiceableCity[] = useMemo(() => {
    const raw = citiesRes?.data;
    if (Array.isArray(raw) && raw.length > 0) return raw;
    return [
      { city: "Sakti", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.959, longitude: 82.961, delivery_radius_km: 10 },
    ];
  }, [citiesRes?.data]);

  // 2. Fetch user saved addresses
  const { data: addrRes, isLoading: isLoadingAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any>("/users/me/addresses"),
    enabled: isAuthenticated,
  });

  const rawAddresses = addrRes?.data?.data || addrRes?.data || [];
  const addresses: any[] = Array.isArray(rawAddresses) ? rawAddresses : [];
  const defaultAddress =
    addresses.find((a: any) => a.is_default) || addresses[0];

  // 3. Shared local city, selected address, and GPS location across all hook callers
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CITY_STORAGE_KEY) || "";
    }
    return "";
  });

  const [selectedAddressId, setSelectedAddressIdState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(SELECTED_ADDRESS_KEY) || "";
    }
    return "";
  });

  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [geoLoc, setGeoLocState] = useState<AppLocation | null>(() => readStoredGeoLoc());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Sync shared state across components via custom window events
  useEffect(() => {
    const handleCityChange = (e: CustomEvent<string>) => {
      if (e.detail && e.detail !== selectedCity) {
        setSelectedCityState(e.detail);
      }
    };
    const handleGeoChange = (e: CustomEvent<AppLocation | null>) => {
      setGeoLocState(e.detail ?? null);
    };
    const handleAddressChange = (e: CustomEvent<string>) => {
      setSelectedAddressIdState(e.detail ?? "");
    };
    window.addEventListener(CITY_CHANGE_EVENT as any, handleCityChange);
    window.addEventListener(GEO_CHANGE_EVENT as any, handleGeoChange);
    window.addEventListener(ADDRESS_CHANGE_EVENT as any, handleAddressChange);
    return () => {
      window.removeEventListener(CITY_CHANGE_EVENT as any, handleCityChange);
      window.removeEventListener(GEO_CHANGE_EVENT as any, handleGeoChange);
      window.removeEventListener(ADDRESS_CHANGE_EVENT as any, handleAddressChange);
    };
  }, [selectedCity]);

  const persistGeoLoc = useCallback((loc: AppLocation | null) => {
    setGeoLocState(loc);
    if (typeof window !== "undefined") {
      if (loc) {
        localStorage.setItem(GEO_LOC_STORAGE_KEY, JSON.stringify(loc));
      } else {
        localStorage.removeItem(GEO_LOC_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent(GEO_CHANGE_EVENT, { detail: loc }));
    }
  }, []);

  const persistSelectedAddressId = useCallback((addrId: string) => {
    setSelectedAddressIdState(addrId);
    if (typeof window !== "undefined") {
      if (addrId) {
        localStorage.setItem(SELECTED_ADDRESS_KEY, addrId);
      } else {
        localStorage.removeItem(SELECTED_ADDRESS_KEY);
      }
      window.dispatchEvent(new CustomEvent(ADDRESS_CHANGE_EVENT, { detail: addrId }));
    }
  }, []);

  // Initialize selectedCity from selectedAddress, geoLoc, defaultAddress, or top city
  useEffect(() => {
    if (!selectedCity) {
      if (geoLoc?.city) {
        setSelectedCityState(geoLoc.city);
        localStorage.setItem(CITY_STORAGE_KEY, geoLoc.city);
        return;
      }
      const activeSaved = addresses.find((a: any) => a.id === selectedAddressId) || defaultAddress;
      if (activeSaved?.city && normalizeCityName(activeSaved.city) !== "city") {
        setSelectedCityState(activeSaved.city);
        localStorage.setItem(CITY_STORAGE_KEY, activeSaved.city);
      } else if (cities.length > 0) {
        const topCity = cities.find((c) => c.vendor_count > 0)?.city || cities[0].city || "Sakti";
        setSelectedCityState(topCity);
        localStorage.setItem(CITY_STORAGE_KEY, topCity);
      }
    }
  }, [selectedCity, geoLoc?.city, selectedAddressId, addresses, defaultAddress, cities]);

  const setSelectedCity = useCallback(
    (cityName: string, options?: { keepGeoLoc?: boolean }) => {
      const trimmed = cityName.trim();
      if (!trimmed) return;
      localStorage.setItem(CITY_STORAGE_KEY, trimmed);
      setSelectedCityState(trimmed);
      window.dispatchEvent(new CustomEvent(CITY_CHANGE_EVENT, { detail: trimmed }));

      // Clear stale GPS coords / saved address from a different city so coords never mismatch city
      if (!options?.keepGeoLoc && geoLoc?.city && !citiesMatch(geoLoc.city, trimmed)) {
        persistGeoLoc(null);
      }
      const currentSaved = addresses.find((a: any) => a.id === selectedAddressId);
      if (currentSaved?.city && !citiesMatch(currentSaved.city, trimmed)) {
        persistSelectedAddressId("");
      }

      // Invalidate relevant marketplace queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["allVendors"] });
      queryClient.invalidateQueries({ queryKey: ["nearbyDailyLocations"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      queryClient.invalidateQueries({ queryKey: ["recommended_products"] });
      queryClient.invalidateQueries({ queryKey: ["recently_viewed"] });
    },
    [queryClient, geoLoc?.city, addresses, selectedAddressId, persistGeoLoc, persistSelectedAddressId],
  );

  const setSelectedAddress = useCallback(
    async (address: any) => {
      if (!address) return;
      const addrId = address.id || "";
      persistSelectedAddressId(addrId);
      persistGeoLoc(null);

      if (address.city && normalizeCityName(address.city) !== "city") {
        localStorage.setItem(CITY_STORAGE_KEY, address.city.trim());
        setSelectedCityState(address.city.trim());
        window.dispatchEvent(new CustomEvent(CITY_CHANGE_EVENT, { detail: address.city.trim() }));
      }

      if (isAuthenticated && addrId && !addrId.startsWith("addr_")) {
        api.put(`/users/me/addresses/${addrId}/default`).catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["allVendors"] });
      queryClient.invalidateQueries({ queryKey: ["nearbyDailyLocations"] });
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      queryClient.invalidateQueries({ queryKey: ["recommended_products"] });
      queryClient.invalidateQueries({ queryKey: ["recently_viewed"] });
    },
    [isAuthenticated, persistSelectedAddressId, persistGeoLoc, queryClient]
  );

  // 4. GPS Auto-detection with reverse-geocoding
  const detectLocation = useCallback(async (): Promise<string | null> => {
    if (!("geolocation" in navigator)) {
      throw new Error("Geolocation is not supported by your browser");
    }
    setIsLocating(true);
    setGeoError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Find closest serviceable or known city by distance
          let closestCity: string | null = null;
          let minDistance = Infinity;

          for (const c of cities) {
            if (c.latitude && c.longitude) {
              const dist = getDistanceKm(lat, lng, c.latitude, c.longitude);
              if (dist < minDistance) {
                minDistance = dist;
                closestCity = c.city;
              }
            }
          }
          for (const [k, coords] of Object.entries(KNOWN_CITY_COORDS)) {
            const dist = getDistanceKm(lat, lng, coords.lat, coords.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestCity = k.charAt(0).toUpperCase() + k.slice(1);
            }
          }

          let detectedCity = closestCity || "Sakti";
          let streetLine = "";
          let stateName = "";

          try {
            const revRes = await api.get<any>(`/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
            const rev = revRes?.data;
            if (rev?.city) detectedCity = rev.city;
            if (rev?.state) stateName = rev.state;
            if (rev?.line1) {
              streetLine = `${rev.line1}${rev.line2 ? `, ${rev.line2}` : ""}`;
            } else if (rev?.line2) {
              streetLine = rev.line2;
            }
          } catch {
            // Use closest fallback city
          }

          const newGeo: AppLocation = {
            latitude: lat,
            longitude: lng,
            line1: streetLine || detectedCity,
            city: detectedCity,
            state: stateName || undefined,
          };

          persistSelectedAddressId("");
          persistGeoLoc(newGeo);
          setSelectedCity(detectedCity, { keepGeoLoc: true });
          setIsLocating(false);
          resolve(detectedCity);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setGeoError(error.message);
          setIsLocating(false);
          reject(new Error(error.message || "Failed to get current GPS location"));
        },
        { timeout: 10000, enableHighAccuracy: true },
      );
    });
  }, [cities, setSelectedCity, persistGeoLoc, persistSelectedAddressId]);

  // 5. Determine active address and coordinates
  const currentCityObj = useMemo(
    () => cities.find((c) => citiesMatch(c.city, selectedCity)),
    [cities, selectedCity],
  );

  const activeAddress = useMemo(() => {
    const cityNorm = normalizeCityName(selectedCity);
    const knownCenter = KNOWN_CITY_COORDS[cityNorm] || null;

    // 1. If explicit saved address was selected by the customer (and matches selectedCity if one is set)
    if (selectedAddressId && addresses.length > 0) {
      const match = addresses.find((a: any) => a.id === selectedAddressId);
      if (match && (!selectedCity || citiesMatch(match.city, selectedCity))) {
        return match;
      }
    }
    // 2. If customer explicitly used GPS "Current Location" (and matches selectedCity if one is set)
    if (geoLoc && geoLoc.latitude && geoLoc.longitude) {
      if (!selectedCity || !geoLoc.city || citiesMatch(geoLoc.city, selectedCity)) {
        return geoLoc;
      }
    }
    // 3. If customer has a default address in the selected city
    if (defaultAddress && defaultAddress.city && citiesMatch(defaultAddress.city, selectedCity)) {
      return defaultAddress;
    }
    // 4. Default saved address ONLY when no specific city was picked yet
    if (!selectedCity && defaultAddress && defaultAddress.city) {
      return defaultAddress;
    }
    // 5. Fallback city center (prefer backend city coords -> KNOWN_CITY_COORDS -> never fall back to Sakti for another city!)
    const targetCity = selectedCity || "Sakti";
    const fallbackLat = currentCityObj?.latitude ?? knownCenter?.lat ?? (cityNorm === "sakti" ? 21.959 : null);
    const fallbackLng = currentCityObj?.longitude ?? knownCenter?.lng ?? (cityNorm === "sakti" ? 82.961 : null);
    return {
      city: targetCity,
      line1: targetCity,
      state: currentCityObj?.state ?? knownCenter?.state,
      latitude: fallbackLat,
      longitude: fallbackLng,
    };
  }, [selectedAddressId, addresses, geoLoc, defaultAddress, selectedCity, currentCityObj]);

  // 6. Display Location label for header and navbar
  const displayLocation = useMemo(() => {
    if (isLocating) return "Locating...";
    if (activeAddress) {
      if (activeAddress.full_address) {
        return activeAddress.full_address;
      }
      const line1 = (activeAddress.line1 || "").trim();
      const city = (activeAddress.city || selectedCity || "").trim();
      if (line1 && city && line1.toLowerCase() !== city.toLowerCase()) {
        return `${line1}, ${city}`;
      }
      if (city) {
        const statePart =
          activeAddress.state || currentCityObj?.state || KNOWN_CITY_COORDS[normalizeCityName(city)]?.state || "";
        return statePart ? `${city}, ${statePart}` : city;
      }
      if (line1) return line1;
    }
    if (selectedCity) {
      const statePart = currentCityObj?.state ? `, ${currentCityObj.state}` : "";
      return `${selectedCity}${statePart}`;
    }
    return "Select Location";
  }, [isLocating, activeAddress, selectedCity, currentCityObj]);

  return {
    selectedCity: selectedCity || "Sakti",
    setSelectedCity,
    cities,
    addresses,
    selectedAddressId,
    setSelectedAddress,
    activeAddress,
    displayLocation,
    isLocating,
    isLoadingAddresses,
    isLoadingCities,
    geoError,
    detectLocation,
    isCityModalOpen,
    setIsCityModalOpen,
    openCitySelector: () => setIsCityModalOpen(true),
  };
}
