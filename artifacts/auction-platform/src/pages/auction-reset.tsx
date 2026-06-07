import { useState } from "react";
import { useRoute } from "wouter";
import { useResetTrialAuction, useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ShieldAlert, CheckCircle2, ArrowLeft, ShieldCheck, Lock } from "lucide-react";
import { openAuctionRoom } from "@/lib/tournament-navigation";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";

export default function AuctionReset() {
  const [, params] = useRoute("/tournament/:id/reset");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const { data: tournament, refetch: refetchTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });

  const resetMut = useResetTrialAuction();
  const [password, setPassword] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetCount = tournament?.resetCount ?? 0;
  const isFirstReset = resetCount === 0;
  const lastResetAt = tournament?.lastResetAt ? new Date(tournament.lastResetAt) : null;
  const lastResetBy = tournament?.lastResetBy;

  async function handleReset() {
    if (!password.trim()) {
      setError("Please enter the required password.");
      return;
    }
    if (!isAuditReasonValid(auditReason)) {
      setError("A reason is required for clearing practice data (minimum 10 characters).");
      return;
    }
    setError(null);
    try {
      await resetMut.mutateAsync({ tournamentId, data: { password, reason: auditReason.trim() } });
      setSuccess(true);
      setPassword("");
      qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
      await refetchTournament();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string }; status?: number }; message?: string };
      setError(err?.response?.data?.error || err?.message || "Reset failed.");
      setSuccess(false);
    }
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight text-foreground flex items-center gap-3">
              <RefreshCw className="w-7 h-7 text-red-400" />
              Clear Practice Data
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Remove practice bids and return players to the pool. Teams and player list stay safe.
            </p>
          </div>
          <Button variant="ghost" className="gap-2" onClick={() => openAuctionRoom(tournamentId)}>
            <ArrowLeft className="w-4 h-4" /> Back to Auction Room
          </Button>
        </div>

        {/* Status banner */}
        <Card className={`border ${isFirstReset ? "border-red-500/30 bg-red-500/5" : "border-purple-500/30 bg-purple-500/5"}`}>
          <CardContent className="p-5 flex items-start gap-4">
            {isFirstReset ? (
              <ShieldCheck className="w-7 h-7 text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <ShieldAlert className="w-7 h-7 text-purple-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <h2 className={`font-bold text-lg ${isFirstReset ? "text-red-300" : "text-purple-300"}`}>
                {isFirstReset
                  ? "First reset — operator password required"
                  : `Already reset ${resetCount} time${resetCount === 1 ? "" : "s"} — platform authorization required`}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {isFirstReset
                  ? "An operator can reset the auction once using the tournament's organizer password. After that, platform-level authorization is required."
                  : "This tournament has already been reset. To run another reset you must provide the platform authorization password."}
              </p>
              {lastResetAt && (
                <p className="text-xs text-muted-foreground/80 pt-1">
                  Last reset on <span className="font-semibold text-foreground/90">{lastResetAt.toLocaleString()}</span>
                  {lastResetBy && <> by <span className="font-semibold text-foreground/90">{lastResetBy === "super_admin" ? "Platform" : "Operator"}</span></>}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Warning panel — same content the dialog used to show */}
        <Card className="border border-red-500/40 bg-red-500/5">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="font-bold text-red-300">The following will be permanently erased</h3>
            </div>
            <ul className="text-sm text-red-200/80 space-y-1.5 list-disc list-inside pl-1">
              <li>Every sold / unsold result — all players reset to "Available"</li>
              <li>All bid records for this tournament</li>
              <li>All purse usage for every team (back to full purse)</li>
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

        {/* Confirm panel */}
        <Card className="border border-border">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password" className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                {isFirstReset ? "Operator password" : "Authorization password"}
              </Label>
              <Input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null); setSuccess(false); }}
                placeholder={isFirstReset ? "Enter the organizer password for this tournament" : "Enter the authorization password"}
                className="bg-card border-border"
                autoComplete="current-password"
              />
            </div>

            <AuditReasonField
              value={auditReason}
              onChange={setAuditReason}
              placeholder="Explain why practice auction data is being cleared…"
            />

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

            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1 bg-red-700 hover:bg-red-600 text-white border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.3)] gap-2"
                disabled={resetMut.isPending || !password.trim() || !isAuditReasonValid(auditReason)}
                onClick={handleReset}
              >
                <RefreshCw className={`w-4 h-4 ${resetMut.isPending ? "animate-spin" : ""}`} />
                {resetMut.isPending ? "Resetting..." : "Yes, reset everything"}
              </Button>
              <Button variant="outline" onClick={() => openAuctionRoom(tournamentId)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
