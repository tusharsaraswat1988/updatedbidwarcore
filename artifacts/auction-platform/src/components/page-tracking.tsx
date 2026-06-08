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

export function PageTracking(): null {
  const [pathname] = useLocation();

  useEffect(() => {
    const blocked = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!blocked) {
      loadTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only fires on initial page load

  return null;
}
