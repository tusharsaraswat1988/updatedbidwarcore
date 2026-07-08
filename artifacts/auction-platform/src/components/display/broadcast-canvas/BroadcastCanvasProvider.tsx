import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  BroadcastCanvasPreviewState,
  CanvasDisplayMode,
  CanvasGuideOverlay,
  CanvasScaleMode,
} from "@/lib/broadcast-canvas/preview-mode";

type BroadcastCanvasContextValue = {
  preview: BroadcastCanvasPreviewState;
  setScaleMode: (mode: CanvasScaleMode) => void;
  setDisplayMode: (mode: CanvasDisplayMode) => void;
  toggleGuide: (guide: CanvasGuideOverlay) => void;
  setShowPreviewControls: (show: boolean) => void;
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
    setPreview((p) => ({ ...p, scaleMode }));
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
      setDisplayMode,
      toggleGuide,
      setShowPreviewControls,
    }),
    [preview, setScaleMode, setDisplayMode, toggleGuide, setShowPreviewControls],
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
