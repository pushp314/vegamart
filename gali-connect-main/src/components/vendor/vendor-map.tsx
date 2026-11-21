import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export default function VendorMap({ lat, lng, businessName, address }: { lat: number; lng: number; businessName: string; address: string }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={
          import.meta.env.VITE_MAP_TILE_URL &&
          (!import.meta.env.VITE_MAP_TILE_URL.includes("cartocdn.com") ||
            import.meta.env.VITE_MAP_TILE_URL.includes("api_key="))
            ? import.meta.env.VITE_MAP_TILE_URL
            : "https://tile.openstreetmap.de/{z}/{x}/{y}.png"
        }
        maxZoom={19}
      />
      <Marker position={[lat, lng]}>
        <Popup>
          <div className="text-xs font-semibold">{businessName}</div>
          <div className="text-[11px] text-muted-foreground">{address}</div>
        </Popup>
      </Marker>
    </MapContainer>
  );
}
