import { useEffect, useState, type RefObject } from "react";
import {
  resolveCanvasScale,
  type CanvasScaleMode,
} from "./preview-mode";

/**
 * Observes viewport size and returns GPU-friendly scale for the fixed canvas.
 */
export function useCanvasScale(
  viewportRef: RefObject<HTMLElement | null>,
  scaleMode: CanvasScaleMode,
  canvasWidth = 1080,
  canvasHeight = 1920,
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      setScale(
        resolveCanvasScale(
          el.clientWidth,
          el.clientHeight,
          scaleMode,
          canvasWidth,
          canvasHeight,
        ),
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [viewportRef, scaleMode, canvasWidth, canvasHeight]);

  return scale;
}
