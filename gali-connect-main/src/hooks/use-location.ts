import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export interface AppLocation {
  latitude: number;
  longitude: number;
  line1?: string;
  city?: string;
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
const CITY_CHANGE_EVENT = "vegamart_city_changed";

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

export function useLocation() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch serviceable cities from backend (filtered by active vendor availability)
  const { data: citiesRes, isLoading: isLoadingCities } = useQuery({
    queryKey: ["serviceableCities"],
    queryFn: () => api.get<ServiceableCity[]>("/locations/cities"),
    staleTime: 5 * 60 * 1000,
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

  // 3. Local city and selected address selection
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
  const [geoLoc, setGeoLoc] = useState<AppLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Sync selectedCity when another component changes it via event
  useEffect(() => {
    const handleCityChange = (e: CustomEvent<string>) => {
      if (e.detail && e.detail !== selectedCity) {
        setSelectedCityState(e.detail);
      }
    };
    window.addEventListener(CITY_CHANGE_EVENT as any, handleCityChange);
    return () => window.removeEventListener(CITY_CHANGE_EVENT as any, handleCityChange);
  }, [selectedCity]);

  // Initialize selectedCity from selectedAddress or defaultAddress or top city if not set
  useEffect(() => {
    if (!selectedCity) {
      const activeSaved = addresses.find((a: any) => a.id === selectedAddressId) || defaultAddress;
      if (activeSaved?.city) {
        setSelectedCityState(activeSaved.city);
        localStorage.setItem(CITY_STORAGE_KEY, activeSaved.city);
      } else if (cities.length > 0) {
        const topCity = cities.find((c) => c.vendor_count > 0)?.city || cities[0].city || "Sakti";
        setSelectedCityState(topCity);
        localStorage.setItem(CITY_STORAGE_KEY, topCity);
      }
    }
  }, [selectedCity, selectedAddressId, addresses, defaultAddress, cities]);

  const setSelectedCity = useCallback(
    (cityName: string) => {
      const trimmed = cityName.trim();
      if (!trimmed) return;
      localStorage.setItem(CITY_STORAGE_KEY, trimmed);
      setSelectedCityState(trimmed);
      window.dispatchEvent(new CustomEvent(CITY_CHANGE_EVENT, { detail: trimmed }));

      // Invalidate relevant marketplace queries
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["nearbyDailyLocations"] });
    },
    [queryClient],
  );

  const setSelectedAddress = useCallback(
    async (address: any) => {
      if (!address) return;
      const addrId = address.id || "";
      setSelectedAddressIdState(addrId);
      if (addrId) {
        localStorage.setItem(SELECTED_ADDRESS_KEY, addrId);
      }
      setGeoLoc(null);

      if (address.city) {
        setSelectedCity(address.city);
      }

      if (isAuthenticated && addrId && !addrId.startsWith("addr_")) {
        api.put(`/users/me/addresses/${addrId}/default`).catch(() => {});
      }

      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      queryClient.invalidateQueries({ queryKey: ["nearbyDailyLocations"] });
    },
    [isAuthenticated, setSelectedCity, queryClient]
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

          // Find closest serviceable city by distance
          let closestCity: ServiceableCity | null = null;
          let minDistance = Infinity;

          for (const c of cities) {
            if (c.latitude && c.longitude) {
              const dist = getDistanceKm(lat, lng, c.latitude, c.longitude);
              if (dist < minDistance) {
                minDistance = dist;
                closestCity = c;
              }
            }
          }

          const fallbackCity = closestCity ? closestCity.city : "Sakti";
          let detectedCity = fallbackCity;
          let streetLine = "Current Location";

          try {
            const revRes = await api.get<any>(`/locations/reverse-geocode?lat=${lat}&lng=${lng}`);
            const rev = revRes?.data;
            if (rev?.city) detectedCity = rev.city;
            if (rev?.line1) {
              streetLine = `${rev.line1}${rev.line2 ? `, ${rev.line2}` : ""}`;
            } else if (rev?.exact_location) {
              streetLine = rev.exact_location;
            }
          } catch {
            // Use closest fallback city
          }

          setGeoLoc({
            latitude: lat,
            longitude: lng,
            line1: streetLine,
            city: detectedCity,
          });

          // Reset explicit address selection so GPS location takes precedence
          setSelectedAddressIdState("");
          localStorage.removeItem(SELECTED_ADDRESS_KEY);

          setSelectedCity(detectedCity);
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
  }, [cities, setSelectedCity]);

  // 5. Determine active address and coordinates
  const currentCityObj = useMemo(
    () => cities.find((c) => c.city.toLowerCase() === (selectedCity || "").toLowerCase()),
    [cities, selectedCity],
  );

  const activeAddress = useMemo(() => {
    // 1. If explicit saved address was selected by the customer
    if (selectedAddressId && addresses.length > 0) {
      const match = addresses.find((a: any) => a.id === selectedAddressId);
      if (match) return match;
    }
    // 2. If customer explicitly used GPS "Current Location"
    if (geoLoc && geoLoc.latitude && geoLoc.longitude) {
      return geoLoc;
    }
    // 3. If customer has a default address in the selected city
    if (defaultAddress && defaultAddress.city && defaultAddress.city.toLowerCase() === (selectedCity || "").toLowerCase()) {
      return defaultAddress;
    }
    // 4. Any default saved address
    if (defaultAddress && defaultAddress.city) {
      return defaultAddress;
    }
    // 5. Fallback city center
    return {
      city: selectedCity || "Sakti",
      line1: selectedCity || "Sakti",
      latitude: currentCityObj?.latitude ?? 21.959,
      longitude: currentCityObj?.longitude ?? 82.961,
    };
  }, [selectedAddressId, addresses, geoLoc, defaultAddress, selectedCity, currentCityObj]);

  // 6. Display Location label for header and navbar
  const displayLocation = useMemo(() => {
    if (isLocating) return "Locating...";
    if (activeAddress) {
      if (activeAddress.full_address) {
        return activeAddress.full_address;
      }
      if (activeAddress.line1) {
        return `${activeAddress.line1}, ${activeAddress.city || selectedCity}`;
      }
      if (activeAddress.city) {
        return `${activeAddress.city}${currentCityObj?.state ? `, ${currentCityObj.state}` : ""}`;
      }
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
