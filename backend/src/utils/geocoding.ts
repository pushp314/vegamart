export interface KnownCityInfo {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const KNOWN_CITIES: KnownCityInfo[] = [
  { name: "Bhilai", state: "Chhattisgarh", lat: 21.1938, lng: 81.3509 },
  { name: "Durg", state: "Chhattisgarh", lat: 21.1904, lng: 81.2849 },
  { name: "Raipur", state: "Chhattisgarh", lat: 21.2514, lng: 81.6296 },
  { name: "Bilaspur", state: "Chhattisgarh", lat: 22.0797, lng: 82.1409 },
  { name: "Sakti", state: "Chhattisgarh", lat: 21.959, lng: 82.961 },
  { name: "Raigarh", state: "Chhattisgarh", lat: 21.8974, lng: 83.395 },
  { name: "Korba", state: "Chhattisgarh", lat: 22.3595, lng: 82.7501 },
  { name: "Rajnandgaon", state: "Chhattisgarh", lat: 21.0972, lng: 81.0282 },
  { name: "Janjgir", state: "Chhattisgarh", lat: 22.011, lng: 82.5789 },
  { name: "Champa", state: "Chhattisgarh", lat: 22.0355, lng: 82.6524 },
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
];

const CITY_ALIASES: Record<string, string> = {
  "bhilai nagar": "bhilai",
  "bhilai-durg": "bhilai",
  "bangalore": "bengaluru",
};

export function normalizeCityName(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(municipal corporation|district|tahsil|tehsil|city)\b/g, "")
    .trim();
  if (!s) return "";
  return CITY_ALIASES[s] ?? s;
}

export function formatCanonicalCityName(raw?: string | null): string {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  const norm = normalizeCityName(trimmed);
  const known = KNOWN_CITIES.find((c) => c.name.toLowerCase() === norm);
  if (known) return known.name;
  return trimmed
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function citiesMatch(cityA?: string | null, cityB?: string | null): boolean {
  const normA = normalizeCityName(cityA);
  const normB = normalizeCityName(cityB);
  if (!normA || !normB) return true;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

export function getKnownCityCenter(city?: string | null): KnownCityInfo | null {
  const norm = normalizeCityName(city);
  if (!norm) return null;
  return KNOWN_CITIES.find((c) => c.name.toLowerCase() === norm) ?? null;
}

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  exact_location: string;
  lat: number;
  lng: number;
  map_url: string;
}

export async function reverseGeocodeCoords(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  let streetName = "";
  let areaName = "";
  let cityName = "";
  let stateName = "";
  let pincode = "";
  let displayName = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const osmRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "VegaMart/1.0 (contact@vegamart.in)",
          "Accept-Language": "en",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (osmRes.ok) {
      const data: any = await osmRes.json();
      const addr = data.address || {};
      streetName = addr.road || addr.street || addr.residential || addr.neighbourhood || "";
      areaName = addr.suburb || addr.neighbourhood || addr.village || addr.subdistrict || "";
      cityName = addr.city || addr.town || addr.village || addr.state_district || addr.county || "";
      stateName = addr.state || "";
      pincode = addr.postcode || "";
      displayName = data.display_name || "";
    }
  } catch {
    // Fallback to nearest known city below
  }

  if (cityName) {
    cityName = formatCanonicalCityName(cityName);
  }

  if (!cityName) {
    let closest = KNOWN_CITIES[0]!;
    let minD = Infinity;
    for (const c of KNOWN_CITIES) {
      const d = Math.hypot(lat - c.lat, lng - c.lng);
      if (d < minD) {
        minD = d;
        closest = c;
      }
    }
    cityName = closest.name;
    if (!stateName) stateName = closest.state;
  }

  return {
    line1: streetName,
    line2: areaName,
    city: cityName,
    state: stateName,
    pincode,
    exact_location:
      displayName || [streetName, areaName, cityName, stateName, pincode].filter(Boolean).join(", "),
    lat,
    lng,
    map_url: `https://www.google.com/maps?q=${lat},${lng}`,
  };
}
