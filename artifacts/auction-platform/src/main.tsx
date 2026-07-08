import { hydrateRoot, createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import App from "./App";
import "./index.css";
import { readWindowDehydratedState, readWindowInitialData, normalizeHomeInitialData } from "@/lib/initial-data/types";
import { homePageInitialData } from "@/lib/initial-data/initial-data-provider";
import { readWindowAcademyData } from "@/lib/academy-public";

const root = document.getElementById("root")!;

function isDisplayRoute(pathname: string): boolean {
  return (
    pathname.includes("/display") ||
    pathname.includes("/side-display") ||
    pathname.includes("/obs-overlay") ||
    pathname.includes("/liveviewer")
  );
}

async function prefetchAcademyRoute(pathname: string): Promise<void> {
  if (!readWindowAcademyData()) return;
  if (pathname === "/academy" || pathname === "/academy/") {
    await import("@/pages/academy/index");
    return;
  }
  if (/^\/academy\/[^/]+$/.test(pathname)) {
    await import("@/pages/academy/lesson");
  }
}

async function bootstrapAcademy(pathname: string): Promise<void> {
  await prefetchAcademyRoute(pathname);
  flushSync(() => {
    createRoot(root).render(<App />);
  });
  document.getElementById("academy-ssr-fallback")?.remove();
}

async function bootstrap(): Promise<void> {
  const pathname = window.location.pathname;

  if (isDisplayRoute(pathname)) {
    await import("./styles/display-tv-mode.css");
    if (pathname.includes("/side-display")) {
      await import("./styles/broadcast-canvas.css");
    }
  }

  const academyData = readWindowAcademyData();
  if (academyData && document.getElementById("academy-ssr-fallback")) {
    await bootstrapAcademy(pathname);
    return;
  }

  await prefetchAcademyRoute(pathname);

  const initialWire = readWindowInitialData();
  const dehydratedState = readWindowDehydratedState();
  const hasHomeSsrPayload = Boolean(initialWire || dehydratedState);

  if (hasHomeSsrPayload && root.hasChildNodes()) {
    hydrateRoot(
      root,
      <App
        pageData={initialWire ? homePageInitialData(normalizeHomeInitialData(initialWire)) : null}
        dehydratedState={dehydratedState}
      />,
    );
    return;
  }

  createRoot(root).render(<App />);
}

/** Scoring URLs are served by the separate scoring-app bundle — never mount auction SPA here. */
if (window.location.pathname.startsWith(SCORING_APP_BASE)) {
  root.innerHTML =
    '<div style="font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center">' +
    "<main style=\"max-width:28rem\">" +
    "<h1 style=\"font-size:1.25rem;margin:0 0 12px\">Scoring app did not load</h1>" +
    "<p style=\"color:#a1a1aa;line-height:1.6;margin:0 0 12px\">" +
    "The auction app started on a scoring URL. Run <code style=\"color:#fbbf24\">pnpm dev:restart</code> " +
    "so <code style=\"color:#fbbf24\">/scoring-app</code> proxies to the scoring dev server." +
    "</p>" +
    '<button type="button" style="color:#fbbf24;background:none;border:none;cursor:pointer;text-decoration:underline;font-size:14px" onclick="location.reload()">Retry</button>' +
    "</main></div>";
} else {
  void bootstrap();
}
