import { AnimatePresence, motion } from "framer-motion";
import { WifiOff, RotateCw, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function NetworkIndicator() {
  const online = useNetworkStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setShowBackOnline(false);
    } else if (wasOffline) {
      setShowBackOnline(true);
      const t = setTimeout(() => setShowBackOnline(false), 2200);
      return () => clearTimeout(t);
    }
  }, [online, wasOffline]);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="fixed inset-x-0 top-0 z-[80] pt-safe"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-b-2xl border border-t-0 border-destructive bg-destructive/10 px-4 py-3 text-destructive shadow-soft mt-safe">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive/10">
              <WifiOff className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">You're offline</div>
              <div className="text-xs text-destructive/80">
                Check your connection to keep shopping.
              </div>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card/70 hover:bg-card active:scale-95 transition tap-highlight-none"
              aria-label="Retry"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
      {online && showBackOnline && (
        <motion.div
          key="online"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="fixed inset-x-0 top-0 z-[80] pt-safe"
        >
          <div className="mx-auto flex max-w-xs items-center gap-2 rounded-b-2xl bg-brand px-4 py-2 text-primary-foreground shadow-glow mt-safe">
            <Wifi className="h-4 w-4" />
            <span className="text-xs font-semibold">Back online</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
