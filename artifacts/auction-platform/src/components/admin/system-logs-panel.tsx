import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  Tag,
} from "lucide-react";
import { CRITICAL_TAG_LABELS } from "@/lib/audit-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ADMIN_FLEX_SCROLL_CLASS } from "@/components/admin/admin-scroll-panel";
import { useAdminAuth } from "@/hooks/use-auth";

interface AuditEvent {
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
  metadata: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changes: Array<{ field: string; old: unknown; new: unknown }> | null;
  alertKey: string | null;
  criticalTags: string[];
  monitoringFlags: {
    flags: Array<{ ruleId: string; label: string; severity: string }>;
    score: number;
  } | null;
  source: string;
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-red-500/20 text-red-300 border-red-500/30";
  if (severity === "warning") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-muted/30 text-muted-foreground border-border";
}

function EventRow({ event, expanded, onToggle }: {
  event: AuditEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasDetail = !!(event.reason || event.changes?.length || event.before || event.after);
  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        type="button"
        onClick={hasDetail ? onToggle : undefined}
        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${hasDetail ? "hover:bg-accent/40 cursor-pointer" : "cursor-default"}`}
      >
        <div className="mt-0.5 text-muted-foreground">
          {hasDetail ? (expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="inline-block w-4" />}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {new Date(event.occurredAt).toLocaleString()}
            </span>
            <Badge variant="outline" className={`text-[10px] uppercase ${severityClass(event.eventSeverity)}`}>
              {event.eventSeverity}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {event.eventCategory}
            </Badge>
            {event.alertKey && (
              <Badge variant="outline" className="gap-1 text-[10px] text-amber-400 border-amber-500/40">
                <AlertTriangle className="h-3 w-3" />
                {event.alertKey}
              </Badge>
            )}
            {event.criticalTags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="gap-1 text-[10px] border-primary/30 text-primary">
                <Tag className="h-3 w-3" />
                {CRITICAL_TAG_LABELS[tag] ?? tag}
              </Badge>
            ))}
            {(event.monitoringFlags?.score ?? 0) >= 3 && (
              <Badge variant="outline" className="gap-1 text-[10px] text-orange-300 border-orange-500/40">
                <ShieldAlert className="h-3 w-3" />
                Suspicious · {event.monitoringFlags?.score}
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{event.summary}</p>
          <p className="text-xs text-muted-foreground">
            {event.actorLabel ?? event.actorType}
            {event.tournamentId ? ` · Tournament #${event.tournamentId}` : ""}
            {event.actorIp ? ` · ${event.actorIp}` : ""}
          </p>
          {event.reason && !expanded && (
            <p className="text-xs italic text-muted-foreground/80 truncate">Reason: {event.reason}</p>
          )}
        </div>
        <code className="hidden shrink-0 text-[10px] text-muted-foreground sm:block">{event.eventAction}</code>
      </button>
      {expanded && hasDetail && (
        <div className="space-y-3 border-t border-border/40 bg-muted/10 px-4 py-3 text-xs">
          {event.reason && (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Reason</div>
              <p className="rounded-md border border-border bg-card/50 p-2 text-foreground">{event.reason}</p>
            </div>
          )}
          {event.monitoringFlags?.flags?.length ? (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Suspicion flags</div>
              <div className="flex flex-wrap gap-1.5">
                {event.monitoringFlags.flags.map((f) => (
                  <Badge key={f.ruleId} variant="outline" className="text-[10px]">
                    {f.label} ({f.severity})
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          {event.changes && event.changes.length > 0 && (
            <div>
              <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Changes</div>
              <div className="space-y-1 rounded-md border border-border bg-card/50 p-2">
                {event.changes.map((c) => (
                  <div key={c.field} className="font-mono">
                    <span className="text-primary">{c.field}</span>: {JSON.stringify(c.old)} → {JSON.stringify(c.new)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {(event.before || event.after) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {event.before && (
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">Before</div>
                  <pre className="max-h-40 overflow-auto rounded-md border border-border bg-card/50 p-2 text-[10px]">{JSON.stringify(event.before, null, 2)}</pre>
                </div>
              )}
              {event.after && (
                <div>
                  <div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">After</div>
                  <pre className="max-h-40 overflow-auto rounded-md border border-border bg-card/50 p-2 text-[10px]">{JSON.stringify(event.after, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SystemLogsPanel() {
  const { isMaster } = useAdminAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [severity, setSeverity] = useState("all");
  const [tournamentId, setTournamentId] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);
      if (severity !== "all") params.set("severity", severity);
      if (tournamentId.trim()) params.set("tournamentId", tournamentId.trim());
      const res = await fetch(`/api/auth/admin/audit/events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { events: AuditEvent[]; total: number };
      setEvents(data.events);
      setTotal(data.total);
    } catch {
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, category, severity, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/admin/audit/meta", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { categories?: string[] }) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  function exportCsv() {
    const params = new URLSearchParams();
    if (tournamentId.trim()) params.set("tournamentId", tournamentId.trim());
    window.open(`/api/auth/admin/audit/export?${params}`, "_blank");
  }

  return (
    <div className="flex h-[min(80vh,720px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <ScrollText className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Platform Audit Logs</h2>
          <p className="text-xs text-muted-foreground">
            Append-only investigation trail · {total} events
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        {isMaster && (
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search summary, reason, actor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
        <Input
          placeholder="Tournament ID"
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
          className="h-9 w-28"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-9 w-36">
            <Filter className="mr-1 h-3.5 w-3.5" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severity</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="h-9" onClick={() => void load()}>Apply</Button>
      </div>

      <div className={ADMIN_FLEX_SCROLL_CLASS}>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
            <ScrollText className="h-8 w-8 opacity-40" />
            <p className="text-sm">No audit events yet. Actions will appear here as they occur.</p>
          </div>
        ) : (
          events.map((event) => (
            <EventRow
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
            />
          ))
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Audit logs are append-only and cannot be edited or deleted from this UI.
      </div>
    </div>
  );
}
