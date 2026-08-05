import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  PlayCircle,
} from "lucide-react";

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};

type RuntimeListItem = {
  identity: { id: string; tournamentId: number; typeId: string };
  executionPhase: string;
  currentRuntimeVersion: number | null;
  matchLifecycleStatus: string;
};

type RuntimeValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  readiness: string;
};

type RuntimeSnapshot = {
  snapshotVersion: number;
  snapshotSchemaVersion: string;
  createdAt: string;
  createdBy: string | null;
  references: {
    ruleProfile: { id: string; version: number | string | null } | null;
    fixture: { id: string; version: number | string | null } | null;
    schedulingPlan: { id: string; version: number | string | null } | null;
    matchConfiguration: { id: string; version: number | string | null } | null;
    sides: readonly { id: string }[];
  };
};

type RuntimeRow = {
  list: RuntimeListItem;
  validation: RuntimeValidation;
  snapshot: RuntimeSnapshot | null;
};

type RuntimePreparationCardProps = {
  tournamentId: number;
};

function checklist(validation: RuntimeValidation, snapshot: RuntimeSnapshot | null) {
  const codes = new Set(validation.issues.filter((i) => i.severity === "ERROR").map((i) => i.code));
  return [
    {
      label: "Competition Ready",
      ok: !codes.has("COMPETITION_NOT_READY") && !codes.has("COMPETITION_STATE_UNKNOWN"),
    },
    {
      label: "Fixture Ready",
      ok: !codes.has("FIXTURE_NOT_READY"),
    },
    {
      label: "Scheduling Ready",
      ok: !codes.has("SCHEDULING_NOT_READY") && !codes.has("RESOURCE_ASSIGNMENT_NOT_LOCKED"),
    },
    {
      label: "Locked Match Configuration",
      ok: !codes.has("MATCH_CONFIGURATION_NOT_LOCKED"),
    },
    {
      label: "Locked Rule / Presentation Profiles",
      ok:
        !codes.has("RULE_PROFILE_NOT_LOCKED") &&
        !codes.has("PRESENTATION_PROFILE_NOT_LOCKED"),
    },
    {
      label: "Runtime Snapshot frozen",
      ok: snapshot != null,
    },
  ];
}

export function RuntimePreparationCard({ tournamentId }: RuntimePreparationCardProps) {
  const [rows, setRows] = useState<RuntimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const listRes = await apiFetch(`/tournaments/${tournamentId}/runtime-matches`);
      if (!listRes.ok) {
        const body = await listRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load runtime matches");
      }
      const { runtimeMatches } = (await listRes.json()) as {
        runtimeMatches: RuntimeListItem[];
      };

      const loaded = await Promise.all(
        runtimeMatches.map(async (list) => {
          const base = `/tournaments/${tournamentId}/runtime-matches/${list.identity.id}`;
          const [validationRes, snapshotRes] = await Promise.all([
            apiFetch(`${base}/validation`),
            apiFetch(`${base}/snapshot`),
          ]);
          if (!validationRes.ok || !snapshotRes.ok) {
            throw new Error(`Failed to load runtime match ${list.identity.id}`);
          }
          const { validation } = (await validationRes.json()) as {
            validation: RuntimeValidation;
          };
          const { snapshot } = (await snapshotRes.json()) as {
            snapshot: RuntimeSnapshot | null;
          };
          return { list, validation, snapshot };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Runtime Preparation");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePrepare(matchId: string) {
    setBusyId(matchId);
    setError("");
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/runtime-matches/${matchId}/prepare`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Prepare failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReady(matchId: string) {
    setBusyId(matchId);
    setError("");
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/runtime-matches/${matchId}/ready`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Ready request failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ready request failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="org-surface-rail p-5 space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="org-surface-rail p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" /> Runtime Preparation
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Freeze the execution contract for each Match — no scoring, broadcast, or statistics.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches yet. Create matches first, then prepare their Runtime Snapshot.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ list, validation, snapshot }) => {
            const items = checklist(validation, snapshot);
            const busy = busyId === list.identity.id;
            return (
              <li
                key={list.identity.id}
                className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      Match #{list.identity.id}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({list.identity.typeId})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lifecycle: {list.matchLifecycleStatus} · Phase: {list.executionPhase}
                      {list.currentRuntimeVersion != null
                        ? ` · Snapshot v${list.currentRuntimeVersion}`
                        : " · No snapshot"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {validation.readiness === "ready" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : validation.errorCount > 0 ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span className="capitalize">{validation.readiness.replace(/_/g, " ")}</span>
                  </div>
                </div>

                {snapshot ? (
                  <div className="text-xs text-muted-foreground space-y-0.5 rounded-md bg-muted/40 px-2.5 py-2">
                    <p>
                      Snapshot v{snapshot.snapshotVersion} · schema{" "}
                      {snapshot.snapshotSchemaVersion}
                    </p>
                    <p>
                      Frozen {new Date(snapshot.createdAt).toLocaleString()}
                      {snapshot.createdBy ? ` by ${snapshot.createdBy}` : ""}
                    </p>
                    <p>
                      Refs: config v{snapshot.references.matchConfiguration?.version ?? "—"}
                      {snapshot.references.fixture
                        ? ` · fixture ${snapshot.references.fixture.id}`
                        : ""}
                      {snapshot.references.sides?.length
                        ? ` · ${snapshot.references.sides.length} sides`
                        : ""}
                    </p>
                  </div>
                ) : null}

                <ul className="grid gap-1 sm:grid-cols-2">
                  {items.map((item) => (
                    <li key={item.label} className="flex items-center gap-1.5 text-xs">
                      {item.ok ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                      )}
                      {item.label}
                    </li>
                  ))}
                </ul>

                {validation.issues.length > 0 ? (
                  <ul className="space-y-1">
                    {validation.issues.slice(0, 4).map((issue) => (
                      <li key={`${issue.code}-${issue.message}`} className="text-xs text-muted-foreground">
                        [{issue.severity}] {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || validation.errorCount > 0}
                    onClick={() => void handlePrepare(list.identity.id)}
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                    Prepare (freeze snapshot)
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || list.currentRuntimeVersion == null}
                    onClick={() => void handleReady(list.identity.id)}
                  >
                    Request Ready
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
