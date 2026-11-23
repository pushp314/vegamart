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

  // 1. Fetch serviceable cities from backend
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
      { city: "Raigarh", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.897, longitude: 83.395, delivery_radius_km: 10 },
      { city: "Bilaspur", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 22.079, longitude: 82.140, delivery_radius_km: 10 },
      { city: "Raipur", state: "Chhattisgarh", vendor_count: 0, open_vendor_count: 0, latitude: 21.251, longitude: 81.629, delivery_radius_km: 15 },
      { city: "Bengaluru", state: "Karnataka", vendor_count: 0, open_vendor_count: 0, latitude: 12.971, longitude: 77.594, delivery_radius_km: 10 },
    ];
  }, [citiesRes?.data]);

  // 2. Fetch user saved addresses
  const { data: addrRes, isLoading: isLoadingAddresses } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any>("/users/me/addresses"),
    enabled: isAuthenticated,
  });

  const addresses = addrRes?.data?.data || addrRes?.data || [];
  const defaultAddress =
    (addresses as any[]).find((a: any) => a.is_default) || (addresses as any[])[0];

  // 3. Local city selection
  const [selectedCity, setSelectedCityState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(CITY_STORAGE_KEY) || "";
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

  // Initialize selectedCity from defaultAddress or top city if not set
  useEffect(() => {
    if (!selectedCity) {
      if (defaultAddress?.city) {
        setSelectedCityState(defaultAddress.city);
        localStorage.setItem(CITY_STORAGE_KEY, defaultAddress.city);
      } else if (cities.length > 0) {
        // Pick city with most vendors or Sakti
        const topCity = cities.find((c) => c.vendor_count > 0)?.city || cities[0].city || "Sakti";
        setSelectedCityState(topCity);
        localStorage.setItem(CITY_STORAGE_KEY, topCity);
      }
    }
  }, [selectedCity, defaultAddress, cities]);

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

  // 4. GPS Auto-detection matching closest city
  const detectLocation = useCallback(async (): Promise<string | null> => {
    if (!("geolocation" in navigator)) {
      throw new Error("Geolocation is not supported by your browser");
    }
    setIsLocating(true);
    setGeoError(null);

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Find closest serviceable city
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

          const targetCityName = closestCity ? closestCity.city : "Sakti";

          setGeoLoc({
            latitude: lat,
            longitude: lng,
            line1: "Current Location",
            city: targetCityName,
          });

          setSelectedCity(targetCityName);
          setIsLocating(false);
          resolve(targetCityName);
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
    if (defaultAddress && defaultAddress.city && defaultAddress.city.toLowerCase() === selectedCity.toLowerCase()) {
      return defaultAddress;
    }
    if (geoLoc && geoLoc.city && geoLoc.city.toLowerCase() === selectedCity.toLowerCase()) {
      return geoLoc;
    }
    return {
      city: selectedCity || "Sakti",
      line1: selectedCity || "Sakti",
      latitude: currentCityObj?.latitude ?? 21.959,
      longitude: currentCityObj?.longitude ?? 82.961,
    };
  }, [defaultAddress, geoLoc, selectedCity, currentCityObj]);

  // 6. Display Location label
  const displayLocation = useMemo(() => {
    if (isLocating) return "Locating...";
    if (defaultAddress && defaultAddress.city && defaultAddress.city.toLowerCase() === selectedCity.toLowerCase()) {
      if (defaultAddress.line1 && defaultAddress.line1 !== defaultAddress.city) {
        return `${defaultAddress.line1}, ${defaultAddress.city}`;
      }
      return `${defaultAddress.city}${defaultAddress.state ? `, ${defaultAddress.state}` : ""}`;
    }
    if (selectedCity) {
      const statePart = currentCityObj?.state ? `, ${currentCityObj.state}` : "";
      return `${selectedCity}${statePart}`;
    }
    return "Select City";
  }, [isLocating, defaultAddress, selectedCity, currentCityObj]);

  return {
    selectedCity: selectedCity || "Sakti",
    setSelectedCity,
    cities,
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
