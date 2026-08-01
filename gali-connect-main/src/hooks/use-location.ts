import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

export interface AppLocation {
  latitude: number;
  longitude: number;
  line1?: string;
  city?: string;
  is_default?: boolean;
}

export function useLocation() {
  const { isAuthenticated } = useAuth();
  
  const { data: addrRes, isLoading: isLoadingAddresses } = useQuery({ 
    queryKey: ["addresses"], 
    queryFn: () => api.get<any>("/users/me/addresses"),
    enabled: isAuthenticated,
  });

  const addresses = addrRes?.data?.data || addrRes?.data || [];
  const defaultAddress = (addresses as any[]).find((a: any) => a.is_default) || (addresses as any[])[0];

  const [geoLoc, setGeoLoc] = useState<AppLocation | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (defaultAddress) {
      return;
    }

    if ("geolocation" in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLoc({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            line1: "Current Location",
            city: "Detected",
          });
          setIsLocating(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setGeoError(error.message);
          setIsLocating(false);
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    }
  }, [defaultAddress]);

  const activeAddress = defaultAddress || geoLoc;
  
  let displayLocation = "Indiranagar, Bengaluru"; // Fallback
  if (activeAddress?.line1 && activeAddress?.city) {
    displayLocation = `${activeAddress.line1}, ${activeAddress.city}`;
  } else if (isLocating || isLoadingAddresses) {
    displayLocation = "Locating...";
  }

  return { 
    activeAddress, 
    displayLocation, 
    isLocating,
    isLoadingAddresses,
    geoError
  };
}
