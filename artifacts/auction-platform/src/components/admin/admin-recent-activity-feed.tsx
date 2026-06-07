import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AuditEventRecord,
  AuditFeedResponse,
  CRITICAL_TAG_LABELS,
  fetchAuditFeed,
} from "@/lib/audit-api";

function severityClass(severity: string) {
  if (severity === "critical") return "bg-red-500/15 text-red-300 border-red-500/30";
  if (severity === "warning") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-muted/30 text-muted-foreground border-border";
}

function FeedEventRow({ event, showSuspicion }: { event: AuditEventRecord; showSuspicion?: boolean }) {
  const suspicionScore = event.monitoringFlags?.score ?? 0;
  return (
    <div className="px-4 py-3 hover:bg-accent/30 transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[10px] text-muted-foreground">
          {new Date(event.occurredAt).toLocaleString()}
        </span>
        <Badge variant="outline" className={`text-[10px] uppercase ${severityClass(event.eventSeverity)}`}>
          {event.eventSeverity}
        </Badge>
        {event.criticalTags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
            <Tag className="h-2.5 w-2.5" />
            {CRITICAL_TAG_LABELS[tag] ?? tag}
          </Badge>
        ))}
        {showSuspicion && suspicionScore >= 3 && (
          <Badge variant="outline" className="text-[10px] gap-1 border-orange-500/40 text-orange-300">
            <ShieldAlert className="h-2.5 w-2.5" />
            Suspicious · {suspicionScore}
          </Badge>
        )}
      </div>
      <p className="text-sm font-medium text-foreground leading-snug">{event.summary}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {event.actorLabel ?? event.actorType}
        {event.tournamentId ? ` · T#${event.tournamentId}` : ""}
        {event.reason ? " · reason logged" : ""}
      </p>
      {event.monitoringFlags?.flags?.length && showSuspicion ? (
        <p className="text-[10px] text-orange-300/80 mt-1">
          {event.monitoringFlags.flags.map((f) => f.label).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  const cls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-300"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-border bg-muted/20 text-muted-foreground";
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${cls}`}>
      <div className="text-lg font-black tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

export function AdminRecentActivityFeed() {
  const [feed, setFeed] = useState<AuditFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchAuditFeed();
    setFeed(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  if (loading && !feed) {
    return (
      <div className="rounded-xl border border-border bg-card/70 p-4 space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const stats = feed?.stats ?? { critical24h: 0, denied24h: 0, suspicious24h: 0, withReason24h: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill label="Critical 24h" value={stats.critical24h} tone={stats.critical24h > 0 ? "danger" : undefined} />
        <StatPill label="Denied 24h" value={stats.denied24h} tone={stats.denied24h > 0 ? "warn" : undefined} />
        <StatPill label="Suspicious 24h" value={stats.suspicious24h} tone={stats.suspicious24h > 0 ? "warn" : undefined} />
        <StatPill label="With reason 24h" value={stats.withReason24h} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/70 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="font-display text-base font-black text-white flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" />
                Recent Activity
              </h2>
              <p className="text-xs text-muted-foreground">Live platform audit trail</p>
            </div>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
            {feed?.recentActivity.length ? (
              feed.recentActivity.map((e) => <FeedEventRow key={e.id} event={e} />)
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">No audit events yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
            <div className="border-b border-red-500/20 px-4 py-3">
              <h2 className="font-display text-base font-black text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Critical Events
              </h2>
            </div>
            <div className="divide-y divide-border/60 max-h-[200px] overflow-y-auto">
              {feed?.criticalHighlights.length ? (
                feed.criticalHighlights.slice(0, 6).map((e) => <FeedEventRow key={e.id} event={e} />)
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">No critical events recorded.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 overflow-hidden">
            <div className="border-b border-orange-500/20 px-4 py-3">
              <h2 className="font-display text-base font-black text-orange-300 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" />
                Suspicious Activity
              </h2>
              <p className="text-[10px] text-muted-foreground mt-0.5">Rule-based flags · configurable later</p>
            </div>
            <div className="divide-y divide-border/60 max-h-[200px] overflow-y-auto">
              {feed?.suspiciousActivity.length ? (
                feed.suspiciousActivity.slice(0, 6).map((e) => (
                  <FeedEventRow key={e.id} event={e} showSuspicion />
                ))
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">No suspicious patterns in the last 24h.</p>
              )}
            </div>
          </div>

          {feed?.tagBreakdown?.length ? (
            <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Top tags (24h)</p>
              <div className="flex flex-wrap gap-2">
                {feed.tagBreakdown.map((t) => (
                  <Badge key={t.tag} variant="outline" className="text-[10px]">
                    {t.label} · {t.count}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border bg-card/50 px-4 py-2 text-xs text-muted-foreground">
        <span>Append-only audit log · no edits or deletes from UI</span>
        <Link href="/admin/settings/system/audit-logs" className="text-primary hover:underline font-medium">
          Open full audit logs →
        </Link>
      </div>
    </div>
  );
}
