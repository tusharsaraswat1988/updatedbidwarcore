import { TrialDemoCard } from "@/components/trial-demo/trial-demo-card";
import { useState } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useResetTrialAuction, useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { applyAuctionResetState } from "@/lib/sync-auction-sse";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, RefreshCw, ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { resolveReturnPath, returnPathBackLabel } from "@/lib/tournament-navigation";

const PRACTICE_ERASED_ITEMS = [
  "Sold / unsold results — players back to Available",
  "All bids and live feed history",
  "AI reports (replay, behavior, demand, briefing)",
  "Team purse usage and active boosters",
] as const;

const DEMO_ERASED_ITEMS = [
  "Demo teams, players, and their photos",
  "Demo sponsors and logos",
  "Demo categories created for the sample auction",
  "Demo owner access codes and sign-in sessions",
  "Demo bids, sold and unsold results, and feed history",
  "Demo retained-player assignments",
  "Demo auction settings you have not changed since loading",
] as const;

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
  const demoSession = useQuery({
    queryKey: ["auction-demo-session", tournamentId],
    enabled: !!tournamentId,
    queryFn: async () => {
      const response = await apiFetch(`/tournaments/${tournamentId}/auction/demo-session`);
      if (!response.ok) return { loaded: false as const };
      const body = (await response.json()) as { loaded?: boolean };
      return { loaded: body.loaded === true };
    },
  });
  const demoLoaded = demoSession.data?.loaded === true;
  const erasedItems = demoLoaded ? DEMO_ERASED_ITEMS : PRACTICE_ERASED_ITEMS;
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
      const resetMode = (state as { resetMode?: string }).resetMode;
      setSuccessMessage(
        resetMode === "demo"
          ? "Demo data removed. Your original tournament records are still here."
          : "Reset complete. Practice auction activity is cleared.",
      );
      setSuccess(true);
      setConfirmText("");
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: ["auction-demo-session", tournamentId] });
      void refetchTournament();
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
      <div className="max-w-2xl space-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-red-400 shrink-0" aria-hidden />
            {demoLoaded ? "Clear Trial Demo Data" : "Clear Practice Data"}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-snug">
            {demoLoaded
              ? "Removes loaded sample teams, players, sponsors, and demo auction activity. Your original tournament data is preserved."
              : "Removes practice auction activity and resets team purses. Your original tournament data is preserved."}
          </p>
        </div>

        <Card className="border border-red-500/35 bg-red-500/[0.06] overflow-hidden">
          <CardContent className="p-3 sm:p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0 flex-1 text-xs sm:text-sm leading-snug">
                {isCompleted ? (
                  <p className="font-semibold text-red-300">Reset unavailable — tournament is completed.</p>
                ) : (
                  <>
                    <p className="font-semibold text-red-200/95">Organizer verified</p>
                    <p className="text-muted-foreground mt-0.5">
                      {resetCount > 0
                        ? `Reset ${resetCount} time${resetCount === 1 ? "" : "s"} before. `
                        : null}
                      {lastResetAt ? (
                        <>
                          Last:{" "}
                          <span className="text-foreground/90 font-medium">
                            {lastResetAt.toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                          .{" "}
                        </>
                      ) : null}
                      Each reset is logged.
                    </p>
                  </>
                )}
              </div>
            </div>

            {!isCompleted ? (
              <>
                <div className="rounded-md border border-red-500/30 bg-red-950/20 px-3 py-2">
                  <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wide text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Permanently erased
                  </p>
                  <ul className="mt-1.5 grid sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] sm:text-xs text-red-100/75 list-disc list-inside">
                    {erasedItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 leading-snug">
                    {demoLoaded
                      ? "Original teams, players, sponsors, photos, and settings stay. "
                      : "No demo session is loaded, so this only clears practice auction activity. Teams, players, sponsors, and settings stay. Retained players are kept. "}
                    <span className="font-bold text-red-400 uppercase">Cannot be undone.</span>
                  </p>
                </div>

                {error ? (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                    <span>{error}</span>
                  </div>
                ) : null}
                {success ? (
                  <div className="flex items-start gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
                    <span>{successMessage}</span>
                  </div>
                ) : null}

                <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3 pt-0.5">
                  <div className="flex-1 min-w-0 space-y-1">
                    <Label htmlFor="reset-confirm" className="text-xs">
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
                      className="font-mono h-9 text-sm"
                    />
                  </div>
                  <div className="flex gap-2 sm:pb-0.5 shrink-0">
                    <Button
                      size="sm"
                      className="flex-1 sm:flex-none bg-red-700 hover:bg-red-600 text-white border-red-600 gap-1.5 h-9 px-4"
                      disabled={resetMut.isPending || success || !confirmMatches}
                      onClick={handleReset}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${resetMut.isPending ? "animate-spin" : ""}`} aria-hidden />
                      {resetMut.isPending ? "Clearing…" : demoLoaded ? "Clear Trial Demo Data" : "Reset Auction Bids"}
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={goBack}>
                      <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                      {backLabel}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={goBack} className="gap-1.5 h-9">
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden />
                {backLabel}
              </Button>
            )}
          </CardContent>
        </Card>

        {tournament?.licenseStatus === "trial" && !demoLoaded && (
          <TrialDemoCard
            tournamentId={tournamentId}
            tournament={tournament}
            returnTo={returnTo}
          />
        )}
      </div>
    </AppLayout>
  );
}
