import type { CapacitorConfig } from "@capacitor/cli";

/**
 * BidWar Android shell (Capacitor) — Phase 3 production config.
 *
 * Default server URL is **production**. Debug APKs override to staging
 * at Gradle assemble time (see android/app/build.gradle).
 *
 * Optional override: CAPACITOR_SERVER_URL=https://…
 */
const serverUrl = (
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://bidwar.in/mobile/"
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
      "bidwar.in",
      "www.bidwar.in",
      "bidwar-staging.onrender.com",
      "*.google.com",
      "accounts.google.com",
      "*.googleapis.com",
      "*.gstatic.com",
      "*.googleusercontent.com",
    ],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#09090b",
    // Release builds force this off in MainActivity + BuildConfig.
    webContentsDebuggingEnabled: false,
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
