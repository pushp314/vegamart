import { useState, useMemo, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed, MapPin } from "lucide-react";
import { MapLayerToggle } from "@/components/maps/MapLayerToggle";
import { MAP_LAYERS, type MapLayerType } from "@/components/maps/map-layers";

interface AddressPinMapProps {
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (lat: number, lng: number) => void;
}

// Draggable Pin with Map Click listener
function DraggablePin({
  position,
  onChange,
}: {
  position: [number, number];
  onChange: (pos: [number, number]) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  // Allow clicking anywhere on the map to place/move the pin
  useMapEvents({
    click(e) {
      onChange([e.latlng.lat, e.latlng.lng]);
    },
  });

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const latLng = marker.getLatLng();
          onChange([latLng.lat, latLng.lng]);
        }
      },
    }),
    [onChange]
  );

  const pinIcon = useMemo(() => {
    return L.divIcon({
      className: "custom-draggable-pin",
      html: `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: grab;">
          <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #ef4444, #b91c1c); border-radius: 9999px; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.6); border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            📍
          </div>
          <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid #b91c1c; margin-top: -1px;"></div>
        </div>
      `,
      iconSize: [40, 47],
      iconAnchor: [20, 47],
    });
  }, []);

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={pinIcon}
    >
      <Popup minWidth={140}>
        <div className="text-xs p-1 text-center font-bold text-foreground">
          📍 Drag me or tap anywhere on the map to set your doorstep!
        </div>
      </Popup>
    </Marker>
  );
}

// Controller to smoothly pan when coordinates change
function PanController({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true });
  }, [map, position]);
  return null;
}

export function AddressPinMap({ latitude, longitude, onLocationChange }: AddressPinMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>("streets");

  // Default to Sakti, Chhattisgarh center if no coordinates yet
  const validLat = latitude && latitude > 5 ? latitude : 21.9588;
  const validLng = longitude && longitude > 60 ? longitude : 82.9588;
  const currentPos: [number, number] = [validLat, validLng];

  const handlePinMove = (newPos: [number, number]) => {
    onLocationChange(
      Math.round(newPos[0] * 1000000) / 1000000,
      Math.round(newPos[1] * 1000000) / 1000000
    );
  };

  return (
    <div className="relative w-full h-[260px] sm:h-[300px] rounded-2xl overflow-hidden border border-border bg-muted shadow-inner">
      <MapContainer
        center={currentPos}
        zoom={16}
        scrollWheelZoom={true}
        className="h-full w-full z-0"
      >
        <TileLayer
          key={currentLayer}
          attribution={MAP_LAYERS[currentLayer].attribution}
          url={MAP_LAYERS[currentLayer].url}
          subdomains={MAP_LAYERS[currentLayer].subdomains}
          maxZoom={19}
        />

        <PanController position={currentPos} />
        <DraggablePin position={currentPos} onChange={handlePinMove} />
      </MapContainer>

      {/* Satellite / Road Layer Toggle */}
      <MapLayerToggle
        currentLayer={currentLayer}
        onToggle={setCurrentLayer}
        className="bottom-2.5 left-2.5 shadow-md scale-90"
      />

      {/* Floating Instructions Badge */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-[400] pointer-events-none flex justify-center">
        <div className="bg-card/95 backdrop-blur-md border border-border/80 px-3 py-1 rounded-full text-[11px] font-bold text-foreground shadow-md flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-rose-600 animate-bounce" />
          <span>Tap anywhere on the map or drag the pin to your exact building / gate</span>
        </div>
      </div>
    </div>
  );
}
