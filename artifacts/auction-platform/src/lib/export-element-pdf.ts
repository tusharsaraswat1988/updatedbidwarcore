import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { BRANDING_LOGO_PATHS } from "@workspace/api-base/branding-assets";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = Math.round((A4_WIDTH_MM * 96) / 25.4);
const A4_HEIGHT_PX = Math.round((A4_HEIGHT_MM * 96) / 25.4);

/** Platform logo paths that 302-redirect to Cloudinary — must not be treated as same-origin. */
const REDIRECT_LOGO_PATHS = new Set<string>([
  BRANDING_LOGO_PATHS.primary,
  BRANDING_LOGO_PATHS.reverse,
]);

type ImageRestore = () => void;

function parseUrl(src: string): URL | null {
  try {
    return new URL(src, window.location.href);
  } catch {
    return null;
  }
}

function needsCorsSafeLoad(src: string): boolean {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) return false;

  const parsed = parseUrl(src);
  if (!parsed) return false;

  if (parsed.origin !== window.location.origin) return true;
  return REDIRECT_LOGO_PATHS.has(parsed.pathname);
}

function shouldForceCorsImageLoad(src: string, isSameOrigin: (src: string) => boolean): boolean {
  if (!isSameOrigin(src)) return true;

  const parsed = parseUrl(src);
  if (!parsed) return false;

  return REDIRECT_LOGO_PATHS.has(parsed.pathname);
}

function setCrossOriginAnonymous(root: ParentNode): void {
  root.querySelectorAll("img").forEach((img) => {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
    img.crossOrigin = "anonymous";
  });
}

function applyFullPageLayout(root: HTMLElement): void {
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.width = `${A4_WIDTH_PX}px`;
  root.style.minHeight = `${A4_HEIGHT_PX}px`;
  root.style.height = "auto";
  root.style.maxWidth = "none";
  root.style.margin = "0";
  root.style.boxShadow = "none";
  root.style.overflow = "visible";

  const tables = root.querySelector<HTMLElement>(".print-tables");
  if (tables) {
    tables.style.flex = "1";
    tables.style.display = "flex";
    tables.style.flexDirection = "column";
  }

  const footer = root.querySelector<HTMLElement>(".print-footer");
  if (footer) {
    footer.style.marginTop = "auto";
  }
}

function captureInlineStyles(element: HTMLElement, targets: HTMLElement[]): Map<HTMLElement, string> {
  const saved = new Map<HTMLElement, string>();
  for (const target of [element, ...targets]) {
    saved.set(target, target.getAttribute("style") ?? "");
  }
  return saved;
}

function restoreInlineStyles(saved: Map<HTMLElement, string>): void {
  for (const [target, style] of saved) {
    if (style) {
      target.setAttribute("style", style);
    } else {
      target.removeAttribute("style");
    }
  }
}

async function waitForImage(img: HTMLImageElement): Promise<void> {
  if (img.complete) return;
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => waitForImage(img)));
}

/**
 * Replace cross-origin / redirect-backed image URLs with same-origin blob URLs so
 * html2canvas can call toDataURL without tainting the canvas.
 */
async function inlineCorsSensitiveImages(root: HTMLElement): Promise<ImageRestore[]> {
  const restores: ImageRestore[] = [];
  const images = Array.from(root.querySelectorAll("img"));

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!needsCorsSafeLoad(src)) return;

      const originalSrc = img.src;
      const originalVisibility = img.style.visibility;

      try {
        const response = await fetch(src, { mode: "cors", credentials: "omit" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        img.crossOrigin = "anonymous";
        img.src = blobUrl;
        await waitForImage(img);

        restores.push(() => {
          URL.revokeObjectURL(blobUrl);
          img.src = originalSrc;
          img.style.visibility = originalVisibility;
        });
      } catch {
        img.style.visibility = "hidden";
        restores.push(() => {
          img.style.visibility = originalVisibility;
        });
      }
    }),
  );

  return restores;
}

async function renderElementPdf(element: HTMLElement): Promise<jsPDF> {
  element.scrollIntoView({ block: "start", inline: "nearest" });
  await document.fonts.ready;

  const restoreImages = await inlineCorsSensitiveImages(element);
  const layoutTargets = [
    element.querySelector<HTMLElement>(".print-tables"),
    element.querySelector<HTMLElement>(".print-footer"),
  ].filter((node): node is HTMLElement => node !== null);
  const savedStyles = captureInlineStyles(element, layoutTargets);
  try {
    setCrossOriginAnonymous(element);
    applyFullPageLayout(element);
    await waitForImages(element);
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const captureWidth = A4_WIDTH_PX;
    const captureHeight = Math.max(element.scrollHeight, element.offsetHeight, A4_HEIGHT_PX);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: -window.scrollY,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      customIsSameOrigin: (src, oldFn) => !shouldForceCorsImageLoad(src, oldFn),
      onclone: (_doc, clonedEl) => {
        applyFullPageLayout(clonedEl);
        setCrossOriginAnonymous(clonedEl);
      },
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Could not capture the report preview.");
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const renderedHeightMm = (canvas.height / canvas.width) * A4_WIDTH_MM;

    if (renderedHeightMm <= A4_HEIGHT_MM) {
      pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    } else {
      const scale = A4_HEIGHT_MM / renderedHeightMm;
      const scaledWidth = A4_WIDTH_MM * scale;
      const xOffset = (A4_WIDTH_MM - scaledWidth) / 2;
      pdf.addImage(imgData, "JPEG", xOffset, 0, scaledWidth, A4_HEIGHT_MM);
    }

    return pdf;
  } finally {
    restoreInlineStyles(savedStyles);
    for (const restore of restoreImages) restore();
  }
}

/**
 * Export a DOM element as a single A4 PDF page, preserving aspect ratio.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  const pdf = await renderElementPdf(element);
  pdf.save(filename);
}

/** Open the browser print dialog using the same rendered PDF as export. */
export async function printElementAsPdf(element: HTMLElement): Promise<void> {
  const pdf = await renderElementPdf(element);
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  iframe.src = url;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      URL.revokeObjectURL(url);
      iframe.remove();
    };

    iframe.onload = () => {
      const printWindow = iframe.contentWindow;
      if (!printWindow) {
        cleanup();
        reject(new Error("Could not open the print preview."));
        return;
      }

      const timeoutId = window.setTimeout(cleanup, 60_000);
      printWindow.addEventListener("afterprint", () => {
        window.clearTimeout(timeoutId);
        cleanup();
      }, { once: true });
      printWindow.focus();
      printWindow.print();
      resolve();
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("Could not load the print preview."));
    };

    document.body.appendChild(iframe);
  });
}
