import { TrialDemoCard } from "@/components/trial-demo/trial-demo-card";
import { useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  Lock,
  Zap,
} from "lucide-react";
import { resolveReturnPath, returnPathBackLabel } from "@/lib/tournament-navigation";

const OPERATIONAL_DATA_ERASED = [
  "Auction bids, current lots, and practice sales history",
  "Team purse usage deductions from test bids",
  "Cricket match scores, ball-by-ball delivery events, and DLS calculations",
  "Badminton game points, set snapshots, and pair standings",
] as const;

const PERMANENT_CONFIGURATION_PRESERVED = [
  "Tournament settings, scoring rules, and presentation profiles",
  "Registered players, master profiles, and registration forms",
  "Teams, owners, purse allocations, and colors",
  "Fixture brackets, draw collections, and court assignments",
  "Retained players and official sponsors",
] as const;

export default function AuctionReset() {
  const [, params] = useRoute("/tournament/:id/reset");
  const [, navigate] = useLocation();
  const search = useSearch();
  const tournamentId = parseInt(params?.id || "0", 10);
  const qc = useQueryClient();

  const returnParams = new URLSearchParams(search);
  const returnTo = resolveReturnPath(returnParams.get("from"), tournamentId);
  const backLabel = returnPathBackLabel(returnTo);

  const { data: tournament, refetch: refetchTournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 5000,
    },
  });

  // State: Reset Data
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // State: Activate Live Modal
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [activateConfirmed, setActivateConfirmed] = useState(false);
  const [activatePending, setActivatePending] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);
  const [activateSuccessMsg, setActivateSuccessMsg] = useState<string | null>(null);

  const confirmPhrase = "reset";
  const confirmMatches = confirmText.trim().toLowerCase() === confirmPhrase;

  const rawOfficialActivatedAt = (tournament as any)?.officialActivatedAt;
  const isOfficiallyActivated = !!rawOfficialActivatedAt;
  const officialActivatedDate = rawOfficialActivatedAt ? new Date(rawOfficialActivatedAt) : null;
  const isCompleted = tournament?.status === "completed";
  const resetCount = tournament?.resetCount ?? 0;
  const lastResetAt = tournament?.lastResetAt ? new Date(tournament.lastResetAt) : null;

  function goBack() {
    navigate(returnTo);
  }

  async function handleResetData() {
    if (isOfficiallyActivated) {
      setResetError("Tournament is officially activated for live production. Reset Data is permanently locked.");
      return;
    }
    if (isCompleted) {
      setResetError("This tournament is completed. Reset Data is no longer available.");
      return;
    }
    if (!confirmMatches) {
      setResetError(`Type "${confirmPhrase}" in the box below to confirm.`);
      return;
    }

    setResetError(null);
    setResetPending(true);

    try {
      const response = await apiFetch(`/tournaments/${tournamentId}/reset-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Organizer unified reset data" }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Reset Data failed");
      }

      setResetSuccess(true);
      setResetSuccessMsg("Reset complete. All practice operational data across enabled modules has been cleared.");
      setConfirmText("");
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      void refetchTournament();
    } catch (e: any) {
      setResetError(e?.message || "Reset Data failed.");
      setResetSuccess(false);
    } finally {
      setResetPending(false);
    }
  }

  async function handleActivateLive() {
    if (!activateConfirmed) {
      setActivateError("Please confirm your understanding before activating live.");
      return;
    }

    setActivateError(null);
    setActivatePending(true);

    try {
      const response = await apiFetch(`/tournaments/${tournamentId}/activate-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: true }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Activate Live failed");
      }

      setActivateSuccess(true);
      setActivateSuccessMsg(body?.message || "Tournament officially activated for live production!");
      setActivateModalOpen(false);
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      void refetchTournament();
    } catch (e: any) {
      setActivateError(e?.message || "Activate Live failed.");
    } finally {
      setActivatePending(false);
    }
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="max-w-3xl space-y-5 pb-8">
        {/* Navigation back and header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-primary shrink-0" aria-hidden />
              Tournament Lifecycle Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {tournament?.name} • Control testing data cleanup and official live transition.
            </p>
          </div>

          <div className="shrink-0">
            {isOfficiallyActivated ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1.5 py-1 px-3">
                <ShieldCheck className="w-4 h-4" />
                Official Live Mode
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1.5 py-1 px-3">
                <RefreshCw className="w-3.5 h-3.5" />
                Trial / Testing Mode
              </Badge>
            )}
          </div>
        </div>

        {/* Global Activation Banner if already officially activated */}
        {isOfficiallyActivated && (
          <Card className="border border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Officially Activated for Live Production
                </p>
                <p className="text-xs text-muted-foreground">
                  Activated on{" "}
                  <span className="font-medium text-foreground">
                    {officialActivatedDate?.toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  . All bids, scores, and match events are recorded as permanent official records.
                  Organizer Reset Data is permanently locked.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── CARD 1: RESET DATA ── */}
        <Card className={`border ${isOfficiallyActivated ? "border-muted bg-muted/20 opacity-80" : "border-red-500/30 bg-red-500/[0.03]"}`}>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <RefreshCw className={`w-5 h-5 ${isOfficiallyActivated ? "text-muted-foreground" : "text-red-500"} shrink-0`} />
                <div>
                  <h2 className="font-semibold text-base text-foreground">
                    Reset Data (Trial Purge)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Clean test bids and practice matches across enabled modules before going live.
                  </p>
                </div>
              </div>

              {isOfficiallyActivated ? (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Lock className="w-3 h-3" />
                  Locked
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Unlimited During Testing
                </Badge>
              )}
            </div>

            {/* Audit stats */}
            <div className="text-xs text-muted-foreground flex items-center gap-3 border-t border-b border-border/50 py-2">
              <span>Resets performed: <strong className="text-foreground">{resetCount}</strong></span>
              {lastResetAt && (
                <span>
                  Last reset:{" "}
                  <strong className="text-foreground">
                    {lastResetAt.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </strong>
                </span>
              )}
            </div>

            {isOfficiallyActivated ? (
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <Lock className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  <strong>Reset Data is permanently unavailable:</strong> This tournament was officially activated.
                  To protect live tournament data and fan records, operational reset is disabled.
                </span>
              </div>
            ) : isCompleted ? (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                This tournament is marked completed. Operational reset is no longer permitted.
              </div>
            ) : (
              <>
                {/* Details of what is erased vs preserved */}
                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 space-y-1.5">
                    <p className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Erased on Reset:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {OPERATIONAL_DATA_ERASED.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Preserved Safely:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      {PERMANENT_CONFIGURATION_PRESERVED.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {resetError && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </div>
                )}

                {resetSuccess && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{resetSuccessMsg}</span>
                  </div>
                )}

                {/* Confirmation input and trigger */}
                <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="reset-confirm" className="text-xs">
                      Type <span className="font-mono font-semibold text-red-500">reset</span> to confirm operational cleanup
                    </Label>
                    <Input
                      id="reset-confirm"
                      value={confirmText}
                      onChange={(e) => {
                        setConfirmText(e.target.value);
                        if (resetError?.includes("Type")) setResetError(null);
                      }}
                      placeholder="reset"
                      disabled={resetPending || resetSuccess}
                      className="font-mono text-sm h-9"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white h-9 px-4 gap-1.5 shrink-0"
                    disabled={resetPending || !confirmMatches}
                    onClick={handleResetData}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resetPending ? "animate-spin" : ""}`} />
                    {resetPending ? "Resetting…" : "Reset Data"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ── CARD 2: ACTIVATE LIVE ── */}
        {!isOfficiallyActivated && (
          <Card className="border border-primary/30 bg-primary/[0.02]">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <h2 className="font-semibold text-base text-foreground">
                      Activate Live (Official Production)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      One-time transition to official live mode. Automatically cleans trial activity and seals records.
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="border-primary/40 text-primary text-xs">
                  One-Time Action
                </Badge>
              </div>

              <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1.5 text-muted-foreground">
                <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Important Transition Warning:
                </p>
                <p>
                  Activating live will automatically purge any remaining trial bids and test matches, then permanently seal
                  the tournament. Once activated, <strong>Reset Data is permanently disabled</strong> for organizers.
                </p>
              </div>

              {activateSuccess && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{activateSuccessMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Ready to host your official live event?
                </p>

                <Button
                  size="sm"
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 px-4"
                  disabled={isCompleted || activatePending}
                  onClick={() => setActivateModalOpen(true)}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Review &amp; Activate Live
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tournament?.licenseStatus === "trial" && (
          <TrialDemoCard
            tournamentId={tournamentId}
            tournament={tournament}
            returnTo={returnTo}
          />
        )}

        {/* Back navigation button */}
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5 h-9">
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Button>
        </div>
      </div>

      {/* ── ACTIVATE LIVE CONFIRMATION MODAL ── */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Zap className="w-5 h-5 text-primary" />
              Activate Official Live Tournament
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review tournament readiness before permanently transitioning to official production.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tournament:</span>
                <span className="font-semibold text-foreground">{tournament?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Sport:</span>
                <span className="font-medium capitalize text-foreground">{tournament?.sport}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Enabled Modules:</span>
                <div className="flex gap-1.5">
                  {tournament?.auctionEnabled && <Badge variant="secondary" className="text-[10px]">Auction</Badge>}
                  {tournament?.scoringEnabled && <Badge variant="secondary" className="text-[10px]">Scoring</Badge>}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <p className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Permanent &amp; Irreversible:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-[11px]">
                <li>All remaining practice bids, test overs, and trial scoring data will be purged.</li>
                <li>Tournament will be permanently sealed as <strong>Official Live</strong>.</li>
                <li>Organizer Reset Data will be <strong>permanently locked</strong>.</li>
              </ul>
            </div>

            <div className="flex items-start gap-2.5 pt-1">
              <Checkbox
                id="activate-agreement"
                checked={activateConfirmed}
                onCheckedChange={(c) => setActivateConfirmed(c === true)}
                className="mt-0.5"
              />
              <Label htmlFor="activate-agreement" className="text-xs leading-snug cursor-pointer select-none">
                I understand this action is permanent and irreversible. All subsequent auction bids and match events are official live records.
              </Label>
            </div>

            {activateError && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-300 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{activateError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActivateModalOpen(false)}
              disabled={activatePending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              disabled={!activateConfirmed || activatePending}
              onClick={handleActivateLive}
            >
              {activatePending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Activating…
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  Confirm &amp; Activate Live
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
