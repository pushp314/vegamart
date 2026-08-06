import { useEffect, useState } from "react";

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
  const [deferred, setDeferred] = useState<BIPEvent | null>(deferredInstallPrompt);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const sync = () => setDeferred(deferredInstallPrompt);
    listeners.add(sync);
    setStandalone(isStandalonePwa());
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const isIOS = isIOSPwa();

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

  return {
    canInstall,
    isIOS,
    isStandalone: standalone,
    showInstallOption: !standalone && (canInstall || isIOS),
    install,
  };
}
