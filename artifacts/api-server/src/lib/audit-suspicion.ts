/**
 * Suspicious activity detection framework.
 * Rules are registered here; thresholds/config can move to DB or env later.
 */

import type { AuditEventInput, AuditSeverity } from "./audit-service";
import type { CriticalTag } from "./audit-critical-tags";
import { CRITICAL_TAG } from "./audit-critical-tags";

export type SuspicionSeverity = "low" | "medium" | "high";

export type SuspicionFlag = {
  ruleId: string;
  label: string;
  severity: SuspicionSeverity;
};

export type MonitoringFlags = {
  flags: SuspicionFlag[];
  score: number;
};

export type SuspicionRuleContext = {
  input: AuditEventInput;
  tags: CriticalTag[];
  actorType: string;
  actorIp: string | null;
  occurredAt: Date;
};

export type SuspicionRule = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  defaultSeverity: SuspicionSeverity;
  /** Sync evaluation at write time — no DB lookups. */
  evaluate: (ctx: SuspicionRuleContext) => boolean;
};

/** Registry — add/disable rules without changing audit-service. */
export const SUSPICION_RULES: SuspicionRule[] = [
  {
    id: "auth_denied",
    label: "Failed authentication",
    description: "Login or access verification was denied.",
    enabled: true,
    defaultSeverity: "medium",
    evaluate: (ctx) => ctx.input.outcome === "denied" && ctx.input.category === "auth",
  },
  {
    id: "access_code_denied",
    label: "Team access denied",
    description: "Invalid team owner access code attempt.",
    enabled: true,
    defaultSeverity: "medium",
    evaluate: (ctx) => ctx.input.action === "team.access_code_denied",
  },
  {
    id: "critical_finance_no_context",
    label: "High-risk finance action",
    description: "Purse, manual sell, or undo without stored reason (should be blocked by API).",
    enabled: true,
    defaultSeverity: "high",
    evaluate: (ctx) => {
      const financeTags: CriticalTag[] = [CRITICAL_TAG.PURSE_EDIT, CRITICAL_TAG.MANUAL_SELL, CRITICAL_TAG.UNDO];
      return financeTags.some((t) => ctx.tags.includes(t)) && !ctx.input.reason?.trim();
    },
  },
  {
    id: "high_value_undo",
    label: "High-value undo",
    description: "Undo reversed a sale above the configured threshold.",
    enabled: true,
    defaultSeverity: "high",
    evaluate: (ctx) => {
      if (ctx.input.action !== "auction.undo") return false;
      const amount = Number((ctx.input.metadata as { amount?: number } | null)?.amount ?? 0);
      return amount >= HIGH_VALUE_UNDO_THRESHOLD;
    },
  },
  {
    id: "license_change",
    label: "Licence status change",
    description: "Tournament licence was granted, revoked, or switched.",
    enabled: true,
    defaultSeverity: "medium",
    evaluate: (ctx) => ctx.tags.includes(CRITICAL_TAG.LICENSE_CHANGE),
  },
  {
    id: "tournament_config_change",
    label: "Tournament rules changed",
    description: "Auction configuration fields were modified.",
    enabled: true,
    defaultSeverity: "medium",
    evaluate: (ctx) => ctx.tags.includes(CRITICAL_TAG.TOURNAMENT_CONFIG),
  },
  {
    id: "data_reset",
    label: "Practice data reset",
    description: "Auction trial/practice data was cleared.",
    enabled: true,
    defaultSeverity: "high",
    evaluate: (ctx) => ctx.tags.includes(CRITICAL_TAG.DATA_RESET),
  },
  {
    id: "after_hours_critical",
    label: "After-hours critical action",
    description: "Critical action performed outside typical operating hours (IST).",
    enabled: true,
    defaultSeverity: "low",
    evaluate: (ctx) => {
      if (ctx.input.severity !== "critical") return false;
      const hourIst = (ctx.occurredAt.getUTCHours() + 5.5 + 24) % 24;
      return hourIst < 6 || hourIst >= 23;
    },
  },
  {
    id: "public_actor_critical",
    label: "Unauthenticated critical action",
    description: "Critical event attributed to a public/unknown actor.",
    enabled: true,
    defaultSeverity: "high",
    evaluate: (ctx) =>
      ctx.input.severity === "critical" &&
      (ctx.actorType === "public" || ctx.actorType === "seed_key"),
  },
];

/** Rules evaluated at feed read time using recent DB context. */
export const ASYNC_SUSPICION_RULES = [
  {
    id: "critical_burst_ip",
    label: "Critical action burst (same IP)",
    description: "More than N critical events from one IP within a short window.",
    enabled: true,
    defaultSeverity: "high" as SuspicionSeverity,
    windowMinutes: 10,
    threshold: 4,
  },
  {
    id: "auth_failure_burst_ip",
    label: "Auth failure burst (same IP)",
    description: "Multiple failed auth attempts from one IP.",
    enabled: true,
    defaultSeverity: "high" as SuspicionSeverity,
    windowMinutes: 15,
    threshold: 5,
  },
] as const;

export const HIGH_VALUE_UNDO_THRESHOLD = 5_000_000;

const SEVERITY_SCORE: Record<SuspicionSeverity, number> = {
  low: 1,
  medium: 3,
  high: 8,
};

export function evaluateStaticSuspicion(ctx: SuspicionRuleContext): MonitoringFlags {
  const flags: SuspicionFlag[] = [];

  for (const rule of SUSPICION_RULES) {
    if (!rule.enabled) continue;
    try {
      if (rule.evaluate(ctx)) {
        flags.push({
          ruleId: rule.id,
          label: rule.label,
          severity: rule.defaultSeverity,
        });
      }
    } catch {
      // Rule errors must not break audit writes
    }
  }

  const score = flags.reduce((sum, f) => sum + SEVERITY_SCORE[f.severity], 0);
  return { flags, score };
}

export function mergeMonitoringFlags(
  base: MonitoringFlags,
  extra: SuspicionFlag[],
): MonitoringFlags {
  const seen = new Set(base.flags.map((f) => f.ruleId));
  const flags = [...base.flags];
  for (const f of extra) {
    if (!seen.has(f.ruleId)) {
      flags.push(f);
      seen.add(f.ruleId);
    }
  }
  const score = flags.reduce((sum, f) => sum + SEVERITY_SCORE[f.severity], 0);
  return { flags, score };
}

export function getSuspicionRulesCatalog() {
  return {
    syncRules: SUSPICION_RULES.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      enabled: r.enabled,
      defaultSeverity: r.defaultSeverity,
      phase: "write" as const,
    })),
    asyncRules: ASYNC_SUSPICION_RULES.map((r) => ({
      id: r.id,
      label: r.label,
      description: r.description,
      enabled: r.enabled,
      defaultSeverity: r.defaultSeverity,
      phase: "enrichment" as const,
      windowMinutes: r.windowMinutes,
      threshold: r.threshold,
    })),
  };
}
