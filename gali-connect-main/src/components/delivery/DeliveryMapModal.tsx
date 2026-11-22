import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";

// Fix leaflet icon paths
import L from "leaflet";
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface DeliveryMapModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  startLocation: { lat: number; lng: number; label: string };
  endLocation: { lat: number; lng: number; label: string };
}

export function DeliveryMapModal({
  open,
  onOpenChange,
  title,
  startLocation,
  endLocation,
}: DeliveryMapModalProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");

  const center = [
    (startLocation.lat + endLocation.lat) / 2,
    (startLocation.lng + endLocation.lng) / 2,
  ] as [number, number];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[95vw] h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b border-border bg-card">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 bg-muted relative">
          <MapContainer center={center} zoom={13} scrollWheelZoom={true} className="h-full w-full">
            <TileLayer
              key={currentLayer}
              attribution={MAP_LAYERS[currentLayer].attribution}
              url={MAP_LAYERS[currentLayer].url}
              subdomains={MAP_LAYERS[currentLayer].subdomains}
              maxZoom={19}
            />

            <Marker position={[startLocation.lat, startLocation.lng]}>
              <Popup>
                <strong>Start:</strong> {startLocation.label}
              </Popup>
            </Marker>

            <Marker position={[endLocation.lat, endLocation.lng]}>
              <Popup>
                <strong>Destination:</strong> {endLocation.label}
              </Popup>
            </Marker>

            {/* Simple straight line for visual direction */}
            <Polyline
              positions={[
                [startLocation.lat, startLocation.lng],
                [endLocation.lat, endLocation.lng],
              ]}
              color="#2563eb"
              dashArray="5, 10"
              weight={4}
            />
          </MapContainer>

          {/* Google Maps-style Free Satellite / Road Map Toggle */}
          <MapLayerToggle
            currentLayer={currentLayer}
            onToggle={setCurrentLayer}
            className="bottom-3 left-3 shadow-md"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
