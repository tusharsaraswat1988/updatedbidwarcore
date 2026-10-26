import { useEffect, useState, type RefObject } from "react";
import {
  resolveCanvasScale2D,
  type CanvasScale2D,
  type CanvasScaleMode,
} from "./preview-mode";

/**
 * Observes viewport size and returns GPU-friendly 2D scale for the fixed canvas.
 */
export function useCanvasScale(
  viewportRef: RefObject<HTMLElement | null>,
  scaleMode: CanvasScaleMode,
  canvasWidth = 1080,
  canvasHeight = 1920,
  stretchX = 1,
): CanvasScale2D {
  const [scaleState, setScaleState] = useState<CanvasScale2D>({
    scaleX: 1,
    scaleY: 1,
    scale: 1,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      setScaleState(
        resolveCanvasScale2D(
          el.clientWidth,
          el.clientHeight,
          scaleMode,
          canvasWidth,
          canvasHeight,
          stretchX,
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
  }, [viewportRef, scaleMode, canvasWidth, canvasHeight, stretchX]);

  return scaleState;
}

