import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * In-app offline banner with retry. Complements the native offline.html page
 * (used when the main frame fails to load entirely).
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/network").then(({ Network }) => {
        void Network.getStatus().then((s) => setOffline(!s.connected));
        const handle = Network.addListener("networkStatusChange", (s) => {
          setOffline(!s.connected);
        });
        remove = () => {
          void handle.then((h) => h.remove());
        };
      });
    }

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      remove?.();
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] safe-top px-3 pt-2 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl border border-amber-400/40 bg-[#18181b] px-4 py-3 shadow-lg">
        <p className="text-amber-400 text-sm font-semibold">You’re offline</p>
        <p className="text-[#a1a1aa] text-xs mt-1 leading-relaxed">
          Changes may not sync until you’re back online.
        </p>
        <button
          type="button"
          className="mt-2 text-sm font-semibold text-white underline underline-offset-2"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
