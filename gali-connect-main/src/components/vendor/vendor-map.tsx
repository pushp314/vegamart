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
        attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
        url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
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
