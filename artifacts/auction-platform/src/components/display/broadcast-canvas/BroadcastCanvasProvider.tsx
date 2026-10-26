import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  savePersistedLedScreenConfig,
  type BroadcastCanvasPreviewState,
  type CanvasDisplayMode,
  type CanvasGuideOverlay,
  type CanvasScaleMode,
} from "@/lib/broadcast-canvas/preview-mode";

type BroadcastCanvasContextValue = {
  preview: BroadcastCanvasPreviewState;
  setScaleMode: (mode: CanvasScaleMode) => void;
  setStretchX: (stretchX: number) => void;
  setDisplayMode: (mode: CanvasDisplayMode) => void;
  toggleGuide: (guide: CanvasGuideOverlay) => void;
  setShowPreviewControls: (show: boolean) => void;
  resetScale: () => void;
};

const BroadcastCanvasContext =
  createContext<BroadcastCanvasContextValue | null>(null);

export function BroadcastCanvasProvider({
  initialPreview,
  children,
}: {
  initialPreview: BroadcastCanvasPreviewState;
  children: ReactNode;
}) {
  const [preview, setPreview] = useState(initialPreview);

  const setScaleMode = useCallback((scaleMode: CanvasScaleMode) => {
    setPreview((p) => {
      savePersistedLedScreenConfig({ scaleMode, stretchX: p.stretchX });
      return { ...p, scaleMode };
    });
  }, []);

  const setStretchX = useCallback((stretchX: number) => {
    const safe = Number.isFinite(stretchX) && stretchX > 0 ? Math.round(stretchX * 100) / 100 : 1;
    setPreview((p) => {
      savePersistedLedScreenConfig({ scaleMode: p.scaleMode, stretchX: safe });
      return { ...p, stretchX: safe };
    });
  }, []);

  const resetScale = useCallback(() => {
    setPreview((p) => {
      savePersistedLedScreenConfig({ scaleMode: "fit", stretchX: 1 });
      return { ...p, scaleMode: "fit", stretchX: 1 };
    });
  }, []);

  const setDisplayMode = useCallback((displayMode: CanvasDisplayMode) => {
    setPreview((p) => ({ ...p, displayMode }));
  }, []);

  const toggleGuide = useCallback((guide: CanvasGuideOverlay) => {
    setPreview((p) => {
      const guides = new Set(p.guides);
      if (guides.has(guide)) guides.delete(guide);
      else guides.add(guide);
      return { ...p, guides };
    });
  }, []);

  const setShowPreviewControls = useCallback((show: boolean) => {
    setPreview((p) => ({ ...p, showPreviewControls: show }));
  }, []);

  const value = useMemo(
    () => ({
      preview,
      setScaleMode,
      setStretchX,
      resetScale,
      setDisplayMode,
      toggleGuide,
      setShowPreviewControls,
    }),
    [
      preview,
      setScaleMode,
      setStretchX,
      resetScale,
      setDisplayMode,
      toggleGuide,
      setShowPreviewControls,
    ],
  );

  return (
    <BroadcastCanvasContext value={value}>{children}</BroadcastCanvasContext>
  );
}

export function useBroadcastCanvasPreview() {
  const ctx = use(BroadcastCanvasContext);
  if (!ctx) {
    throw new Error("useBroadcastCanvasPreview requires BroadcastCanvasProvider");
  }
  return ctx;
}

/** Optional hook — returns null outside provider (for shared components). */
export function useBroadcastCanvasPreviewOptional() {
  return use(BroadcastCanvasContext);
}

