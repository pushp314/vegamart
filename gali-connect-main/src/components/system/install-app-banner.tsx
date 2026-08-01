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
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed inset-x-3 z-[70] md:hidden"
          style={{ bottom: "calc(84px + env(safe-area-inset-bottom))" }}
        >
          <div className="glass flex items-center gap-3 rounded-2xl border p-3 shadow-glow">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold">Install Vegamart</div>
              <div className="truncate text-xs text-muted-foreground">
                {iosHint
                  ? "Tap Share → Add to Home Screen"
                  : "Faster, offline-ready, one-tap access."}
              </div>
            </div>
            {!iosHint && deferred && (
              <button
                onClick={install}
                className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow active:scale-95 transition tap-highlight-none"
              >
                Install
              </button>
            )}
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-muted tap-highlight-none"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
