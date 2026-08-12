import { useEffect } from "react";
import { BROADCAST_OVERLAY_HEIGHT } from "@/lib/broadcast-overlay";

/** Force transparent document chrome so OBS does not paint app backgrounds. */
export function useObsTransparentDocument() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      rootBg: root?.style.background ?? "",
      rootMinH: root?.style.minHeight ?? "",
      htmlMinH: html.style.minHeight,
      bodyMinH: body.style.minHeight,
      bodyOverflow: body.style.overflow,
      htmlClass: html.className,
    };

    html.style.background = "transparent";
    body.style.background = "transparent";
    body.style.overflow = "hidden";
    html.style.minHeight = "0";
    body.style.minHeight = "0";
    html.classList.remove("dark");
    if (root) {
      root.style.background = "transparent";
      root.style.minHeight = `${BROADCAST_OVERLAY_HEIGHT}px`;
    }

    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      html.style.minHeight = prev.htmlMinH;
      body.style.minHeight = prev.bodyMinH;
      html.className = prev.htmlClass;
      if (root) {
        root.style.background = prev.rootBg;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, []);
}
