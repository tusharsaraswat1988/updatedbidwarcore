import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  Loader2,
  Users,
} from "lucide-react";

type ValidationIssue = {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
};

type TeamIdentity = {
  id: string;
  tournamentId: number;
  typeId: string;
  masterTeamId: string | null;
};

type TeamConfiguration = {
  teamId: string;
  name: string;
  displayName: string;
  shortName: string;
  typeId: string;
  status: string;
  locked: boolean;
  planVersion: number | null;
};

type TeamValidation = {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  readiness: string;
};

type TeamRow = {
  identity: TeamIdentity;
  configuration: TeamConfiguration;
  validation: TeamValidation;
  memberCount: number;
};

type TeamSetupCardProps = {
  tournamentId: number;
};

export function TeamSetupCard({ tournamentId }: TeamSetupCardProps) {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lockingId, setLockingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const idRes = await apiFetch(`/tournaments/${tournamentId}/teams/identities`);
      if (!idRes.ok) {
        const body = await idRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load teams");
      }
      const { identities } = (await idRes.json()) as { identities: TeamIdentity[] };

      const loaded = await Promise.all(
        identities.map(async (identity) => {
          const [configRes, membersRes, validationRes] = await Promise.all([
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/configuration`),
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/members`),
            apiFetch(`/tournaments/${tournamentId}/teams/${identity.id}/validation`),
          ]);
          if (!configRes.ok || !membersRes.ok || !validationRes.ok) {
            throw new Error(`Failed to load team ${identity.id}`);
          }
          const { configuration } = (await configRes.json()) as {
            configuration: TeamConfiguration;
          };
          const { members } = (await membersRes.json()) as { members: unknown[] };
          const { validation } = (await validationRes.json()) as {
            validation: TeamValidation;
          };
          return {
            identity,
            configuration,
            validation,
            memberCount: members.length,
          };
        }),
      );
      setRows(loaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Team Setup");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLock(teamId: string) {
    setLockingId(teamId);
    setError("");
    try {
      const res = await apiFetch(`/tournaments/${tournamentId}/teams/${teamId}/ready`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Could not lock Team Setup");
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
            <Users className="w-4 h-4 text-primary" /> Team Setup
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure and lock each Team identity — branding and lifecycle only.
          </p>
        </div>
        <Link
          href={`/tournament/${tournamentId}/teams`}
          className="text-xs font-medium text-primary hover:underline shrink-0"
        >
          Manage teams
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No teams yet. Create teams first, then return here to lock configuration.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const locked = row.configuration.locked;
            const canLock = !locked && row.validation.errorCount === 0;
            return (
              <li
                key={row.identity.id}
                className="rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.configuration.displayName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.configuration.shortName} · {row.configuration.typeId} ·{" "}
                      {row.configuration.status}
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

                <p className="text-xs text-muted-foreground">
                  {row.memberCount} membership relationship
                  {row.memberCount === 1 ? "" : "s"} (identity is independent)
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
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Team Setup
                      </>
                    )}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Configuration frozen. Roster history is not stored here.
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
