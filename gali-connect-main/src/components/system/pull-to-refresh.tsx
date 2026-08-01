import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const THRESHOLD = 72;
const MAX = 120;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
}) {
  const y = useMotionValue(0);
  const rotation = useTransform(y, [0, MAX], [0, 360]);
  const opacity = useTransform(y, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.7, 1]);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const canPull = () => window.scrollY <= 0 && !refreshing;

    const onStart = (e: TouchEvent) => {
      if (!canPull()) return;
      start.current = e.touches[0].clientY;
      dragging.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!dragging.current || start.current == null) return;
      const dy = e.touches[0].clientY - start.current;
      if (dy <= 0) {
        y.set(0);
        return;
      }
      // rubber-band
      const eased = Math.min(MAX, dy * 0.55);
      y.set(eased);
    };
    const onEnd = async () => {
      if (!dragging.current) return;
      dragging.current = false;
      const current = y.get();
      start.current = null;
      if (current >= THRESHOLD) {
        setRefreshing(true);
        animate(y, 56, { type: "spring", stiffness: 320, damping: 26 });
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          animate(y, 0, { type: "spring", stiffness: 320, damping: 26 });
        }
      } else {
        animate(y, 0, { type: "spring", stiffness: 320, damping: 26 });
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh, refreshing, y]);

  return (
    <div ref={wrapRef} className="relative">
      <motion.div
        aria-hidden={!refreshing}
        style={{ y, opacity }}
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center"
      >
        <div className="mt-2 grid h-10 w-10 place-items-center rounded-full bg-card shadow-soft border">
          <motion.div
            style={{ rotate: refreshing ? undefined : rotation }}
            animate={refreshing ? { rotate: 360 } : undefined}
            transition={
              refreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : undefined
            }
          >
            <RotateCw className="h-4 w-4 text-brand" />
          </motion.div>
        </div>
      </motion.div>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
}
