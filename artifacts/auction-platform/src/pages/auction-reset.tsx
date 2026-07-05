import { useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useResetTrialAuction, useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { applyAuctionResetState } from "@/lib/sync-auction-sse";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw, ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { resolveReturnPath, returnPathBackLabel } from "@/lib/tournament-navigation";

export default function AuctionReset() {
  const [, params] = useRoute("/tournament/:id/reset");
  const [, navigate] = useLocation();
  const search = useSearch();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const returnParams = new URLSearchParams(search);
  const returnTo = resolveReturnPath(returnParams.get("from"), tournamentId);
  const backLabel = returnPathBackLabel(returnTo);

  const { data: tournament, refetch: refetchTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });

  const resetMut = useResetTrialAuction();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const confirmPhrase = "reset";
  const confirmMatches = confirmText.trim().toLowerCase() === confirmPhrase;

  const resetCount = tournament?.resetCount ?? 0;
  const lastResetAt = tournament?.lastResetAt ? new Date(tournament.lastResetAt) : null;
  const isCompleted = tournament?.status === "completed";

  function goBack() {
    navigate(returnTo);
  }

  async function handleReset() {
    if (isCompleted) {
      setError("This tournament is completed. Auction reset is no longer available from the organizer panel.");
      return;
    }
    if (!confirmMatches) {
      setError(`Type "${confirmPhrase}" in the box below to confirm.`);
      return;
    }
    setError(null);
    try {
      const state = await resetMut.mutateAsync({
        tournamentId,
        data: { password: "", reason: "", resetContext: "organizer" },
      });
      applyAuctionResetState(qc, tournamentId, state);
      setSuccess(true);
      setConfirmText("");
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      await refetchTournament();
    } catch (e: unknown) {
      const err = e as { data?: { error?: string } | null; message?: string };
      const apiMessage =
        err?.data && typeof err.data === "object" && "error" in err.data
          ? (err.data as { error?: string }).error
          : undefined;
      setError(apiMessage || err?.message || "Reset failed.");
      setSuccess(false);
    }
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6 max-w-3xl">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<><RefreshCw className="w-7 h-7 text-red-400 inline-block mr-3 align-middle" />Clear Practice Data</>}
          titleClassName="font-display font-black text-3xl md:text-4xl tracking-tight text-foreground flex items-center gap-3"
          description="Remove practice bids and return players to the pool. Teams and player list stay safe."
          actions={
          <Button variant="ghost" className="gap-2" onClick={goBack}>
            <ArrowLeft className="w-4 h-4" /> {backLabel}
          </Button>
          }
        />

        <Card className="border border-red-500/30 bg-red-500/5">
          <CardContent className="p-5 flex items-start gap-4">
            <ShieldCheck className="w-7 h-7 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h2 className="font-bold text-lg text-red-300">
                {isCompleted ? "Reset unavailable" : "Organizer session verified"}
              </h2>
              {isCompleted ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This tournament is marked as completed. Practice auction data can no longer be cleared from the organizer panel.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    You are signed in as the organizer for this tournament. Confirm below to clear practice auction data.
                    {resetCount > 0 && ` This tournament has been reset ${resetCount} time${resetCount === 1 ? "" : "s"} before.`}
                    {" "}Once the tournament is marked completed, reset will no longer be available from the organizer panel.
                  </p>
                  {lastResetAt && (
                    <p className="text-xs text-muted-foreground/80 pt-1">
                      Last reset on <span className="font-semibold text-foreground/90">{lastResetAt.toLocaleString()}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {!isCompleted && (
        <>
        <Card className="border border-red-500/40 bg-red-500/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-red-300">The following will be permanently erased</h3>
            </div>
            <ul className="text-sm text-red-200/80 space-y-1.5 list-disc list-inside pl-1">
              <li>Every sold / unsold result — all players reset to "Available"</li>
              <li>All bid records and live bid feed history for this tournament</li>
              <li>All AI intelligence data (replay, behavior, demand, and briefing reports)</li>
              <li>All purse usage for every team (back to full purse)</li>
              <li>All active purse boosters (teams return to original purse capacity)</li>
            </ul>
            <p className="text-sm text-muted-foreground pt-1">
              Retained players and their reserved purse amounts will{" "}
              <span className="font-semibold text-foreground">not</span> be affected.
            </p>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wide pt-1">
              This action cannot be undone.
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardContent className="p-5 space-y-4">
            <p className="text-[11px] text-muted-foreground">
              Reset is blocked once the tournament is completed. Each reset is logged automatically with date and time.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-300">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Reset complete. The tournament is now back to setup state.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reset-confirm" className="text-sm">
                Type <span className="font-mono font-semibold text-red-300">reset</span> to confirm
              </Label>
              <Input
                id="reset-confirm"
                value={confirmText}
                onChange={(e) => {
                  setConfirmText(e.target.value);
                  if (error?.includes("Type")) setError(null);
                }}
                placeholder="reset"
                autoComplete="off"
                spellCheck={false}
                disabled={resetMut.isPending || success}
                className="font-mono"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1 bg-red-700 hover:bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)] gap-2"
                disabled={resetMut.isPending || success || !confirmMatches}
                onClick={handleReset}
              >
                <RefreshCw className={`w-4 h-4 ${resetMut.isPending ? "animate-spin" : ""}`} />
                {resetMut.isPending ? "Resetting..." : "Yes, reset everything"}
              </Button>
              <Button variant="outline" onClick={goBack}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
        </>
        )}

        {isCompleted && (
          <div className="flex gap-3">
            <Button variant="outline" onClick={goBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> {backLabel}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
