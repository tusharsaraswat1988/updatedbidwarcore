import PDFDocument from "pdfkit";

export async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export interface PdfWatermarkDrawInput {
  watermarkImageBuffer: Buffer | null;
  watermarkText: string;
  watermarkOpacity: number;
}

/** Draw a centered page watermark: image when available, otherwise rotated text. */
export function drawPdfPageWatermark(
  doc: InstanceType<typeof PDFDocument>,
  branding: PdfWatermarkDrawInput,
): void {
  const w = doc.page.width;
  const h = doc.page.height;

  doc.save();

  if (branding.watermarkImageBuffer) {
    const maxWidth = Math.min(w * 0.55, 480);
    doc.opacity(Math.max(branding.watermarkOpacity, 0.06));
    doc.image(branding.watermarkImageBuffer, (w - maxWidth) / 2, (h - maxWidth * 0.35) / 2, {
      width: maxWidth,
    });
  } else {
    const label = branding.watermarkText || "BidWar";
    doc.translate(w / 2, h / 2);
    doc.rotate(-25);
    doc.fillColor("#000000", branding.watermarkOpacity).font("Helvetica-Bold").fontSize(64);
    const tw = doc.widthOfString(label);
    doc.text(label, -tw / 2, -24, { lineBreak: false });
  }

  doc.opacity(1);
  doc.restore();
}
