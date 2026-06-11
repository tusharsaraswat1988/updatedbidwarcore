import { useEffect } from "react";
import { useLocation } from "wouter";

const GA_ID = "G-5Q39TEZJX2";
const CLARITY_ID = "wu86zkys2f";

// Paths where analytics must NOT run: live auction, operator panel,
// owner bidding panel, admin app, organizer portal, Broadcast Overlay.
const BLOCKED_PREFIXES = [
  "/tournament/",
  "/admin/",
  "/organizer",
  "/wa-consent/",
  "/complete-profile",
];

let trackingLoaded = false;
let trackingScheduled = false;

function loadTracking(): void {
  if (trackingLoaded) return;
  trackingLoaded = true;

  // Google Analytics
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gaScript);

  const w = window as unknown as Record<string, unknown>;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    (w.dataLayer as unknown[]).push(arguments); // eslint-disable-line prefer-rest-params
  };
  (w.gtag as (...args: unknown[]) => void)("js", new Date());
  (w.gtag as (...args: unknown[]) => void)("config", GA_ID);

  // Microsoft Clarity (inline init snippet, same as original)
  const clarityInit = document.createElement("script");
  clarityInit.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`;
  document.head.appendChild(clarityInit);
}

/**
 * Schedule analytics loading after the page is interactive and idle.
 * Uses requestIdleCallback with a minimum delay so analytics scripts
 * don't compete with LCP / TBT on slow mobile connections.
 * Falls back to a plain timeout in browsers that lack requestIdleCallback.
 */
function scheduleTracking(): void {
  if (trackingScheduled) return;
  trackingScheduled = true;

  const doLoad = () => loadTracking();

  if (typeof window.requestIdleCallback === "function") {
    // Load when the browser is idle, with a 5-second maximum timeout.
    // On fast devices this fires within ~1s; on slow/throttled devices it
    // waits up to 5s, keeping analytics out of the LCP/TBT critical window.
    window.requestIdleCallback(doLoad, { timeout: 5000 });
  } else {
    // Safari / older browsers: plain timeout after 3 seconds
    setTimeout(doLoad, 3000);
  }
}

export function PageTracking(): null {
  const [pathname] = useLocation();

  useEffect(() => {
    const blocked = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!blocked) {
      scheduleTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only fires on initial page load

  return null;
}
