export type BroadcastCanvasMode = "production" | "developer";

export type CanvasScaleMode =
  | "fit"
  | "stretch"
  | "8x4"
  | "8x2"
  | "fill-height"
  | "fill-width"
  | "actual"
  | "75"
  | "50";

export type CanvasDisplayMode =
  | "desktop"
  | "led-vertical"
  | "led-horizontal"
  | "mobile";

export type CanvasGuideOverlay = "safe" | "grid" | "center";

export type BroadcastCanvasPreviewState = {
  /** Production = LED-only. Developer = preview tools via ?dev=1 */
  mode: BroadcastCanvasMode;
  scaleMode: CanvasScaleMode;
  stretchX: number; // Horizontal stretch multiplier (e.g. 1.0 = 100%, 1.25 = 125%)
  displayMode: CanvasDisplayMode;
  guides: Set<CanvasGuideOverlay>;
  showPreviewControls: boolean;
};

const DEFAULT_STATE: BroadcastCanvasPreviewState = {
  mode: "production",
  scaleMode: "fit",
  stretchX: 1,
  displayMode: "led-vertical",
  guides: new Set(),
  showPreviewControls: false,
};

const STORAGE_KEY = "bidwar_side_led_screen_config";

export function isDeveloperMode(state: BroadcastCanvasPreviewState): boolean {
  return state.mode === "developer";
}

export type PersistedLedScreenConfig = {
  scaleMode?: CanvasScaleMode;
  stretchX?: number;
};

export function readPersistedLedScreenConfig(): PersistedLedScreenConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function savePersistedLedScreenConfig(config: PersistedLedScreenConfig): void {
  if (typeof window === "undefined") return;
  try {
    const current = readPersistedLedScreenConfig();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...config }));
  } catch {
    // ignore
  }
}

/**
 * Parse canvas runtime mode from URL and localStorage fallback.
 * Supports:
 *   ?stretch=1 / ?stretch=fill / ?scale=stretch
 *   ?preset=8x2 / ?ratio=2:8 / ?ratio=1:4
 *   ?stretchX=1.25
 */
export function parseBroadcastCanvasPreview(
  search: string,
): BroadcastCanvasPreviewState {
  const params = new URLSearchParams(search);
  const scaleRaw = params.get("scale");
  const stretchRaw = params.get("stretch");
  const presetRaw = params.get("preset") ?? params.get("ratio") ?? params.get("aspect");
  const stretchXRaw = params.get("stretchX") ?? params.get("widthStretch");
  const displayRaw = params.get("display");
  const guidesRaw = params.get("guides");
  const devRaw = params.get("dev") ?? params.get("previewControls");

  const mode: BroadcastCanvasMode =
    devRaw === "1" || devRaw === "true" ? "developer" : "production";

  const persisted = readPersistedLedScreenConfig();

  let scaleMode: CanvasScaleMode = "fit";
  if (
    stretchRaw === "1" ||
    stretchRaw === "true" ||
    stretchRaw === "fill" ||
    stretchRaw === "stretch" ||
    scaleRaw === "stretch" ||
    scaleRaw === "fill"
  ) {
    scaleMode = "stretch";
  } else if (
    presetRaw === "8x4" ||
    presetRaw === "4x8" ||
    presetRaw === "1:2" ||
    presetRaw === "1/2" ||
    scaleRaw === "8x4"
  ) {
    scaleMode = "8x4";
  } else if (
    presetRaw === "8x2" ||
    presetRaw === "2x8" ||
    presetRaw === "1:4" ||
    presetRaw === "1/4" ||
    scaleRaw === "8x2"
  ) {
    scaleMode = "8x2";
  } else if (
    scaleRaw === "fill-height" ||
    scaleRaw === "fill-width" ||
    scaleRaw === "actual" ||
    scaleRaw === "75" ||
    scaleRaw === "50" ||
    scaleRaw === "fit"
  ) {
    scaleMode = scaleRaw as CanvasScaleMode;
  } else if (persisted.scaleMode) {
    scaleMode = persisted.scaleMode;
  }

  let stretchX = 1;
  if (stretchXRaw) {
    const parsed = parseFloat(stretchXRaw);
    if (Number.isFinite(parsed) && parsed > 0) stretchX = parsed;
  } else if (typeof persisted.stretchX === "number" && persisted.stretchX > 0) {
    stretchX = persisted.stretchX;
  }

  const displayMode: CanvasDisplayMode =
    displayRaw === "desktop" ||
    displayRaw === "led-horizontal" ||
    displayRaw === "mobile"
      ? displayRaw
      : "led-vertical";

  const guides = new Set<CanvasGuideOverlay>();
  if (mode === "developer" && guidesRaw) {
    for (const token of guidesRaw.split(",")) {
      const t = token.trim();
      if (t === "safe" || t === "grid" || t === "center") {
        guides.add(t);
      }
    }
  }

  return {
    mode,
    scaleMode,
    stretchX,
    displayMode,
    guides,
    showPreviewControls: mode === "developer",
  };
}

