/** Presentation-only formatting. No business logic. */
function formatLakh(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${formatLakh(n / 1e5)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function strikeRate(runs: number, balls: number): string {
  return balls ? ((runs / balls) * 100).toFixed(1) : "0.0";
}

/** Economy from "overs" string like "1.3" */
export function economy(runs: number, overs: string): string {
  const [o, b = "0"] = overs.split(".");
  const balls = Number(o) * 6 + Number(b);
  return balls ? ((runs / balls) * 6).toFixed(1) : "0.0";
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}
