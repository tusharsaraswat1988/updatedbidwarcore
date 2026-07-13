import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BidWar Android shell (Capacitor).
 *
 * Loads the deployed /mobile web app so Organizer + Team Owner auth,
 * Google OAuth cookies, and deep links stay identical to the browser.
 *
 * Override at build time:
 *   CAPACITOR_SERVER_URL=https://bidwar.in/mobile/
 */
const serverUrl = (
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://bidwar-staging.onrender.com/mobile/"
).replace(/\/*$/, "/");

const config: CapacitorConfig = {
  appId: "com.bidwar.app",
  appName: "BidWar",
  webDir: "dist/public",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "bidwar-staging.onrender.com",
      "bidwar.in",
      "www.bidwar.in",
      "*.google.com",
      "accounts.google.com",
      "*.googleapis.com",
      "*.gstatic.com",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
    webContentsDebuggingEnabled: process.env.NODE_ENV !== "production",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#09090b",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
