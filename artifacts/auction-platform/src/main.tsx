import { createRoot } from "react-dom/client";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import App from "./App";
import "./index.css";
import "./styles/display-tv-mode.css";

const root = document.getElementById("root")!;

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
  createRoot(root).render(<App />);
}
