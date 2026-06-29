function slugForExportFilename(value: string, maxLen = 45): string {
  return value
    .trim()
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen) || "tournament";
}

export function buildWorkbookExportFilename(
  tournamentName: string | null | undefined,
  auctionCode: string | null | undefined,
): string {
  const parts = ["BidWar-BMW", slugForExportFilename(tournamentName ?? "tournament")];
  const code = auctionCode?.trim();
  if (code) {
    parts.push(slugForExportFilename(code, 16).toUpperCase());
  }
  return `${parts.join("-")}.xlsx`;
}
