import { memo, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, MapPin, Mic, SlidersHorizontal, X, TrendingUp, History } from "lucide-react";
import type { DiscoveryVendor } from "@/lib/discovery";
import { DISCOVERY_CATEGORIES } from "@/lib/discovery";

interface DiscoverySearchProps {
  areaLabel: string;
  vendors: DiscoveryVendor[];
  vendorsCount: number;
  query: string;
  onQueryChange: (q: string) => void;
  onSelectVendor: (id: string) => void;
  onOpenFilters: () => void;
  filtersActive: boolean;
  recentSearches: string[];
  onRunRecentSearch: (q: string) => void;
}

export const DiscoverySearch = memo(function DiscoverySearch({
  areaLabel,
  vendors,
  vendorsCount,
  query,
  onQueryChange,
  onSelectVendor,
  onOpenFilters,
  filtersActive,
  recentSearches,
  onRunRecentSearch,
}: DiscoverySearchProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return vendors
      .filter((v) => {
        const name = v.business_name.toLowerCase();
        const cat = (v.category ?? "").toLowerCase();
        const area = (v.area ?? "").toLowerCase();
        const landmark = (v.landmark ?? "").toLowerCase();
        const address = (v.address ?? "").toLowerCase();
        return (
          name.includes(q) ||
          cat.includes(q) ||
          area.includes(q) ||
          landmark.includes(q) ||
          address.includes(q)
        );
      })
      .slice(0, 6);
  }, [vendors, query]);

  return (
    <div className="relative z-40">
      {/* floating bar */}
      <div className="glass flex items-center gap-2 rounded-full p-1.5 pl-4 shadow-xl">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold">
              {query ? `“${query}”` : "Search vendors, areas…"}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
              <MapPin className="h-2.5 w-2.5" />
              <span className="truncate">{areaLabel}</span>
              <span className="text-muted-foreground">· {vendorsCount} nearby</span>
            </span>
          </span>
        </button>

        <button
          type="button"
          aria-label="Voice search"
          onClick={() => {
            const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
            if (supported) {
              inputRef.current?.focus();
            }
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-foreground hover:bg-muted/70"
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Open filters"
          onClick={onOpenFilters}
          className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filtersActive && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </button>
      </div>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass absolute inset-x-0 top-14 mt-1 max-h-[60vh] overflow-y-auto rounded-3xl p-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  setOpen(true);
                }}
                placeholder="Search vendors, products, areas, landmarks…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => onQueryChange("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* results */}
            {matches.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" /> Matching vendors
                </div>
                <div className="mt-2 space-y-1.5">
                  {matches.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        onSelectVendor(v.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/60 px-3 py-2 text-left ring-1 ring-black/5 transition hover:bg-white"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full overflow-hidden bg-muted p-1 border border-border">
                        <img src="/icons/icon-512.png" alt="Vegamart logo" className="h-full w-full object-contain" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold">
                          {v.business_name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {[v.category, v.area].filter(Boolean).join(" · ") || "Local vendor"}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          v.is_open
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {v.is_open ? "OPEN" : "CLOSED"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* categories */}
            <div className="mt-3">
              <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Browse categories
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DISCOVERY_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onQueryChange(cat.label);
                      setOpen(true);
                    }}
                    className="rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold ring-1 ring-black/5"
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* recent searches */}
            {recentSearches.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  <History className="h-3.5 w-3.5" /> Recent searches
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recentSearches.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        onRunRecentSearch(s);
                        setOpen(false);
                      }}
                      className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-bold text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {query && matches.length === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                No vendors match “{query}”. Try a nearby area or landmark.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
