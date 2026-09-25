/** Presentation-only formatting. No business logic. */
export function formatAmount(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${Math.round(n / 1e5)} L`;
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
