import React from "react";
import { Layers } from "lucide-react";
import { type MapLayerType } from "./map-layers";

interface MapLayerToggleProps {
  currentLayer: MapLayerType;
  onToggle: (nextLayer: MapLayerType) => void;
  className?: string;
}

export function MapLayerToggle({ currentLayer, onToggle, className = "" }: MapLayerToggleProps) {
  const isSatellite = currentLayer === "satellite";

  return (
    <button
      type="button"
      onClick={() => onToggle(isSatellite ? "streets" : "satellite")}
      className={`group absolute z-[400] overflow-hidden rounded-xl border-2 border-white/90 bg-white shadow-md backdrop-blur-xs transition-all hover:scale-105 hover:shadow-lg active:scale-95 dark:border-slate-800 dark:bg-slate-900 ${className}`}
      title={isSatellite ? "Switch to Google Roads / Street Map" : "Switch to Free Google Satellite Map"}
    >
      <div className="relative flex h-14 w-14 flex-col items-center justify-between p-1">
        {/* Preview thumbnail representing the target layer to switch into (Google Maps style) */}
        <div
          className={`relative h-8 w-12 rounded-md overflow-hidden border shadow-inner transition-all bg-cover bg-center ${
            isSatellite
              ? "border-slate-300 bg-[url('https://mt1.google.com/vt/lyrs=m&x=14717&y=9635&z=14')]"
              : "border-slate-700 bg-[url('https://mt1.google.com/vt/lyrs=s&x=14717&y=9635&z=14')]"
          }`}
        >
          {/* Quick Layers badge icon in top corner */}
          <div className="absolute top-0.5 left-0.5 rounded-full bg-black/60 p-0.5 text-white backdrop-blur-xs shadow-xs">
            <Layers className="h-2 w-2" />
          </div>
        </div>

        {/* Text Label matching Google Maps "Layers" */}
        <span className="text-[10px] font-bold tracking-tight text-slate-700 dark:text-slate-200 leading-tight">
          {isSatellite ? "Roads" : "Layers"}
        </span>
      </div>
    </button>
  );
}
