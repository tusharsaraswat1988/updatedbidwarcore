import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetTournament,
  getGetTournamentQueryKey,
  useGetAuctionState,
  getGetAuctionStateQueryKey,
  useGetTeamPurses,
  getGetTeamPursesQueryKey,
  useListPlayers,
  getListPlayersQueryKey,
  useListCategories,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import type { TeamPurse, Player, Tournament, AuctionState } from "@workspace/api-client-react";
import { useAuctionSocket, type CheerMessage } from "@/hooks/use-auction-socket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Radio, Volume2, VolumeX, User, Trophy, Gavel, MessageCircle, X, Star, Flame } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { useBranding } from "@/hooks/use-branding";

import { DEFAULT_CHEER_PRESETS } from "@/lib/cheer-constants";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { AuctionStatusOverlay } from "@/components/display/auction-status-overlay";
import { deriveAuctionDisplayMode } from "@/lib/auction-display-status";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";

type CheerEntry = { id: string; supporterLabel: string; message: string; teamColor: string | null; teamId: number; timestamp: number };

// ── Sound utilities (module-level, no hooks) ──────────────────────────────────

type SoundKey = "newPlayer" | "bid" | "sold" | "unsold";
type SoundSettings = Record<SoundKey, boolean>;

const SOUND_LABELS: Record<SoundKey, string> = {
  newPlayer: "New player announced",
  bid: "Bid placed",
  sold: "Player sold",
  unsold: "Player unsold",
};

function playTone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  gainVal = 0.28,
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(gainVal, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playNewPlayerSound(ac: AudioContext) {
  const t = ac.currentTime;
  [440, 554, 659].forEach((freq, i) => playTone(ac, freq, t + i * 0.13, 0.38, "sine", 0.3));
}

function playBidSound(ac: AudioContext) {
  playTone(ac, 880, ac.currentTime, 0.07, "sine", 0.22);
}

function playSoldSound(ac: AudioContext) {
  const t = ac.currentTime;
  [523, 659, 784].forEach((freq) => playTone(ac, freq, t, 0.75, "triangle", 0.19));
  playTone(ac, 1047, t + 0.38, 0.5, "sine", 0.24);
}

function playUnsoldSound(ac: AudioContext) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(280, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.6);
  gain.gain.setValueAtTime(0.16, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.6);
  osc.start();
  osc.stop(ac.currentTime + 0.6);
}

// ── useSoundEngine ────────────────────────────────────────────────────────────

