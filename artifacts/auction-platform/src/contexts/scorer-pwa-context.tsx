import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type ScorerPwaContextValue = {
  canPromptInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
};

const ScorerPwaContext = createContext<ScorerPwaContextValue | null>(null);

const SCORER_SW_URL = "/scoring-app/sw.js";
const SCORER_SW_SCOPE = "/scoring-app/";

function checkIsStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

const FALLBACK_VALUE: ScorerPwaContextValue = {
  canPromptInstall: false,
  isInstalled: false,
  promptInstall: async () => false,
};

export function ScorerPwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => checkIsStandalone());

  useEffect(() => {
    setIsInstalled(checkIsStandalone());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SCORER_SW_URL, { scope: SCORER_SW_SCOPE }).catch(() => {
        // HTTP LAN or unsupported browser — manual Add to Home Screen still works.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const value: ScorerPwaContextValue = {
    canPromptInstall: deferredPrompt !== null && !isInstalled,
    isInstalled,
    promptInstall,
  };

  return <ScorerPwaContext value={value}>{children}</ScorerPwaContext>;
}

export function useScorerPwa(): ScorerPwaContextValue {
  const ctx = use(ScorerPwaContext);
  if (!ctx) {
    return {
      ...FALLBACK_VALUE,
      isInstalled: checkIsStandalone(),
    };
  }
  return ctx;
}
