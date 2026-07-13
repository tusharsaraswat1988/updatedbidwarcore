/**
 * Mask database connection identity for diagnostics (no credentials).
 */

export type MaskedDatabaseIdentity = {
  hostMasked: string;
  databaseName: string;
  sslModePresent: boolean;
};

function toParseableUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^postgres(ql)?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^postgres(ql)?:\/\//i, "https://");
  }
  return trimmed;
}

/** Redact hostname labels while keeping a stable suffix for ops recognition. */
export function maskHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase();
  if (!host) return "unknown";

  const parts = host.split(".").filter(Boolean);
  if (parts.length === 0) return "unknown";

  if (parts.length <= 3) {
    const [first, ...rest] = parts;
    const prefix = first.split("-")[0] || first.slice(0, 2) || "db";
    return [`${prefix}-****`, ...rest].join(".");
  }

  // Keep last 4 labels (e.g. ap-southeast-1.aws.neon.tech); redact earlier.
  const keepCount = Math.min(4, parts.length - 1);
  const keep = parts.slice(-keepCount);
  const redact = parts.slice(0, -keepCount).map((label, index) => {
    if (index === 0) {
      const prefix = label.split("-")[0] || "db";
      return `${prefix}-****`;
    }
    return "****";
  });

  return [...redact, ...keep].join(".");
}

export function maskDatabaseUrl(databaseUrl: string | undefined | null): MaskedDatabaseIdentity {
  if (!databaseUrl?.trim()) {
    return {
      hostMasked: "unknown",
      databaseName: "unknown",
      sslModePresent: false,
    };
  }

  try {
    const parsed = new URL(toParseableUrl(databaseUrl));
    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "unknown";
    const sslModePresent = parsed.searchParams.has("sslmode");
    return {
      hostMasked: maskHostname(parsed.hostname),
      databaseName,
      sslModePresent,
    };
  } catch {
    return {
      hostMasked: "unknown",
      databaseName: "unknown",
      sslModePresent: false,
    };
  }
}
