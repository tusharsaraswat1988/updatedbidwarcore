import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { isAdminPwaRoute } from "@/lib/branding-pwa";
import { isStandalonePwaDisplay } from "@/lib/admin-pwa";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type AdminPwaContextValue = {
  canPromptInstall: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<boolean>;
};

const AdminPwaContext = createContext<AdminPwaContextValue | null>(null);

const ADMIN_SW_URL = "/admin/sw.js";
const ADMIN_SW_SCOPE = "/admin/";

const FALLBACK_VALUE: AdminPwaContextValue = {
  canPromptInstall: false,
  isInstalled: false,
  promptInstall: async () => false,
};

export function AdminPwaProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isAdmin = isAdminPwaRoute(location);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => isStandalonePwaDisplay());

  useEffect(() => {
    if (!isAdmin) {
      setDeferredPrompt(null);
      return;
    }

    setIsInstalled(isStandalonePwaDisplay());

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

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(ADMIN_SW_URL, { scope: ADMIN_SW_SCOPE }).catch(() => {
        // HTTP LAN or unsupported context — manual Add to Home Screen still works.
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isAdmin]);

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

  const value: AdminPwaContextValue = {
    canPromptInstall: deferredPrompt !== null && !isInstalled,
    isInstalled,
    promptInstall,
  };

  return <AdminPwaContext value={value}>{children}</AdminPwaContext>;
}

export function useAdminPwa(): AdminPwaContextValue {
  const ctx = use(AdminPwaContext);
  if (!ctx) {
    return {
      ...FALLBACK_VALUE,
      isInstalled: isStandalonePwaDisplay(),
    };
  }
  return ctx;
}
