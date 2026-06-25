import PDFDocument from "pdfkit";
import type { MatchReport } from "@workspace/badminton-core";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const mins = Math.floor(ms / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return `${mins}m ${secs}s`;
}

export function generateMatchReportPdf(report: MatchReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("Badminton Match Report", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(
      `Generated ${new Date(report.generatedAt).toLocaleString()}`,
      { align: "center" },
    );
    doc.fillColor("#000");
    doc.moveDown(1.5);

    doc.fontSize(14).font("Helvetica-Bold").text("Players");
    doc.fontSize(11).font("Helvetica");
    doc.text(`${report.players.left.label} vs ${report.players.right.label}`);
    doc.text(`Format: ${report.matchKind.replace("_", " ")}`);
    doc.moveDown();

    doc.fontSize(14).font("Helvetica-Bold").text("Result");
    doc.fontSize(11).font("Helvetica");
    doc.text(`Status: ${report.status}`);
    if (report.winner) doc.text(`Winner: ${report.winner}`);
    doc.text(`Games: ${report.gamesWon.left} – ${report.gamesWon.right}`);
    if (report.resultSummary) doc.text(`Summary: ${report.resultSummary}`);
    doc.text(`Duration: ${formatDuration(report.durationMs)}`);
    doc.moveDown();

    if (report.games.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Game Scores");
      doc.fontSize(11).font("Helvetica");
      for (const g of report.games) {
        doc.text(`Game ${g.gameNumber}: ${g.leftScore} – ${g.rightScore}`);
      }
      doc.moveDown();
    }

    if (report.timeline.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Timeline");
      doc.fontSize(10).font("Helvetica");
      for (const entry of report.timeline) {
        doc.text(`${entry.timestamp}  ${entry.label}`);
      }
      doc.moveDown();
    }

    if (report.notes.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Director Notes");
      doc.fontSize(10).font("Helvetica");
      for (const note of report.notes) {
        doc.text(`• ${note.text}`);
      }
    }

    doc.end();
  });
}
