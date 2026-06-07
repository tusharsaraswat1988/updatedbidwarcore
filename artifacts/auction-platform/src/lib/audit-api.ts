export type MonitoringFlags = {
  flags: Array<{ ruleId: string; label: string; severity: "low" | "medium" | "high" }>;
  score: number;
};

export type AuditEventRecord = {
  id: number;
  occurredAt: string;
  eventCategory: string;
  eventAction: string;
  eventSeverity: string;
  outcome: string;
  actorType: string;
  actorLabel: string | null;
  actorIp: string | null;
  tournamentId: number | null;
  teamId: number | null;
  playerId: number | null;
  summary: string;
  reason: string | null;
  alertKey: string | null;
  criticalTags: string[];
  monitoringFlags: MonitoringFlags | null;
  metadata: Record<string, unknown> | null;
  changes: Array<{ field: string; old: unknown; new: unknown }> | null;
};

export type AuditFeedResponse = {
  recentActivity: AuditEventRecord[];
  criticalHighlights: AuditEventRecord[];
  suspiciousActivity: AuditEventRecord[];
  stats: {
    critical24h: number;
    denied24h: number;
    suspicious24h: number;
    withReason24h: number;
  };
  tagBreakdown: Array<{ tag: string; label: string; count: number }>;
  generatedAt: string;
};

export const CRITICAL_TAG_LABELS: Record<string, string> = {
  purse_edit: "Purse edit",
  manual_sell: "Manual sell",
  undo: "Undo",
  re_auction: "Re-auction",
  owner_change: "Owner change",
  license_change: "Licence change",
  tournament_config: "Tournament config",
  player_critical: "Player edit",
  category_config: "Category config",
  data_reset: "Data reset",
  auth_failure: "Auth failure",
  access_denied: "Access denied",
  admin_action: "Admin action",
  auction_control: "Auction control",
  finance: "Finance",
};

export async function fetchAuditFeed(): Promise<AuditFeedResponse | null> {
  try {
    const res = await fetch("/api/auth/admin/audit/feed", { credentials: "include" });
    if (!res.ok) return null;
    return res.json() as Promise<AuditFeedResponse>;
  } catch {
    return null;
  }
}
