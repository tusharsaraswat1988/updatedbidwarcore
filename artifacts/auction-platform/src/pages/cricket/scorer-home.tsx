/**
 * Cricket Scorer Home Portal
 * Route: /cricket/scorer?tid={tournamentId}
 *
 * Scorer signs in with registered Mobile + 4-digit PIN.
 * Shows all live and scheduled cricket matches for the tournament.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import {
  getCricketMasterTeams,
  getScoringStandings,
  listScoringMatches,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import {
  cricketGroupChoices,
  legacyRoundGroupLabels,
  matchMatchesLegacyGroupLabel,
  resolvedMatchGroupId,
  usesLegacyGroupNameFilter,
} from "@workspace/scoring-core/cricket";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import {
  getScorerAuthSession,
  setScorerAuthSession,
  clearScorerAuthSession,
  getScorerSavedTournamentId,
  setScorerSavedTournamentId,
} from "@/lib/badminton-scorer-session";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { loginScorer, logoutScorer, type ScorerAssignedTournament, type ScorerLoginResult } from "@/lib/scorer-api";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";
import { cricketScorerConsolePath, cricketScorerHomePath } from "@/lib/cricket-routes";
import { CricketPublicBrandMark } from "@/components/scoring/cricket-branding";
import { ScorerPwaInstallBanner } from "@/components/scoring/scorer-pwa-install-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronDown,
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
  Search,
  ShieldAlert,
  Smartphone,
  Trophy,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatMatchDateTime(iso: string | null | undefined): string {
  if (!iso) return "Date & Time TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date & Time TBD";
  const dateStr = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const timeStr = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} · ${timeStr}`;
}

function cleanRoundLabel(roundName: string | null | undefined, tournamentName?: string): string {
  if (!roundName) return "";
  let cleaned = roundName;
  if (tournamentName) {
    cleaned = cleaned.replace(new RegExp(tournamentName, "gi"), "");
  }
  cleaned = cleaned.replace(/^[\s·\-_/]+|[\s·\-_/]+$/g, "").trim();
  return cleaned || roundName;
}

function getMatchEffectiveStatus(m: ScoringMatchJson): string {
  const sessionStatus = (m.stateJson as { matchStatus?: string } | null)?.matchStatus;
  if (sessionStatus === "completed" || sessionStatus === "abandoned") return sessionStatus;
  return m.status;
}

function sortMatchesChronologically(list: ScoringMatchJson[]): ScoringMatchJson[] {
  return [...list].sort((a, b) => {
    // 1. Live matches first
    const aLive = getMatchEffectiveStatus(a) === "live";
    const bLive = getMatchEffectiveStatus(b) === "live";
    if (aLive && !bLive) return -1;
    if (bLive && !aLive) return 1;

    // 2. Completed matches: latest completed first
    const aCompleted = getMatchEffectiveStatus(a) === "completed" || getMatchEffectiveStatus(a) === "abandoned";
    const bCompleted = getMatchEffectiveStatus(b) === "completed" || getMatchEffectiveStatus(b) === "abandoned";
    if (aCompleted && bCompleted) {
      const timeA = new Date(a.completedAt || a.scheduledAt || 0).getTime();
      const timeB = new Date(b.completedAt || b.scheduledAt || 0).getTime();
      return timeB - timeA;
    }

    // 3. Scheduled matches: earliest date first
    const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    if (timeA && timeB && timeA !== timeB) {
      return timeA - timeB;
    }
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // 4. Fallback: match number ascending
    const numA = a.tournamentMatchNumber ?? a.id;
    const numB = b.tournamentMatchNumber ?? b.id;
    return numA - numB;
  });
}

export default function CricketScorerHomePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);
  const tidFromQuery = parseInt(searchParams.get("tid") ?? "0", 10);

  const [session, setSession] = useState(() => getScorerAuthSession());
  const [showTournamentPicker, setShowTournamentPicker] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<ScorerLoginResult | null>(null);
  const savedTid = session?.tournamentId || getScorerSavedTournamentId();
  const effectiveTid = tidFromQuery > 0 ? tidFromQuery : savedTid;

  const [activeTab, setActiveTab] = useState<"all" | "live" | "scheduled" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const isUnassignedToCurrentTournament = Boolean(
    session?.tournaments &&
      session.tournaments.length > 0 &&
      tournamentId > 0 &&
      !session.tournaments.some((t) => t.id === tournamentId),
  );

  const { data: matches = [], isLoading: matchesLoading, refetch: refetchMatches } = useQuery({
    queryKey: ["cricket-scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0 && !!session && !isUnassignedToCurrentTournament,
    refetchInterval: 10_000,
  });

  const { data: masterTeams = [] } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0 && !!session && !isUnassignedToCurrentTournament,
  });

  const teams = useMemo(() => masterTeams.map(cricketMasterTeamToScorerTeam), [masterTeams]);
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0 && !!session && !isUnassignedToCurrentTournament,
  });
  const groupChoices = useMemo(
    () => cricketGroupChoices(standings?.groups ?? []),
    [standings?.groups],
  );
  const legacyGroupLabels = useMemo(() => {
    const allowed = usesLegacyGroupNameFilter({
      groupCount: groupChoices.length,
      drawIds: (matches as ScoringMatchJson[]).map((match) => match.drawId),
    });
    return allowed ? legacyRoundGroupLabels(matches as ScoringMatchJson[]) : [];
  }, [groupChoices.length, matches]);

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

  function selectTournamentAndCompleteLogin(loginData: ScorerLoginResult, targetTid: number) {
    const authPayload = {
      token: loginData.token,
      scorer: {
        id: loginData.scorer.id,
        name: loginData.scorer.name,
        mobile: loginData.scorer.mobile,
        isActive: loginData.canScore ?? loginData.scorer.isActive !== false,
      },
      canScore: loginData.canScore ?? loginData.scorer.isActive !== false,
      expiresAt: loginData.expiresAt,
      tournamentId: targetTid,
      tournaments: loginData.tournaments,
    };
    setScorerAuthSession(authPayload);
    setScorerSavedTournamentId(targetTid);
    setSession(getScorerAuthSession());
    setShowTournamentPicker(false);
    setPendingLogin(null);
    navigate(cricketScorerHomePath(targetTid), { replace: true });
  }

  function handleSwitchTournament(targetTid: number) {
    if (!session) return;
    const updated = {
      ...session,
      tournamentId: targetTid,
    };
    setScorerAuthSession(updated);
    setScorerSavedTournamentId(targetTid);
    setSession(getScorerAuthSession());
    setShowTournamentPicker(false);
    navigate(cricketScorerHomePath(targetTid), { replace: true });
  }

  async function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
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
      const nonEndedTournaments = login.tournaments ?? [];

      if (nonEndedTournaments.length === 0) {
        setAuthError(
          "You are not registered as an official scorer in any live or upcoming tournament. If your tournament has ended or not yet registered, please contact your tournament organizer."
        );
        return;
      }

      // If registered for exactly 1 tournament -> direct login
      if (nonEndedTournaments.length === 1) {
        selectTournamentAndCompleteLogin(login, nonEndedTournaments[0].id);
        return;
      }

      // If registered for multiple tournaments (>1) -> show tournament selector modal
      setPendingLogin(login);
      setShowTournamentPicker(true);
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

  const liveMatches = (matches as ScoringMatchJson[]).filter(
    (m: ScoringMatchJson) => getMatchEffectiveStatus(m) === "live",
  );
  const scheduledMatches = (matches as ScoringMatchJson[]).filter(
    (m: ScoringMatchJson) => getMatchEffectiveStatus(m) === "scheduled",
  );
  const completedMatches = (matches as ScoringMatchJson[]).filter((m: ScoringMatchJson) => {
    const s = getMatchEffectiveStatus(m);
    return s === "completed" || s === "abandoned";
  });

  // Filter memos must run on every render, including the login screen.
  // Returning before them changes the hook count when a scorer signs in or out.
  const query = searchQuery.trim().toLowerCase();

  const filterMatch = (m: ScoringMatchJson) => {
    // 1. Group filter. Group id is authoritative. A round-name label is only
    // offered for a single unscoped legacy draw.
    if (selectedGroup.startsWith("group:")) {
      const groupId = Number(selectedGroup.slice("group:".length));
      if (resolvedMatchGroupId(m) !== groupId) return false;
    } else if (selectedGroup.startsWith("legacy:")) {
      const label = selectedGroup.slice("legacy:".length);
      if (!matchMatchesLegacyGroupLabel(m.roundName, label)) return false;
    }

    // 2. Search query filter
    if (!query) return true;
    const home = teamMap.get(m.homeTeamId);
    const away = teamMap.get(m.awayTeamId);
    const matchNo = String(m.tournamentMatchNumber ?? m.id);
    const round = (m.roundName || "").toLowerCase();
    const venue = (m.venue || "").toLowerCase();
    const homeName = (home?.name || "").toLowerCase();
    const homeCode = (home?.shortCode || "").toLowerCase();
    const awayName = (away?.name || "").toLowerCase();
    const awayCode = (away?.shortCode || "").toLowerCase();

    return (
      matchNo.includes(query) ||
      round.includes(query) ||
      venue.includes(query) ||
      homeName.includes(query) ||
      homeCode.includes(query) ||
      awayName.includes(query) ||
      awayCode.includes(query)
    );
  };

  const filteredLiveMatches = useMemo(
    () => sortMatchesChronologically(liveMatches.filter(filterMatch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [liveMatches, query, selectedGroup, teamMap],
  );
  const filteredScheduledMatches = useMemo(
    () => sortMatchesChronologically(scheduledMatches.filter(filterMatch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scheduledMatches, query, selectedGroup, teamMap],
  );
  const filteredCompletedMatches = useMemo(
    () => sortMatchesChronologically(completedMatches.filter(filterMatch)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [completedMatches, query, selectedGroup, teamMap],
  );

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
            {tidFromQuery > 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">
                Tournament: <span className="font-bold text-white">{tournament?.name || `#${tidFromQuery}`}</span>
              </div>
            ) : null}

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

        {/* Modal when registered for multiple tournaments during login */}
        <Dialog
          open={showTournamentPicker && !!pendingLogin}
          onOpenChange={(open) => {
            setShowTournamentPicker(open);
            if (!open) setPendingLogin(null);
          }}
        >
          <DialogContent className="bg-[#0b1026] border border-white/15 text-white max-w-md w-full">
            <DialogHeader className="text-left space-y-1">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Select Tournament to Score
              </DialogTitle>
              <DialogDescription className="text-xs text-white/60">
                You are registered as a scorer for multiple tournaments. Choose which live or upcoming tournament you want to score:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto py-2 pr-1">
              {(pendingLogin?.tournaments ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => selectTournamentAndCompleteLogin(pendingLogin!, t.id)}
                  className="w-full text-left p-3.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-amber-400/40 text-white transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-amber-300 truncate transition-colors">
                        {t.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className="capitalize">{t.sport || "Cricket"}</span>
                      <span>•</span>
                      {t.hasLiveMatch ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                          Live Match Ongoing
                        </span>
                      ) : (
                        <span className="text-white/50 capitalize">{t.status || "Upcoming"}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-amber-400 shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const totalMatchesCount = (matches as ScoringMatchJson[]).length;

  // ─── AUTHENTICATED MATCH SELECTION HUB ───
  return (
    <div className="min-h-[100dvh] bg-[#070b19] text-white flex flex-col">
      {/* ─── Top Scorer App Header ─── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b19]/95 backdrop-blur-md px-3 py-2.5 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <CricketPublicBrandMark variant="scorer-bar" className="h-6 sm:h-7 shrink-0" />
            <div className="h-5 w-px bg-white/20 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {session.tournaments && session.tournaments.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setShowTournamentPicker(true)}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold text-xs truncate max-w-[12rem] sm:max-w-sm tracking-wide group text-left"
                    title="Switch Tournament"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate">{tournament?.name || `Tournament #${tournamentId}`}</span>
                    <span className="text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 px-1 rounded font-mono group-hover:bg-amber-500/30 flex items-center gap-0.5 shrink-0">
                      <span>{session.tournaments.length}</span>
                      <ChevronDown className="w-2.5 h-2.5" />
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-amber-400 font-bold text-xs truncate max-w-[12rem] sm:max-w-sm tracking-wide">
                      {tournament?.name || `Tournament #${tournamentId}`}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/70 truncate mt-0.5">
                <span className="font-semibold text-slate-200 truncate flex items-center gap-1">
                  <User className="w-3 h-3 text-white/50" />
                  {session.scorer.name}
                </span>
                {session.canScore ? (
                  <span className="text-[9.5px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded-full">
                    Active Scorer
                  </span>
                ) : (
                  <span className="text-[9.5px] font-semibold bg-white/10 text-white/60 px-1.5 py-0.2 rounded-full">
                    View-only
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white rounded-lg hover:bg-white/10"
              onClick={() => void refetchMatches()}
              title="Refresh matches"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", matchesLoading && "animate-spin")} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold border-white/15 bg-white/[0.04] text-white hover:bg-white/15 gap-1.5 rounded-lg shadow-xs"
              onClick={() => void handleLogout()}
            >
              <LogOut className="w-3 h-3 text-rose-400" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main Content: Match Hub ─── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-6 py-4 space-y-4 pb-16">
        <ScorerPwaInstallBanner />

        {isUnassignedToCurrentTournament ? (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-4 max-w-lg mx-auto my-8">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Not Assigned to This Tournament</h3>
              <p className="text-xs text-white/70">
                You are signed in as <strong className="text-white">{session.scorer.name}</strong> ({session.scorer.mobile}), but you are not registered as an official scorer for Tournament #{tournamentId}.
              </p>
            </div>
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Switch to your registered tournament:
              </p>
              <div className="space-y-2">
                {session.tournaments!.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    onClick={() => handleSwitchTournament(t.id)}
                    className="w-full justify-between bg-white/10 hover:bg-white/20 text-white border border-white/15 h-11"
                  >
                    <span className="font-bold truncate">{t.name}</span>
                    <span className="text-xs text-amber-400 flex items-center gap-1.5 font-semibold shrink-0">
                      {t.hasLiveMatch && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                      <span>Open Tournament &rarr;</span>
                    </span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-xs text-white/50 hover:text-white"
              >
                Sign in with a different scorer account
              </Button>
            </div>
          </div>
        ) : (
          <>

        {/* ─── Navigation Tabs & Search (Sub-options) ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === "all"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-white/60 hover:text-white hover:bg-white/5",
              )}
            >
              <span>All Matches</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  activeTab === "all" ? "bg-slate-950/20 text-slate-950" : "bg-white/10 text-white/70",
                )}
              >
                {totalMatchesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("live")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === "live"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-400 hover:text-rose-300 hover:bg-rose-500/10",
              )}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span>Live</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  activeTab === "live" ? "bg-white/20 text-white" : "bg-rose-500/20 text-rose-300",
                )}
              >
                {liveMatches.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("scheduled")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === "scheduled"
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-sky-400 hover:text-sky-300 hover:bg-sky-500/10",
              )}
            >
              <Calendar className="w-3 h-3" />
              <span>Scheduled</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  activeTab === "scheduled" ? "bg-white/20 text-white" : "bg-sky-500/20 text-sky-300",
                )}
              >
                {scheduledMatches.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5",
                activeTab === "completed"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10",
              )}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Completed</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-black",
                  activeTab === "completed" ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-300",
                )}
              >
                {completedMatches.length}
              </span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[160px] sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team or match #"
              className="bg-white/5 border-white/10 text-white text-xs pl-8 pr-7 h-9 rounded-xl placeholder:text-white/30 focus-visible:ring-amber-400/40"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* ─── Group Filter Tabs (if tournament has distinct groups) ─── */}
        {(groupChoices.length > 0 || legacyGroupLabels.length > 0) && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider shrink-0 mr-0.5">
              Group:
            </span>
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                selectedGroup === "all"
                  ? "bg-amber-500 text-slate-950 shadow-sm"
                  : "text-white/70 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10",
              )}
            >
              All Groups
            </button>
            {groupChoices.map((choice) => {
              const token = `group:${choice.id}`;
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedGroup(token)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    selectedGroup === token
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10",
                  )}
                >
                  {choice.label}
                </button>
              );
            })}
            {legacyGroupLabels.map((label) => {
              const token = `legacy:${label}`;
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedGroup(token)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    selectedGroup === token
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Match Cards List ─── */}
        <div className="space-y-6 pt-2">
          {/* SECTION: LIVE MATCHES */}
          {(activeTab === "all" || activeTab === "live") && (
            <section className="space-y-3">
              {activeTab === "all" && filteredLiveMatches.length > 0 && (
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                    Live Matches ({filteredLiveMatches.length})
                  </h2>
                </div>
              )}

              {filteredLiveMatches.length === 0 ? (
                activeTab === "live" ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center space-y-2">
                    <Activity className="w-8 h-8 text-white/30 mx-auto" />
                    <p className="text-sm font-semibold text-white/70">No live matches in progress</p>
                    <p className="text-xs text-white/40">Upcoming matches can be started from the Scheduled tab.</p>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {filteredLiveMatches.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const matchNo = m.tournamentMatchNumber ?? m.id;
                    const cleanedStage = cleanRoundLabel(m.roundName, tournament?.name);

                    const liveState = m.stateJson as import("@workspace/scoring-core").CricketScoreboardState | null;
                    const currentInnings = liveState?.currentInnings ?? 0;
                    const activeInn = liveState?.innings?.find((i) => i.innings === currentInnings);
                    const battingTeam = teams.find((t) => t.id === activeInn?.battingTeamId) || (currentInnings === 1 ? home : away);
                    const oversLimit = activeInn?.oversLimit || liveState?.revisedOversLimit || liveState?.oversLimit || m.rules?.overs || 20;

                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-rose-500/50 bg-gradient-to-br from-rose-950/40 via-[#0f172b]/95 to-[#070b19]/98 p-4 sm:p-5 space-y-3.5 shadow-xl shadow-rose-950/30 ring-1 ring-rose-500/20 backdrop-blur-md"
                      >
                        {/* Header: Match #, Stage, LIVE badge */}
                        <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-[11px] font-black text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-md">
                              Match #{matchNo}
                            </span>
                            {cleanedStage ? (
                              <span
                                className="text-[11px] font-bold text-slate-200 bg-white/10 border border-white/10 px-2 py-0.5 rounded-md truncate max-w-[190px]"
                                title={m.roundName || ""}
                              >
                                {cleanedStage}
                              </span>
                            ) : null}
                            {m.rulePresetName ? (
                              <span className="text-[10px] font-semibold text-rose-300/80 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                                {m.rulePresetName}
                              </span>
                            ) : null}
                          </div>

                          <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-500 text-white flex items-center gap-1.5 shadow-sm shadow-rose-900/50 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                            LIVE NOW
                          </span>
                        </div>

                        {/* Date & Ground Bar */}
                        <div className="flex items-center justify-between text-xs bg-black/40 px-3 py-2 rounded-xl border border-white/5">
                          <div className="flex items-center gap-1.5 font-medium text-rose-300">
                            <Activity className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>In Progress</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white/50 text-[11px] truncate">
                            {m.venue ? (
                              <>
                                <MapPin className="w-3 h-3 text-white/40 shrink-0" />
                                <span className="truncate">{m.venue}</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span>{m.rules?.overs ?? 20} Ov</span>
                          </div>
                        </div>

                        {/* 2-Row Team Presentation (Never Truncated) */}
                        <div className="rounded-xl border border-rose-500/30 bg-black/30 p-2.5 space-y-2">
                          {/* Home Team */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {home?.logoUrl ? (
                                <img
                                  src={home.logoUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10 shrink-0 p-0.5"
                                />
                              ) : (
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm"
                                  style={{ backgroundColor: home?.color || "#38bdf8" }}
                                >
                                  {home?.shortCode?.slice(0, 3) || "H"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-white break-words leading-tight" title={home?.name}>
                                  {home?.name ?? "Home Team"}
                                </div>
                                {home?.shortCode ? (
                                  <div className="text-[10px] text-white/50 font-semibold font-mono">
                                    {home.shortCode}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {liveState && battingTeam?.id === home?.id && activeInn ? (
                              <span className="font-display font-black text-amber-400 text-sm shrink-0">
                                {activeInn.runs}/{activeInn.wickets}{" "}
                                <span className="text-[11px] font-normal text-white/60">
                                  ({activeInn.over}.{activeInn.ball}/{oversLimit} ov)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-white/30 shrink-0">—</span>
                            )}
                          </div>

                          {/* Centered VS divider */}
                          <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-white/10" />
                            </div>
                            <span className="relative px-2 text-[9px] font-black uppercase tracking-widest text-rose-400/80 bg-[#160d1e] rounded-full border border-white/10">
                              VS
                            </span>
                          </div>

                          {/* Away Team */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {away?.logoUrl ? (
                                <img
                                  src={away.logoUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10 shrink-0 p-0.5"
                                />
                              ) : (
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm"
                                  style={{ backgroundColor: away?.color || "#10b981" }}
                                >
                                  {away?.shortCode?.slice(0, 3) || "A"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-white break-words leading-tight" title={away?.name}>
                                  {away?.name ?? "Away Team"}
                                </div>
                                {away?.shortCode ? (
                                  <div className="text-[10px] text-white/50 font-semibold font-mono">
                                    {away.shortCode}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            {liveState && battingTeam?.id === away?.id && activeInn ? (
                              <span className="font-display font-black text-amber-400 text-sm shrink-0">
                                {activeInn.runs}/{activeInn.wickets}{" "}
                                <span className="text-[11px] font-normal text-white/60">
                                  ({activeInn.over}.{activeInn.ball}/{oversLimit} ov)
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-white/30 shrink-0">—</span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          className="w-full h-11 sm:h-12 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm tracking-wide shadow-lg shadow-rose-950/40 gap-2 rounded-xl transition-all"
                          onClick={() => handleOpenScoring(m)}
                        >
                          <Play className="w-4 h-4 fill-white shrink-0" />
                          <span>Resume Live Scoring</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION: SCHEDULED MATCHES */}
          {(activeTab === "all" || activeTab === "scheduled") && (
            <section className="space-y-3">
              {activeTab === "all" && (
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Scheduled Matches ({filteredScheduledMatches.length})
                  </h2>
                  <span className="text-[11px] text-white/50 font-medium">Earliest first</span>
                </div>
              )}

              {filteredScheduledMatches.length === 0 ? (
                activeTab === "scheduled" ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center space-y-2">
                    <Calendar className="w-8 h-8 text-white/30 mx-auto" />
                    <p className="text-sm font-semibold text-white/70">No scheduled upcoming matches</p>
                    <p className="text-xs text-white/40">New matches will appear here once fixtures are generated.</p>
                  </div>
                ) : activeTab === "all" && liveMatches.length === 0 && completedMatches.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-white/40">
                    No scheduled matches found.
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredScheduledMatches.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const matchNo = m.tournamentMatchNumber ?? m.id;
                    const cleanedStage = cleanRoundLabel(m.roundName, tournament?.name);

                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] hover:border-amber-500/40 p-4 space-y-3 transition-colors flex flex-col justify-between group shadow-sm"
                      >
                        {/* Header: Match #, Stage, Scheduled Pill */}
                        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-[11px] font-black text-amber-400 bg-amber-400/15 border border-amber-400/30 px-2.5 py-0.5 rounded-md shadow-xs">
                              Match #{matchNo}
                            </span>
                            {cleanedStage ? (
                              <span
                                className="text-[11px] font-bold text-slate-200 bg-white/10 border border-white/10 px-2 py-0.5 rounded-md truncate max-w-[190px]"
                                title={m.roundName || ""}
                              >
                                {cleanedStage}
                              </span>
                            ) : null}
                            {m.rulePresetName ? (
                              <span className="text-[10px] font-semibold text-sky-300/80 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                                {m.rulePresetName}
                              </span>
                            ) : null}
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full shrink-0">
                            Scheduled
                          </span>
                        </div>

                        {/* Date & Ground Bar */}
                        <div className="flex items-center justify-between text-xs bg-black/30 px-3 py-2 rounded-xl border border-white/5 text-white/70">
                          <div className="flex items-center gap-1.5 font-medium text-sky-300">
                            <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            <span>{formatMatchDateTime(m.scheduledAt)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white/50 text-[11px] truncate">
                            {m.venue ? (
                              <>
                                <MapPin className="w-3 h-3 text-white/40 shrink-0" />
                                <span className="truncate">{m.venue}</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span>{m.rules?.overs ?? 20} Ov</span>
                          </div>
                        </div>

                        {/* 2-Row Stacked Team Display: FULL NAMES, ZERO TRUNCATION */}
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
                          {/* Home Team */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {home?.logoUrl ? (
                                <img
                                  src={home.logoUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10 shrink-0 p-0.5"
                                />
                              ) : (
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm"
                                  style={{ backgroundColor: home?.color || "#38bdf8" }}
                                >
                                  {home?.shortCode?.slice(0, 3) || "H"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-white break-words leading-tight" title={home?.name}>
                                  {home?.name ?? "Home Team"}
                                </div>
                                {home?.shortCode ? (
                                  <div className="text-[10px] text-white/50 font-semibold font-mono">
                                    {home.shortCode}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-white/30 shrink-0">—</span>
                          </div>

                          {/* Centered VS divider */}
                          <div className="relative flex items-center justify-center">
                            <div className="absolute inset-0 flex items-center">
                              <div className="w-full border-t border-white/10" />
                            </div>
                            <span className="relative px-2 text-[9px] font-black uppercase tracking-widest text-amber-400/80 bg-[#0d142c] rounded-full border border-white/10">
                              VS
                            </span>
                          </div>

                          {/* Away Team */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {away?.logoUrl ? (
                                <img
                                  src={away.logoUrl}
                                  alt=""
                                  className="w-7 h-7 rounded-lg object-contain bg-white/5 border border-white/10 shrink-0 p-0.5"
                                />
                              ) : (
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-sm"
                                  style={{ backgroundColor: away?.color || "#10b981" }}
                                >
                                  {away?.shortCode?.slice(0, 3) || "A"}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-bold text-sm text-white break-words leading-tight" title={away?.name}>
                                  {away?.name ?? "Away Team"}
                                </div>
                                {away?.shortCode ? (
                                  <div className="text-[10px] text-white/50 font-semibold font-mono">
                                    {away.shortCode}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <span className="text-xs font-semibold text-white/30 shrink-0">—</span>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <Button
                          type="button"
                          className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide gap-2 rounded-xl shadow-md shadow-amber-500/15 group-hover:shadow-amber-500/25 transition-all mt-1"
                          onClick={() => handleOpenScoring(m)}
                        >
                          <Play className="w-4 h-4 fill-slate-950 shrink-0" />
                          <span>Start Scoring</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* SECTION: COMPLETED MATCHES */}
          {(activeTab === "all" || activeTab === "completed") && (
            <section className="space-y-3">
              {activeTab === "all" && completedMatches.length > 0 && (
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Completed Matches ({filteredCompletedMatches.length})
                  </h2>
                  <span className="text-[11px] text-white/50 font-medium">Recently finished first</span>
                </div>
              )}

              {filteredCompletedMatches.length === 0 ? (
                activeTab === "completed" ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-white/30 mx-auto" />
                    <p className="text-sm font-semibold text-white/70">No completed matches yet</p>
                    <p className="text-xs text-white/40">Matches marked completed will appear here.</p>
                  </div>
                ) : null
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {filteredCompletedMatches.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    const matchNo = m.tournamentMatchNumber ?? m.id;
                    const cleanedStage = cleanRoundLabel(m.roundName, tournament?.name);

                    const summary = (m.summaryJson || m.stateJson) as import("@workspace/scoring-core").CricketMatchSummary | null;
                    const summaryInnings = (summary?.innings as any[]) || (m.stateJson as any)?.innings || [];
                    const inn1 = summaryInnings?.[0];
                    const inn2 = summaryInnings?.[1];

                    const t1 = teams.find((t) => t.id === inn1?.battingTeamId) || home;
                    const t2 = teams.find((t) => t.id === inn2?.battingTeamId) || away;
                    const isT1Winner = m.winnerTeamId === t1?.id;
                    const isT2Winner = m.winnerTeamId === t2?.id;

                    return (
                      <div
                        key={m.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] hover:border-emerald-500/40 p-4 space-y-3 transition-colors flex flex-col justify-between shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="text-[11px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
                              Match #{matchNo}
                            </span>
                            {cleanedStage ? (
                              <span
                                className="text-[11px] font-semibold text-white/70 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md truncate max-w-[190px]"
                                title={m.roundName || ""}
                              >
                                {cleanedStage}
                              </span>
                            ) : null}
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0">
                            Completed
                          </span>
                        </div>

                        {/* 2-Row Teams with scores and trophy */}
                        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
                          {/* Team 1 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t1?.color || "#3b82f6" }} />
                              <span className={cn("text-xs font-bold truncate", isT1Winner ? "text-white font-black" : "text-white/70")}>
                                {t1?.name || t1?.shortCode || "Team 1"}
                              </span>
                              {isT1Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </div>
                            <span className="text-xs font-bold tabular-nums text-white shrink-0">
                              {inn1 ? `${inn1.runs}/${inn1.wickets} (${inn1.overs || `${inn1.over}.${inn1.ball}`} ov)` : "—"}
                            </span>
                          </div>

                          <div className="h-px bg-white/5" />

                          {/* Team 2 */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t2?.color || "#10b981" }} />
                              <span className={cn("text-xs font-bold truncate", isT2Winner ? "text-white font-black" : "text-white/70")}>
                                {t2?.name || t2?.shortCode || "Team 2"}
                              </span>
                              {isT2Winner && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                            </div>
                            <span className="text-xs font-bold tabular-nums text-white shrink-0">
                              {inn2 ? `${inn2.runs}/${inn2.wickets} (${inn2.overs || `${inn2.over}.${inn2.ball}`} ov)` : "—"}
                            </span>
                          </div>
                        </div>

                        {/* Result summary banner */}
                        {m.resultSummary ? (
                          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-300 font-medium truncate flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">{m.resultSummary}</span>
                          </div>
                        ) : null}

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full h-9 text-xs font-semibold border-white/15 bg-white/[0.04] text-slate-200 hover:text-white hover:bg-white/10 rounded-xl"
                          onClick={() => handleOpenScoring(m)}
                        >
                          View Result & Scorecard
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
        </>
      )}
      </main>

      {/* Modal to switch tournament when already logged in */}
      <Dialog open={showTournamentPicker} onOpenChange={setShowTournamentPicker}>
        <DialogContent className="bg-[#0b1026] border border-white/15 text-white max-w-md w-full">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              Switch Tournament
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Select another live or upcoming tournament assigned to your account:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 max-h-[60vh] overflow-y-auto py-2 pr-1">
            {(session?.tournaments ?? []).map((t) => {
              const isCurrent = t.id === tournamentId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSwitchTournament(t.id)}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 group",
                    isCurrent
                      ? "border-amber-500/60 bg-amber-500/10 text-white shadow-md shadow-amber-500/5"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-amber-400/40 text-white",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-amber-300 truncate transition-colors">
                        {t.name}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded-full font-semibold">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/60">
                      <span className="capitalize">{t.sport || "Cricket"}</span>
                      <span>•</span>
                      {t.hasLiveMatch ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                          Live Match Ongoing
                        </span>
                      ) : (
                        <span className="text-white/50 capitalize">{t.status || "Upcoming"}</span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-amber-400 shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

