export type MapLayerType = "streets" | "satellite" | "osm";

export interface MapLayerConfig {
  id: MapLayerType;
  label: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

export const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  // Free 1:1 Google Maps crisp road networks, colony names, and landmarks
  streets: {
    id: "streets",
    label: "Roads",
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    subdomains: ["0", "1", "2", "3"],
  },
  // Free 1:1 Google Maps Satellite Hybrid (satellite photography + street names and road overlays)
  satellite: {
    id: "satellite",
    label: "Satellite",
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    subdomains: ["0", "1", "2", "3"],
  },
  // OpenStreetMap CDN fallback
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};
