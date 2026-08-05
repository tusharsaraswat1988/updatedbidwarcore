import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  Loader2,
  Swords,
} from "lucide-react";

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};

type MatchIdentity = {
  id: string;
  tournamentId: number;
  typeId: string;
};

type MatchConfiguration = {
  matchId: string;
  name: string;
  displayName: string;
  typeId: string;
  venue: string | null;
  locked: boolean;
  planVersion: number | null;
};

type MatchLifecycle = {
  status: string;
  locked: boolean;
};

type MatchValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  readiness: string;
};

type MatchSide = {
  sideId: string;
  subject: { kind: string; displayName: string } | null;
};

type MatchRow = {
  identity: MatchIdentity;
  configuration: MatchConfiguration;
  lifecycle: MatchLifecycle;
  validation: MatchValidation;
  sides: MatchSide[];
  officialCount: number;
};

type MatchSetupCardProps = {
  tournamentId: number;
};

export function MatchSetupCard({ tournamentId }: MatchSetupCardProps) {
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/matches/identities`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load matches");
      }
      const { identities } = (await idRes.json()) as { identities: MatchIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const base = `/tournaments/${tournamentId}/matches/${identity.id}`;
          const [configRes, sidesRes, officialsRes, validationRes, lifecycleRes] =
            await Promise.all([
              apiFetch(`${base}/configuration`),
              apiFetch(`${base}/sides`),
              apiFetch(`${base}/officials`),
              apiFetch(`${base}/validation`),
              apiFetch(`${base}/lifecycle`),
            ]);
          if (
            !configRes.ok ||
            !sidesRes.ok ||
            !officialsRes.ok ||
            !validationRes.ok ||
            !lifecycleRes.ok
          ) {
            throw new Error(`Failed to load match ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: MatchConfiguration;
          };
          const { sides } = (await sidesRes.json()) as { sides: MatchSide[] };
          const { officials } = (await officialsRes.json()) as { officials: unknown[] };
          const { validation } = (await validationRes.json()) as {
            validation: MatchValidation;
          };
          const { lifecycle } = (await lifecycleRes.json()) as {
            lifecycle: MatchLifecycle;
          };
          return {
            identity,
            configuration,
            lifecycle,
            validation,
            sides,
            officialCount: officials.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Match Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(matchId: string) {
    setLockingId(matchId);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/matches/${matchId}/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Match Setup");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lock failed");
    } finally {
      setLockingId(null);
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="org-surface-rail p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="org-surface-rail p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-display font-bold flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" /> Match Setup
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure and lock each Match identity — no scoring, broadcast, or fixtures.
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
          No matches yet. Create matches in scoring or badminton runtime, then lock configuration
          here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            const sideLabel = row.sides
              .map((s) => s.subject?.displayName ?? `${s.sideId} (empty)`)
              .join(" vs ");
            return (
              <li
                key={row.identity.id}
                className="rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.configuration.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.configuration.typeId} · lifecycle {row.lifecycle.status}
                      {row.configuration.venue ? ` · ${row.configuration.venue}` : ""}
                      {row.configuration.planVersion
                        ? ` · v${row.configuration.planVersion}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                      locked
                        ? "border-green-500/30 bg-green-500/10 text-green-400"
                        : row.validation.errorCount > 0
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-500"
                    }`}
                  >
                    {locked
                      ? "Locked"
                      : row.validation.readiness === "ready"
                        ? "Ready"
                        : row.validation.readiness === "almost_ready"
                          ? "Almost Ready"
                          : "Not Ready"}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground truncate">
                  Sides: {sideLabel} · {row.officialCount} official
                  {row.officialCount === 1 ? "" : "s"}
                </p>

                {row.validation.issues.length > 0 ? (
                  <ul className="space-y-1">
                    {row.validation.issues.slice(0, 4).map((issue) => (
                      <li
                        key={`${row.identity.id}-${issue.code}-${issue.message}`}
                        className="flex items-start gap-2 text-xs"
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

                {!locked ? (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-10"
                    disabled={!canLock || lockingId === row.identity.id}
                    onClick={() => void handleLock(row.identity.id)}
                  >
                    {lockingId === row.identity.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Locking…
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Match Setup
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Configuration frozen. Score and events are not stored here.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
