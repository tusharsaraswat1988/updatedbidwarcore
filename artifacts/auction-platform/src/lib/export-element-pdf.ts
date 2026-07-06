import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = Math.round((A4_WIDTH_MM * 96) / 25.4);

async function waitForImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

/**
 * Export a DOM element as a single A4 PDF page, preserving aspect ratio.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  element.scrollIntoView({ block: "start", inline: "nearest" });
  await document.fonts.ready;
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const captureWidth = A4_WIDTH_PX;
  const captureHeight = Math.max(element.scrollHeight, element.offsetHeight);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: -window.scrollY,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    onclone: (_doc, clonedEl) => {
      clonedEl.style.width = `${captureWidth}px`;
      clonedEl.style.height = "auto";
      clonedEl.style.minHeight = "0";
      clonedEl.style.maxWidth = "none";
      clonedEl.style.margin = "0";
      clonedEl.style.boxShadow = "none";
      clonedEl.style.overflow = "visible";
    },
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("Could not capture the report preview.");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const renderedHeightMm = (canvas.height / canvas.width) * A4_WIDTH_MM;

  if (renderedHeightMm <= A4_HEIGHT_MM) {
    pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, renderedHeightMm);
  } else {
    const scale = A4_HEIGHT_MM / renderedHeightMm;
    const scaledWidth = A4_WIDTH_MM * scale;
    const xOffset = (A4_WIDTH_MM - scaledWidth) / 2;
    pdf.addImage(imgData, "JPEG", xOffset, 0, scaledWidth, A4_HEIGHT_MM);
  }

  pdf.save(filename);
}
