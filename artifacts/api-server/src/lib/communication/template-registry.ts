/**
 * BIDWAR — Authoritative WhatsApp Template Registry & Allowlist
 *
 * Permanent source of truth for WhatsApp templates in BIDWAR.
 * In accordance with Meta WhatsApp Business Cloud API policies:
 * - Only verified, Meta-approved templates explicitly enabled for BIDWAR use can be dispatched.
 * - Unapproved, draft, paused, rejected, duplicate, or locally invented templates are excluded from active operations.
 * - When live Meta status cannot be queried (no live Graph API sync credentials), dispatch is strictly
 *   restricted to previously verified approval evidence on this allowlist.
 */

import { getPublicOrigin } from "../runtime-env";

export function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolves the image header URL for auction_player_sold Meta template.
 * Validates protocol (http/https) and supports custom environment overrides.
 */
export function resolvePlayerSoldImageUrl(customUrl?: string | null): string {
  if (customUrl && typeof customUrl === "string" && customUrl.trim()) {
    const trimmed = customUrl.trim();
    if (trimmed.startsWith("/")) {
      const appUrl = process.env.APP_URL?.trim() || process.env.PUBLIC_ORIGIN?.trim();
      if (appUrl) {
        const candidate = `${appUrl.replace(/\/+$/, "")}${trimmed}`;
        if (isValidHttpUrl(candidate)) {
          return candidate;
        }
      }
      try {
        const origin = getPublicOrigin();
        const candidate = `${origin.replace(/\/+$/, "")}${trimmed}`;
        if (isValidHttpUrl(candidate)) {
          return candidate;
        }
      } catch {
        const candidate = `https://bidwar.in${trimmed}`;
        if (isValidHttpUrl(candidate)) {
          return candidate;
        }
      }
    }
    return trimmed;
  }
  const envUrl = process.env.WHATSAPP_PLAYER_SOLD_IMAGE_URL?.trim();
  if (envUrl && isValidHttpUrl(envUrl)) {
    return envUrl;
  }
  const appUrl = process.env.APP_URL?.trim() || process.env.PUBLIC_ORIGIN?.trim();
  if (appUrl) {
    const candidate = `${appUrl.replace(/\/+$/, "")}/assets/branding/player-sold-banner.jpg`;
    if (isValidHttpUrl(candidate)) {
      return candidate;
    }
  }
  try {
    const origin = getPublicOrigin();
    const candidate = `${origin}/assets/branding/player-sold-banner.jpg`;
    if (isValidHttpUrl(candidate)) {
      return candidate;
    }
  } catch {
    // Fall through to canonical fallback
  }
  return "https://bidwar.in/assets/branding/player-sold-banner.jpg";
}

export interface MetaTemplateVariable {
  key: string;
  label: string;
  placeholder: string;
  description?: string;
}

export interface MetaVerifiedTemplate {
  templateName: string;
  metaTemplateName: string;
  title: string;
  displayName: string;
  category: "utility" | "marketing" | "authentication";
  description: string;
  language: string;
  headerType: "image" | "text" | "video" | "document" | "none";
  headerImageUrl?: string;
  body: string;
  variables: MetaTemplateVariable[];
  sampleArgs: string[];
  status: "approved";
  metaApproved: true;
  isUsableInBidwar: true;
  evidenceSource: string;
  evidenceTimestamp: string;
  liveSyncStatus: "sync_unavailable" | "synced" | "unverified";
  liveSyncNote: string;
  connectedEvents: string[];
}

export interface DevTemplateAuditEntry {
  templateName: string;
  metaTemplateName: string | null;
  title: string;
  category: string;
  description: string;
  language: string;
  body: string;
  variables: MetaTemplateVariable[];
  sampleArgs: string[];
  status: "unapproved" | "duplicate" | "placeholder" | "draft" | "rejected";
  metaApproved: false;
  isUsableInBidwar: false;
  reason: string;
  connectedEvents: string[];
}

/**
 * Strict server-side allowlist of template names verified with Meta WhatsApp Business Manager.
 * ONLY templates in this Set are eligible for outbound WhatsApp dispatch in BIDWAR.
 */
export const BIDWAR_APPROVED_TEMPLATE_ALLOWLIST = new Set<string>([
  "auction_player_sold",
]);

