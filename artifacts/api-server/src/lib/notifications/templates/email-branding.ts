/**
 * BidWar transactional email design tokens — aligned with auction-platform
 * BRANDING_DEFAULTS and index.css dark theme (primary amber, #09090b background).
 */

export const BIDWAR_EMAIL_COLORS = {
  /** Page background — matches --background hsl(240 10% 4%) */
  pageBg: "#09090b",
  /** Card / panel surface — matches landing hero panels */
  surface: "#0f0f12",
  surfaceElevated: "#141418",
  /** Borders — matches --border hsl(240 10% 16%) */
  border: "#27272a",
  borderGold: "rgba(251, 191, 36, 0.35)",
  /** Primary amber/gold — matches --primary hsl(43 96% 56%) */
  primary: "#FBBF24",
  primaryGlow: "rgba(251, 191, 36, 0.15)",
  primaryForeground: "#09090b",
  /** Text */
  foreground: "#FAFAFA",
  muted: "#A1A1AA",
  mutedDark: "#71717A",
  success: "#22C55E",
  accent: "#3B82F6",
} as const;

export const BIDWAR_SUPPORT_EMAIL = "bidwarsupport@gmail.com";

export const BIDWAR_WEBSITE_URL = "https://bidwar.in/";

/** Clickable BidWar link — opens bidwar.in in a new tab (email-safe inline styles). */
export function bidwarAnchor(displayText?: string): string {
  const text = escapeHtml(displayText ?? "BidWar");
  const url = escapeHtml(BIDWAR_WEBSITE_URL);
  return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${BIDWAR_EMAIL_COLORS.primary};text-decoration:none;font-weight:700;">${text}</a>`;
}

export const BIDWAR_FONT_STACK =
  "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const BIDWAR_BODY_FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Google Fonts — supported in Apple Mail, iOS Mail, and many webmail clients. */
export const BIDWAR_FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap";

export function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

/**
 * Resolve logo URL for email clients.
 * Prefer HTTPS CDN/branding URL; fall back to app-hosted PNG (Outlook-safe; WebP is unreliable in email).
 */
export function resolveEmailLogoUrl(appUrl: string, miniLogoUrl?: string | null): string {
  if (miniLogoUrl?.startsWith("https://")) return miniLogoUrl;
  return `${normalizeAppUrl(appUrl)}/favicon-32.png`;
}

export function resolveTournamentDashboardUrl(appUrl: string, tournamentId?: number | null): string {
  const base = normalizeAppUrl(appUrl);
  if (tournamentId != null && tournamentId > 0) return `${base}/tournament/${tournamentId}`;
  return `${base}/organizer`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
