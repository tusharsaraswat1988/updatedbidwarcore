import { useEffect, useState } from "react";

const cropCache = new Map<string, string>();

/**
 * Trims excess white or transparent bounding box margins from an image URL.
 * Scans perimeter pixels and extracts the tight bounding box of actual logo glyphs.
 * Fallbacks gracefully to the original URL if CORS prevents canvas access.
 */
export async function autoCropSponsorLogo(url: string, threshold = 240): Promise<string> {
  if (!url || typeof window === "undefined") return url;
  if (cropCache.has(url)) return cropCache.get(url)!;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    // Timeout fallback after 2.5s in case image hangs
    const timeout = setTimeout(() => {
      cropCache.set(url, url);
      resolve(url);
    }, 2500);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          cropCache.set(url, url);
          resolve(url);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          cropCache.set(url, url);
          resolve(url);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let top = 0;
        let bottom = h;
        let left = 0;
        let right = w;

        // Scan from top down
        topLoop: for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const isBlank = a < 15 || (r > threshold && g > threshold && b > threshold);
            if (!isBlank) {
              top = Math.max(0, y - 4);
              break topLoop;
            }
          }
        }

        // Scan from bottom up
        botLoop: for (let y = h - 1; y >= 0; y--) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const isBlank = a < 15 || (r > threshold && g > threshold && b > threshold);
            if (!isBlank) {
              bottom = Math.min(h, y + 5);
              break botLoop;
            }
          }
        }

        // Scan from left to right
        leftLoop: for (let x = 0; x < w; x++) {
          for (let y = 0; y < h; y++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const isBlank = a < 15 || (r > threshold && g > threshold && b > threshold);
            if (!isBlank) {
              left = Math.max(0, x - 4);
              break leftLoop;
            }
          }
        }

        // Scan from right to left
        rightLoop: for (let x = w - 1; x >= 0; x--) {
          for (let y = 0; y < h; y++) {
            const idx = (y * w + x) * 4;
            const a = data[idx + 3];
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const isBlank = a < 15 || (r > threshold && g > threshold && b > threshold);
            if (!isBlank) {
              right = Math.min(w, x + 5);
              break rightLoop;
            }
          }
        }

        const cropW = Math.max(1, right - left);
        const cropH = Math.max(1, bottom - top);

        // If margins were minimal (less than 4% total whitespace), retain original
        if (cropW >= w * 0.96 && cropH >= h * 0.96) {
          cropCache.set(url, url);
          resolve(url);
          return;
        }

        const outCanvas = document.createElement("canvas");
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext("2d");
        if (!outCtx) {
          cropCache.set(url, url);
          resolve(url);
          return;
        }

        outCtx.drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
        const croppedUrl = outCanvas.toDataURL("image/png");
        cropCache.set(url, croppedUrl);
        resolve(croppedUrl);
      } catch {
        // In case of tainted canvas due to strict CORS, gracefully fallback to original
        cropCache.set(url, url);
        resolve(url);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      cropCache.set(url, url);
      resolve(url);
    };
  });
}

/**
 * React hook that returns the auto-cropped logo URL.
 * Yields original URL instantly while background crop computation executes.
 */
export function useAutoCroppedLogo(rawUrl: string | undefined): string | undefined {
  const [cropped, setCropped] = useState<string | undefined>(() => {
    if (!rawUrl) return undefined;
    return cropCache.get(rawUrl) || rawUrl;
  });

  useEffect(() => {
    if (!rawUrl) {
      setCropped(undefined);
      return;
    }

    if (cropCache.has(rawUrl)) {
      setCropped(cropCache.get(rawUrl));
      return;
    }

    let active = true;
    autoCropSponsorLogo(rawUrl).then((res) => {
      if (active) setCropped(res);
    });

    return () => {
      active = false;
    };
  }, [rawUrl]);

  return cropped;
}
