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
      title={isSatellite ? "Switch to Roads / Street Map" : "Switch to Free Satellite Map"}
    >
      <div className="relative flex h-14 w-14 flex-col items-center justify-between p-1">
        {/* Preview thumbnail representing the target layer to switch into */}
        <div
          className={`relative h-8 w-12 rounded-md overflow-hidden border shadow-inner transition-all ${
            isSatellite
              ? "bg-[#e5e3df] border-slate-300" // Roads preview thumbnail
              : "bg-[#1e293b] border-slate-700" // Satellite preview thumbnail
          }`}
        >
          {isSatellite ? (
            /* Mini roads illustration */
            <div className="absolute inset-0 flex items-center justify-center opacity-85">
              <div className="absolute h-1 w-full bg-[#fcd34d] rotate-12" />
              <div className="absolute w-1 h-full bg-white -rotate-12" />
              <div className="absolute bottom-0.5 right-1 text-[8px]">🛣️</div>
            </div>
          ) : (
            /* Mini satellite illustration */
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950">
              <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] opacity-30 [background-size:4px_4px]" />
              <div className="text-[10px]">🛰️</div>
            </div>
          )}

          {/* Quick Layers badge icon in top corner */}
          <div className="absolute top-0.5 left-0.5 rounded-full bg-black/60 p-0.5 text-white backdrop-blur-xs">
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
