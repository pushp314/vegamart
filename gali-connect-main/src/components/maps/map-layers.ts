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
  // Clean Google Maps-style crisp road networks & street names
  streets: {
    id: "streets",
    label: "Roads",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Street Map',
    maxZoom: 19,
  },
  // 100% Free High-Resolution Global Satellite Imagery
  satellite: {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; Esri &mdash; Satellite Imagery',
    maxZoom: 19,
  },
  // Standard OpenStreetMap Foundation German CDN fallback
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
};
