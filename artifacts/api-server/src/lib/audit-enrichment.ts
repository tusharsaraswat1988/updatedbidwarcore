import { db } from "@workspace/db";
import { platformAuditEventsTable } from "@workspace/db";
import { and, eq, gte, sql, or } from "drizzle-orm";
import type { MonitoringFlags, SuspicionFlag } from "./audit-suspicion";
import { ASYNC_SUSPICION_RULES, mergeMonitoringFlags } from "./audit-suspicion";

export async function enrichMonitoringFlagsAsync(
  base: MonitoringFlags,
  actorIp: string | null,
  tournamentId: number | null,
): Promise<MonitoringFlags> {
  const extra: SuspicionFlag[] = [];
  const since = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000);

  if (actorIp) {
    const criticalBurst = ASYNC_SUSPICION_RULES.find((r) => r.id === "critical_burst_ip");
    if (criticalBurst?.enabled) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(platformAuditEventsTable)
        .where(
          and(
            eq(platformAuditEventsTable.actorIp, actorIp),
            eq(platformAuditEventsTable.eventSeverity, "critical"),
            gte(platformAuditEventsTable.occurredAt, since(criticalBurst.windowMinutes)),
          ),
        );
      if ((row?.count ?? 0) >= criticalBurst.threshold) {
        extra.push({
          ruleId: criticalBurst.id,
          label: criticalBurst.label,
          severity: criticalBurst.defaultSeverity,
        });
      }
    }

    const authBurst = ASYNC_SUSPICION_RULES.find((r) => r.id === "auth_failure_burst_ip");
    if (authBurst?.enabled) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(platformAuditEventsTable)
        .where(
          and(
            eq(platformAuditEventsTable.actorIp, actorIp),
            gte(platformAuditEventsTable.occurredAt, since(authBurst.windowMinutes)),
            or(
              eq(platformAuditEventsTable.outcome, "denied"),
              sql`${platformAuditEventsTable.eventAction} LIKE '%_failed'`,
            ),
          ),
        );
      if ((row?.count ?? 0) >= authBurst.threshold) {
        extra.push({
          ruleId: authBurst.id,
          label: authBurst.label,
          severity: authBurst.defaultSeverity,
        });
      }
    }
  }

  if (tournamentId != null) {
    const [recentCritical] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(platformAuditEventsTable)
      .where(
        and(
          eq(platformAuditEventsTable.tournamentId, tournamentId),
          eq(platformAuditEventsTable.eventSeverity, "critical"),
          gte(platformAuditEventsTable.occurredAt, since(5)),
        ),
      );
    if ((recentCritical?.count ?? 0) >= 6) {
      extra.push({
        ruleId: "tournament_critical_burst",
        label: "Tournament critical burst",
        severity: "medium",
      });
    }
  }

  return extra.length > 0 ? mergeMonitoringFlags(base, extra) : base;
}
