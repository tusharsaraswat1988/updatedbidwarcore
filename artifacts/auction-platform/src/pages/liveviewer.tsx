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
} from "@workspace/api-client-react";
import type { TeamPurse, Player } from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Radio, Volume2, VolumeX, User, Trophy, Gavel } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

// ── Sound utilities ───────────────────────────────────────────────────────────

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
  [440, 554, 659].forEach((freq, i) => playTone(ac, freq, t + i * 0.13, 0.38, "sine", 0.32));
}

function playBidSound(ac: AudioContext) {
  playTone(ac, 880, ac.currentTime, 0.07, "sine", 0.22);
}

function playSoldSound(ac: AudioContext) {
  const t = ac.currentTime;
  [523, 659, 784].forEach((freq) => playTone(ac, freq, t, 0.75, "triangle", 0.2));
  playTone(ac, 1047, t + 0.38, 0.5, "sine", 0.25);
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
      acRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (acRef.current.state === "suspended") void acRef.current.resume();
    return acRef.current;
  }

  const play = useCallback((sound: SoundKey) => {
    if (!settingsRef.current[sound]) return;
    try {
      const ac = getAC();
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
        <div className="space-y-1 pt-1">
          <p className="text-xs text-muted-foreground pb-3">
            Click anywhere on the page to enable audio. Uses your browser's Web Audio engine.
          </p>
          {(Object.keys(SOUND_LABELS) as SoundKey[]).map((key) => (
            <div
              key={key}
              className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0"
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
      </DialogContent>
    </Dialog>
  );
}

// ── TeamSquadDialog ───────────────────────────────────────────────────────────

function TeamSquadDialog({
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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-border/50">
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
              <DialogTitle className="font-display font-bold text-lg leading-none" style={{ color: tc }}>
                {team?.teamName}
              </DialogTitle>
              {team?.ownerName && (
                <p className="text-xs text-muted-foreground mt-0.5">{team.ownerName}</p>
              )}
            </div>
          </div>
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
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card/60 transition-colors"
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
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LiveViewerPage() {
  const [, params] = useRoute("/tournament/:id/liveviewer");
  const tournamentId = parseInt(params?.id || "0");

  // ── Data ─────────────────────────────────────────────────────────────────
  useAuctionSocket(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 2000,
    },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 8000,
    },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  // ── Sound engine ─────────────────────────────────────────────────────────
  const { play, settings: soundSettings, toggle: toggleSound } = useSoundEngine();

  // ── UI state ─────────────────────────────────────────────────────────────
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [soldVisible, setSoldVisible] = useState(false);

  // ── Sound event detection ─────────────────────────────────────────────────
  type StateSnapshot = NonNullable<typeof state>;
  const prevStateRef = useRef<StateSnapshot | null>(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    if (prev != null && state != null) {
      if (prev.currentPlayer?.id !== state.currentPlayer?.id && state.currentPlayer) {
        play("newPlayer");
      }
      if (prev.currentBid !== state.currentBid && (state.currentBid ?? 0) > 0 &&
          prev.currentPlayer?.id === state.currentPlayer?.id) {
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

  // ── SOLD overlay ──────────────────────────────────────────────────────────
  useEffect(() => {
    if ((state?.status as string) === "sold") {
      setSoldVisible(true);
      const t = setTimeout(() => setSoldVisible(false), 3500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state?.status, state?.soldPlayersCount]);

  // ── Derived values ────────────────────────────────────────────────────────
  const teamColor = state?.currentBidTeamColor || "#F59E0B";
  const hasPlayer = !!state?.currentPlayer;
  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const isSold = (state?.status as string) === "sold";

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
    state?.currentPlayer?.role,
    state?.currentPlayer?.battingStyle,
    state?.currentPlayer?.bowlingStyle,
    state?.currentPlayer?.specialization,
    state?.currentPlayer?.city,
    state?.currentPlayer?.age,
    state?.currentPlayer?.id,
  ]);

  const soldCount = state?.soldPlayersCount ?? 0;
  const unsoldCount = state?.unsoldPlayersCount ?? 0;
  const remainingCount = state?.remainingPlayersCount ?? 0;

  const statusLabel = isSold ? "SOLD"
    : (state?.status as string) === "unsold" ? "UNSOLD"
    : isActive ? "LIVE"
    : isPaused ? "PAUSED"
    : "IDLE";

  const statusRing = (isActive || isSold) ? "bg-green-500/15 text-green-400 border-green-500/30"
    : isPaused ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-border/15 text-muted-foreground border-border/30";

  const anySound = Object.values(soundSettings).some(Boolean);

  return (
    <div
      className="min-h-screen bg-[#09090b] relative"
      onClick={() => {
        try {
          const w = window as unknown as { __bwac?: AudioContext };
          if (w.__bwac?.state === "suspended") void w.__bwac.resume();
        } catch {}
      }}
    >
      {/* Animated background glow — key on teamColor so it fades in on team change */}
      <AnimatePresence>
        <motion.div
          key={teamColor}
          className="fixed inset-0 pointer-events-none z-0"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${teamColor}1a 0%, transparent 55%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5 }}
        />
      </AnimatePresence>

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/8">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Radio className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-display font-black text-primary text-sm tracking-wide hidden sm:block">BidWar</span>
            <span className="text-border/50 hidden sm:block">·</span>
            <p className="font-semibold text-sm truncate text-foreground">
              {tournament?.name || "Auction"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusRing}`}>
              {(isActive || isSold) && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              )}
              {statusLabel}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setSoundSettingsOpen(true); }}
              className="p-2 rounded-lg border border-border/40 hover:border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Sound settings"
            >
              {anySound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 pb-12">

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 py-4">
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-xl sm:text-2xl text-green-400">{soldCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Sold</p>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-xl sm:text-2xl text-amber-400">{remainingCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Remaining</p>
          </div>
          <div className="text-center p-3 sm:p-4 rounded-xl bg-card/40 border border-border/40">
            <p className="font-display font-black text-xl sm:text-2xl text-red-400">{unsoldCount}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">Unsold</p>
          </div>
        </div>

        {/* ── Player section ─────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {hasPlayer ? (
            <motion.div
              key={state?.currentPlayer?.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3 }}
              className="mb-5 p-4 sm:p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Photo column */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
                    style={{ borderColor: `${teamColor}55` }}
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
                  {state?.currentPlayer?.jerseyNumber && (
                    <div
                      className="absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center font-display font-black text-xs text-black shadow-lg"
                      style={{ backgroundColor: teamColor }}
                    >
                      {state.currentPlayer.jerseyNumber}
                    </div>
                  )}
                  {/* SOLD stamp */}
                  <AnimatePresence>
                    {soldVisible && (
                      <motion.div
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
                  </AnimatePresence>
                </div>

                {/* Info column */}
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                  <div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl leading-none">
                      {state?.currentPlayer?.name}
                    </h2>
                    {playerSpecs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
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
                      Current Bid
                    </p>
                    <motion.p
                      key={state?.currentBid ?? 0}
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="font-display font-black text-4xl sm:text-5xl leading-none"
                      style={{ color: teamColor, textShadow: `0 0 28px ${teamColor}55` }}
                    >
                      {formatIndianRupee(state?.currentBid || 0)}
                    </motion.p>
                  </div>

                  {/* Leading team chip */}
                  {state?.currentBidTeamName ? (
                    <motion.div
                      key={state.currentBidTeamId}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex justify-center sm:justify-start"
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
                        {state.currentBidTeamName}
                      </span>
                    </motion.div>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="no-player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-5 py-12 px-6 rounded-2xl bg-card/30 border border-dashed border-border/40 flex flex-col items-center justify-center text-center gap-3"
            >
              <Gavel className="w-10 h-10 text-muted-foreground/25" />
              {isPaused ? (
                <>
                  <p className="font-display font-bold text-lg text-amber-400">Auction Paused</p>
                  <p className="text-sm text-muted-foreground">The operator has paused bidding.</p>
                </>
              ) : (
                <>
                  <p className="font-display font-bold text-lg text-muted-foreground">Waiting for next player</p>
                  <p className="text-sm text-muted-foreground">
                    {soldCount > 0
                      ? `${soldCount} player${soldCount !== 1 ? "s" : ""} sold so far`
                      : "The auction will begin shortly."}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Team grid ──────────────────────────────────────────────── */}
        {teamPurses && teamPurses.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Teams</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {teamPurses.map((team) => {
                const isLeading = state?.currentBidTeamId === team.teamId;
                const tc = team.color || "#F59E0B";
                const short = team.shortCode || team.teamName.slice(0, 4).toUpperCase();
                return (
                  <motion.button
                    key={team.teamId}
                    onClick={(e) => { e.stopPropagation(); setSelectedTeamId(team.teamId); }}
                    whileTap={{ scale: 0.95 }}
                    className="text-left rounded-xl border transition-all cursor-pointer relative overflow-hidden p-3"
                    style={{
                      backgroundColor: isLeading ? `${tc}10` : "transparent",
                      borderColor: isLeading ? `${tc}88` : "rgba(var(--border), 0.5)",
                      boxShadow: isLeading ? `0 0 18px ${tc}28` : "none",
                    }}
                  >
                    {/* Color accent bar */}
                    <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-xl" style={{ backgroundColor: tc }} />

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

                    <p className="text-[11px] text-muted-foreground truncate leading-tight">
                      {team.teamName}
                    </p>
                    <p className="font-display font-black text-sm mt-1.5 tabular-nums" style={{ color: tc }}>
                      {formatShortIndianRupee(team.purseRemaining)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {team.playersBought} player{team.playersBought !== 1 ? "s" : ""}
                    </p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="text-[10px] text-muted-foreground/35 uppercase tracking-widest">
            Powered by BidWar
          </p>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <TeamSquadDialog
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
    </div>
  );
}
