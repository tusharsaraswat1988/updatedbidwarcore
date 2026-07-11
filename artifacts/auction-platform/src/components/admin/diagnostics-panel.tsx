import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, RefreshCw } from "lucide-react";

type DiagnosticsPayload = {
  ok: true;
  capturedAt: string;
  environment: "local" | "staging" | "production" | "unknown";
  build: {
    commitSha: string | null;
    commitShaShort: string | null;
    buildTimestamp: string | null;
    source: string;
    gitBranch: string | null;
  };
  database: {
    hostMasked: string;
    databaseName: string;
    sslModePresent: boolean;
  };
  startup: {
    ready: boolean;
    reason?: string;
    systemC: {
      executionTimeMs: number;
      queryBatches: number;
      failures: number;
      createStatements: number;
      alterStatements: number;
      createIndexStatements: number;
      dropStatements: number;
      dmlStatements: number;
    } | null;
    systemD: {
      executionTimeMs: number;
      queryCount: number;
      success: boolean;
      failure: boolean;
    } | null;
    totalDatabaseBootTimeMs: number | null;
    startupDdlBatches: number | null;
    startupFailures: number | null;
  };
  process: {
    serverStartTime: string;
    uptimeSeconds: number;
    uptimeHuman: string;
    pid: number;
    nodeVersion: string;
    nodeEnv: string;
    gitBranch: string | null;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
  };
  eventLoopDelayMs: null;
  redis: {
    configured: boolean;
    status: string;
    initAttempted: boolean;
    commandClientStatus: string | null;
    subscriberClientStatus: string | null;
  };
  sse: {
    status: string;
    auctionClients: number;
    scoringClients: number;
    badmintonClients: number;
    totalClients: number;
  };
  databaseConnection: {
    status: string;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
};

function envBadgeClass(env: DiagnosticsPayload["environment"]): string {
  switch (env) {
    case "production":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    case "staging":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    case "local":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function formatMs(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value} ms`;
}

function MetricRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/60 py-2.5 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`font-mono text-sm ${emphasize ? "font-semibold text-destructive" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}

export function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/auth/admin/diagnostics/startup", { credentials: "include" });
      const body = (await r.json()) as DiagnosticsPayload & { error?: string };
      if (!r.ok) {
        throw new Error(body.error ?? `Failed to load diagnostics (${r.status})`);
      }
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copyJson = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading diagnostics…
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Startup Diagnostics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Read-only view of this server process. Does not re-run database startup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-1.5">Refresh</span>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void copyJson()} disabled={!data}>
            <Copy className="h-4 w-4" />
            <span className="ml-1.5">{copied ? "Copied" : "Copy JSON"}</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-medium uppercase tracking-wide ${envBadgeClass(data.environment)}`}
            >
              {data.environment}
            </span>
            <span className="text-xs text-muted-foreground">
              Captured {new Date(data.capturedAt).toLocaleString()}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Build</h3>
              <MetricRow label="Commit SHA" value={data.build.commitShaShort ?? data.build.commitSha ?? "unknown"} />
              {data.build.commitSha ? (
                <p className="mb-2 break-all font-mono text-[11px] text-muted-foreground">{data.build.commitSha}</p>
              ) : null}
              <MetricRow label="Git branch" value={data.build.gitBranch ?? "unknown"} />
              <MetricRow label="Build timestamp" value={data.build.buildTimestamp ?? "unknown"} />
              <MetricRow label="Source" value={data.build.source} />
            </section>

            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Process</h3>
              <MetricRow label="Server start time" value={new Date(data.process.serverStartTime).toLocaleString()} />
              <MetricRow label="Current uptime" value={data.process.uptimeHuman} />
              <MetricRow label="Process PID" value={String(data.process.pid)} />
              <MetricRow label="Node version" value={data.process.nodeVersion} />
              <MetricRow label="NODE_ENV" value={data.process.nodeEnv} />
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Memory</h3>
              <MetricRow label="RSS" value={`${data.memory.rssMb} MB`} />
              <MetricRow label="Heap used" value={`${data.memory.heapUsedMb} MB`} />
              <MetricRow label="Heap total" value={`${data.memory.heapTotalMb} MB`} />
            </section>

            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Infrastructure</h3>
              <MetricRow label="Redis status" value={data.redis.status} />
              <MetricRow label="Redis configured" value={data.redis.configured ? "yes" : "no"} />
              <MetricRow label="SSE status" value={data.sse.status} />
              <MetricRow label="SSE clients (total)" value={String(data.sse.totalClients)} />
              <MetricRow
                label="SSE breakdown"
                value={`auction ${data.sse.auctionClients} · scoring ${data.sse.scoringClients} · badminton ${data.sse.badmintonClients}`}
              />
              <MetricRow label="Database connection" value={data.databaseConnection.status} />
              <MetricRow
                label="Pool (total/idle/waiting)"
                value={`${data.databaseConnection.totalCount}/${data.databaseConnection.idleCount}/${data.databaseConnection.waitingCount}`}
              />
              <MetricRow label="Event loop delay" value="not instrumented" />
            </section>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Database identity</h3>
              <MetricRow label="Host (masked)" value={data.database.hostMasked} />
              <MetricRow label="Database name" value={data.database.databaseName} />
              <MetricRow label="SSL mode present" value={data.database.sslModePresent ? "yes" : "no"} />
            </section>

            <section className="rounded-lg border border-border bg-background/50 p-4">
              <h3 className="mb-2 text-sm font-medium text-foreground">Database startup</h3>
              {!data.startup.ready ? (
                <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  {data.startup.reason ?? "Boot metrics still settling — refresh in a few seconds."}
                </p>
              ) : null}
              <MetricRow label="System C execution time" value={formatMs(data.startup.systemC?.executionTimeMs)} />
              <MetricRow label="System D execution time" value={formatMs(data.startup.systemD?.executionTimeMs)} />
              <MetricRow label="Total database boot time" value={formatMs(data.startup.totalDatabaseBootTimeMs)} />
              <MetricRow
                label="Startup DDL batches"
                value={data.startup.startupDdlBatches != null ? String(data.startup.startupDdlBatches) : "—"}
              />
              <MetricRow
                label="Startup failures"
                value={data.startup.startupFailures != null ? String(data.startup.startupFailures) : "—"}
                emphasize={(data.startup.startupFailures ?? 0) > 0}
              />
            </section>
          </div>

          {data.startup.systemC ? (
            <details className="rounded-lg border border-border bg-background/50 p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">System C statement breakdown</summary>
              <div className="mt-2">
                <MetricRow label="Query batches" value={String(data.startup.systemC.queryBatches)} />
                <MetricRow label="CREATE TABLE" value={String(data.startup.systemC.createStatements)} />
                <MetricRow label="ALTER TABLE" value={String(data.startup.systemC.alterStatements)} />
                <MetricRow label="CREATE INDEX" value={String(data.startup.systemC.createIndexStatements)} />
                <MetricRow label="DROP" value={String(data.startup.systemC.dropStatements)} />
                <MetricRow label="DML" value={String(data.startup.systemC.dmlStatements)} />
                <MetricRow label="Failures" value={String(data.startup.systemC.failures)} />
              </div>
            </details>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Metrics for this server instance only. Pool status is in-memory (no DB query). Event loop delay is skipped (not instrumented).
          </p>
        </>
      ) : null}
    </div>
  );
}
