/** Google Ads conversion: organiser signup (Subscribe). */
const ADS_CONVERSION_EVENT = "ads_conversion_Subscribe_1";
const ADS_ID = "AW-18319955361";
const STORAGE_KEY = "bidwar:ads_conversion_Subscribe_1";

let conversionFired = false;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Ensure gtag exists for conversion pages where PageTracking is blocked
 * (e.g. /complete-profile). Reuses an existing GA/Ads gtag when present.
 */
function ensureGtagForAds(): void {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    (window.dataLayer as unknown[]).push(arguments);
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ADS_ID}`;
  document.head.appendChild(script);
  window.gtag("js", new Date());
  window.gtag("config", ADS_ID);
}

function markFired(): void {
  conversionFired = true;
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // sessionStorage unavailable — module flag still dedupes this tab
  }
}

function alreadyFired(): boolean {
  if (conversionFired) return true;
  try {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      conversionFired = true;
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Fire Google Ads organiser-signup conversion once per browser session.
 * Call only after the backend confirms account creation.
 *
 * Pass `onDone` when navigating away immediately after the event so the hit
 * can flush (event_callback) before the page unloads.
 */
export function trackOrganizerSignupConversion(options?: { onDone?: () => void }): void {
  const finish = () => options?.onDone?.();

  if (typeof window === "undefined") {
    finish();
    return;
  }

  if (alreadyFired()) {
    finish();
    return;
  }

  ensureGtagForAds();

  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    markFired();
    if (options?.onDone) {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        finish();
      };
      window.gtag("event", ADS_CONVERSION_EVENT, {
        event_callback: settle,
        event_timeout: 2000,
      });
      window.setTimeout(settle, 2000);
    } else {
      window.gtag("event", ADS_CONVERSION_EVENT);
    }
    return;
  }

  finish();
}
