import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const A4_WIDTH_PX = Math.round((A4_WIDTH_MM * 96) / 25.4);
const A4_HEIGHT_PX = Math.round((A4_HEIGHT_MM * 96) / 25.4);

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
 * Export a DOM element as a single A4 PDF page, matching its on-screen layout.
 */
export async function exportElementToPdf(element: HTMLElement, filename: string): Promise<void> {
  element.scrollIntoView({ block: "center", inline: "nearest" });
  await document.fonts.ready;
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: -window.scrollY,
    width: element.offsetWidth || A4_WIDTH_PX,
    height: element.offsetHeight || A4_HEIGHT_PX,
    onclone: (_doc, clonedEl) => {
      clonedEl.style.width = `${A4_WIDTH_PX}px`;
      clonedEl.style.height = `${A4_HEIGHT_PX}px`;
      clonedEl.style.maxWidth = "none";
      clonedEl.style.margin = "0";
      clonedEl.style.boxShadow = "none";
    },
  });

  if (!canvas.width || !canvas.height) {
    throw new Error("Could not capture the report preview.");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  pdf.save(filename);
}
