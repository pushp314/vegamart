import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Minus, Plus, LocateFixed } from "lucide-react";
import type { DiscoveryVendor } from "@/lib/discovery";
import { VendorMarker } from "@/components/marketplace/vendor-marker";

/* ------------------------------------------------------------------ */
/* Seeded PRNG so the illustrated city is stable while panning/zooming */
/* ------------------------------------------------------------------ */

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randFor(key: string): number {
  return mulberry32(hashStr(key))();
}

/* ------------------------------------------------------------------ */
/* View state                                                          */
/* ------------------------------------------------------------------ */

interface MapView {
  cx: number; // world x (lng) at viewport center
  cy: number; // world y (-lat) at viewport center
  scale: number; // screen px per degree
}

const MIN_SCALE = 6000;
const MAX_SCALE = 220000;
const DEFAULT_SCALE = 22000;
const CELL = 0.006; // ~660m world units per city block

interface Point {
  x: number;
  y: number;
}

interface IllustratedCityMapProps {
  center: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number } | null;
  accuracyMeters?: number;
  vendors: DiscoveryVendor[];
  selectedVendorId?: string | null;
  onSelectVendor?: (id: string) => void;
  onOpenVendorSheet?: (id: string) => void;
  onLocate?: () => void;
  recenterKey?: number;
  className?: string;
}

const NEIGHBORHOODS = [
  "Indiranagar",
  "Koramangala",
  "MG Road",
  "Jayanagar",
  "Whitefield",
  "HSR Layout",
  "BTM Layout",
  "Frazer Town",
  "Jayanagar 4th Block",
  "Shivajinagar",
  "Kasturinagar",
  "Domlur",
  "Ulsoor",
  "Langford Town",
  "Richmond Town",
  "Vasanth Nagar",
];

const LANDMARK_NAMES = [
  "Metro Gate",
  "Market",
  "Temple",
  "Park",
  "School",
  "Bus Stop",
  "Hospital",
  "Water Tank",
];

/* ------------------------------------------------------------------ */
/* Background                                                        */
/* ------------------------------------------------------------------ */

interface BgLabel {
  x: number;
  y: number;
  text: string;
  kind: "area" | "landmark";
  color: string;
}

