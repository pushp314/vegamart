import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

export default function VendorMap({
  lat,
  lng,
  businessName,
  address,
}: {
  lat: number;
  lng: number;
  businessName: string;
  address: string;
}) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          key={currentLayer}
          attribution={MAP_LAYERS[currentLayer].attribution}
          url={MAP_LAYERS[currentLayer].url}
          subdomains={MAP_LAYERS[currentLayer].subdomains}
          maxZoom={19}
        />
        <Marker position={[lat, lng]}>
          <Popup>
            <div className="text-xs font-semibold">{businessName}</div>
            <div className="text-[11px] text-muted-foreground">{address}</div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Google Maps-style Free Satellite / Road Map Toggle */}
      <MapLayerToggle
        currentLayer={currentLayer}
        onToggle={setCurrentLayer}
        className="bottom-3 left-3 shadow-md"
      />
    </div>
  );
}
