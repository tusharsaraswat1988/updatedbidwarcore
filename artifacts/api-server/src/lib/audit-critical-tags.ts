import type { AuditEventInput } from "./audit-service";

/** Operational tags for monitoring feeds, filters, and alert routing. */
export const CRITICAL_TAG = {
  PURSE_EDIT: "purse_edit",
  MANUAL_SELL: "manual_sell",
  UNDO: "undo",
  RE_AUCTION: "re_auction",
  OWNER_CHANGE: "owner_change",
  LICENSE_CHANGE: "license_change",
  TOURNAMENT_CONFIG: "tournament_config",
  PLAYER_CRITICAL: "player_critical",
  CATEGORY_CONFIG: "category_config",
  DATA_RESET: "data_reset",
  AUTH_FAILURE: "auth_failure",
  ACCESS_DENIED: "access_denied",
  ADMIN_ACTION: "admin_action",
  AUCTION_CONTROL: "auction_control",
  FINANCE: "finance",
} as const;

export type CriticalTag = (typeof CRITICAL_TAG)[keyof typeof CRITICAL_TAG];

const ACTION_TAGS: Record<string, CriticalTag[]> = {
  "team.purse_updated": [CRITICAL_TAG.PURSE_EDIT, CRITICAL_TAG.FINANCE],
  "team.owner_changed": [CRITICAL_TAG.OWNER_CHANGE],
  "team.access_code_regenerated": [CRITICAL_TAG.OWNER_CHANGE, CRITICAL_TAG.ADMIN_ACTION],
  "auction.manual_sell": [CRITICAL_TAG.MANUAL_SELL, CRITICAL_TAG.FINANCE, CRITICAL_TAG.AUCTION_CONTROL],
  "auction.undo": [CRITICAL_TAG.UNDO, CRITICAL_TAG.FINANCE, CRITICAL_TAG.AUCTION_CONTROL],
  "auction.reauction": [CRITICAL_TAG.RE_AUCTION, CRITICAL_TAG.AUCTION_CONTROL],
  "auction.reauction_all_unsold": [CRITICAL_TAG.RE_AUCTION, CRITICAL_TAG.AUCTION_CONTROL],
  "auction.reset_trial": [CRITICAL_TAG.DATA_RESET, CRITICAL_TAG.AUCTION_CONTROL],
  "tournament.config_updated": [CRITICAL_TAG.TOURNAMENT_CONFIG],
  "tournament.license_granted": [CRITICAL_TAG.LICENSE_CHANGE, CRITICAL_TAG.ADMIN_ACTION],
  "tournament.license_revoked": [CRITICAL_TAG.LICENSE_CHANGE, CRITICAL_TAG.ADMIN_ACTION],
  "tournament.license_status_set": [CRITICAL_TAG.LICENSE_CHANGE, CRITICAL_TAG.ADMIN_ACTION],
  "player.updated": [CRITICAL_TAG.PLAYER_CRITICAL],
  "category.config_updated": [CRITICAL_TAG.CATEGORY_CONFIG, CRITICAL_TAG.TOURNAMENT_CONFIG],
  "auth.admin_login_failed": [CRITICAL_TAG.AUTH_FAILURE],
  "auth.tournament_organizer_login_failed": [CRITICAL_TAG.AUTH_FAILURE],
  "team.access_code_denied": [CRITICAL_TAG.ACCESS_DENIED, CRITICAL_TAG.AUTH_FAILURE],
};

const ALERT_KEY_TAGS: Record<string, CriticalTag[]> = {
  purse_manual_edit: [CRITICAL_TAG.PURSE_EDIT],
  auction_manual_sell: [CRITICAL_TAG.MANUAL_SELL],
  auction_undo: [CRITICAL_TAG.UNDO],
  license_granted: [CRITICAL_TAG.LICENSE_CHANGE],
  license_revoked: [CRITICAL_TAG.LICENSE_CHANGE],
  tournament_config_changed: [CRITICAL_TAG.TOURNAMENT_CONFIG],
  player_critical_edit: [CRITICAL_TAG.PLAYER_CRITICAL],
  category_config_changed: [CRITICAL_TAG.CATEGORY_CONFIG],
};

export const CRITICAL_TAG_LABELS: Record<CriticalTag, string> = {
  [CRITICAL_TAG.PURSE_EDIT]: "Purse edit",
  [CRITICAL_TAG.MANUAL_SELL]: "Manual sell",
  [CRITICAL_TAG.UNDO]: "Undo",
  [CRITICAL_TAG.RE_AUCTION]: "Re-auction",
  [CRITICAL_TAG.OWNER_CHANGE]: "Owner change",
  [CRITICAL_TAG.LICENSE_CHANGE]: "Licence change",
  [CRITICAL_TAG.TOURNAMENT_CONFIG]: "Tournament config",
  [CRITICAL_TAG.PLAYER_CRITICAL]: "Player edit",
  [CRITICAL_TAG.CATEGORY_CONFIG]: "Category config",
  [CRITICAL_TAG.DATA_RESET]: "Data reset",
  [CRITICAL_TAG.AUTH_FAILURE]: "Auth failure",
  [CRITICAL_TAG.ACCESS_DENIED]: "Access denied",
  [CRITICAL_TAG.ADMIN_ACTION]: "Admin action",
  [CRITICAL_TAG.AUCTION_CONTROL]: "Auction control",
  [CRITICAL_TAG.FINANCE]: "Finance",
};

export function resolveCriticalTags(input: AuditEventInput): CriticalTag[] {
  const tags = new Set<CriticalTag>();

  for (const t of ACTION_TAGS[input.action] ?? []) tags.add(t);
  if (input.alertKey) {
    for (const t of ALERT_KEY_TAGS[input.alertKey] ?? []) tags.add(t);
  }
  if (input.outcome === "denied") tags.add(CRITICAL_TAG.ACCESS_DENIED);
  if (input.severity === "critical" && input.category === "auth" && input.action.includes("failed")) {
    tags.add(CRITICAL_TAG.AUTH_FAILURE);
  }

  return [...tags];
}

export function isOperationalTag(tag: string): tag is CriticalTag {
  return Object.values(CRITICAL_TAG).includes(tag as CriticalTag);
}