export type CanvasScale2D = {
  scaleX: number;
  scaleY: number;
  scale: number;
};

export function resolveCanvasScale2D(
  viewportWidth: number,
  viewportHeight: number,
  scaleMode: CanvasScaleMode,
  canvasWidth = 1080,
  canvasHeight = 1920,
  stretchX = 1,
): CanvasScale2D {
  const safeViewportW = Math.max(1, viewportWidth);
  const safeViewportH = Math.max(1, viewportHeight);
  const fitScale = Math.min(
    safeViewportW / canvasWidth,
    safeViewportH / canvasHeight,
  );
  const userStretchX = Number.isFinite(stretchX) && stretchX > 0 ? stretchX : 1;

  switch (scaleMode) {
    case "stretch": {
      const scaleX = (safeViewportW / canvasWidth) * userStretchX;
      const scaleY = safeViewportH / canvasHeight;
      return {
        scaleX: scaleX > 0 ? scaleX : 1,
        scaleY: scaleY > 0 ? scaleY : 1,
        scale: fitScale > 0 ? fitScale : 1,
      };
    }
    case "8x4": {
      // 8ft height x 4ft width portrait LED (aspect ratio 4/8 = 0.5 = 1:2).
      // Standard canvas is 1080/1920 = 0.5625 (9:16).
      // Converting 9:16 canvas width to 4:8 (1:2) width is (4/8) / (9/16) = 0.5 / 0.5625 = 8/9 ≈ 0.8888.
      const scaleY = safeViewportH / canvasHeight;
      const natural8x4ScaleX = scaleY * (8 / 9);
      const scaleX = (safeViewportW < canvasWidth * scaleY ? (safeViewportW / canvasWidth) : natural8x4ScaleX) * userStretchX;
      return {
        scaleX: scaleX > 0 ? scaleX : 1,
        scaleY: scaleY > 0 ? scaleY : 1,
        scale: scaleY > 0 ? scaleY : 1,
      };
    }
    case "8x2": {
      // 8ft height x 2ft width portrait LED totem (aspect ratio 2/8 = 0.25).
      // Standard canvas is 1080/1920 = 0.5625 (9:16).
      // Converting 9:16 canvas width to 2:8 (1:4) width is (2/8) / (9/16) = 0.25 / 0.5625 = 4/9 ≈ 0.4444.
      const scaleY = safeViewportH / canvasHeight;
      const natural8x2ScaleX = scaleY * (4 / 9);
      const scaleX = (safeViewportW < canvasWidth * scaleY ? (safeViewportW / canvasWidth) : natural8x2ScaleX) * userStretchX;
      return {
        scaleX: scaleX > 0 ? scaleX : 1,
        scaleY: scaleY > 0 ? scaleY : 1,
        scale: scaleY > 0 ? scaleY : 1,
      };
    }
    case "fill-height": {
      const scaleY = safeViewportH / canvasHeight;
      const scaleX = scaleY * userStretchX;
      return {
        scaleX: scaleX > 0 ? scaleX : 1,
        scaleY: scaleY > 0 ? scaleY : 1,
        scale: scaleY > 0 ? scaleY : 1,
      };
    }
    case "fill-width": {
      const scaleX = (safeViewportW / canvasWidth) * userStretchX;
      const scaleY = safeViewportW / canvasWidth;
      return {
        scaleX: scaleX > 0 ? scaleX : 1,
        scaleY: scaleY > 0 ? scaleY : 1,
        scale: scaleX > 0 ? scaleX : 1,
      };
    }
    case "actual":
      return { scaleX: userStretchX, scaleY: 1, scale: 1 };
    case "75":
      return { scaleX: 0.75 * userStretchX, scaleY: 0.75, scale: 0.75 };
    case "50":
      return { scaleX: 0.5 * userStretchX, scaleY: 0.5, scale: 0.5 };
    case "fit":
    default: {
      const safeFit = fitScale > 0 ? fitScale : 1;
      return {
        scaleX: safeFit * userStretchX,
        scaleY: safeFit,
        scale: safeFit,
      };
    }
  }
}

export function resolveCanvasScale(
  viewportWidth: number,
  viewportHeight: number,
  scaleMode: CanvasScaleMode,
  canvasWidth = 1080,
  canvasHeight = 1920,
): number {
  return resolveCanvasScale2D(
    viewportWidth,
    viewportHeight,
    scaleMode,
    canvasWidth,
    canvasHeight,
  ).scale;
}

export function buildPreviewSearchParams(
  state: BroadcastCanvasPreviewState,
): string {
  const params = new URLSearchParams();
  if (state.mode === "developer") params.set("dev", "1");
  if (state.scaleMode !== "fit") params.set("scale", state.scaleMode);
  if (state.stretchX !== 1) params.set("stretchX", String(state.stretchX));
  if (state.displayMode !== "led-vertical") {
    params.set("display", state.displayMode);
  }
  if (state.guides.size > 0) {
    params.set("guides", [...state.guides].join(","));
  }
  return params.toString();
}

export { DEFAULT_STATE };

