/**
 * Cricket Scorer Home Portal
 * Route: /cricket/scorer?tid={tournamentId}
 *
 * Scorer signs in with registered Mobile + 4-digit PIN.
 * Shows all live and scheduled cricket matches for the tournament.
 */
import { useEffect, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import {
  getCricketMasterTeams,
  listScoringMatches,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import {
  getScorerAuthSession,
  setScorerAuthSession,
  clearScorerAuthSession,
  getScorerSavedTournamentId,
  setScorerSavedTournamentId,
} from "@/lib/badminton-scorer-session";
import { loginScorer, logoutScorer } from "@/lib/scorer-api";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";
import { cricketScorerConsolePath, cricketScorerPath } from "@/lib/cricket-routes";
import { CricketPublicBrandMark } from "@/components/scoring/cricket-branding";
import { ScorerPwaInstallBanner } from "@/components/scoring/scorer-pwa-install-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Play,
  RefreshCw,
  Smartphone,
  Trophy,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketScorerHomePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);
  const tidFromQuery = parseInt(searchParams.get("tid") ?? "0", 10);

  const [session, setSession] = useState(() => getScorerAuthSession());
  const savedTid = session?.tournamentId || getScorerSavedTournamentId();
  const effectiveTid = tidFromQuery > 0 ? tidFromQuery : savedTid;

  const [tournamentIdInput, setTournamentIdInput] = useState(
    effectiveTid > 0 ? String(effectiveTid) : "",
  );
  const tournamentId =
    tidFromQuery > 0 ? tidFromQuery : parseInt(tournamentIdInput || "0", 10) || (savedTid > 0 ? savedTid : 0);

  const [mobileInput, setMobileInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (tidFromQuery > 0) {
      setScorerSavedTournamentId(tidFromQuery);
    }
  }, [tidFromQuery]);

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(
    tournamentId > 0 ? tournamentId : 0,
    {
      query: {
        queryKey: getGetTournamentQueryKey(tournamentId),
        enabled: tournamentId > 0,
      },
    },
  );

  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ["cricket-scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0 && !!session,
    refetchInterval: 10_000,
  });

  const { data: masterTeams = [] } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0 && !!session,
  });

  const teams = masterTeams.map(cricketMasterTeamToScorerTeam);

  useEffect(() => {
    const sync = () => {
      const current = getScorerAuthSession();
      if (current) {
        setSession(current);
        if (current.tournamentId && !tournamentIdInput && !tidFromQuery) {
          setTournamentIdInput(String(current.tournamentId));
        }
      }
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [tournamentIdInput, tidFromQuery]);

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!tournamentId) {
      setAuthError("Enter a valid Tournament ID or use the link sent by your organizer");
      return;
    }
    const cleanMobile = mobileInput.replace(/\D/g, "").slice(-10);
    if (cleanMobile.length < 10) {
      setAuthError("Enter a valid 10-digit registered mobile number");
      return;
    }
    if (pinInput.trim().length < 4) {
      setAuthError("Enter your 4-digit PIN");
      return;
    }

    setVerifying(true);
    setAuthError("");
    try {
      const login = await loginScorer(cleanMobile, pinInput.trim());
      const authPayload = {
        token: login.token,
        scorer: {
          id: login.scorer.id,
          name: login.scorer.name,
          mobile: login.scorer.mobile,
          isActive: login.canScore ?? login.scorer.isActive !== false,
        },
        canScore: login.canScore ?? login.scorer.isActive !== false,
        expiresAt: login.expiresAt,
        tournamentId,
      };
      setScorerAuthSession(authPayload);
      setScorerSavedTournamentId(tournamentId);
      setSession(getScorerAuthSession());
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Authentication failed. Check your mobile number and PIN.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleLogout() {
    if (session?.token) {
      try {
        await logoutScorer(session.token);
      } catch {
        // non-fatal
      }
    }
    clearScorerAuthSession();
    setSession(null);
    setPinInput("");
    setAuthError("");
  }

  function handleOpenScoring(match: ScoringMatchJson) {
    navigate(cricketScorerConsolePath(tournamentId, match.id));
  }

  const liveMatches = (matches as ScoringMatchJson[]).filter((m: ScoringMatchJson) => m.status === "live");
  const scheduledMatches = (matches as ScoringMatchJson[]).filter((m: ScoringMatchJson) => m.status === "scheduled");
  const completedMatches = (matches as ScoringMatchJson[]).filter((m: ScoringMatchJson) => m.status === "completed" || m.status === "abandoned");

  // ─── LOGIN SCREEN ───
  if (!session) {
    return (
      <div className="min-h-[100dvh] bg-[#070b19] text-white flex flex-col justify-center px-4 py-8">
        <div className="max-w-sm w-full mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-3">
              <CricketPublicBrandMark variant="scorer-bar" className="h-8" />
            </div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-1">
              <KeyRound className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black font-display tracking-wide text-white">Official Scorer Portal</h1>
            <p className="text-xs text-white/50">
              Sign in with your registered mobile and 4-digit PIN to score matches.
            </p>
          </div>

          <ScorerPwaInstallBanner />

          <form onSubmit={handleLogin} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6 space-y-4 shadow-xl backdrop-blur-md">
            {tidFromQuery <= 0 ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider">
                  Tournament ID
                </label>
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={tournamentIdInput}
                  onChange={(e) => setTournamentIdInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 25"
                  className="bg-white/5 border-white/15 text-white font-mono text-center h-12 text-lg"
                  required
                />
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">
                Tournament: <span className="font-bold text-white">{tournament?.name || `#${tournamentId}`}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                Mobile Number
              </label>
              <Input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={mobileInput}
                onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="bg-white/5 border-white/15 text-white font-mono text-center h-12 text-lg tracking-wider"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  4-Digit PIN
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="text-[11px] text-amber-400/80 hover:text-amber-400 flex items-center gap-1 font-normal lowercase tracking-normal"
                >
                  {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showPin ? "hide" : "show"}
                </button>
              </label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="••••"
                  maxLength={8}
                  className="bg-white/5 border-white/15 text-white font-mono text-center h-12 text-2xl tracking-widest pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-1"
                  title={showPin ? "Hide PIN" : "Show PIN"}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authError ? (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200 text-center font-medium">
                {authError}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={verifying}
              className="w-full h-12 text-base font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20"
            >
              {verifying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Sign In & Open Scorer"
              )}
            </Button>
          </form>

          <p className="text-[11px] text-center text-white/40">
            Don't have a PIN? Contact the tournament organizer to get registered as an official scorer.
          </p>
        </div>
      </div>
    );
  }

  // ─── AUTHENTICATED MATCH SELECTION HUB ───
  return (
    <div className="min-h-[100dvh] bg-[#070b19] text-white flex flex-col">
      {/* Top Scorer App Header */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b19]/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CricketPublicBrandMark variant="scorer-bar" className="h-7 shrink-0" />
            <div className="h-4 w-px bg-white/20 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  {tournament?.name || `Tournament #${tournamentId}`}
                </span>
              </div>
              <p className="text-sm font-bold text-white truncate flex items-center gap-1.5 mt-0.5">
                <User className="w-3.5 h-3.5 text-white/60" />
                {session.scorer.name}
                {session.canScore ? (
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                    Active Scorer
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold bg-white/10 text-white/60 px-1.5 py-0.5 rounded">
                    View-only
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/60 hover:text-white"
              onClick={() => void refetchMatches()}
              title="Refresh matches"
            >
              <RefreshCw className={cn("w-4 h-4", matchesLoading && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold border-white/15 text-white/80 hover:text-white hover:bg-white/10 gap-1.5"
              onClick={() => void handleLogout()}
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content: Match Lists */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-3 sm:px-6 py-4 space-y-6 pb-12">
        <ScorerPwaInstallBanner />

        {/* Section: Live Matches */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block" />
              Live Matches ({liveMatches.length})
            </h2>
          </div>

          {liveMatches.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-white/40">
              No live cricket matches right now.
            </div>
          ) : (
            <div className="space-y-3">
              {liveMatches.map((m) => {
                const home = teams.find((t) => t.id === m.homeTeamId);
                const away = teams.find((t) => t.id === m.awayTeamId);
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-red-500/40 bg-red-500/[0.07] p-4 sm:p-5 space-y-3 shadow-lg ring-1 ring-red-500/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white/60 uppercase tracking-wide">
                        {m.roundName || `Match #${m.tournamentMatchNumber ?? m.id}`}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500 text-white flex items-center gap-1">
                        <Activity className="w-3 h-3 animate-pulse" />
                        LIVE SCORING
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-base sm:text-lg font-black text-white truncate">
                          {home?.name || "Team A"}
                        </p>
                        <p className="text-xs text-white/60 font-medium">
                          {home?.shortCode || "T1"}
                        </p>
                      </div>
                      <div className="text-xs font-bold text-amber-400 px-2 py-1 rounded bg-black/40 border border-white/10 shrink-0">
                        VS
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-base sm:text-lg font-black text-white truncate">
                          {away?.name || "Team B"}
                        </p>
                        <p className="text-xs text-white/60 font-medium">
                          {away?.shortCode || "T2"}
                        </p>
                      </div>
                    </div>

                    {m.venue ? (
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {m.venue}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full h-12 bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-wide shadow-md gap-2"
                      onClick={() => handleOpenScoring(m)}
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Resume Live Scoring
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Scheduled Matches */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Scheduled Matches ({scheduledMatches.length})
            </h2>
          </div>

          {scheduledMatches.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-center text-xs text-white/40">
              No upcoming scheduled matches found.
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledMatches.map((m) => {
                const home = teams.find((t) => t.id === m.homeTeamId);
                const away = teams.find((t) => t.id === m.awayTeamId);
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] hover:border-amber-500/40 p-4 sm:p-5 space-y-3 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-white/50 uppercase tracking-wide">
                        {m.roundName || `Match #${m.tournamentMatchNumber ?? m.id}`}
                      </span>
                      {m.scheduledAt ? (
                        <span className="text-xs text-amber-300 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(m.scheduledAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-4 py-1">
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-white truncate">
                          {home?.name || "Team A"}
                        </p>
                        <p className="text-xs text-white/50">{home?.shortCode || "T1"}</p>
                      </div>
                      <div className="text-xs font-semibold text-white/40 shrink-0">vs</div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-base font-bold text-white truncate">
                          {away?.name || "Team B"}
                        </p>
                        <p className="text-xs text-white/50">{away?.shortCode || "T2"}</p>
                      </div>
                    </div>

                    {m.venue ? (
                      <p className="text-xs text-white/50 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {m.venue}
                      </p>
                    ) : null}

                    <Button
                      type="button"
                      className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm tracking-wide gap-2"
                      onClick={() => handleOpenScoring(m)}
                    >
                      Start Scoring
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Completed Matches */}
        {completedMatches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Completed Matches ({completedMatches.length})
            </h2>

            <div className="space-y-2.5">
              {completedMatches.map((m) => {
                const home = teams.find((t) => t.id === m.homeTeamId);
                const away = teams.find((t) => t.id === m.awayTeamId);
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-bold text-white/90 truncate">
                        {home?.shortCode || "T1"} vs {away?.shortCode || "T2"}
                      </p>
                      <p className="text-emerald-400 font-medium truncate">
                        {m.resultSummary || "Match Completed"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs border-white/10 text-white/80 hover:bg-white/10 shrink-0"
                      onClick={() => handleOpenScoring(m)}
                    >
                      View Result
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
