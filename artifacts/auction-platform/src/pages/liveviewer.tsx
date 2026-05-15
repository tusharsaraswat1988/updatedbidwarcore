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
import { Input } from "@/components/ui/input";
import { Radio, Volume2, VolumeX, User, Trophy, Gavel } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

import { DEFAULT_CHEER_PRESETS, CHEER_MESSAGE_TTL_MS } from "@/lib/cheer-constants";

type CheerEntry = { id: string; senderName: string; message: string; timestamp: number };

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

// ── Main LiveViewerPage ───────────────────────────────────────────────────────

export default function LiveViewerPage() {
  const [, params] = useRoute("/tournament/:id/liveviewer");
  const tournamentId = parseInt(params?.id || "0");

  // ── Cheer state (declared early so the socket callback is stable) ─────────
  const [cheerMessages, setCheerMessages] = useState<CheerEntry[]>([]);
  const [cheerName, setCheerName] = useState<string>(() => {
    try { return localStorage.getItem("bidwar-viewer-name") ?? ""; } catch { return ""; }
  });
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [cheerCooldown, setCheerCooldown] = useState(false);
  const [pendingPresetIndex, setPendingPresetIndex] = useState<number | null>(null);
  const [cheerBlockedMsg, setCheerBlockedMsg] = useState<string | null>(null);

  const handleCheerMessage = useCallback((msg: CheerMessage) => {
    setCheerMessages((prev) => {
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          senderName: msg.senderName,
          message: msg.message,
          timestamp: Date.now(),
        },
      ];
      return next.slice(-8);
    });
  }, []);

  useEffect(() => {
    if (cheerMessages.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - CHEER_MESSAGE_TTL_MS;
      setCheerMessages((prev) => prev.filter((m) => m.timestamp > cutoff));
    }, 1000);
    return () => clearInterval(timer);
  }, [cheerMessages.length]);

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
      refetchInterval: isCompleted ? false : 2000,
      staleTime: 0,
    },
  });
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: isCompleted ? false : 8000,
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
  const cheerPresets = useMemo<string[]>(() => {
    const raw = tournament?.cheerMessagePresets;
    if (!raw) return DEFAULT_CHEER_PRESETS;
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p) && p.length > 0) return p as string[];
    } catch {}
    return DEFAULT_CHEER_PRESETS;
  }, [tournament?.cheerMessagePresets]);

  function showCheerError(msg: string) {
    setCheerBlockedMsg(msg);
    setTimeout(() => setCheerBlockedMsg(null), 2500);
  }

  async function postCheer(senderName: string, idx: number) {
    try {
      const r = await fetch(`/api/tournaments/${tournamentId}/cheer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, messageIndex: idx }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        if (r.status === 429) showCheerError("Slow down!");
        else if (r.status === 400) showCheerError(d.error === "Name contains disallowed words" ? "Name not allowed" : "Could not send");
        else if (r.status === 403) showCheerError("Cheers are disabled");
      }
    } catch {}
  }

  function sendCheer(idx: number) {
    if (cheerCooldown) return;
    if (!cheerName) {
      setPendingPresetIndex(idx);
      setNameInput("");
      setShowNameDialog(true);
      return;
    }
    setCheerCooldown(true);
    setTimeout(() => setCheerCooldown(false), 500);
    void postCheer(cheerName, idx);
  }

  function saveNameAndCheer() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try { localStorage.setItem("bidwar-viewer-name", trimmed); } catch {}
    setCheerName(trimmed);
    setShowNameDialog(false);
    const idx = pendingPresetIndex;
    setPendingPresetIndex(null);
    if (idx !== null) {
      setCheerCooldown(true);
      setTimeout(() => setCheerCooldown(false), 500);
      void postCheer(trimmed, idx);
    }
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
  const teamColor = state?.currentBidTeamColor || "#F59E0B";
  const hasPlayer = !!state?.currentPlayer;
  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
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
    <div className="min-h-screen bg-[#09090b] relative">
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

      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-white/8">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-7 w-auto flex-shrink-0 hidden sm:block" />
            <span className="font-display font-black text-white text-sm tracking-wide hidden sm:block">BIDWAR</span>
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
              onClick={() => setSoundSettingsOpen(true)}
              className="p-2 rounded-lg border border-border/40 hover:border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Sound settings"
            >
              {anySound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Sponsor strip ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2.5 py-1.5 bg-black/25 border-b border-white/5">
        {tournament?.logoUrl && (
          <img src={tournament.logoUrl} alt="" className="w-4 h-4 object-contain opacity-50 rounded" />
        )}
        <p className="text-[10px] text-muted-foreground/45 font-medium tracking-wide">
          {tournament?.name ? `${tournament.name} · ` : ""}Powered by BidWar
        </p>
      </div>

      {/* ── Last result ticker ────────────────────────────────────────── */}
      {lastResult && (
        <div className="overflow-hidden bg-black/35 border-b border-white/5 py-1.5">
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
            // ── Active / live player card ──────────────────────────────
            <motion.div
              key={state?.currentPlayer?.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.3 }}
              className="mb-5 p-4 sm:p-6 rounded-2xl backdrop-blur border transition-colors"
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
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Photo */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
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
                      {isSold ? "Sold at" : isUnsold ? "Last Bid" : "Current Bid"}
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

                  {/* Leading / sold-to team chip */}
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
                        {isSold ? `Sold to ${state.currentBidTeamName}` : state.currentBidTeamName}
                      </span>
                    </motion.div>
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
              className="mb-5 p-4 sm:p-6 rounded-2xl backdrop-blur border"
              style={{
                backgroundColor: lastResult!.status === "sold"
                  ? `${lastResult!.soldToTeamColor || "#22c55e"}10`
                  : "rgba(239,68,68,0.06)",
                borderColor: lastResult!.status === "sold"
                  ? `${lastResult!.soldToTeamColor || "#22c55e"}45`
                  : "rgba(239,68,68,0.3)",
              }}
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Photo with persistent result stamp */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-28 h-36 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
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
                <div className="flex-1 min-w-0 text-center sm:text-left space-y-3">
                  <div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl leading-none">
                      {lastResult!.playerName}
                    </h2>
                    {(lastResult!.role || lastResult!.city || lastResult!.age) && (
                      <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
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
                          className="font-display font-black text-4xl sm:text-5xl leading-none"
                          style={{
                            color: lastResult!.soldToTeamColor || "#22c55e",
                            textShadow: `0 0 28px ${lastResult!.soldToTeamColor || "#22c55e"}55`,
                          }}
                        >
                          {formatIndianRupee(lastResult!.soldPrice || 0)}
                        </p>
                      </div>
                      {lastResult!.soldToTeam && (
                        <div className="flex justify-center sm:justify-start">
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
                    <div className="flex justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold border-red-500/30 bg-red-500/10 text-red-400">
                        Player returns to pool
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-center text-[10px] text-muted-foreground/35 mt-4 tracking-wide uppercase">
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
              {isPaused ? (
                <>
                  <p className="font-display font-bold text-lg text-amber-400">Auction Paused</p>
                  <p className="text-sm text-muted-foreground">The operator has paused bidding.</p>
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

        {/* ── Team grid ──────────────────────────────────────────────── */}
        {teamPurses && teamPurses.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-3">Teams</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {teamPurses.map((team) => {
                const isLeading = state?.currentBidTeamId === team.teamId;
                const tc = team.color || "#F59E0B";
                const short = team.shortCode || team.teamName.slice(0, 4).toUpperCase();
                const squadPct = team.maximumSquadSize > 0
                  ? Math.min(100, (team.playersBought / team.maximumSquadSize) * 100)
                  : 0;
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

                    <p className="text-[11px] text-muted-foreground truncate leading-tight">{team.teamName}</p>
                    <p className="font-display font-black text-sm mt-1.5 tabular-nums" style={{ color: tc }}>
                      {formatShortIndianRupee(team.purseRemaining)}
                    </p>

                    {/* Squad capacity */}
                    {team.maximumSquadSize > 0 ? (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>{team.playersBought} / {team.maximumSquadSize}</span>
                        </div>
                        <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${squadPct}%`, backgroundColor: tc }}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {team.playersBought} player{team.playersBought !== 1 ? "s" : ""}
                      </p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        <div className={`mt-10 text-center ${cheerEnabled ? "pb-16" : ""}`}>
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

      {/* ── Floating cheer strip ──────────────────────────────────────────── */}
      {cheerEnabled && cheerMessages.length > 0 && (
        <div className="fixed bottom-[72px] right-3 z-50 flex flex-col-reverse gap-1.5 pointer-events-none w-72 max-w-[55vw]">
          <AnimatePresence mode="popLayout">
            {cheerMessages.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 24, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.88 }}
                transition={{ type: "spring", stiffness: 380, damping: 26 }}
                className="bg-black/75 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 text-xs text-white flex items-center gap-1.5 min-w-0"
              >
                <span className="font-bold text-amber-400 truncate flex-shrink-0 max-w-[90px]">
                  {m.senderName}
                </span>
                <span className="truncate text-white/80">{m.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Cheer chip bar ────────────────────────────────────────────────── */}
      {cheerEnabled && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm border-t border-white/10 px-3 py-2">
          <AnimatePresence>
            {cheerBlockedMsg && (
              <motion.div
                key="cheer-error"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="text-[11px] text-red-400 text-center mb-1"
              >
                {cheerBlockedMsg}
              </motion.div>
            )}
          </AnimatePresence>
          <div
            className="flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" } as React.CSSProperties}
          >
            {cheerPresets.map((preset, i) => (
              <button
                key={i}
                onClick={() => sendCheer(i)}
                disabled={cheerCooldown}
                className="flex-shrink-0 rounded-full border border-white/20 bg-white/5 hover:bg-white/15 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all px-3 py-1 text-xs text-white/85 whitespace-nowrap"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Cheer name dialog ─────────────────────────────────────────────── */}
      <Dialog
        open={showNameDialog}
        onOpenChange={(open) => {
          if (!open) { setShowNameDialog(false); setPendingPresetIndex(null); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enter your display name</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            Your name will appear alongside your cheer. Max 30 characters.
          </p>
          <Input
            className="mt-3"
            placeholder="Your name..."
            maxLength={30}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveNameAndCheer(); }}
            autoFocus
          />
          <div className="flex gap-2 mt-3 justify-end">
            <button
              className="text-xs text-muted-foreground px-3 py-1.5 rounded hover:bg-muted/20 transition-colors"
              onClick={() => { setShowNameDialog(false); setPendingPresetIndex(null); }}
            >
              Cancel
            </button>
            <button
              disabled={!nameInput.trim()}
              className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold px-3 py-1.5 rounded transition-colors"
              onClick={saveNameAndCheer}
            >
              Join Cheer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
