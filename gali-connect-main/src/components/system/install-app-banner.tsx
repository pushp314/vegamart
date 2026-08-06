import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

const DISMISS_KEY = "lg_install_dismissed_at";
const DISMISS_DAYS = 7;

export function InstallAppBanner() {
  const { canInstall, isIOS, isStandalone, install } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_DAYS * 86400000) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    if (isIOS) {
      timers.push(
        setTimeout(() => {
          setIosHint(true);
          setVisible(true);
        }, 1200),
      );
    }
    if (canInstall) {
      timers.push(setTimeout(() => setVisible(true), 800));
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [canInstall, isIOS, isStandalone]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const onInstall = async () => {
    const outcome = await install();
    if (outcome === "accepted") setVisible(false);
    else dismiss();
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
              onClick={dismiss}
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
                <p className="mt-2 text-sm text-muted-foreground px-4">
                  {iosHint
                    ? "Tap the Share button and select 'Add to Home Screen'."
                    : "Get faster, offline-ready, one-tap access to Vegamart."}
                </p>
              </div>

              {!iosHint && canInstall && (
                <button
                  onClick={onInstall}
                  className="w-full rounded-xl bg-brand py-3.5 text-[15px] font-bold text-primary-foreground shadow-glow active:scale-[0.98] transition tap-highlight-none mt-2"
                >
                  Install App Now
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