function buildBackground(view: MapView, w: number, h: number, dpr: number) {
  const minX = view.cx - w / 2 / view.scale;
  const maxX = view.cx + w / 2 / view.scale;
  const minY = view.cy - h / 2 / view.scale;
  const maxY = view.cy + h / 2 / view.scale;

  const iMin = Math.floor(minX / CELL);
  const iMax = Math.floor(maxX / CELL);
  const jMin = Math.floor(minY / CELL);
  const jMax = Math.floor(maxY / CELL);

  const minorRoadPx = 7 / view.scale;
  const majorRoadPx = 16 / view.scale;

  const rects: React.ReactNode[] = [];
  const labels: BgLabel[] = [];
  const trees: React.ReactNode[] = [];

  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      const key = `${i}:${j}`;
      const r = randFor(key);
      const x = i * CELL;
      const y = j * CELL;

      let fill = "#d8dbe0";
      if (r < 0.07) fill = "#9ad7dd"; // water tank/lake
      else if (r < 0.115) fill = "#a8d8a0"; // park
      else {
        const shade = randFor(`s:${key}`);
        fill = shade < 0.5 ? "#e3e5ea" : "#d9dce2";
      }

      const inset = minorRoadPx;
      rects.push(
        <rect
          key={key}
          x={x + inset / 2}
          y={y + inset / 2}
          width={CELL - inset}
          height={CELL - inset}
          rx={dpr * 1.2}
          fill={fill}
          stroke="none"
        />,
      );

      // parks get trees
      if (r >= 0.07 && r < 0.115) {
        const n = 3 + Math.floor(randFor(`t:${key}`) * 3);
        for (let t = 0; t < n; t++) {
          const tx = x + randFor(`tx:${key}:${t}`) * CELL;
          const ty = y + randFor(`ty:${key}:${t}`) * CELL;
          trees.push(
            <circle key={`${key}:t${t}`} cx={tx} cy={ty} r={dpr * 0.7} fill="#7cbd78" />,
          );
        }
      }

      // landmarks
      if (r > 0.955 && r < 0.975) {
        const name = LANDMARK_NAMES[Math.floor(randFor(`l:${key}`) * LANDMARK_NAMES.length)];
        const lx = x + CELL / 2;
        const ly = y + CELL / 2;
        const rad = 22 / view.scale;
        labels.push({ x: lx, y: ly, text: name, kind: "landmark", color: "#94a3b8" });
        rects.push(
          <g key={`${key}:lm`}>
            <circle cx={lx} cy={ly} r={rad} fill="#f59e0b" opacity={0.9} />
            <circle cx={lx} cy={ly} r={rad * 0.45} fill="#fff7ed" />
          </g>,
        );
      }
    }
  }

  // road grid lines
  const roadLines: React.ReactNode[] = [];
  const startI = iMin;
  const endI = iMax;
  const startJ = jMin;
  const endJ = jMax;

  const vLines: React.ReactNode[] = [];
  for (let i = startI; i <= endI; i++) {
    const isMajor = i % 5 === 0;
    vLines.push(
      <line
        key={`v${i}`}
        x1={i * CELL}
        y1={minY - 0.1}
        x2={i * CELL}
        y2={maxY + 0.1}
        stroke={isMajor ? "#e7c269" : "#f1f2f5"}
        strokeWidth={isMajor ? majorRoadPx : minorRoadPx}
      />,
    );
  }
  const hLines: React.ReactNode[] = [];
  for (let j = startJ; j <= endJ; j++) {
    const isMajor = j % 5 === 0;
    hLines.push(
      <line
        key={`h${j}`}
        x1={minX - 0.1}
        y1={j * CELL}
        x2={maxX + 0.1}
        y2={j * CELL}
        stroke={isMajor ? "#e7c269" : "#f1f2f5"}
        strokeWidth={isMajor ? majorRoadPx : minorRoadPx}
      />,
    );
  }

  // neighborhood labels on a coarse grid
  let labelIdx = 0;
  const areaStep = Math.max(1, Math.round(3.2 / Math.max(1, view.scale / DEFAULT_SCALE)));
  for (let i = iMin; i <= iMax; i += areaStep) {
    for (let j = jMin; j <= jMax; j += areaStep) {
      const name = NEIGHBORHOODS[labelIdx % NEIGHBORHOODS.length];
      labelIdx++;
      labels.push({
        x: (i + 0.5) * CELL,
        y: (j + 0.5) * CELL,
        text: name,
        kind: "area",
        color: "#b0b6c1",
      });
    }
  }

  return { rects, roadLines: [...vLines, ...hLines], trees, labels };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export const IllustratedCityMap = memo(function IllustratedCityMap({
  center,
  userLocation,
  accuracyMeters,
  vendors,
  selectedVendorId,
  onSelectVendor,
  onOpenVendorSheet,
  onLocate,
  recenterKey = 0,
  className,
}: IllustratedCityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 640, h: 640 });
  const [view, setView] = useState<MapView>({
    cx: center.lng,
    cy: -center.lat,
    scale: DEFAULT_SCALE,
  });
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;

  // measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ w: rect.width, h: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // initial / recenter
  useEffect(() => {
    setView((v) => ({
      cx: center.lng,
      cy: -center.lat,
      scale: v.scale,
    }));
  }, [recenterKey, center.lat, center.lng]);

  const toScreen = useCallback(
    (lng: number, lat: number): Point => ({
      x: (lng - view.cx) * view.scale + size.w / 2,
      y: (-lat - view.cy) * view.scale + size.h / 2,
    }),
    [view, size],
  );

  /* -------- gestures -------- */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({
    startX: 0,
    startY: 0,
    moved: false,
    startView: view,
    pinchDist: 0,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dist =
        pointers.current.size === 2
          ? Math.hypot(
              [...pointers.current.values()][0].x - [...pointers.current.values()][1].x,
              [...pointers.current.values()][0].y - [...pointers.current.values()][1].y,
            )
          : 0;
      gesture.current = {
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        startView: view,
        pinchDist: dist,
      };
    },
    [view],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 1) {
        const dx = e.clientX - gesture.current.startX;
        const dy = e.clientY - gesture.current.startY;
        if (Math.abs(dx) + Math.abs(dy) > 3) gesture.current.moved = true;
        setView((v) => ({
          ...v,
          cx: gesture.current.startView.cx - dx / v.scale,
          cy: gesture.current.startView.cy - dy / v.scale,
        }));
      } else if (pointers.current.size === 2) {
        const pts = [...pointers.current.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const prev = gesture.current.pinchDist;
        if (prev > 0 && dist > 0) {
          const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
          setView((v) => {
            const newScale = Math.min(
              MAX_SCALE,
              Math.max(MIN_SCALE, v.scale * (dist / prev)),
            );
            const ratio = newScale / v.scale;
            const dx = (mid.x - size.w / 2) / v.scale;
            const dy = (mid.y - size.h / 2) / v.scale;
            return {
              scale: newScale,
              cx: v.cx + dx * (1 - ratio),
              cy: v.cy + dy * (1 - ratio),
            };
          });
          gesture.current.pinchDist = dist;
        }
      }
    },
    [size, view],
  );

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setView((v) => {
      const factor = Math.pow(1.0016, -e.deltaY);
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
      const ratio = newScale / v.scale;
      const rect = containerRef.current?.getBoundingClientRect();
      const mx = e.clientX - (rect?.left ?? 0);
      const my = e.clientY - (rect?.top ?? 0);
      const dx = (mx - size.w / 2) / v.scale;
      const dy = (my - size.h / 2) / v.scale;
      return {
        scale: newScale,
        cx: v.cx + dx * (1 - ratio),
        cy: v.cy + dy * (1 - ratio),
      };
    });
  }, [size]);

  const zoomBy = useCallback(
    (factor: number) => {
      setView((v) => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor));
        return { ...v, scale: newScale };
      });
    },
    [],
  );

  /* -------- derived render data -------- */
  const viewKey = `${view.cx.toFixed(5)}:${view.cy.toFixed(5)}:${view.scale.toFixed(1)}`;
  const bg = useMemo(
    () => buildBackground(view, size.w, size.h, dpr),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewKey, size.w, size.h],
  );

  const visibleVendors = useMemo(
    () =>
      vendors.filter(
        (v) =>
          v.latitude != null &&
          v.longitude != null &&
          Math.abs(v.longitude - view.cx) < size.w / view.scale + 0.02 &&
          Math.abs(-v.latitude - view.cy) < size.h / view.scale + 0.02,
      ),
    [vendors, view, size],
  );

  const positioned = useMemo(
    () =>
      visibleVendors.map((v) => {
        const p = toScreen(v.longitude!, v.latitude!);
        return { v, p };
      }),
    [visibleVendors, toScreen],
  );

  // simple grid clustering in screen space
  const CLUSTER = 42;
  const markers = useMemo(() => {
    const clusters: { v: DiscoveryVendor; p: Point }[][] = [];
    const seen = new Set<DiscoveryVendor>();
    for (const a of positioned) {
      if (seen.has(a.v)) continue;
      const group = positioned.filter((b) => {
        if (seen.has(b.v)) return false;
        const dist = Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y);
        return dist < CLUSTER;
      });
      group.forEach((g) => seen.add(g.v));
      clusters.push(group);
    }
    return clusters;
  }, [positioned]);

  const userPos = userLocation ? toScreen(userLocation.lng, userLocation.lat) : null;
  const accuracyPx = accuracyMeters ? (accuracyMeters / 111000) * view.scale : 0;

  return (
    <div
      ref={containerRef}
      className={`relative touch-none select-none overflow-hidden bg-[#eef0f4] ${className ?? ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onWheel={onWheel}
      role="application"
      aria-label="Interactive vendor map"
    >
      {/* decorative SVG city */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${size.w} ${size.h}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <rect width={size.w} height={size.h} fill="#eef0f4" />
        <g
          transform={`translate(${size.w / 2} ${size.h / 2}) scale(${view.scale}) translate(${-view.cx} ${-view.cy})`}
        >
          {bg.rects}
          {bg.roadLines}
          {bg.trees}
        </g>
      </svg>

      {/* neighborhood / landmark labels (crisp screen space) */}
      {bg.labels.map((l, idx) => {
        const p = toScreen(l.x, -l.y);
        if (p.x < -80 || p.x > size.w + 80 || p.y < -30 || p.y > size.h + 30) return null;
        return (
          <span
            key={`${l.kind}:${idx}`}
            className={`pointer-events-none absolute z-0 ${
              l.kind === "area"
                ? "px-2 text-[11px] font-bold uppercase tracking-[0.14em]"
                : "px-1.5 text-[10px] font-semibold"
            }`}
            style={{
              left: p.x,
              top: p.y,
              transform: "translate(-50%, -50%)",
              color: l.color,
            }}
          >
            {l.text}
          </span>
        );
      })}

      {/* user location */}
      {userPos && (
        <div
          className="pointer-events-none absolute z-10"
          style={{ left: userPos.x, top: userPos.y, transform: "translate(-50%, -50%)" }}
        >
          {accuracyPx > 8 && (
            <span
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400/40 bg-sky-400/10"
              style={{ width: accuracyPx * 2, height: accuracyPx * 2 }}
            />
          )}
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 animate-ping-slow rounded-full bg-sky-400/30" />
          <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-sky-500 shadow-[0_0_0_2px_rgba(56,189,248,0.5)]" />
        </div>
      )}

      {/* vendor markers / clusters */}
      {markers.map((group) => {
        if (group.length === 1) {
          const { v, p } = group[0];
          return (
            <VendorMarker
              key={v.id}
              x={p.x}
              y={p.y}
              vendor={v}
              selected={selectedVendorId === v.id}
              onSelect={(id) => onSelectVendor?.(id)}
              onOpenSheet={(id) => onOpenVendorSheet?.(id)}
            />
          );
        }
        const cx = group.reduce((s, g) => s + g.p.x, 0) / group.length;
        const cy = group.reduce((s, g) => s + g.p.y, 0) / group.length;
        return (
          <button
            key={`cluster-${cx.toFixed(0)}-${cy.toFixed(0)}`}
            type="button"
            onClick={() => zoomBy(1.8)}
            className="absolute z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-foreground/85 text-xs font-black text-background shadow-lg backdrop-blur-sm"
            style={{ left: cx, top: cy }}
          >
            {group.length}
          </button>
        );
      })}

      {/* controls */}
      <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(1.6);
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-foreground shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={(e) => {
            e.stopPropagation();
            zoomBy(1 / 1.6);
          }}
          className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-foreground shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
        >
          <Minus className="h-4 w-4" />
        </button>
        {onLocate && (
          <button
            type="button"
            aria-label="Center on my location"
            onClick={(e) => {
              e.stopPropagation();
              onLocate();
            }}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-sky-600 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:bg-white"
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});