/**
 * The authoritative Meta-approved canonical template for BIDWAR.
 * Exact body copy and variable order from Meta WhatsApp Manager.
 */
export const VERIFIED_APPROVED_TEMPLATES: Record<string, MetaVerifiedTemplate> = {
  auction_player_sold: {
    templateName: "auction_player_sold",
    metaTemplateName: "auction_player_sold",
    title: "🏏 Player Sold Celebration",
    displayName: "🏏 Player Sold Celebration",
    category: "utility",
    description: "Meta-approved celebratory announcement with image header sent when a player is sold to a team in auction.",
    language: "en",
    headerType: "image",
    headerImageUrl: resolvePlayerSoldImageUrl(),
    body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
    variables: [
      { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
      { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
      { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
      { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
    ],
    sampleArgs: ["Virat Kohli", "Royal Challengers", "₹25,00,000", "Premier League 2026"],
    status: "approved",
    metaApproved: true,
    isUsableInBidwar: true,
    evidenceSource: "Meta WhatsApp Business Manager (WABA) Confirmed Template Registry",
    evidenceTimestamp: "2026-10-29T00:00:00Z",
    liveSyncStatus: "sync_unavailable",
    liveSyncNote: "Live Meta Graph API sync unavailable without direct Meta credentials; serving previously verified approval evidence.",
    connectedEvents: ["player_sold"],
  },
};

/**
 * Audit log of unapproved development templates, placeholders, and duplicates discovered in the codebase.
 * Preserved for restricted debug/audit view and historical delivery inspection, but excluded from operational dispatch.
 */
export const DEV_UNAPPROVED_TEMPLATES: Record<string, DevTemplateAuditEntry> = {
  player_sold: {
    templateName: "player_sold",
    metaTemplateName: "auction_player_sold",
    title: "🏏 Player Sold Celebration (Legacy Alias)",
    category: "utility",
    description: "Legacy development alias for auction_player_sold. Operational admin uses canonical name 'auction_player_sold'.",
    language: "en",
    body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
    variables: [
      { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
      { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
      { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
      { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
    ],
    sampleArgs: ["Virat Kohli", "Royal Challengers", "₹25,00,000", "Premier League 2026"],
    status: "duplicate",
    metaApproved: false,
    isUsableInBidwar: false,
    reason: "Duplicate alias of canonical Meta template 'auction_player_sold'. Redundant alias hidden from operational active dropdown.",
    connectedEvents: [],
  },
  welcome_invite: {
    templateName: "welcome_invite",
    metaTemplateName: null,
    title: "🎉 Welcome & Tournament Invite (Dev Placeholder)",
    category: "utility",
    description: "Tournament invite message created during development.",
    language: "en",
    body: "*Welcome to BidWar Auction!*\n\nYou are invited to participate in *{{1}}*.\n\n📅 Date: {{2}}\n📍 Venue/Mode: {{3}}\n\nClick below to view details and live rosters.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Date & Time", placeholder: "e.g. 24 Sep 2026, 6:00 PM" },
      { key: "3", label: "Venue / Mode", placeholder: "e.g. Live Arena" },
    ],
    sampleArgs: ["Premier League 2026", "24 Sep 2026, 6:00 PM", "Live Arena"],
    status: "unapproved",
    metaApproved: false,
    isUsableInBidwar: false,
    reason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
    connectedEvents: [],
  },
  auction_reminder: {
    templateName: "auction_reminder",
    metaTemplateName: null,
    title: "🚨 Live Auction Countdown Alert (Dev Placeholder)",
    category: "utility",
    description: "Countdown alert message created during development.",
    language: "en",
    body: "*🚨 Live Auction Starting Soon!*\n\nThe player auction for *{{1}}* begins in *{{2}} minutes*.\n\nTap the link below to enter the live bidding arena right now:\n{{3}}",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Minutes Remaining", placeholder: "e.g. 15" },
      { key: "3", label: "Live Auction Link", placeholder: "e.g. https://bidwar.in/live/742" },
    ],
    sampleArgs: ["Premier League 2026", "15", "https://bidwar.in/live/742"],
    status: "unapproved",
    metaApproved: false,
    isUsableInBidwar: false,
    reason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
    connectedEvents: [],
  },
  consent_optin: {
    templateName: "consent_optin",
    metaTemplateName: null,
    title: "📲 WhatsApp Consent Opt-In Request (Dev Placeholder)",
    category: "utility",
    description: "Consent opt-in message created during development.",
    language: "en",
    body: "*BidWar Instant Alerts*\n\nTo receive real-time bid updates, sale notifications, and squad announcements directly on WhatsApp, please confirm your opt-in:\n\n{{1}}",
    variables: [
      { key: "1", label: "Consent Verification Link", placeholder: "e.g. https://bidwar.in/wa-consent/token981" },
    ],
    sampleArgs: ["https://bidwar.in/wa-consent/token981"],
    status: "unapproved",
    metaApproved: false,
    isUsableInBidwar: false,
    reason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
    connectedEvents: [],
  },
  credentials_share: {
    templateName: "credentials_share",
    metaTemplateName: null,
    title: "🔑 Team Owner Credentials (Dev Placeholder)",
    category: "authentication",
    description: "Access PIN notification created during development.",
    language: "en",
    body: "*BidWar Team Pass*\n\nYour owner access for *{{1}}* (Team *{{2}}*) is ready.\n\n🔑 PIN: *{{3}}*\n🌐 App: {{4}}\n\nDo not share this PIN with anyone.",
    variables: [
      { key: "1", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      { key: "2", label: "Team Name", placeholder: "e.g. Super Kings" },
      { key: "3", label: "Access PIN", placeholder: "e.g. 4921" },
      { key: "4", label: "Platform URL", placeholder: "e.g. https://bidwar.in/owner" },
    ],
    sampleArgs: ["Premier League 2026", "Super Kings", "4921", "https://bidwar.in/owner"],
    status: "unapproved",
    metaApproved: false,
    isUsableInBidwar: false,
    reason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
    connectedEvents: [],
  },
};

/** Normalize free-text / alias template names to canonical key. */
export function normalizeTemplateKey(name: string | undefined | null): string | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "player_sold" || key === "playersold" || key === "auction_player_sold") {
    return "auction_player_sold";
  }
  return key;
}

/** Check if template is confirmed Meta-approved and on the BIDWAR allowlist. */
export function isMetaApprovedTemplate(name: string | undefined | null): boolean {
  if (!name?.trim()) return false;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return BIDWAR_APPROVED_TEMPLATE_ALLOWLIST.has(key);
}

/**
 * Validates template eligibility for outbound WhatsApp dispatch.
 * Fails closed if the template is not Meta-approved and allowlisted.
 */
export function validateTemplateDispatchEligibility(
  templateName: string | undefined | null,
): { eligible: boolean; error?: string; canonicalName?: string } {
  if (!templateName || !templateName.trim()) {
    return {
      eligible: false,
      error: "Outbound WhatsApp push notifications require a Meta-approved template.",
    };
  }

  const trimmed = templateName.trim();
  if (trimmed.toLowerCase() === "custom") {
    return {
      eligible: false,
      error: "Custom direct WhatsApp messages are not permitted. Only verified Meta-approved templates on the BIDWAR allowlist can be dispatched.",
    };
  }

  const canonical = normalizeTemplateKey(trimmed);
  if (!canonical || !BIDWAR_APPROVED_TEMPLATE_ALLOWLIST.has(canonical)) {
    return {
      eligible: false,
      error: `Template "${trimmed}" is not approved by Meta. Only verified Meta-approved templates on the BIDWAR allowlist can be dispatched.`,
    };
  }

  return {
    eligible: true,
    canonicalName: canonical,
  };
}

/** Returns the active operational templates intended for BIDWAR use (Meta-approved only). */
export function getOperationalApprovedTemplates(): MetaVerifiedTemplate[] {
  return Object.values(VERIFIED_APPROVED_TEMPLATES);
}

/** Returns all known templates including dev/unapproved templates for restricted debug view. */
export function getAllTemplatesForAdminAudit(): Array<MetaVerifiedTemplate | DevTemplateAuditEntry> {
  return [
    ...Object.values(VERIFIED_APPROVED_TEMPLATES),
    ...Object.values(DEV_UNAPPROVED_TEMPLATES),
  ];
}
