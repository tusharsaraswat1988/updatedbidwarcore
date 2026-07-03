const INSTALL_HINT_DISMISS_KEY = "admin-pwa-install-hint-dismissed:v1";

/** Android Chrome (not Samsung/Edge wrappers). */
export function isAndroidChromeBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/Edg|OPR|SamsungBrowser/i.test(ua);
}

/** Already launched from a home-screen PWA shortcut. */
export function isStandalonePwaDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function shouldShowAdminInstallHint(): boolean {
  if (typeof window === "undefined") return false;
  if (!isAndroidChromeBrowser() || isStandalonePwaDisplay()) return false;
  try {
    return localStorage.getItem(INSTALL_HINT_DISMISS_KEY) !== "1";
  } catch {
    return true;
  }
}

export function dismissAdminInstallHint(): void {
  try {
    localStorage.setItem(INSTALL_HINT_DISMISS_KEY, "1");
  } catch {
    // Private browsing or storage disabled — ignore.
  }
}
