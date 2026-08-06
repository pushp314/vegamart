import { AnimatePresence, motion } from "framer-motion";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "lg_install_dismissed_at";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);
}

export function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissed && Date.now() - dismissed < DISMISS_DAYS * 86400000) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setTimeout(() => setVisible(true), 800);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (isIOS()) {
      setTimeout(() => {
        setIosHint(true);
        setVisible(true);
      }, 1200);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const res = await deferred.userChoice;
    if (res.outcome === "accepted") setVisible(false);
    else dismiss();
    setDeferred(null);
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

              {!iosHint && deferred && (
                <button
                  onClick={install}
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
