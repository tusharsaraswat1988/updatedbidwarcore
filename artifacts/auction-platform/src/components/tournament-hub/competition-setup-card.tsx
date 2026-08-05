import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, Info, Lock, Loader2 } from "lucide-react";

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};

type CompetitionAggregate = {
  plan: { version: number } | null;
  configuration: {
    registrationModeId: string | null;
    teamFormationStrategyId: string | null;
    competitionTypeId: string | null;
    businessStageId: string;
    locked: boolean;
  };
  validation: {
    issues: ValidationIssue[];
    errorCount: number;
    warningCount: number;
    readiness: string;
  };
  summary: {
    status: {
      readiness: string;
      locked: boolean;
      blockingIssueCount: number;
      warningCount: number;
      recommendations: string[];
      businessStageId: string;
    };
    participantCount: number;
  };
};

type CompetitionSetupCardProps = {
  tournamentId: number;
};

export function CompetitionSetupCard({ tournamentId }: CompetitionSetupCardProps) {
  const [data, setData] = useState<CompetitionAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load competition");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load competition");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock() {
    setLocking(true);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/competition/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Competition Setup");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLocking(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="org-surface-rail p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="org-surface-rail p-5">
        <p className="text-sm text-destructive">{error || "Competition Setup unavailable"}</p>
      </div>
    );
  }

  const { summary, validation, configuration, plan } = data;
  const locked = summary.status.locked || !!plan;
  const canLock = !locked && validation.errorCount === 0;

  const readinessLabel =
    locked
      ? "Configuration Locked"
      : summary.status.readiness === "ready"
        ? "Ready"
        : summary.status.readiness === "almost_ready"
          ? "Almost Ready"
          : "Not Ready";

  return (
    <div className="org-surface-rail p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> Competition Setup
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure and lock how this competition runs — before draws and fixtures.
          </p>
        </div>
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-md border ${
            locked
              ? "border-green-500/30 bg-green-500/10 text-green-400"
              : validation.errorCount > 0
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-amber-500/30 bg-amber-500/10 text-amber-500"
          }`}
        >
          {readinessLabel}
        </span>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <InfoRow label="Competition Type" value={configuration.competitionTypeId ?? "—"} />
        <InfoRow label="Registration Mode" value={configuration.registrationModeId ?? "—"} />
        <InfoRow
          label="Team Formation"
          value={configuration.teamFormationStrategyId ?? "—"}
        />
        <InfoRow label="Participants" value={String(summary.participantCount)} />
        {plan ? <InfoRow label="Plan Version" value={`v${plan.version}`} /> : null}
      </div>

      {validation.issues.length > 0 ? (
        <ul className="space-y-1.5">
          {validation.issues.slice(0, 8).map((issue) => (
            <li
              key={`${issue.code}-${issue.message}`}
              className="flex items-start gap-2 text-xs rounded-md border border-border/50 px-2.5 py-2"
            >
              {issue.severity === "ERROR" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
              ) : issue.severity === "WARNING" ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              ) : (
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <span>
                <span className="font-medium">{issue.severity}</span> — {issue.message}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
          No validation issues
        </p>
      )}

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {!locked ? (
        <Button
          type="button"
          className="min-h-12 w-full sm:w-auto"
          disabled={!canLock || locking}
          onClick={() => void handleLock()}
        >
          {locking ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking…
            </>
          ) : (
            "Lock Competition Setup"
          )}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Competition Plan is frozen. Re-freeze is not available in this release.
        </p>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  );
}
