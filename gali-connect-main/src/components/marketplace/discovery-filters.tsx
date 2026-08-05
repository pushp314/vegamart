import { memo } from "react";
import { motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import type { DiscoveryFilters } from "@/lib/discovery";
import { DISCOVERY_CATEGORIES, DEFAULT_FILTERS } from "@/lib/discovery";

interface DiscoveryFiltersProps {
  filters: DiscoveryFilters;
  onChange: (f: DiscoveryFilters) => void;
  onClose: () => void;
}

const RATING_OPTIONS = [
  { label: "Any rating", value: 0 },
  { label: "4.0+", value: 4 },
  { label: "3.5+", value: 3.5 },
  { label: "3.0+", value: 3 },
];

export const DiscoveryFiltersPanel = memo(function DiscoveryFiltersPanel({
  filters,
  onChange,
  onClose,
}: DiscoveryFiltersProps) {
  const set = (patch: Partial<DiscoveryFilters>) => onChange({ ...filters, ...patch });

  const toggleCategory = (id: string) => {
    const cats = filters.categories.includes(id)
      ? filters.categories.filter((c) => c !== id)
      : [...filters.categories, id];
    set({ categories: cats });
  };

  const toggleKind = (kind: "roaming" | "shop") => {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter((k) => k !== kind)
      : [...filters.kinds, kind];
    set({ kinds });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="glass absolute inset-x-0 top-16 z-40 mx-3 rounded-3xl p-5 shadow-2xl"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close filters"
          className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 space-y-5 overflow-y-auto max-h-[60vh] pr-1">
        {/* distance */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Search radius</span>
            <span className="text-primary">{filters.radiusKm} km</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={filters.radiusKm}
            onChange={(e) => set({ radiusKm: Number(e.target.value) })}
            className="mt-2 w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>1 km</span>
            <span>20 km</span>
          </div>
        </div>

        {/* rating */}
        <div>
          <div className="text-xs font-bold">Minimum rating</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RATING_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set({ minRating: opt.value })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  filters.minRating === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* categories */}
        <div>
          <div className="text-xs font-bold">Categories</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DISCOVERY_CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
              const active = filters.categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition-colors ${
                    active
                      ? "text-white ring-transparent"
                      : "bg-white/70 text-muted-foreground ring-black/10 hover:bg-white"
                  }`}
                  style={active ? { background: cat.color } : undefined}
                >
                  {cat.emoji} {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* kind */}
        <div>
          <div className="text-xs font-bold">Vendor type</div>
          <div className="mt-2 flex gap-1.5">
            {(
              [
                { id: "roaming", label: "Street vendor" },
                { id: "shop", label: "Shop" },
              ] as const
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleKind(k.id)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  filters.kinds.includes(k.id)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* toggles */}
        <div className="space-y-2">
          {[
            { key: "openNow" as const, label: "Open now only" },
            { key: "verifiedOnly" as const, label: "Verified vendors only" },
            { key: "hasOffers" as const, label: "Has offers / deals" },
          ].map((t) => (
            <label
              key={t.key}
              className="flex cursor-pointer items-center justify-between rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5"
            >
              <span className="text-xs font-bold">{t.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={filters[t.key]}
                onClick={() => set({ [t.key]: !filters[t.key] } as Partial<DiscoveryFilters>)}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  filters[t.key] ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    filters[t.key] ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="flex-1 rounded-2xl border py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted/60"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-[2] rounded-2xl bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow-sm"
          >
            Show results
          </button>
        </div>
      </div>
    </motion.div>
  );
});
