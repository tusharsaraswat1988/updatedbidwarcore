/**
 * Capacitor native shell bootstrap.
 * Does NOT change Organizer / Team Owner authentication — only wires
 * Android chrome when Capacitor plugins are present in the loaded page.
 */
import { Capacitor } from "@capacitor/core";

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#09090b" });
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    // StatusBar may be unavailable until plugins sync
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // ignore
  }

  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
        return;
      }
      void App.exitApp();
    });
  } catch {
    // Native MainActivity also handles hardware back
  }

  // FCM infrastructure only — do not request notification permission yet.
  if (isNativeAndroid()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      PushNotifications.addListener("registration", (token) => {
        console.info("[BidWar] FCM token ready (infra only)", `${token.value.slice(0, 12)}…`);
      });
      PushNotifications.addListener("registrationError", (err) => {
        console.warn("[BidWar] FCM registration error", err.error);
      });
    } catch {
      // Requires real google-services.json from Firebase Console
    }
  }
}
