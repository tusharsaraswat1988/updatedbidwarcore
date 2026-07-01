export type AuctionUnit = "rupee" | "points";

export const AUCTION_UNITS = ["rupee", "points"] as const;

export const AUCTION_UNIT_OPTIONS: ReadonlyArray<{
  value: AuctionUnit;
  label: string;
  shortLabel: string;
}> = [
  { value: "points", label: "Points (Pt.)", shortLabel: "Pt." },
  { value: "rupee", label: "Rupee (₹)", shortLabel: "₹" },
];

export function normalizeAuctionUnit(value: string | null | undefined): AuctionUnit {
  return value === "points" ? "points" : "rupee";
}

export function auctionUnitSymbol(unit: AuctionUnit): string {
  return unit === "points" ? "Pt." : "₹";
}

export function auctionUnitSuffix(unit: AuctionUnit): string {
  return unit === "points" ? " Pt." : "";
}

export function formatAuctionAmount(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  if (amount == null) return unit === "points" ? "0 Pt." : "₹0";
  const formatted = amount.toLocaleString("en-IN");
  return unit === "points" ? `${formatted} Pt.` : `₹${formatted}`;
}

export function formatShortAuctionAmount(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  if (amount == null) return unit === "points" ? "0 Pt." : "₹0";
  if (amount >= 10_000_000) {
    const val = (amount / 10_000_000).toFixed(2);
    return unit === "points" ? `${val} Cr Pt.` : `₹${val}Cr`;
  }
  if (amount >= 100_000) {
    const val = (amount / 100_000).toFixed(2);
    return unit === "points" ? `${val} L Pt.` : `₹${val}L`;
  }
  return formatAuctionAmount(amount, unit);
}

/** IPL-style sold line for broadcast overlays, e.g. SOLD FOR ₹12.50 LAKH */
export function formatSoldForBroadcast(
  amount: number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  if (amount == null || amount <= 0) return "SOLD FOR —";
  if (amount >= 10_000_000) {
    const cr = amount / 10_000_000;
    const val = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2);
    return unit === "points" ? `SOLD FOR ${val} CRORE PT.` : `SOLD FOR ₹${val} CRORE`;
  }
  if (amount >= 100_000) {
    const lakh = amount / 100_000;
    const val = lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(2);
    return unit === "points" ? `SOLD FOR ${val} LAKH PT.` : `SOLD FOR ₹${val} LAKH`;
  }
  return `SOLD FOR ${formatAuctionAmount(amount, unit).toUpperCase()}`;
}

/** LED broadcast short format — e.g. ₹1.25 L or 1.25 L Pt. */
export function formatLedAuctionAmount(n: number, unit: AuctionUnit = "rupee"): string {
  if (n >= 1_00_00_000) {
    const cr = n / 1_00_00_000;
    const val = cr.toFixed(cr >= 10 ? 1 : 2);
    return unit === "points" ? `${val} CR PT.` : `₹${val} CR`;
  }
  if (n >= 1_00_000) {
    const lakh = n / 1_00_000;
    const val = lakh.toFixed(lakh >= 10 ? 1 : 2);
    return unit === "points" ? `${val} L PT.` : `₹${val} L`;
  }
  return unit === "points" ? `${n.toLocaleString("en-IN")} PT.` : `₹${n.toLocaleString("en-IN")}`;
}

export function formatLedAuctionAmountFull(n: number, unit: AuctionUnit = "rupee"): string {
  return unit === "points"
    ? `${n.toLocaleString("en-IN")} PT.`
    : `₹${n.toLocaleString("en-IN")}`;
}

export function parseAuctionAmountInput(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : 0;
  const cleaned = String(raw ?? "").replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Human-readable Indian amount, e.g. 11000000 → "1 Cr 10 lakh". */
export function formatAuctionAmountWords(
  raw: string | number | null | undefined,
  unit: AuctionUnit = "rupee",
): string {
  const n = parseAuctionAmountInput(raw);
  if (n <= 0) return "";

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${crore} Cr`);
  if (lakh) parts.push(`${lakh} lakh`);
  if (thousand) parts.push(`${thousand} thousand`);
  if (rest) parts.push(String(rest));

  const base = parts.join(" ");
  return unit === "points" && base ? `${base} Pt.` : base;
}

export function budgetFieldLabel(unit: AuctionUnit): string {
  return unit === "points" ? "Team Budget (Pt.)" : "Team Budget (₹)";
}

export function minValueFieldLabel(unit: AuctionUnit): string {
  return unit === "points" ? "Minimum Player Value (Pt.)" : "Minimum Player Value (₹)";
}

export function bidIncrementFieldLabel(unit: AuctionUnit): string {
  return unit === "points" ? "Bid Increase Amount (Pt.)" : "Bid Increase Amount (₹)";
}
