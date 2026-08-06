import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import { ChevronUp, GripVertical, X, SlidersHorizontal } from "lucide-react";

export type SheetSnap = "collapsed" | "half" | "full";

interface DiscoveryBottomSheetProps {
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  title: string;
  subtitle?: string;
  count?: number;
  onOpenFilters?: () => void;
  onClose?: () => void;
  collapsedPreview?: ReactNode;
  children: ReactNode;
}

const HEADER_H = 58;
const COLLAPSED_H = 116;

function nextSnap(s: SheetSnap, dir: 1 | -1): SheetSnap {
  const order: SheetSnap[] = ["collapsed", "half", "full"];
  const i = order.indexOf(s);
  const n = Math.min(order.length - 1, Math.max(0, i + dir));
  return order[n];
}

export const DiscoveryBottomSheet = memo(function DiscoveryBottomSheet({
  snap,
  onSnapChange,
  title,
  subtitle,
  count,
  onOpenFilters,
  onClose,
  collapsedPreview,
  children,
}: DiscoveryBottomSheetProps) {
  const [viewportH, setViewportH] = useState(700);
  const dragControls = useDragControls();

  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const maxH = useMemo(() => Math.round(viewportH * 0.92), [viewportH]);
  const halfH = useMemo(() => Math.min(Math.round(viewportH * 0.56), 560), [viewportH]);
  const collapsedH = useMemo(() => Math.min(COLLAPSED_H, maxH), [maxH]);

  const yFor = useCallback(
    (s: SheetSnap) => {
      if (s === "full") return 0;
      if (s === "half") return maxH - halfH;
      return maxH - collapsedH;
    },
    [maxH, halfH, collapsedH],
  );

  const y = yFor(snap);

  const handleDragEnd = useCallback(
    (_e: unknown, info: PanInfo) => {
      const currentY = yFor(snap);
      const projected = info.offset.y + currentY;
      const targets = [0, maxH - halfH, maxH - collapsedH];
      const mids = targets.map((t, i) =>
        i < targets.length - 1 ? (t + targets[i + 1]) / 2 : Infinity,
      );

      let next: SheetSnap = snap;
      if (info.velocity.y < -400) next = nextSnap(snap, 1);
      else if (info.velocity.y > 400) next = nextSnap(snap, -1);
      else if (projected <= mids[0]) next = "full";
      else if (projected <= mids[1]) next = "half";
      else next = "collapsed";

      onSnapChange(next);
    },
    [snap, yFor, maxH, halfH, collapsedH, onSnapChange],
  );

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-[55] mx-auto hidden max-w-xl px-0 lg:hidden"
      style={{ height: maxH }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: maxH - collapsedH }}
      dragElastic={{ top: 0, bottom: 0.12 }}
      dragMomentum={false}
      animate={{ y }}
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
      onDragEnd={handleDragEnd}
    >
      <div className="absolute inset-0 flex flex-col overflow-hidden rounded-t-[30px] border border-b-0 border-border/60 bg-card/85 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
        {/* drag handle */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          className="flex cursor-grab touch-none flex-col items-center py-2.5 active:cursor-grabbing"
        >
          <span className="flex h-6 w-12 items-center justify-center rounded-full bg-muted">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </span>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-5" style={{ height: HEADER_H }}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate font-display text-[17px] font-black">{title}</h2>
              {typeof count === "number" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                  {count}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="truncate text-[11px] font-medium text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onOpenFilters && (
              <button
                type="button"
                onClick={onOpenFilters}
                aria-label="Open filters"
                className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground hover:bg-muted/70"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground hover:bg-muted/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* collapsed preview */}
        {snap === "collapsed" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-5 pb-3"
          >
            {collapsedPreview ?? (
              <button
                type="button"
                onClick={() => onSnapChange("half")}
                className="flex w-full items-center justify-between rounded-2xl bg-muted/70 px-4 py-2.5 text-xs font-bold text-foreground"
              >
                <span>Swipe up to see nearby vendors</span>
                <ChevronUp className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* scrollable content */}
        <div className="min-h-0 flex-1 overflow-y-auto pb-6 no-scrollbar">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </motion.div>
  );
});