function useSoundEngine() {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    try {
      const raw = localStorage.getItem("bidwar_viewer_sounds");
      if (raw) return JSON.parse(raw) as SoundSettings;
    } catch {}
    return { newPlayer: true, bid: true, sold: true, unsold: true };
  });

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  const acRef = useRef<AudioContext | null>(null);

  function getAC() {
    if (!acRef.current) {
      acRef.current = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
    }
    return acRef.current;
  }

  // Resume AudioContext on any user gesture — required by browser autoplay policy
  useEffect(() => {
    function resumeAC() {
      if (acRef.current?.state === "suspended") void acRef.current.resume();
    }
    document.addEventListener("click", resumeAC);
    document.addEventListener("touchstart", resumeAC);
    return () => {
      document.removeEventListener("click", resumeAC);
      document.removeEventListener("touchstart", resumeAC);
    };
  }, []);

  const play = useCallback((sound: SoundKey) => {
    if (!settingsRef.current[sound]) return;
    try {
      const ac = getAC();
      if (ac.state === "suspended") void ac.resume();
      switch (sound) {
        case "newPlayer": playNewPlayerSound(ac); break;
        case "bid":       playBidSound(ac);       break;
        case "sold":      playSoldSound(ac);      break;
        case "unsold":    playUnsoldSound(ac);    break;
      }
    } catch {}
  }, []);

  const toggle = useCallback((sound: SoundKey) => {
    setSettings((prev) => {
      const next = { ...prev, [sound]: !prev[sound] };
      try { localStorage.setItem("bidwar_viewer_sounds", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { play, settings, toggle };
}

// ── TeamSquadSheet — bottom sheet on mobile, centered modal on desktop ─────────

function TeamSquadSheet({
  team,
  players,
  open,
  onClose,
}: {
  team: TeamPurse | null;
  players: Player[];
  open: boolean;
  onClose: () => void;
}) {
  const tc = team?.color || "#F59E0B";
  const squadPlayers = useMemo(
    () => players.filter((p) => p.teamId === team?.teamId && p.status === "sold"),
    [players, team?.teamId],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative z-10 w-full sm:max-w-md bg-[#18181b] border border-border/60 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            {/* Drag handle — mobile only */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-5 pb-4 pt-2 sm:pt-5 border-b border-border/50">
              <div className="flex items-center gap-3 mb-4">
                {team?.logoUrl ? (
                  <img src={team.logoUrl} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                    style={{ backgroundColor: `${tc}22`, color: tc, border: `2px solid ${tc}44` }}
                  >
                    {team?.shortCode?.slice(0, 3) || "?"}
                  </div>
                )}
                <div>
                  <p className="font-display font-bold text-lg leading-none" style={{ color: tc }}>
                    {team?.teamName}
                  </p>
                  {team?.ownerName && (
                    <p className="text-xs text-muted-foreground mt-0.5">{team.ownerName}</p>
                  )}
                </div>
              </div>

              {/* Purse stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-card/60 border border-border/50 text-center">
                  <p className="font-display font-black text-base" style={{ color: tc }}>
                    {formatShortIndianRupee(team?.purseRemaining ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Remaining</p>
                </div>
                <div className="p-2.5 rounded-xl bg-card/60 border border-border/50 text-center">
                  <p className="font-display font-black text-base text-foreground">
                    {formatShortIndianRupee(team?.purseUsed ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Spent</p>
                </div>
                <div className="p-2.5 rounded-xl bg-card/60 border border-border/50 text-center">
                  <p className="font-display font-black text-base text-foreground">
                    {team?.playersBought ?? 0}
                    {(team?.maximumSquadSize ?? 0) > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">/{team?.maximumSquadSize}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Players</p>
                </div>
              </div>
            </div>

            {/* Player list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {squadPlayers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <User className="w-8 h-8 mb-2 opacity-25" />
                  <p className="text-sm">No players acquired yet</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {squadPlayers.map((player, i) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                    >
                      <span className="text-xs text-muted-foreground w-5 text-right tabular-nums flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-card border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-none truncate">{player.name}</p>
                        {player.role && (
                          <p className="text-xs text-muted-foreground capitalize mt-0.5">{player.role}</p>
                        )}
                      </div>
                      {player.soldPrice ? (
                        <p className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: tc }}>
                          {formatShortIndianRupee(player.soldPrice)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SoundSettingsDialog ───────────────────────────────────────────────────────

function SoundSettingsDialog({
  open,
  onClose,
  settings,
  toggle,
}: {
  open: boolean;
  onClose: () => void;
  settings: SoundSettings;
  toggle: (sound: SoundKey) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Volume2 className="w-4 h-4" /> Sound Settings
          </DialogTitle>
        </DialogHeader>
        <div className="pt-1">
          <p className="text-xs text-muted-foreground pb-4">
            Tap or click anywhere on the page to enable audio. Uses your browser's Web Audio engine — no downloads required.
          </p>
          <div className="space-y-0.5">
            {(Object.keys(SOUND_LABELS) as SoundKey[]).map((key) => (
              <div
                key={key}
                className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
              >
                <span className="text-sm">{SOUND_LABELS[key]}</span>
                <button
                  onClick={() => toggle(key)}
                  aria-label={settings[key] ? "Disable" : "Enable"}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${settings[key] ? "bg-primary" : "bg-muted"}`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200 ${
                      settings[key] ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── CompletedScreen ───────────────────────────────────────────────────────────

function CompletedScreen({
  tournament,
  players,
  teamPurses,
}: {
  tournament: Tournament | undefined;
  players: Player[];
  teamPurses: TeamPurse[] | undefined;
}) {
  const soldPlayers = useMemo(
    () => players.filter((p) => p.status === "sold" && p.soldPrice),
    [players],
  );
  const totalSpend = useMemo(
    () => soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0),
    [soldPlayers],
  );
  const top3 = useMemo(
    () => [...soldPlayers].sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0)).slice(0, 3),
    [soldPlayers],
  );
  const teamStandings = useMemo(
    () => [...(teamPurses ?? [])].sort((a, b) => (b.purseUsed ?? 0) - (a.purseUsed ?? 0)),
    [teamPurses],
  );

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-10 max-w-3xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 py-6">
        {tournament?.logoUrl && (
          <img src={tournament.logoUrl} alt="" className="w-20 h-20 object-contain mx-auto opacity-80 mb-2" />
        )}
        <Trophy className="w-14 h-14 text-primary mx-auto" />
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-foreground">
            Auction Concluded
          </h1>
          {tournament?.name && (
            <p className="text-muted-foreground mt-1.5">{tournament.name}</p>
          )}
        </div>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-5 rounded-2xl bg-card/50 border border-border/50 text-center">
          <p className="font-display font-black text-3xl text-green-400">{soldPlayers.length}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Players Sold</p>
        </div>
        <div className="p-5 rounded-2xl bg-card/50 border border-border/50 text-center">
          <p className="font-display font-black text-2xl text-primary">{formatShortIndianRupee(totalSpend)}</p>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mt-1">Total Spend</p>
        </div>
      </div>

      {/* Top 3 bids */}
      {top3.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Top Bids</p>
          <div className="space-y-2">
            {top3.map((player, i) => {
              const buyingTeam = teamPurses?.find((t) => t.teamId === player.teamId);
              const tc = buyingTeam?.color || "#F59E0B";
              const medal = ["#F59E0B", "#94a3b8", "#cd7c3a"][i];
              return (
                <div
                  key={player.id}
                  className="flex items-center gap-4 p-4 rounded-2xl bg-card/40 border border-border/40"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-sm flex-shrink-0 text-black"
                    style={{ backgroundColor: medal }}
                  >
                    {i + 1}
                  </div>
                  <div className="w-10 h-12 rounded-xl overflow-hidden bg-card flex-shrink-0 flex items-center justify-center">
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-base leading-none truncate">{player.name}</p>
                    {player.role && (
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{player.role}</p>
                    )}
                    {buyingTeam && (
                      <p className="text-xs font-semibold mt-0.5" style={{ color: tc }}>
                        {buyingTeam.shortCode || buyingTeam.teamName}
                      </p>
                    )}
                  </div>
                  <p className="font-display font-black text-lg tabular-nums" style={{ color: tc }}>
                    {formatShortIndianRupee(player.soldPrice!)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Team standings */}
      {teamStandings.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Team Standings</p>
          <div className="space-y-2">
            {teamStandings.map((team) => {
              const tc = team.color || "#F59E0B";
              const fillPct = team.maximumSquadSize > 0
                ? Math.min(100, (team.playersBought / team.maximumSquadSize) * 100)
                : 0;
              return (
                <div
                  key={team.teamId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/40"
                >
                  {team.logoUrl ? (
                    <img src={team.logoUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-display font-black text-xs flex-shrink-0"
                      style={{ backgroundColor: `${tc}22`, color: tc }}
                    >
                      {(team.shortCode || team.teamName.slice(0, 3)).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm truncate">{team.teamName}</p>
                      <p className="font-display font-black text-sm tabular-nums flex-shrink-0" style={{ color: tc }}>
                        {formatShortIndianRupee(team.purseUsed)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[11px] text-muted-foreground">
                        {team.playersBought} player{team.playersBought !== 1 ? "s" : ""}
                        {team.maximumSquadSize > 0 ? ` / ${team.maximumSquadSize}` : ""}
                      </p>
                      {team.maximumSquadSize > 0 && (
                        <div className="flex-1 h-1 bg-muted/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${fillPct}%`, backgroundColor: tc }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center pt-4">
        <p className="text-[10px] text-muted-foreground/35 uppercase tracking-widest">Powered by BidWar</p>
      </div>
    </div>
  );
}

// ── Idle branded holding screen ───────────────────────────────────────────────

function IdleHoldingScreen({ tournament }: { tournament?: Tournament }) {
  return (
    <div className="py-14 px-6 rounded-2xl bg-card/20 border border-dashed border-border/40 flex flex-col items-center gap-5">
      {tournament?.logoUrl ? (
        <img src={tournament.logoUrl} alt="" className="w-20 h-20 object-contain opacity-75 rounded-xl" />
      ) : (
        <Radio className="w-14 h-14 text-primary/35" />
      )}
      <div className="text-center space-y-1.5">
        <p className="font-display font-bold text-xl text-foreground">
          {tournament?.name || "Live Auction"}
        </p>
        <p className="text-sm text-muted-foreground">Waiting for the auction to start</p>
      </div>
    </div>
  );
}

// ── Cheer sub-components ──────────────────────────────────────────────────────

function HeatBadge({ level }: { level: string }) {
  const configs: Record<string, string> = {
    ACTIVE:     "border-green-500/30 bg-green-500/10 text-green-400",
    HEATED:     "border-amber-500/30 bg-amber-500/10 text-amber-400",
    "WAR MODE": "border-red-500/30 bg-red-500/10 text-red-400",
  };
  const cls = configs[level] ?? "border-border/30 bg-border/10 text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      <Flame className="w-2.5 h-2.5" />
      {level}
    </span>
  );
}

function FanBattleStrip({ fanBattle, teams }: { fanBattle: Record<string, number>; teams: TeamPurse[] }) {
  const sorted = Object.entries(fanBattle)
    .map(([id, count]) => {
      const team = teams.find((t) => String(t.teamId) === id);
      return { id, count, team };
    })
    .filter((x): x is { id: string; count: number; team: TeamPurse } => !!x.team)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const total = sorted.reduce((sum, x) => sum + x.count, 0) || 1;
  if (sorted.length === 0) return null;
  return (
    <div className="mt-2 space-y-1.5">
      {sorted.map(({ id, count, team }) => {
        const tc = team.color || "#F59E0B";
        const pct = Math.round((count / total) * 100);
        return (
          <div key={id} className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase w-14 flex-shrink-0 truncate" style={{ color: tc }}>
              {team.shortCode || team.teamName.slice(0, 6)}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: tc }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground tabular-nums w-5 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function CheerCard({ entry }: { entry: CheerEntry }) {
  const tc = entry.teamColor || "#F59E0B";
  return (
    <motion.div
      initial={{ opacity: 0, x: 24, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className="rounded-xl border px-3 py-2.5 flex-shrink-0"
      style={{ backgroundColor: `${tc}0e`, borderColor: `${tc}38`, boxShadow: `0 0 8px ${tc}12` }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tc }} />
        <span className="font-bold text-[10px] tracking-wider uppercase truncate" style={{ color: tc }}>
          {entry.supporterLabel}
        </span>
      </div>
      <p className="text-white/75 leading-snug text-xs">{entry.message}</p>
    </motion.div>
  );
}

function CheerFeedRail({
  messages,
  teams,
  heatLevel,
  fanBattle,
  heatMeterEnabled,
  fanBattleEnabled,
}: {
  messages: CheerEntry[];
  teams: TeamPurse[];
  heatLevel: string | null;
  fanBattle: Record<string, number>;
  heatMeterEnabled: boolean;
  fanBattleEnabled: boolean;
}) {
  return (
    <div className="hidden xl:flex fixed right-0 top-0 bottom-0 w-72 z-20 flex-col border-l border-white/8 bg-black/55 backdrop-blur-2xl">
      {/* Rail header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Cheer</span>
          </div>
          {heatMeterEnabled && heatLevel && heatLevel !== "CALM" && (
            <HeatBadge level={heatLevel} />
          )}
        </div>
        {fanBattleEnabled && Object.keys(fanBattle).length > 0 && (
          <FanBattleStrip fanBattle={fanBattle} teams={teams} />
        )}
      </div>
      {/* Feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground/20 mb-3" />
            <p className="text-xs text-muted-foreground/40">No cheers yet</p>
            <p className="text-[10px] text-muted-foreground/25 mt-1">Be the first to cheer!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {[...messages].reverse().map((m) => (
              <CheerCard key={m.id} entry={m} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function MobileCheerFeed({
  messages,
  teams,
  heatLevel,
  fanBattle,
  heatMeterEnabled,
  fanBattleEnabled,
}: {
  messages: CheerEntry[];
  teams: TeamPurse[];
  heatLevel: string | null;
  fanBattle: Record<string, number>;
  heatMeterEnabled: boolean;
  fanBattleEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const prevCountRef = useRef(messages.length);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = messages.length;
    if (messages.length <= prev) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [messages.length]);

  const recentMessages = [...messages].reverse().slice(0, 6);

  return (
    <>
      {/* Right-edge pull tab — visible when drawer is closed */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="feed-tab"
            initial={{ x: 56 }}
            animate={{ x: 0, scale: flash ? [1, 1.12, 1] : 1 }}
            exit={{ x: 56 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={() => setOpen(true)}
            className="fixed right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-1.5 px-2.5 py-3.5 bg-[#18181b] border border-white/12 border-r-0 rounded-l-xl shadow-2xl"
          >
            <motion.div animate={flash ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.5 }}>
              <Flame className="w-4 h-4 text-amber-400" />
            </motion.div>
            {messages.length > 0 && (
              <span className="text-[9px] font-black text-amber-400 tabular-nums leading-none">
                {messages.length > 99 ? "99+" : messages.length}
              </span>
            )}
            <span
              className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/60 leading-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              LIVE
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-in drawer from the right */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="feed-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="feed-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 max-w-[82vw] bg-[#111] border-l border-white/10 flex flex-col"
            >
              {/* Drawer header */}
              <div className="flex-shrink-0 px-4 py-3.5 border-b border-white/8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Cheer</span>
                  {heatMeterEnabled && heatLevel && heatLevel !== "CALM" && (
                    <HeatBadge level={heatLevel} />
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {fanBattleEnabled && Object.keys(fanBattle).length > 0 && (
                <div className="flex-shrink-0 px-4 pt-2.5 pb-2 border-b border-white/5">
                  <FanBattleStrip fanBattle={fanBattle} teams={teams} />
                </div>
              )}
              {/* Feed — last 6, newest first */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-3">
                {recentMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                    <MessageCircle className="w-8 h-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground/40">No cheers yet</p>
                    <p className="text-[10px] text-muted-foreground/25 mt-1">Be the first to cheer!</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {recentMessages.map((m) => (
                      <CheerCard key={m.id} entry={m} />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main LiveViewerPage ───────────────────────────────────────────────────────

export default function LiveViewerPage() {
  const [, params] = useRoute("/tournament/:id/liveviewer");
  const tournamentId = parseInt(params?.id || "0");
  const { logos, brandName } = useBranding();

  // ── Cheer state (declared early so the socket callback is stable) ─────────
  const [cheerMessages, setCheerMessages] = useState<CheerEntry[]>([]);
  const [cheerTeamId, setCheerTeamId] = useState<number | null>(() => {
    try { const v = localStorage.getItem("bidwar-cheer-team"); return v ? parseInt(v) : null; } catch { return null; }
  });
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [cheerCooldown, setCheerCooldown] = useState(false);
  const [cheerBlockedMsg, setCheerBlockedMsg] = useState<string | null>(null);
  const [cheerOpen, setCheerOpen] = useState(false);
  const [heatLevel, setHeatLevel] = useState<string | null>(null);
  const [fanBattle, setFanBattle] = useState<Record<string, number>>({});

  const handleCheerMessage = useCallback((msg: CheerMessage) => {
    setCheerMessages((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          supporterLabel: msg.supporterLabel,
          message: msg.message,
          teamColor: msg.teamColor,
          teamId: msg.teamId,
          timestamp: Date.now(),
        },
      ];
      return next.slice(-10);
    });
    if (msg.heatLevel) setHeatLevel(msg.heatLevel);
    if (msg.fanBattle) setFanBattle(msg.fanBattle);
  }, []);

  // ── Data ─────────────────────────────────────────────────────────────────
  useAuctionSocket(tournamentId, handleCheerMessage);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId, staleTime: 0 },
  });

  const isCompleted = (tournament as { status?: string } | undefined)?.status === "completed";

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: isCompleted ? false : 30000,
      staleTime: 0,
    },
  });

  // Sticky countdown: survives the server auto-clearing the countdown on read
  // so the pre-auction 4-s "officially started" banner can complete fully.
  const _rawDc = (state as { displayCountdown?: { type?: string; endsAt?: string; label?: string | null } | null } | undefined)?.displayCountdown;
  const stickyDc = useStickyCountdown(_rawDc);

  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: isCompleted ? false : 30000,
      staleTime: 0,
    },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 0,
    },
  });
  // Prefetch categories into cache for squad detail enrichment
  useListCategories(tournamentId, {
    query: {
      queryKey: getListCategoriesQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 0,
    },
  });

  // ── Page title ────────────────────────────────────────────────────────────
  useEffect(() => {
    const name = tournament?.name;
    document.title = name ? `${name} — BidWar Live` : "BidWar Live";
    return () => { document.title = "BidWar"; };
  }, [tournament?.name]);

  // ── Sound engine ─────────────────────────────────────────────────────────
  const { play, settings: soundSettings, toggle: toggleSound } = useSoundEngine();

  // ── Cheer logic ────────────────────────────────────────────────────────────
  const cheerEnabled = tournament?.cheerMessagesEnabled !== false;
  const cheerCooldownSeconds = (tournament as { cheerCooldownSeconds?: number } | undefined)?.cheerCooldownSeconds ?? 8;
  const heatMeterEnabled = (tournament as { cheerHeatMeterEnabled?: boolean } | undefined)?.cheerHeatMeterEnabled ?? false;
  const fanBattleEnabled = (tournament as { cheerFanBattleEnabled?: boolean } | undefined)?.cheerFanBattleEnabled ?? false;
  const cheerPresets = useMemo<string[]>(() => {
    const raw = tournament?.cheerMessagePresets;
    if (!raw) return DEFAULT_CHEER_PRESETS;
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.length > 0) return p as string[];
    } catch {}
    return DEFAULT_CHEER_PRESETS;
  }, [tournament?.cheerMessagePresets]);

  const cheerTeam = useMemo(
    () => (teamPurses ?? []).find((t) => t.teamId === cheerTeamId) ?? null,
    [teamPurses, cheerTeamId],
  );
  const cheerSupporterLabel = cheerTeam
    ? `${(cheerTeam.shortCode || cheerTeam.teamName.slice(0, 4)).toUpperCase()} FANS`
    : null;

  function showCheerError(msg: string) {
    setCheerBlockedMsg(msg);
    setTimeout(() => setCheerBlockedMsg(null), 2500);
  }

  async function postCheer(teamId: number, reactionId: number) {
    try {
      const r = await fetch(`/api/tournaments/${tournamentId}/cheer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, reactionId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (r.status === 429) showCheerError("Slow down!");
        else if (r.status === 403) showCheerError("Cheers are disabled");
        else showCheerError("Could not send");
      }
    } catch {}
  }

  function sendCheer(idx: number) {
    if (cheerCooldown) return;
    if (!cheerTeamId) {
      setShowTeamSelector(true);
      setCheerOpen(false);
      return;
    }
    setCheerCooldown(true);
    const localCooldownMs = Math.max(500, (cheerCooldownSeconds - 1) * 1000);
    setTimeout(() => setCheerCooldown(false), localCooldownMs);
    setCheerOpen(false);
    void postCheer(cheerTeamId, idx);
  }

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);

  // Stores the last player outcome — persists until the next player is announced
  const [lastResult, setLastResult] = useState<{
    playerName: string;
    photoUrl: string | null;
    basePrice: number;
    role: string | null;
    city: string | null;
    age: number | null;
    jerseyNumber: string | null;
    status: "sold" | "unsold";
    soldPrice?: number;
    soldToTeam?: string;
    soldToTeamColor?: string;
    soldToTeamLogo?: string | null;
  } | null>(null);

  // ── Sound event detection ─────────────────────────────────────────────────
  const prevStateRef = useRef<AuctionState | null>(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev != null && state != null) {
      if (prev.currentPlayer?.id !== state.currentPlayer?.id && state.currentPlayer) {
        play("newPlayer");
      }
      if (
        prev.currentBid !== state.currentBid &&
        (state.currentBid ?? 0) > 0 &&
        prev.currentPlayer?.id === state.currentPlayer?.id
      ) {
        play("bid");
      }
      if ((prev.status as string) !== "sold" && (state.status as string) === "sold") {
        play("sold");
      }
      if ((prev.status as string) !== "unsold" && (state.status as string) === "unsold") {
        play("unsold");
      }
    }
    prevStateRef.current = state ?? null;
  }, [state, play]);

  // ── Capture last result whenever sold/unsold — persists until next player ──
  useEffect(() => {
    if (!state) return;
    const status = state.status as string;
    if ((status === "sold" || status === "unsold") && state.currentPlayer) {
      setLastResult({
        playerName: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl ?? null,
        basePrice: state.currentPlayer.basePrice,
        role: state.currentPlayer.role ?? null,
        city: state.currentPlayer.city ?? null,
        age: state.currentPlayer.age ?? null,
        jerseyNumber: state.currentPlayer.jerseyNumber ?? null,
        status: status as "sold" | "unsold",
        soldPrice: state.currentBid ?? undefined,
        soldToTeam: state.currentBidTeamName ?? undefined,
        soldToTeamColor: state.currentBidTeamColor ?? undefined,
        soldToTeamLogo: (state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ?? null,
      });
    }
  }, [state?.status, state?.currentPlayer?.id]);

  // ── Derived values ────────────────────────────────────────────────────────
  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(state),
    [state?.status, state?.displayCountdown],
  );
  const teamColor = state?.currentBidTeamColor || "#F59E0B";
  const hasPlayer = !!state?.currentPlayer;
  const isActive = displayMode.isLive;
  const isPaused = displayMode.isPaused;
  const freezeBidUpdates = displayMode.freezeBidUpdates;
  const isIdle = !state || state.status === "idle";
  const isSold = (state?.status as string) === "sold";
  const isUnsold = (state?.status as string) === "unsold";
  // Show frozen result card when no active player but we have a previous outcome
  const showFrozenCard = !hasPlayer && !isSold && !isUnsold && !!lastResult;
  const soldCount = state?.soldPlayersCount ?? 0;
  const unsoldCount = state?.unsoldPlayersCount ?? 0;
  const remainingCount = state?.remainingPlayersCount ?? 0;

  const selectedTeam = useMemo(
    () => (teamPurses ?? []).find((t) => t.teamId === selectedTeamId) ?? null,
    [teamPurses, selectedTeamId],
  );
  const playerList = useMemo(() => players ?? [], [players]);

  const playerSpecs = useMemo(() => {
    if (!state?.currentPlayer) return [];
    return [
      state.currentPlayer.role,
      state.currentPlayer.battingStyle,
      state.currentPlayer.bowlingStyle,
      state.currentPlayer.specialization,
      state.currentPlayer.city,
      state.currentPlayer.age ? `Age ${state.currentPlayer.age}` : null,
    ].filter((v): v is string => !!v);
  }, [
    state?.currentPlayer?.id,
    state?.currentPlayer?.role,
    state?.currentPlayer?.battingStyle,
    state?.currentPlayer?.bowlingStyle,
    state?.currentPlayer?.specialization,
    state?.currentPlayer?.city,
    state?.currentPlayer?.age,
  ]);

  const statusLabel = isSold ? "SOLD"
    : isUnsold ? "UNSOLD"
    : isActive ? "LIVE"
    : isPaused ? "PAUSED"
    : "IDLE";

  const statusRing = (isActive || isSold)
    ? "bg-green-500/15 text-green-400 border-green-500/30"
    : isUnsold
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : isPaused
    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-border/15 text-muted-foreground border-border/30";

  const anySound = Object.values(soundSettings).some(Boolean);

  // ── Completed state ───────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <CompletedScreen
        tournament={tournament}
        players={playerList}
        teamPurses={teamPurses}
      />
    );
  }

  return (
    <div className="h-[100dvh] bg-[#09090b] relative flex flex-col overflow-hidden">
      {/* Animated background glow */}
      <AnimatePresence>
        <motion.div
          key={teamColor}
          className="fixed inset-0 pointer-events-none z-0"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${teamColor}1a 0%, transparent 52%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        />
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-3.5 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <img src={logos.mini || "/bidwar-logo-transparent.png"} alt={brandName} className="h-7 w-auto" />
            <span className="font-display font-black text-amber-400 text-base tracking-widest">{brandName.toUpperCase()}</span>
          </div>
          <div className="h-5 w-px bg-white/15 flex-shrink-0" />
          <p className="flex-1 min-w-0 font-semibold text-sm text-white/80 truncate">
            {tournament?.name || "Live Auction"}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusRing}`}>
              {(isActive || isSold) && (
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
              {statusLabel}
            </span>
            <button
              onClick={() => setSoundSettingsOpen(true)}
              className="p-2.5 rounded-xl border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
              title="Sound settings"
            >
              {anySound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Last result ticker ────────────────────────────────────────── */}
      {lastResult && (
        <div className="flex-shrink-0 overflow-hidden bg-black/35 border-b border-white/5 py-1.5">
          <div className="flex animate-marquee" style={{ width: "max-content" }}>
            {[0, 1].map((i) => (
              <span key={i} className="inline-flex items-center gap-2.5 px-12 text-[11px] whitespace-nowrap">
                {lastResult.status === "sold" ? (
                  <>
                    <span className="font-bold text-green-400 tracking-wider">SOLD</span>
                    <span className="text-foreground/80 font-semibold">{lastResult.playerName}</span>
                    <span className="text-muted-foreground/50">to</span>
                    <span
                      className="font-bold"
                      style={{ color: lastResult.soldToTeamColor || "#F59E0B" }}
                    >
                      {lastResult.soldToTeam}
                    </span>
                    <span className="text-muted-foreground/50">at</span>
                    <span className="font-bold text-foreground">{formatIndianRupee(lastResult.soldPrice || 0)}</span>
                  </>
                ) : (
                  <>
                    <span className="font-bold text-red-400 tracking-wider">UNSOLD</span>
                    <span className="text-foreground/80 font-semibold">{lastResult.playerName}</span>
                  </>
                )}
                <span className="mx-10 text-border/30 select-none">◆</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto max-w-4xl xl:max-w-[calc(100%-18rem)] mx-auto xl:mx-0 w-full px-4 py-3 pb-28">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 py-4">
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-3xl sm:text-4xl text-green-400">{soldCount}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Sold</p>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-3xl sm:text-4xl text-amber-400">{remainingCount}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Remaining</p>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-3xl sm:text-4xl text-red-400">{unsoldCount}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Unsold</p>
          </div>
        </div>

        {/* ── Player section ─────────────────────────────────────────── */}
        <div className="relative mb-4 min-h-[12rem]">
          {displayMode.overlayMode && (
            <AuctionStatusOverlay
              mode={displayMode.overlayMode}
              breakEndsAt={displayMode.breakEndsAt}
              breakMessage={displayMode.breakMessage}
              className="rounded-2xl"
            />
          )}

          <div className={`transition-opacity duration-300 ${displayMode.showStatusOverlay && hasPlayer ? "opacity-40" : "opacity-100"}`}>
        <AnimatePresence mode="wait">
          {hasPlayer ? (
            // ── Active / live player card ──────────────────────────────
            <motion.div
              key={state?.currentPlayer?.id}
              initial={freezeBidUpdates ? undefined : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={freezeBidUpdates ? undefined : { opacity: 0, y: -14 }}
              transition={{ duration: 0.3 }}
              className="mb-4 p-4 sm:p-5 rounded-2xl backdrop-blur border transition-colors"
              style={{
                backgroundColor: isSold
                  ? `${teamColor}10`
                  : isUnsold
                  ? "rgba(239,68,68,0.06)"
                  : "rgba(var(--card), 0.5)",
                borderColor: isSold
                  ? `${teamColor}45`
                  : isUnsold
                  ? "rgba(239,68,68,0.3)"
                  : "rgba(var(--border), 0.5)",
              }}
            >
              <div className="flex flex-row items-start gap-4">
                {/* Photo */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-24 h-32 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
                    style={{ borderColor: isSold ? `${teamColor}55` : isUnsold ? "rgba(239,68,68,0.4)" : `${teamColor}55` }}
                  >
                    {state?.currentPlayer?.photoUrl ? (
                      <img
                        src={state.currentPlayer.photoUrl}
                        alt={state.currentPlayer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-14 h-14 text-muted-foreground/25" />
                    )}
                  </div>
                  {state?.currentPlayer?.jerseyNumber && !isSold && !isUnsold && (
                    <div
                      className="absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs text-black shadow-lg"
                      style={{ backgroundColor: teamColor }}
                    >
                      {state.currentPlayer.jerseyNumber}
                    </div>
                  )}
                  {/* SOLD stamp — persistent while status is "sold" */}
                  <AnimatePresence>
                    {isSold && (
                      <motion.div
                        key="sold-stamp"
                        initial={{ scale: 3, opacity: 0, rotate: -20 }}
                        animate={{ scale: 1, opacity: 1, rotate: -12 }}
                        exit={{ scale: 1.1, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 360, damping: 22 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div
                          className="bg-green-600/90 text-white font-display font-black text-xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl"
                          style={{ transform: "rotate(-12deg)" }}
                        >
                          SOLD
                        </div>
                      </motion.div>
                    )}
                    {isUnsold && (
                      <motion.div
                        key="unsold-stamp"
                        initial={{ scale: 3, opacity: 0, rotate: -20 }}
                        animate={{ scale: 1, opacity: 1, rotate: -12 }}
                        exit={{ scale: 1.1, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 360, damping: 22 }}
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <div
                          className="bg-red-700/90 text-white font-display font-black text-xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl"
                          style={{ transform: "rotate(-12deg)" }}
                        >
                          UNSOLD
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left space-y-3">
                  <div>
                    <h2 className="font-display font-black text-3xl sm:text-4xl leading-none">
                      {state?.currentPlayer?.name}
                    </h2>
                    {playerSpecs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {playerSpecs.slice(0, 4).map((spec, i) => (
                          <span
                            key={i}
                            className="text-xs px-2 py-0.5 rounded-full bg-border/25 text-muted-foreground border border-border/40"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Base: {formatIndianRupee(state?.currentPlayer?.basePrice)}
                    </p>
                  </div>

                  {/* Bid amount */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      {isSold ? "Sold at" : isUnsold ? "Last Bid" : "Current Bid"}
                    </p>
                    {freezeBidUpdates ? (
                      <p
                        className="font-display font-black text-5xl sm:text-6xl leading-none"
                        style={{ color: teamColor, textShadow: `0 0 28px ${teamColor}55` }}
                      >
                        {formatIndianRupee(state?.currentBid || 0)}
                      </p>
                    ) : (
                    <motion.p
                      key={state?.currentBid ?? 0}
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="font-display font-black text-5xl sm:text-6xl leading-none"
                      style={{ color: teamColor, textShadow: `0 0 28px ${teamColor}55` }}
                    >
                      {formatIndianRupee(state?.currentBid || 0)}
                    </motion.p>
                    )}
                  </div>

                  {/* Leading / sold-to team chip */}
                  {state?.currentBidTeamName ? (
                    freezeBidUpdates ? (
                      <div>
                      <span
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
                        style={{
                          borderColor: `${teamColor}55`,
                          backgroundColor: `${teamColor}15`,
                          color: teamColor,
                        }}
                      >
                        {(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ? (
                          <img
                            src={(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl!}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        {isSold ? `Sold to ${state.currentBidTeamName}` : state.currentBidTeamName}
                      </span>
                      </div>
                    ) : (
                    <motion.div
                      key={state.currentBidTeamId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      >
                      <span
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
                        style={{
                          borderColor: `${teamColor}55`,
                          backgroundColor: `${teamColor}15`,
                          color: teamColor,
                        }}
                      >
                        {(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ? (
                          <img
                            src={(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl!}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                        {isSold ? `Sold to ${state.currentBidTeamName}` : state.currentBidTeamName}
                      </span>
                    </motion.div>
                    )
                  ) : isUnsold ? (
                    <div className="flex justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold border-red-500/30 bg-red-500/10 text-red-400">
                        Player returns to pool
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </motion.div>

          ) : showFrozenCard ? (
            // ── Frozen result card — stays visible until next player ───
            <motion.div
              key={`frozen-${lastResult!.playerName}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3 }}
              className="mb-4 p-4 sm:p-5 rounded-2xl backdrop-blur border"
              style={{
                backgroundColor: lastResult!.status === "sold"
                  ? `${lastResult!.soldToTeamColor || "#22c55e"}10`
                  : "rgba(239,68,68,0.06)",
                borderColor: lastResult!.status === "sold"
                  ? `${lastResult!.soldToTeamColor || "#22c55e"}45`
                  : "rgba(239,68,68,0.3)",
              }}
            >
              <div className="flex flex-row items-start gap-4">
                {/* Photo with persistent result stamp */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-24 h-32 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
                    style={{
                      borderColor: lastResult!.status === "sold"
                        ? `${lastResult!.soldToTeamColor || "#22c55e"}55`
                        : "rgba(239,68,68,0.4)",
                    }}
                  >
                    {lastResult!.photoUrl ? (
                      <img src={lastResult!.photoUrl} alt={lastResult!.playerName} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-14 h-14 text-muted-foreground/25" />
                    )}
                  </div>
                  {/* Always-visible result stamp */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className={`font-display font-black text-xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl ${
                        lastResult!.status === "sold"
                          ? "bg-green-600/90 text-white"
                          : "bg-red-700/90 text-white"
                      }`}
                      style={{ transform: "rotate(-12deg)" }}
                    >
                      {lastResult!.status === "sold" ? "SOLD" : "UNSOLD"}
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left space-y-3">
                  <div>
                    <h2 className="font-display font-black text-3xl sm:text-4xl leading-none">
                      {lastResult!.playerName}
                    </h2>
                    {(lastResult!.role || lastResult!.city || lastResult!.age) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {[lastResult!.role, lastResult!.city, lastResult!.age ? `Age ${lastResult!.age}` : null]
                          .filter((v): v is string => !!v)
                          .map((spec, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-border/25 text-muted-foreground border border-border/40">
                              {spec}
                            </span>
                          ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Base: {formatIndianRupee(lastResult!.basePrice)}
                    </p>
                  </div>

                  {lastResult!.status === "sold" ? (
                    <>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                          Sold at
                        </p>
                        <p
                          className="font-display font-black text-5xl sm:text-6xl leading-none"
                          style={{
                            color: lastResult!.soldToTeamColor || "#22c55e",
                            textShadow: `0 0 28px ${lastResult!.soldToTeamColor || "#22c55e"}55`,
                          }}
                        >
                          {formatIndianRupee(lastResult!.soldPrice || 0)}
                        </p>
                      </div>
                      {lastResult!.soldToTeam && (
                        <div>
                          <span
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
                            style={{
                              borderColor: `${lastResult!.soldToTeamColor || "#22c55e"}55`,
                              backgroundColor: `${lastResult!.soldToTeamColor || "#22c55e"}15`,
                              color: lastResult!.soldToTeamColor || "#22c55e",
                            }}
                          >
                            {lastResult!.soldToTeamLogo ? (
                              <img src={lastResult!.soldToTeamLogo} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <Trophy className="w-3.5 h-3.5 flex-shrink-0" />
                            )}
                            Sold to {lastResult!.soldToTeam}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div>
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold border-red-500/30 bg-red-500/10 text-red-400">
                        Player returns to pool
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-center text-xs text-muted-foreground/35 mt-4 tracking-wide uppercase">
                Waiting for next player
              </p>
            </motion.div>

          ) : isIdle ? (
            // ── Idle branded holding screen — auction not started yet ──
            <motion.div key="idle-branded" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-5">
              <IdleHoldingScreen tournament={tournament} />
            </motion.div>

          ) : (
            // ── Paused / between players with no prior result ──────────
            <motion.div
              key="no-player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5 py-12 px-6 rounded-2xl bg-card/30 border border-dashed border-border/40 flex flex-col items-center justify-center text-center gap-3"
            >
              <Gavel className="w-10 h-10 text-muted-foreground/25" />
              {isPaused && !displayMode.overlayMode ? (
                <>
                  <p className="font-display font-bold text-lg text-amber-400">Auction Paused</p>
                  <p className="text-sm text-muted-foreground">The operator has paused the auction.</p>
                </>
              ) : (
                <>
                  <p className="font-display font-bold text-lg text-muted-foreground">Waiting for next player</p>
                  <p className="text-sm text-muted-foreground">The auction will begin shortly.</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </div>

        {/* ── Team grid ──────────────────────────────────────────────── */}
        {teamPurses && teamPurses.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Teams</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {teamPurses.map((team) => {
                const isLeading = state?.currentBidTeamId === team.teamId;
                const tc = team.color || "#F59E0B";
                const short = team.shortCode || team.teamName.slice(0, 4).toUpperCase();
                const maxSquad = team.maximumSquadSize;
                const minSquad = team.minimumSquadSize;
                const bought = team.playersBought;
                const slotsNeeded = team.slotsRequired;
                const reserved = team.reservePurse;
                const spendable = team.spendablePurse;
                const squadFull = maxSquad > 0 && bought >= maxSquad;
                const minMet = minSquad === 0 || slotsNeeded === 0;
                const squadPct = maxSquad > 0
                  ? Math.min(100, (bought / maxSquad) * 100) : 0;
                return (
                  <motion.button
                    key={team.teamId}
                    onClick={() => setSelectedTeamId(team.teamId)}
                    whileTap={{ scale: 0.95 }}
                    className="text-left rounded-xl border transition-all cursor-pointer relative overflow-hidden p-3"
                    style={{
                      backgroundColor: isLeading ? `${tc}10` : "transparent",
                      borderColor: isLeading ? `${tc}88` : "rgba(var(--border), 0.5)",
                      boxShadow: isLeading ? `0 0 18px ${tc}28` : "none",
                    }}
                  >
                    {/* Color accent bar */}
                    <div
                      className="absolute top-0 inset-x-0 h-0.5 rounded-t-xl"
                      style={{ backgroundColor: tc }}
                    />

                    {/* Header */}
                    <div className="flex items-center gap-2 mb-2 mt-0.5">
                      {team.logoUrl ? (
                        <img src={team.logoUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center font-display font-black text-[9px] flex-shrink-0"
                          style={{ backgroundColor: `${tc}22`, color: tc }}
                        >
                          {short.slice(0, 2)}
                        </div>
                      )}
                      <span className="font-display font-black text-sm leading-none truncate" style={{ color: tc }}>
                        {short}
                      </span>
                      {isLeading && (
                        <span className="ml-auto flex-shrink-0 w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      )}
                    </div>

                    <p className="text-[10px] text-muted-foreground truncate leading-tight">{team.teamName}</p>

                    {/* Purse block */}
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Remaining</span>
                        <span className="font-display font-black text-sm tabular-nums" style={{ color: tc }}>
                          {formatShortIndianRupee(team.purseRemaining)}
                        </span>
                      </div>
                      {spendable !== undefined && spendable < team.purseRemaining && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Max Bid</span>
                          <span className={`font-mono font-bold text-xs tabular-nums ${squadFull ? "text-red-400" : "text-emerald-400"}`}>
                            {squadFull ? "Full" : formatShortIndianRupee(spendable)}
                          </span>
                        </div>
                      )}
                      {reserved !== undefined && reserved > 0 && (
                        <div className="flex items-baseline justify-between">
                          <span className="text-[9px] text-amber-400/70 uppercase tracking-wider">Reserved</span>
                          <span className="font-mono font-bold text-[10px] tabular-nums text-amber-400/80">
                            {formatShortIndianRupee(reserved)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Squad capacity */}
                    <div className="mt-1.5">
                      {maxSquad > 0 ? (
                        <>
                          <div className="flex items-center justify-between text-[10px] mb-0.5">
                            <span className={slotsNeeded > 0 ? "text-amber-400" : minMet && minSquad > 0 ? "text-green-400/70" : "text-muted-foreground"}>
                              {bought} / {maxSquad}
                              {slotsNeeded > 0 && ` · need ${slotsNeeded}`}
                              {squadFull && " · FULL"}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${squadFull ? "bg-red-400" : slotsNeeded > 0 ? "bg-amber-400" : "bg-green-400/60"}`}
                              style={{ width: `${squadPct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">
                          {bought} player{bought !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    {/* Top player */}
                    {team.topPlayerName && (
                      <div className="mt-1.5 flex items-center gap-1 min-w-0">
                        <Star className="w-2.5 h-2.5 flex-shrink-0 text-amber-400/60" />
                        <span className="text-[9px] text-muted-foreground truncate">{team.topPlayerName}</span>
                        {team.topPlayerAmount != null && (
                          <span className="text-[9px] font-mono text-amber-400/70 flex-shrink-0 ml-auto tabular-nums">
                            {formatShortIndianRupee(team.topPlayerAmount)}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 text-center pb-2">
          <p className="text-[10px] text-muted-foreground/35 uppercase tracking-widest">
            Powered by BidWar
          </p>
        </div>
      </div>

      {/* ── Sheets & Dialogs ─────────────────────────────────────────── */}
      <TeamSquadSheet
        team={selectedTeam}
        players={playerList}
        open={selectedTeamId !== null}
        onClose={() => setSelectedTeamId(null)}
      />
      <SoundSettingsDialog
        open={soundSettingsOpen}
        onClose={() => setSoundSettingsOpen(false)}
        settings={soundSettings}
        toggle={toggleSound}
      />

      {/* ── Mobile cheer feed rail — collapsible right-edge drawer (xl+ uses the fixed CheerFeedRail) ─── */}
      {cheerEnabled && (
        <div className="xl:hidden">
          <MobileCheerFeed
            messages={cheerMessages}
            teams={teamPurses ?? []}
            heatLevel={heatLevel}
            fanBattle={fanBattle}
            heatMeterEnabled={heatMeterEnabled}
            fanBattleEnabled={fanBattleEnabled}
          />
        </div>
      )}

      {/* ── CHEER LIVE pill button ────────────────────────────────────────── */}
      {cheerEnabled && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
          {heatMeterEnabled && heatLevel && heatLevel !== "CALM" && (
            <div className="xl:hidden">
              <HeatBadge level={heatLevel} />
            </div>
          )}
          <motion.button
            onClick={() => {
              if (!cheerTeamId) {
                setShowTeamSelector(true);
              } else {
                setCheerOpen((o) => !o);
              }
            }}
            whileTap={{ scale: 0.92 }}
            className="flex items-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-black text-sm tracking-wider shadow-lg"
            style={{ boxShadow: "0 0 30px rgba(245,158,11,0.45), 0 4px 18px rgba(0,0,0,0.55)" }}
          >
            <Flame className="w-4 h-4" />
            CHEER LIVE
          </motion.button>
        </div>
      )}

      {/* ── Cheer panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cheerEnabled && cheerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setCheerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-white/10 rounded-t-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>
              <div className="px-5 pb-10 pt-3">
                {cheerTeam ? (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {cheerTeam.logoUrl ? (
                      <img src={cheerTeam.logoUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cheerTeam.color || "#F59E0B" }}
                      />
                    )}
                    <span className="text-sm font-bold" style={{ color: cheerTeam.color || "#F59E0B" }}>
                      {cheerSupporterLabel}
                    </span>
                    <button
                      className="text-xs text-muted-foreground/60 underline ml-1"
                      onClick={() => { setCheerOpen(false); setShowTeamSelector(true); }}
                    >
                      change
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Choose your side to join the cheer.
                  </p>
                )}
                <AnimatePresence>
                  {cheerBlockedMsg && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-sm text-red-400 text-center mb-3"
                    >
                      {cheerBlockedMsg}
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="grid grid-cols-2 gap-3">
                  {cheerPresets.map((preset, i) => (
                    <button
                      key={i}
                      onClick={() => sendCheer(i)}
                      disabled={cheerCooldown}
                      className="rounded-2xl border border-white/15 bg-white/5 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none py-4 px-4 text-sm text-white/90 text-left transition-transform leading-snug"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Pre-Auction countdown overlay (full-screen; break uses shared banner) ── */}
      {stickyDc?.type === "pre-auction" && (
        <BreakCountdownOverlay
          key={stickyDc.endsAt}
          type="pre-auction"
          endsAt={stickyDc.endsAt}
          message={stickyDc.message}
          tournamentName={tournament?.name}
        />
      )}

      {/* ── Team selector — "Choose your side" ───────────────────────────── */}
      <AnimatePresence>
        {showTeamSelector && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60"
              onClick={() => setShowTeamSelector(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] border-t border-white/10 rounded-t-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>
              <div className="px-5 pb-10 pt-3 max-h-[75vh] overflow-y-auto">
                <h3 className="text-center font-display font-black text-lg mb-1">Choose your side</h3>
                <p className="text-center text-xs text-muted-foreground mb-5">Your cheer will represent this team</p>
                <div className="grid grid-cols-2 gap-3">
                  {(teamPurses ?? []).map((team) => {
                    const tc = team.color || "#F59E0B";
                    const isSelected = cheerTeamId === team.teamId;
                    return (
                      <button
                        key={team.teamId}
                        onClick={() => {
                          setCheerTeamId(team.teamId);
                          try { localStorage.setItem("bidwar-cheer-team", String(team.teamId)); } catch {}
                          setShowTeamSelector(false);
                          setTimeout(() => setCheerOpen(true), 80);
                        }}
                        className="flex items-center gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.97]"
                        style={{
                          borderColor: isSelected ? `${tc}88` : "rgba(255,255,255,0.1)",
                          backgroundColor: isSelected ? `${tc}18` : "transparent",
                          boxShadow: isSelected ? `0 0 16px ${tc}28` : "none",
                        }}
                      >
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                            style={{ backgroundColor: `${tc}25`, color: tc }}
                          >
                            {(team.shortCode || team.teamName).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-sm leading-tight truncate" style={{ color: tc }}>
                            {team.shortCode || team.teamName.slice(0, 10)}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {(team.shortCode || team.teamName.slice(0, 4)).toUpperCase()} FANS
                          </p>
                        </div>
                        {isSelected && (
                          <div className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Cheer feed rail — desktop only ───────────────────────────────── */}
      {cheerEnabled && (
        <CheerFeedRail
          messages={cheerMessages}
          teams={teamPurses ?? []}
          heatLevel={heatLevel}
          fanBattle={fanBattle}
          heatMeterEnabled={heatMeterEnabled}
          fanBattleEnabled={fanBattleEnabled}
        />
      )}
    </div>
  );
}
