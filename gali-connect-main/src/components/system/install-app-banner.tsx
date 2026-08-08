import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { useRouterState } from "@tanstack/react-router";

export function InstallAppBanner() {
  const { canInstall, isIOS, isStandalone, install, isDismissed, dismiss } = usePwaInstall();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [visible, setVisible] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pathname !== "/") {
      setVisible(false);
      return;
    }
    if (isStandalone || isDismissed) {
      setVisible(false);
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];
    if (isIOS) {
      timers.push(setTimeout(() => setVisible(true), 1200));
    }
    if (canInstall) {
      timers.push(setTimeout(() => setVisible(true), 800));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [canInstall, isIOS, isStandalone, isDismissed, pathname]);

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  const onInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") {
      setVisible(false);
    } else {
      setShowSteps(true);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm bg-card border rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:bg-muted rounded-full tap-highlight-none"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4 pt-4">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow">
                <Download className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold font-display">Install Vegamart</h3>
                <p className="mt-2 text-sm italic text-muted-foreground px-4">
                  Your neighbourhood, delivered.
                </p>
              </div>

              <button
                onClick={onInstall}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-[15px] font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition tap-highlight-none mt-2"
              >
                <Download className="h-4 w-4" /> Install App Now
              </button>

              {showSteps && (
                <ol className="space-y-2 text-left text-[13px] text-muted-foreground w-full">
                  <li className="flex gap-2 rounded-xl bg-muted px-3 py-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                      1
                    </span>
                    Tap the <span className="font-semibold">Share</span> button in Safari.
                  </li>
                  <li className="flex gap-2 rounded-xl bg-muted px-3 py-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                      2
                    </span>
                    Select <span className="font-semibold">Add to Home Screen</span>.
                  </li>
                  <li className="flex gap-2 rounded-xl bg-muted px-3 py-2.5">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
                      3
                    </span>
                    Open Vegamart from your Home screen.
                  </li>
                </ol>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
