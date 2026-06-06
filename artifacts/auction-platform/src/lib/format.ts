export function formatIndianRupee(amount: number | null | undefined): string {
  if (amount == null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShortIndianRupee(amount: number | null | undefined): string {
  if (amount == null) return "₹0";
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2)}Cr`;
  }
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(2)}L`;
  }
  return formatIndianRupee(amount);
}

/** IPL-style sold line for broadcast overlays, e.g. SOLD FOR ₹12.50 LAKH */
export function formatSoldForBroadcast(amount: number | null | undefined): string {
  if (amount == null || amount <= 0) return "SOLD FOR —";
  if (amount >= 10000000) {
    const cr = amount / 10000000;
    const val = cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2);
    return `SOLD FOR ₹${val} CRORE`;
  }
  if (amount >= 100000) {
    const lakh = amount / 100000;
    const val = lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(2);
    return `SOLD FOR ₹${val} LAKH`;
  }
  return `SOLD FOR ${formatIndianRupee(amount)}`;
}
