import { useEffect } from "react";
import { useLocation } from "wouter";

import { isBidWarLocalHost } from "@/lib/local-mode-host";

const GA_ID = "G-5Q39TEZJX2";
const GOOGLE_ADS_ID = "AW-18319955361";
const CLARITY_ID = "wu86zkys2f";

// Paths where analytics must NOT run: live auction, operator panel,
// owner bidding panel, admin app, organizer portal, Broadcast Overlay.
const BLOCKED_PREFIXES = [
  "/tournament/",
  "/admin/",
  "/organizer",
  "/wa-consent/",
  "/complete-profile",
  "/academy",
];

let trackingLoaded = false;

function loadTracking(): void {
  if (trackingLoaded) return;
  trackingLoaded = true;

  // Google tag (gtag.js) — single script for GA + Google Ads
  const gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(gaScript);

  const w = window as unknown as Record<string, unknown>;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    (w.dataLayer as unknown[]).push(arguments); // eslint-disable-line prefer-rest-params
  };
  const gtagFn = w.gtag as (...args: unknown[]) => void;
  gtagFn("js", new Date());
  gtagFn("config", GA_ID);
  gtagFn("config", GOOGLE_ADS_ID);

  // Microsoft Clarity (inline init snippet, same as original)
  const clarityInit = document.createElement("script");
  clarityInit.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`;
  document.head.appendChild(clarityInit);
}

export function PageTracking(): null {
  const [pathname] = useLocation();

  useEffect(() => {
    if (isBidWarLocalHost()) return;
    const blocked = BLOCKED_PREFIXES.some((p) => pathname.startsWith(p));
    if (!blocked) {
      loadTracking();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only fires on initial page load

  return null;
}
