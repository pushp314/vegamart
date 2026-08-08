import { useEffect, useState, useCallback } from "react";

const DISMISS_KEY = "lg_install_dismissed_at";
const DISMISS_DAYS = 7;

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredInstallPrompt: BIPEvent | null = null;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((l) => l());
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e as BIPEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    emit();
  });
}

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)
  );
}

function isIOSPwa() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDeferred(deferredInstallPrompt);
    setStandalone(isStandalonePwa());
    setIsIOS(isIOSPwa());
    
    const sync = () => setDeferred(deferredInstallPrompt);
    listeners.add(sync);
    const checkDismissed = () => {
      const dismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setIsDismissed(Boolean(dismissed && Date.now() - dismissed < DISMISS_DAYS * 86400000));
    };
    checkDismissed();
    window.addEventListener("pwa_dismissed", checkDismissed);

    return () => {
      listeners.delete(sync);
      window.removeEventListener("pwa_dismissed", checkDismissed);
    };
  }, []);

  const install = async (): Promise<"accepted" | "dismissed" | null> => {
    const prompt = deferredInstallPrompt;
    if (!prompt) return null;
    await prompt.prompt();
    const res = await prompt.userChoice;
    deferredInstallPrompt = null;
    emit();
    return res.outcome;
  };

  const canInstall = Boolean(deferred);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setIsDismissed(true);
    window.dispatchEvent(new Event("pwa_dismissed"));
  }, []);

  return {
    canInstall,
    isIOS,
    isStandalone: standalone,
    showInstallOption: mounted && !standalone && (canInstall || isIOS),
    isDismissed: mounted ? isDismissed : true,
    install,
    dismiss,
  };
}
