import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import type { TeamPurse, Player, Tournament, AuctionState } from "@workspace/api-client-react";
import { useAuctionSocket, type CheerMessage } from "@/hooks/use-auction-socket";
import { useAuctionConnectionState } from "@/hooks/use-auction-connection-state";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Radio, Volume2, VolumeX, User, Trophy, Gavel, MessageCircle, X, Star, Flame, ChevronRight, SlidersHorizontal, Check, Sparkles } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { resolveRetainedSpend } from "@workspace/api-base";
import { normalizeAuctionUnit } from "@workspace/api-base/auction-unit";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { useBranding } from "@/hooks/use-branding";

import { DEFAULT_CHEER_PRESETS } from "@/lib/cheer-constants";
import { BreakCountdownOverlay } from "@/components/display/break-countdown-overlay";
import { AuctionStatusOverlay } from "@/components/display/auction-status-overlay";
import { DisplayConnectionBanner } from "@/components/display/display-connection-banner";
import { OutcomeResultPanel } from "@/components/display/outcome-result-panel";
import { deriveAuctionDisplayMode, outcomeEventKey, soldRecordFromOutcome, unsoldRecordFromOutcome } from "@/lib/auction-display-status";
import { useStickyCountdown } from "@/hooks/use-sticky-countdown";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import { SponsorTicker, SPONSOR_RIBBON_TOTAL_HEIGHT_PX } from "@/components/display/sponsor-ticker";
import { getSponsorsByPriority, parseSponsorLogos } from "@/lib/sponsor-logo";

const TEAMS_PREVIEW = 6;
const MOBILE_CHEER_VISIBLE_LIMIT = 3;
/** Clearance above sponsor ribbon for the fixed CHEER LIVE pill (mobile). */
const MOBILE_CHEER_BUTTON_CLEARANCE_PX = 52;

type CheerEntry = { id: string; supporterLabel: string; message: string; teamColor: string | null; teamId: number; timestamp: number };

// ── Sound utilities (module-level, no hooks) ──────────────────────────────────

type SoundKey = "newPlayer" | "bid" | "sold" | "unsold" | "cheer";
type SoundSettings = Record<SoundKey, boolean>;

const SOUND_LABELS: Record<SoundKey, string> = {
  newPlayer: "New player announced",
  bid: "Bid placed",
  sold: "Player sold",
  unsold: "Player unsold",
  cheer: "Live cheer reactions",
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

function playCheerSound(ac: AudioContext) {
  const t = ac.currentTime;
  // Soft, subtle harmonic bubble-pop chime (E5 -> A5) with gentle low gain
  playTone(ac, 659.25, t, 0.12, "sine", 0.07);
  playTone(ac, 880, t + 0.05, 0.18, "sine", 0.05);
}

// ── useSoundEngine ────────────────────────────────────────────────────────────

function useSoundEngine() {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    try {
      const raw = localStorage.getItem("bidwar_viewer_sounds");
      if (raw) return JSON.parse(raw) as SoundSettings;
    } catch {}
    return { newPlayer: true, bid: true, sold: true, unsold: true, cheer: true };
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
        case "cheer":     playCheerSound(ac);     break;
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

  const anySound = useMemo(() => Object.values(settings).some(Boolean), [settings]);

  const toggleAll = useCallback(() => {
    setSettings((prev) => {
      const currentlyAnyOn = Object.values(prev).some(Boolean);
      const nextVal = !currentlyAnyOn;
      const next: SoundSettings = {
        newPlayer: nextVal,
        bid: nextVal,
        sold: nextVal,
        unsold: nextVal,
        cheer: nextVal,
      };
      try { localStorage.setItem("bidwar_viewer_sounds", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { play, settings, toggle, toggleAll, anySound };
}

function playerAcquisitionAmount(player: {
  status?: string | null;
  soldPrice?: number | null;
  retainedPrice?: number | null;
  basePrice?: number | null;
}): number {
  if (player.status === "retained") {
    return resolveRetainedSpend({
      status: "retained",
      retainedPrice: player.retainedPrice,
      basePrice: player.basePrice,
    });
  }
  return player.soldPrice ?? 0;
}

// ── TeamSquadSheet — bottom sheet on mobile, centered modal on desktop ─────────

function TeamSquadSheet({
  team,
  players,
  open,
  onClose,
  unit,
}: {
  team: TeamPurse | null;
  players: Player[];
  open: boolean;
  onClose: () => void;
  unit: AuctionUnit;
}) {
  const fmtShort = (amount: number | null | undefined) => formatShortIndianRupee(amount, unit);
  const tc = team?.color || "#F59E0B";
  const squadPlayers = useMemo(
    () =>
      players
        .filter((p) => p.teamId === team?.teamId && (p.status === "sold" || p.status === "retained"))
        .sort((a, b) => playerAcquisitionAmount(b) - playerAcquisitionAmount(a)),
    [players, team?.teamId],
  );

  return (
    <AnimatePresence>
      {open && team && (
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
                  <img src={cldUrl(team.logoUrl, "teamLogo")} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                    style={{ backgroundColor: `${tc}22`, color: tc, border: `2px solid ${tc}44` }}
                  >
                    {team?.shortCode?.slice(0, 3) || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-lg leading-none truncate" style={{ color: tc }}>
                    {team?.teamName}
                  </p>
                  {team?.ownerName && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{team.ownerName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex-shrink-0"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Purse stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-xl bg-card/60 border border-border/50 text-center">
                  <p className="font-display font-black text-base" style={{ color: tc }}>
                    {fmtShort(team?.purseRemaining ?? 0)}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Remaining</p>
                </div>
                <div className="p-2.5 rounded-xl bg-card/60 border border-border/50 text-center">
                  <p className="font-display font-black text-base text-foreground">
                    {fmtShort(team?.purseUsed ?? 0)}
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
              {(team?.maxAllowedBid !== undefined || (team?.futureReservePurse ?? team?.reservePurse ?? 0) > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {team?.maxAllowedBid !== undefined && (
                    <div className="p-2 rounded-lg bg-card/40 border border-border/40 text-center">
                      <p className={`font-mono font-bold text-sm tabular-nums ${(team.maximumSquadSize > 0 && team.playersBought >= team.maximumSquadSize) ? "text-red-400" : "text-emerald-400"}`}>
                        {(team.maximumSquadSize > 0 && team.playersBought >= team.maximumSquadSize)
                          ? "Squad Full"
                          : fmtShort(team.maxAllowedBid)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Max Bid</p>
                    </div>
                  )}
                  {(team?.futureReservePurse ?? team?.reservePurse ?? 0) > 0 && (
                    <div className="p-2 rounded-lg bg-card/40 border border-border/40 text-center">
                      <p className="font-mono font-bold text-sm tabular-nums text-amber-400/90">
                        {fmtShort(team?.futureReservePurse ?? team?.reservePurse ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Reserved</p>
                    </div>
                  )}
                </div>
              )}
              {(team?.maximumSquadSize ?? 0) > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] mb-1 text-muted-foreground">
                    <span>Squad</span>
                    <span>{team?.playersBought ?? 0} / {team?.maximumSquadSize}</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400/70"
                      style={{
                        width: `${Math.min(100, ((team?.playersBought ?? 0) / (team?.maximumSquadSize ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {team?.topPlayerName && (
                <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-2">
                  <Star className="w-3 h-3 flex-shrink-0 text-amber-400" />
                  <span className="text-xs text-muted-foreground truncate flex-1">{team.topPlayerName}</span>
                  {team.topPlayerAmount != null && (
                    <span className="text-xs font-mono font-bold text-amber-400 tabular-nums">
                      {fmtShort(team.topPlayerAmount)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Player list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 pb-8 sm:pb-4">
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
                          <img src={cldUrl(player.photoUrl, "thumbnail")} alt={player.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-none truncate">{player.name}</p>
                        {player.role && (
                          <p className="text-xs text-muted-foreground capitalize mt-0.5 flex items-center gap-1.5">
                            {player.role}
                            {player.status === "retained" && (
                              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide bg-amber-400/10 px-1.5 py-0.5 rounded-full border border-amber-400/30">
                                Retained
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      {playerAcquisitionAmount(player) > 0 ? (
                        <p className="text-xs font-bold tabular-nums flex-shrink-0" style={{ color: tc }}>
                          {fmtShort(playerAcquisitionAmount(player))}
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

// ── AllTeamsSheet — full team list when preview is capped at 6 ────────────────

function AllTeamsSheet({
  teams,
  leadingTeamId,
  open,
  onClose,
  onSelectTeam,
}: {
  teams: TeamPurse[];
  leadingTeamId?: number | null;
  open: boolean;
  onClose: () => void;
  onSelectTeam: (teamId: number) => void;
}) {
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
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative z-10 w-full sm:max-w-lg bg-[#18181b] border border-border/60 rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
          >
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex-shrink-0 px-5 py-4 border-b border-border/50">
              <h3 className="font-display font-black text-lg">All Teams</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tap a team for purse & squad details</p>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {teams.map((team) => {
                  const tc = team.color || "#F59E0B";
                  const isLeading = leadingTeamId === team.teamId;
                  return (
                    <button
                      key={team.teamId}
                      type="button"
                      onClick={() => {
                        onSelectTeam(team.teamId);
                        onClose();
                      }}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all active:scale-[0.97]"
                      style={{
                        borderColor: isLeading ? `${tc}88` : "rgba(var(--border), 0.5)",
                        backgroundColor: isLeading ? `${tc}12` : "transparent",
                      }}
                    >
                      {team.logoUrl ? (
                        <img src={cldUrl(team.logoUrl, "teamLogo")} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-xs"
                          style={{ backgroundColor: `${tc}22`, color: tc }}
                        >
                          {(team.shortCode || team.teamName).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-semibold leading-tight line-clamp-2" style={{ color: tc }}>
                        {team.teamName}
                      </span>
                      {isLeading && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-green-400">Leading</span>
                      )}
                    </button>
                  );
                })}
              </div>
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
              <label
                key={key}
                className="flex items-center justify-between py-3 border-b border-border/30 last:border-0 cursor-pointer"
              >
                <span className="text-sm">{SOUND_LABELS[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings[key]}
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
              </label>
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
  onSelectTeam,
}: {
  tournament: Tournament | undefined;
  players: Player[];
  teamPurses: TeamPurse[] | undefined;
  onSelectTeam: (teamId: number) => void;
}) {
  const unit = normalizeAuctionUnit(tournament?.auctionUnit);
  const fmtShort = (amount: number | null | undefined) => formatShortIndianRupee(amount, unit);
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full max-w-3xl mx-auto">
      {/* Hero */}
      <div className="flex-shrink-0 text-center space-y-3 py-4 px-2">
        {tournament?.logoUrl && (
          <img src={cldUrl(tournament.logoUrl, "headerLogo")} alt="" className="w-14 h-14 object-contain mx-auto opacity-80" />
        )}
        <Trophy className="w-10 h-10 text-primary mx-auto" />
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-foreground leading-tight">
            Auction Concluded
          </h1>
          {tournament?.name && (
            <p className="font-display font-bold text-base sm:text-lg text-amber-400/90 mt-1.5 line-clamp-2">{tournament.name}</p>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-24 space-y-4">
      {/* Overall stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
          <p className="font-display font-black text-2xl text-green-400">{soldPlayers.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Players Sold</p>
        </div>
        <div className="p-3 rounded-xl bg-card/50 border border-border/50 text-center">
          <p className="font-display font-black text-xl text-primary">{fmtShort(totalSpend)}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Total Spend</p>
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
                      <img src={cldUrl(player.photoUrl, "thumbnail")} alt={player.name} className="w-full h-full object-cover" />
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
                    {fmtShort(player.soldPrice!)}
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
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Team Standings</p>
            <p className="text-[10px] text-muted-foreground/70">Tap a team to view squad</p>
          </div>
          <div className="space-y-2">
            {teamStandings.map((team) => {
              const tc = team.color || "#F59E0B";
              const fillPct = team.maximumSquadSize > 0
                ? Math.min(100, (team.playersBought / team.maximumSquadSize) * 100)
                : 0;
              return (
                <button
                  key={team.teamId}
                  type="button"
                  onClick={() => onSelectTeam(team.teamId)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-border/40 hover:bg-card/60 active:scale-[0.99] transition-all cursor-pointer text-left"
                >
                  {team.logoUrl ? (
                    <img src={cldUrl(team.logoUrl, "teamLogo")} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
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
                        {fmtShort(team.purseUsed)}
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
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-center pt-2 pb-1">
        <p className="text-[10px] text-muted-foreground/35 uppercase tracking-widest">Powered by BidWar</p>
      </div>
      </div>
    </div>
  );
}

// ── Idle branded holding screen ───────────────────────────────────────────────

function IdleHoldingScreen({ tournament }: { tournament?: Tournament }) {
  return (
    <div className="py-10 px-5 md:py-14 md:px-6 rounded-2xl bg-card/20 border border-dashed border-border/40 flex flex-col items-center gap-4 md:gap-5">
      {tournament?.logoUrl ? (
        <img src={cldUrl(tournament.logoUrl, "headerLogo")} alt="" className="w-20 h-20 object-contain opacity-75 rounded-xl" />
      ) : (
        <Radio className="w-14 h-14 text-primary/35" />
      )}
      <div className="text-center space-y-2 md:space-y-1.5">
        <p className="font-display font-bold text-[22px] md:text-xl text-foreground leading-tight">
          {tournament?.name || "Live Auction"}
        </p>
        <p className="text-[15px] md:text-sm text-muted-foreground">Waiting for the auction to start</p>
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
  onOpenCheer,
  cheerTeam,
  cooldownSecondsLeft = 0,
}: {
  messages: CheerEntry[];
  teams: TeamPurse[];
  heatLevel: string | null;
  fanBattle: Record<string, number>;
  heatMeterEnabled: boolean;
  fanBattleEnabled: boolean;
  onOpenCheer?: () => void;
  cheerTeam?: TeamPurse | null;
  cooldownSecondsLeft?: number;
}) {
  return (
    <div className="hidden xl:flex fixed right-0 top-0 bottom-0 w-80 z-20 flex-col border-l border-white/10 bg-black/65 backdrop-blur-2xl">
      {/* Rail header */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-foreground">Live Fan Cheer</span>
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
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 p-3">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground/60 font-medium">No cheers yet</p>
            <p className="text-xs text-muted-foreground/35 mt-1">Be the first to cheer for your team!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {[...messages].reverse().map((m) => (
              <CheerCard key={m.id} entry={m} />
            ))}
          </AnimatePresence>
        )}
      </div>
      {/* Rail bottom cheer button */}
      {onOpenCheer && (
        <div className="flex-shrink-0 p-3.5 border-t border-white/10 bg-black/40">
          <motion.button
            onClick={cooldownSecondsLeft > 0 ? undefined : onOpenCheer}
            disabled={cooldownSecondsLeft > 0}
            whileTap={{ scale: 0.96 }}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-black text-sm flex items-center justify-center gap-2 shadow-lg hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all cursor-pointer"
            style={{ boxShadow: "0 0 24px rgba(245,158,11,0.35)" }}
          >
            {cooldownSecondsLeft > 0 ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                WAIT {cooldownSecondsLeft}S
              </>
            ) : (
              <>
                <Flame className="w-4 h-4 fill-black" />
                {cheerTeam ? `CHEER FOR ${cheerTeam.shortCode || cheerTeam.teamName}` : "CHEER LIVE"}
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

type FloatingReactionItem = {
  id: string;
  label: string;
  emoji: string;
  teamColor: string;
  xOffset: number;
};

function FloatingReactionOverlay({ reactions }: { reactions: FloatingReactionItem[] }) {
  if (reactions.length === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-24 pointer-events-none z-30 flex justify-center items-end h-64 overflow-hidden xl:hidden">
      <AnimatePresence>
        {reactions.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 40, scale: 0.7, x: item.xOffset }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -180,
              scale: [0.7, 1.25, 1.1, 0.85],
              x: item.xOffset * 1.6,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.3, ease: "easeOut" }}
            className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-lg"
            style={{
              backgroundColor: `${item.teamColor}28`,
              borderColor: `${item.teamColor}60`,
              boxShadow: `0 4px 20px ${item.teamColor}33`,
            }}
          >
            <span className="text-xl leading-none">{item.emoji}</span>
            <span className="text-xs font-bold font-display" style={{ color: item.teamColor }}>
              {item.label}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function MobileFanBattle({
  fanBattle,
  teams,
}: {
  fanBattle: Record<string, number>;
  teams: TeamPurse[];
}) {
  const sorted = useMemo(() => {
    return Object.entries(fanBattle)
      .map(([id, count]) => {
        const team = teams.find((t) => String(t.teamId) === id);
        return { id, count, team };
      })
      .filter((x): x is { id: string; count: number; team: TeamPurse } => !!x.team)
      .sort((a, b) => b.count - a.count)
      .slice(0, 2);
  }, [fanBattle, teams]);

  if (sorted.length < 2) return null;
  const total = sorted.reduce((sum, x) => sum + x.count, 0) || 1;
  const [t1, t2] = sorted;
  const t1Pct = Math.round((t1.count / total) * 100);
  const t2Pct = 100 - t1Pct;
  const c1 = t1.team.color || "#F59E0B";
  const c2 = t2.team.color || "#3B82F6";

  return (
    <div className="flex-shrink-0 px-1 py-1 mb-2 xl:hidden">
      <div className="p-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5">
          <span className="flex items-center gap-1 truncate max-w-[42%]" style={{ color: c1 }}>
            <Flame className="w-3 h-3 flex-shrink-0 animate-pulse" />
            <span className="truncate">{t1.team.shortCode || t1.team.teamName.slice(0, 8)}</span>
            <span className="font-mono">({t1Pct}%)</span>
          </span>
          <span className="text-[9px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-white/5">
            FAN BATTLE
          </span>
          <span className="flex items-center gap-1 truncate max-w-[42%] justify-end" style={{ color: c2 }}>
            <span className="font-mono">({t2Pct}%)</span>
            <span className="truncate">{t2.team.shortCode || t2.team.teamName.slice(0, 8)}</span>
            <Flame className="w-3 h-3 flex-shrink-0 animate-pulse" />
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 flex overflow-hidden">
          <motion.div
            className="h-full rounded-l-full"
            style={{ backgroundColor: c1 }}
            animate={{ width: `${t1Pct}%` }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            className="h-full rounded-r-full"
            style={{ backgroundColor: c2 }}
            animate={{ width: `${t2Pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>
    </div>
  );
}

function MobileCheerBubble({ entry }: { entry: CheerEntry }) {
  const tc = entry.teamColor || "#F59E0B";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      className="flex items-start gap-1.5 w-fit max-w-full rounded-2xl px-2.5 py-1.5 bg-black/65 backdrop-blur-md border border-white/10 shadow-lg"
      style={{ boxShadow: `0 2px 12px ${tc}20` }}
    >
      <span
        className="font-bold text-[11px] leading-snug flex-shrink-0"
        style={{ color: tc }}
      >
        {entry.supporterLabel}
      </span>
      <span className="text-[11px] text-white/90 leading-snug break-words">
        {entry.message}
      </span>
    </motion.div>
  );
}

function MobileCheerFeed({
  messages,
  overlayBottom,
  hide = false,
}: {
  messages: CheerEntry[];
  overlayBottom: number;
  hide?: boolean;
}) {
  if (hide) return null;
  const visibleMessages = messages.slice(-MOBILE_CHEER_VISIBLE_LIMIT);

  if (visibleMessages.length === 0) return null;

  return (
    <div
      className="fixed left-3 z-20 flex flex-col max-w-[min(62vw,240px)] pointer-events-none xl:hidden"
      style={{ bottom: overlayBottom }}
    >
      <div className="pointer-events-auto flex flex-col gap-1.5 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout">
          {visibleMessages.map((m) => (
            <MobileCheerBubble key={m.id} entry={m} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Main LiveViewerPage ───────────────────────────────────────────────────────

export default function LiveViewerPage() {
  const [, legacyParams] = useRoute("/tournament/:id/liveviewer");
  const [, liveParams] = useRoute("/live/:id");
  const tournamentId = parseInt(legacyParams?.id || liveParams?.id || "0");
  const { logos, brandName } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const viewerHeaderPreset = getBrandSurfacePreset("auction-viewer-header");
  const miniLogoSrc = getBrandLogoSrc(logos, viewerHeaderPreset.logoOrder);

  // ── Sound engine ─────────────────────────────────────────────────────────
  const { play, settings: soundSettings, toggle: toggleSound, toggleAll: toggleAllSounds, anySound } = useSoundEngine();

  // ── Cheer state (declared early so the socket callback is stable) ─────────
  const [cheerMessages, setCheerMessages] = useState<CheerEntry[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReactionItem[]>([]);
  const [cheerTeamId, setCheerTeamId] = useState<number | null>(() => {
    try { const v = localStorage.getItem("bidwar-cheer-team"); return v ? parseInt(v) : null; } catch { return null; }
  });
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [cheerCooldown, setCheerCooldown] = useState(false);
  const [cheerCooldownSecondsLeft, setCheerCooldownSecondsLeft] = useState(0);
  const [cheerBlockedMsg, setCheerBlockedMsg] = useState<string | null>(null);
  const [cheerOpen, setCheerOpen] = useState(false);
  const [heatLevel, setHeatLevel] = useState<string | null>(null);
  const [fanBattle, setFanBattle] = useState<Record<string, number>>({});
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  // Active client-side countdown timer to cleanly throttle cheers and eliminate 429 errors
  useEffect(() => {
    if (cheerCooldownSecondsLeft <= 0) {
      setCheerCooldown(false);
      return;
    }
    const timer = setTimeout(() => {
      setCheerCooldownSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cheerCooldownSecondsLeft]);

  const triggerFloatingReaction = useCallback((msg: string, teamColor: string, label: string) => {
    const match = msg.match(/(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u);
    const emoji = match ? match[0] : "🔥";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const xOffset = Math.floor(Math.random() * 80) - 40;
    setFloatingReactions((prev) => [...prev.slice(-6), { id, emoji, label, teamColor, xOffset }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2400);
  }, []);

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
    triggerFloatingReaction(msg.message, msg.teamColor || "#F59E0B", msg.supporterLabel);
    play("cheer");
    if (msg.heatLevel) setHeatLevel(msg.heatLevel);
    if (msg.fanBattle) setFanBattle(msg.fanBattle);
  }, [play, triggerFloatingReaction]);

  // ── Data ─────────────────────────────────────────────────────────────────
  const { connectionStatus } = useAuctionSocket(tournamentId, handleCheerMessage);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId, staleTime: 15000 },
  });
  const { formatAmount, formatShort } = useAuctionUnit(tournament);

  const isCompleted = (tournament as { status?: string } | undefined)?.status === "completed";

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: isCompleted ? false : sseAwareRefetchInterval(connectionStatus, 30000),
      staleTime: 15000,
    },
  });

  const stateWithActivity = state as (typeof state & { lastAuctionActivityAt?: string | null }) | undefined;
  const lastActivityAt =
    typeof stateWithActivity?.lastAuctionActivityAt === "string"
      ? stateWithActivity.lastAuctionActivityAt
      : null;
  const feed = useAuctionConnectionState(connectionStatus, tournamentId, lastActivityAt);
  const isStaleFeed = feed.state === "disconnected" || feed.state === "reconnecting";

  // Sticky countdown: survives the server auto-clearing the countdown on read
  // so the post-expiry banner can complete fully.
  const _rawDc = (state as { displayCountdown?: { type?: string; endsAt?: string; label?: string | null } | null } | undefined)?.displayCountdown;
  const stickyDc = useStickyCountdown(_rawDc);
  const displayMode = useMemo(
    () => deriveAuctionDisplayMode(state),
    [state?.status, state?.lastAction, state?.outcome, state?.displayCountdown],
  );

  const embeddedPurses = state?.teamPurses;
  const needsPlayerList = isCompleted || selectedTeamId !== null;

  const { data: queriedTeamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && !embeddedPurses?.length,
      refetchInterval: isCompleted ? false : sseAwareRefetchInterval(connectionStatus, 30000),
      staleTime: 15000,
    },
  });
  const teamPurses = embeddedPurses ?? queriedTeamPurses;

  const { data: players } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 60000,
    },
  });

  // ── Page title ────────────────────────────────────────────────────────────
  useEffect(() => {
    const name = tournament?.name;
    document.title = name ? `${name} — BidWar Live` : "BidWar Live";
    return () => { document.title = "BidWar"; };
  }, [tournament?.name]);

  // Lock document scroll — viewer is a fixed single-screen experience
  useEffect(() => {
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  const sponsorLogos = useMemo(
    () => getSponsorsByPriority(parseSponsorLogos(tournament?.sponsorLogos)),
    [tournament?.sponsorLogos],
  );
  const hasSponsorRibbon = sponsorLogos.length > 0;
  const cheerBottomOffset = hasSponsorRibbon ? SPONSOR_RIBBON_TOTAL_HEIGHT_PX + 12 : 20;
  const previewTeams = useMemo(
    () => (teamPurses ?? []).slice(0, TEAMS_PREVIEW),
    [teamPurses],
  );
  const extraTeamCount = Math.max(0, (teamPurses?.length ?? 0) - TEAMS_PREVIEW);

  // ── Cheer logic ────────────────────────────────────────────────────────────
  const cheerEnabled = tournament?.cheerMessagesEnabled !== false;
  const mobileTeamsScrollPadding = cheerEnabled
    ? cheerBottomOffset + MOBILE_CHEER_BUTTON_CLEARANCE_PX
    : hasSponsorRibbon
      ? SPONSOR_RIBBON_TOTAL_HEIGHT_PX + 12
      : 16;
  const cheerCooldownSeconds = (tournament as { cheerCooldownSeconds?: number } | undefined)?.cheerCooldownSeconds ?? 2;
  const heatMeterEnabled = (tournament as { cheerHeatMeterEnabled?: boolean } | undefined)?.cheerHeatMeterEnabled ?? false;
  const fanBattleEnabled = (tournament as { cheerFanBattleEnabled?: boolean } | undefined)?.cheerFanBattleEnabled ?? false;
  const cheerOverlayBottom =
    cheerBottomOffset +
    (heatMeterEnabled && heatLevel && heatLevel !== "CALM" ? 108 : 76);
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
    if (cheerCooldown || cheerCooldownSecondsLeft > 0) return;
    if (!cheerTeamId) {
      setShowTeamSelector(true);
      setCheerOpen(false);
      return;
    }
    const cooldownDuration = Math.max(cheerCooldownSeconds, 3);
    setCheerCooldown(true);
    setCheerCooldownSecondsLeft(cooldownDuration);
    setCheerOpen(false);

    // Instant local reaction feedback
    const msg = cheerPresets[idx] || "Cheer! 🔥";
    triggerFloatingReaction(msg, cheerTeam?.color || "#F59E0B", cheerSupporterLabel || "Fans");
    play("cheer");

    void postCheer(cheerTeamId, idx);
  }

  // ── UI state ─────────────────────────────────────────────────────────────
  const [allTeamsOpen, setAllTeamsOpen] = useState(false);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);

  const anyModalOpen =
    selectedTeamId !== null ||
    allTeamsOpen ||
    soundSettingsOpen ||
    cheerOpen ||
    showTeamSelector;

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
  const lastLivePlayerRef = useRef<{
    playerName: string;
    photoUrl: string | null;
    basePrice: number;
    role: string | null;
    city: string | null;
    age: number | null;
    jerseyNumber: string | null;
    soldPrice?: number;
    soldToTeam?: string;
    soldToTeamColor?: string;
    soldToTeamLogo?: string | null;
  } | null>(null);
  const lastOutcomeKeyRef = useRef<string | null>(null);

  // ── Sound event detection ─────────────────────────────────────────────────
  const prevStateRef = useRef<AuctionState | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevStateRef.current;
    const prevPhase = prevPhaseRef.current;
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
      if (prevPhase !== "sold" && displayMode.phase === "sold") {
        play("sold");
      }
      if (prevPhase !== "unsold" && displayMode.phase === "unsold") {
        play("unsold");
      }
    }
    prevPhaseRef.current = displayMode.phase;
    prevStateRef.current = state ?? null;
  }, [state, displayMode.phase, play]);

  // ── Capture authoritative outcome — persists until next player ──
  useEffect(() => {
    if (!state) return;
    if (state.currentPlayer) {
      lastLivePlayerRef.current = {
        playerName: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl ?? null,
        basePrice: state.currentPlayer.basePrice,
        role: state.currentPlayer.role ?? null,
        city: state.currentPlayer.city ?? null,
        age: state.currentPlayer.age ?? null,
        jerseyNumber: state.currentPlayer.jerseyNumber ?? null,
        soldPrice: state.currentBid ?? undefined,
        soldToTeam: state.currentBidTeamName ?? undefined,
        soldToTeamColor: state.currentBidTeamColor ?? undefined,
        soldToTeamLogo: state.currentBidTeamLogoUrl ?? null,
      };
    }

    const outcome = displayMode.outcome;
    if (!outcome) return;
    const key = outcomeEventKey(outcome);
    if (!key || key === lastOutcomeKeyRef.current) return;
    lastOutcomeKeyRef.current = key;

    const enrichment = lastLivePlayerRef.current;
    const sold = soldRecordFromOutcome(outcome);
    const unsold = unsoldRecordFromOutcome(outcome);

    if (outcome.type === "sold" && sold) {
      setLastResult({
        playerName: sold.playerName,
        photoUrl: sold.photoUrl ?? null,
        basePrice: enrichment?.basePrice ?? 0,
        role: enrichment?.role ?? null,
        city: enrichment?.city ?? null,
        age: enrichment?.age ?? null,
        jerseyNumber: enrichment?.jerseyNumber ?? null,
        status: "sold",
        soldPrice: sold.amount,
        soldToTeam: sold.teamName,
        soldToTeamColor: sold.teamColor,
        soldToTeamLogo: sold.teamLogoUrl ?? enrichment?.soldToTeamLogo ?? null,
      });
      return;
    }

    if (outcome.type === "unsold" && unsold) {
      setLastResult({
        playerName: unsold.playerName,
        photoUrl: unsold.photoUrl ?? null,
        basePrice: enrichment?.basePrice ?? 0,
        role: enrichment?.role ?? null,
        city: enrichment?.city ?? null,
        age: enrichment?.age ?? null,
        jerseyNumber: enrichment?.jerseyNumber ?? null,
        status: "unsold",
      });
      return;
    }

    // Legacy servers: outcome derived from lastAction only (no structured record)
    if (!outcome.record && enrichment) {
      setLastResult({
        ...enrichment,
        status: outcome.type,
      });
    }
  }, [state, displayMode.outcome]);

  // ── Derived values ────────────────────────────────────────────────────────
  const teamColor = state?.currentBidTeamColor || "#F59E0B";
  const hasPlayer = !!state?.currentPlayer;
  const isActive = displayMode.isLive;
  const isPaused = displayMode.isPaused;
  const freezeBidUpdates = displayMode.freezeBidUpdates;
  const isIdle = !state || state.status === "idle";
  const isSold = displayMode.phase === "sold";
  const isUnsold = displayMode.phase === "unsold";
  // Show outcome card whenever the server has cleared the active player.
  const showFrozenCard = !hasPlayer && !!lastResult;
  const soldCount = state?.soldPlayersCount ?? 0;
  const unsoldCount = state?.unsoldPlayersCount ?? 0;
  const remainingCount = state?.remainingPlayersCount ?? 0;

  const selectedTeam = useMemo(
    () => (teamPurses ?? []).find((t) => t.teamId === selectedTeamId) ?? null,
    [teamPurses, selectedTeamId],
  );
  const playerList = useMemo(() => players ?? [], [players]);
  const retainedCount = useMemo(
    () => playerList.filter((p) => p.status === "retained").length,
    [playerList],
  );

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

  return (
    <div className="lovable-theme dark h-[100dvh] bg-background relative flex flex-col overflow-hidden">
      {isCompleted ? (
        <CompletedScreen
          tournament={tournament}
          players={playerList}
          teamPurses={teamPurses}
          onSelectTeam={setSelectedTeamId}
        />
      ) : (
        <>
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
      <div className="flex-shrink-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="px-3 py-2.5 sm:px-5 sm:py-3 md:px-6 md:py-3.5">
          {/* Top Row: Left (Live badge + Sound), Center (BidWar branding), Right (Sponsor banner) */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
            {/* Left: Status badge & Sound toggles */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 justify-start">
              <span className={`inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border shadow-sm ${statusRing}`}>
                {(isActive || isSold) && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
                {statusLabel}
              </span>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={toggleAllSounds}
                  className={`p-1.5 sm:p-2 rounded-lg transition-colors ${anySound ? "text-emerald-400 hover:bg-white/10" : "text-muted-foreground hover:text-foreground hover:bg-white/10"}`}
                  title={anySound ? "Mute all sounds" : "Unmute sounds"}
                  aria-label={anySound ? "Mute all sounds" : "Unmute sounds"}
                >
                  {anySound ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSoundSettingsOpen(true)}
                  className="p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors border-l border-white/10"
                  title="Sound settings"
                  aria-label="Sound settings"
                >
                  <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>

            {/* Center: BidWar official branding ("1. bidwar branding should be in top centre.") */}
            <div className="flex items-center justify-center flex-shrink-0 px-2">
              <img
                src={logos.mini || miniLogoSrc}
                alt={logoAlt}
                className="h-7 sm:h-8 md:h-9 w-auto object-contain select-none transition-transform hover:scale-105"
              />
            </div>

            {/* Right: Sponsors banner ("3. sponsors ke banner top right me apni proper jagah le ke rahe. aur thoda bada rahe, taaki dikhe.") */}
            <div className="flex items-center justify-end min-w-0 flex-1">
              {sponsorLogos.length > 0 ? (
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md shadow-sm">
                  <span className="text-[9px] uppercase tracking-widest font-black text-amber-400/90 hidden sm:inline-block">
                    Sponsor
                  </span>
                  <SponsorCarousel logos={sponsorLogos} compact />
                </div>
              ) : (
                <div className="w-16 sm:w-24 invisible pointer-events-none" />
              )}
            </div>
          </div>

          {/* Row 2: Tournament Name ("2. tournament name uske neeche 80-85% width le ke responsive rahe. depending on tournament name") */}
          <div className="mt-2 sm:mt-2.5 w-full max-w-[85%] mx-auto flex items-center justify-center gap-2.5 sm:gap-3 text-center">
            {tournament?.logoUrl && (
              <img
                src={cldUrl(tournament.logoUrl, "headerLogo")}
                alt=""
                className="w-7 h-7 sm:w-9 sm:h-9 md:w-11 md:h-11 rounded-xl object-contain flex-shrink-0 bg-white/5 border border-white/10 shadow-sm"
              />
            )}
            <h1 className="font-display font-black text-lg sm:text-2xl md:text-3xl lg:text-4xl leading-tight text-white tracking-tight line-clamp-2 drop-shadow-md">
              {tournament?.name || "Live Auction"}
            </h1>
          </div>

          {/* Row 3: Prominent TV-Broadcast Stat Badges ("4. sold left unsold retained ye promonently dikhe abhi ajeeb sa kone me pada sa lag raha feeling less.") */}
          <div className="mt-2.5 sm:mt-3 flex items-center justify-center flex-wrap gap-2 sm:gap-3">
            {/* SOLD */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-950/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-display font-black text-sm sm:text-base md:text-lg tabular-nums leading-none">
                {soldCount}
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-400/85">
                Sold
              </span>
            </div>

            {/* LEFT */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm shadow-amber-950/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="font-display font-black text-sm sm:text-base md:text-lg tabular-nums leading-none">
                {remainingCount}
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400/85">
                Left
              </span>
            </div>

            {/* UNSOLD */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-sm shadow-rose-950/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
              <span className="font-display font-black text-sm sm:text-base md:text-lg tabular-nums leading-none">
                {unsoldCount}
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-rose-400/85">
                Unsold
              </span>
            </div>

            {/* RETAINED */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 shadow-sm shadow-purple-950/20 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
              <span className="font-display font-black text-sm sm:text-base md:text-lg tabular-nums leading-none">
                {retainedCount}
              </span>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-purple-300/85">
                Retained
              </span>
            </div>
          </div>
        </div>
        {feed.state !== "live" && (
          <DisplayConnectionBanner
            feedState={feed.state}
            secondsSinceLastActivity={feed.secondsSinceLastActivity}
            placement="inline"
            className="mt-1.5"
          />
        )}
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
                    <span className="font-bold text-foreground">{formatAmount(lastResult.soldPrice || 0)}</span>
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

      {/* ── Main content — fixed viewport, no page scroll ──────────────── */}
      <div className={`relative z-10 flex-1 min-h-0 flex flex-col overflow-hidden max-w-5xl lg:max-w-6xl xl:max-w-[calc(100%-20rem)] mx-auto xl:mx-0 w-full transition-opacity duration-300 ${isStaleFeed ? "opacity-95 ring-2 ring-inset ring-amber-500/20" : ""}`}>

        {/* Player + teams fill remaining height — mobile: only teams scroll */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden px-3 sm:px-4 md:px-6 max-md:pb-0 pb-2">
        {/* ── Player section — fixed prominence, does not scroll on mobile ── */}
        <div className="relative flex-shrink-0 mb-3 md:mb-4">
          {displayMode.overlayMode === "paused" && (
            <AuctionStatusOverlay
              mode="paused"
              className="rounded-2xl md:rounded-3xl"
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
              className="mb-3 sm:mb-4 p-3.5 sm:p-5 md:p-6 rounded-2xl md:rounded-3xl backdrop-blur border transition-colors shadow-lg"
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
              <div className="flex flex-row items-start gap-3.5 sm:gap-5 md:gap-6">
                {/* Photo */}
                <div className="relative flex-shrink-0">
                  <div
                    className="w-24 h-32 sm:w-32 sm:h-40 md:w-36 md:h-48 lg:w-44 lg:h-56 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
                    style={{ borderColor: isSold ? `${teamColor}55` : isUnsold ? "rgba(239,68,68,0.4)" : `${teamColor}55` }}
                  >
                    {state?.currentPlayer?.photoUrl ? (
                      <img
                        src={cldUrl(state.currentPlayer.photoUrl, "soldCard")}
                        alt={state.currentPlayer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/25" />
                    )}
                  </div>
                  {state?.currentPlayer?.jerseyNumber && !isSold && !isUnsold && (
                    <div
                      className="absolute -top-2 -left-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-display font-black text-xs sm:text-sm text-black shadow-lg"
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
                          className="bg-green-600/90 text-white font-display font-black text-xl sm:text-2xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl"
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
                          className="bg-red-700/90 text-white font-display font-black text-xl sm:text-2xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl"
                          style={{ transform: "rotate(-12deg)" }}
                        >
                          UNSOLD
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left space-y-2.5 sm:space-y-3 md:space-y-4">
                  <div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-tight tracking-tight text-white">
                      {state?.currentPlayer?.name}
                    </h2>
                    {playerSpecs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-2.5">
                        {playerSpecs.slice(0, 4).map((spec, i) => (
                          <span
                            key={i}
                            className="text-xs sm:text-sm px-2.5 py-0.5 rounded-full bg-border/25 text-muted-foreground border border-border/40 font-medium"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-medium">
                      Base: {formatAmount(state?.currentPlayer?.basePrice)}
                    </p>
                  </div>

                  {/* Bid amount */}
                  <div>
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                      {isSold ? "Sold at" : isUnsold ? "Last Bid" : "Current Bid"}
                    </p>
                    {freezeBidUpdates ? (
                      <p
                        className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none tracking-tight"
                        style={{ color: teamColor, textShadow: `0 0 28px ${teamColor}55` }}
                      >
                        {formatAmount(state?.currentBid || 0)}
                      </p>
                    ) : (
                    <motion.p
                      key={state?.currentBid ?? 0}
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 340, damping: 22 }}
                      className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none tracking-tight"
                      style={{ color: teamColor, textShadow: `0 0 28px ${teamColor}55` }}
                    >
                      {formatAmount(state?.currentBid || 0)}
                    </motion.p>
                    )}
                  </div>

                  {/* Leading / sold-to team chip */}
                  {state?.currentBidTeamName ? (
                    freezeBidUpdates ? (
                      <div>
                      <span
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border text-sm sm:text-base font-bold shadow-md"
                        style={{
                          borderColor: `${teamColor}55`,
                          backgroundColor: `${teamColor}15`,
                          color: teamColor,
                        }}
                      >
                        {(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ? (
                          <img
                            src={cldUrl((state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl, "teamLogo")}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Trophy className="w-4 h-4 flex-shrink-0" />
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
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border text-sm sm:text-base font-bold shadow-md"
                        style={{
                          borderColor: `${teamColor}55`,
                          backgroundColor: `${teamColor}15`,
                          color: teamColor,
                        }}
                      >
                        {(state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl ? (
                          <img
                            src={cldUrl((state as { currentBidTeamLogoUrl?: string | null }).currentBidTeamLogoUrl, "teamLogo")}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <Trophy className="w-4 h-4 flex-shrink-0" />
                        )}
                        {isSold ? `Sold to ${state.currentBidTeamName}` : state.currentBidTeamName}
                      </span>
                    </motion.div>
                    )
                  ) : isUnsold ? (
                    <div className="flex justify-center sm:justify-start">
                      <span className="inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full border text-sm sm:text-base font-semibold border-red-500/30 bg-red-500/10 text-red-400">
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
              className="mb-4"
            >
              <OutcomeResultPanel
                layout="viewer"
                data={{
                  outcome: lastResult!.status,
                  playerName: lastResult!.playerName,
                  photoUrl: lastResult!.photoUrl,
                  amount: lastResult!.soldPrice,
                  teamName: lastResult!.soldToTeam,
                  teamColor: lastResult!.soldToTeamColor,
                  teamLogoUrl: lastResult!.soldToTeamLogo,
                  basePrice: lastResult!.basePrice,
                  role: lastResult!.role,
                  city: lastResult!.city,
                  age: lastResult!.age,
                }}
              />
              <p className="text-center text-[15px] md:text-xs text-muted-foreground/35 mt-3 md:mt-4 tracking-wide uppercase">
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
              className="mb-4 md:mb-5 py-8 md:py-12 px-5 md:px-6 rounded-2xl bg-card/30 border border-dashed border-border/40 flex flex-col items-center justify-center text-center gap-3"
            >
              <Gavel className="w-11 h-11 md:w-10 md:h-10 text-muted-foreground/25" />
              {isPaused && !displayMode.overlayMode ? (
                <>
                  <p className="font-display font-bold text-[22px] md:text-lg text-amber-400 leading-tight">Auction Paused</p>
                  <p className="text-[15px] md:text-sm text-muted-foreground">The operator has paused the auction.</p>
                </>
              ) : (
                <>
                  <p className="font-display font-bold text-[22px] md:text-lg text-muted-foreground leading-tight">Waiting for next player</p>
                  <p className="text-[15px] md:text-sm text-muted-foreground">The auction will begin shortly.</p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
          </div>
        </div>

        {/* ── Team grid — responsive across all gadgets (mobile, tablet landscape, laptop, desktop) ── */}
        {previewTeams.length > 0 && (
          <div
            className="flex-1 min-h-0 flex flex-col gap-3 sm:gap-4 overflow-y-auto overscroll-contain pr-1 liveviewer-mobile-teams-scroll"
            style={{ "--teams-scroll-pad": `${mobileTeamsScrollPadding}px` } as CSSProperties}
          >
            {/* Mobile Fan Battle if active */}
            {Object.keys(fanBattle).length > 0 && (
              <MobileFanBattle fanBattle={fanBattle} teams={teamPurses ?? []} />
            )}

            <div className="flex items-center justify-between gap-2 flex-shrink-0">
              <p className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground font-bold">Teams</p>
              {extraTeamCount > 0 && (
                <button
                  type="button"
                  onClick={() => setAllTeamsOpen(true)}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  View More (+{extraTeamCount})
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            <div
              className={`grid gap-3 sm:gap-4 pb-4 ${
                previewTeams.length <= 1
                  ? "grid-cols-1 max-w-md mx-auto"
                  : previewTeams.length === 2
                  ? "grid-cols-2"
                  : previewTeams.length === 3
                  ? "grid-cols-2 sm:grid-cols-3"
                  : previewTeams.length === 4
                  ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-4"
                  : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              }`}
            >
              {previewTeams.map((team) => {
                const isLeading = state?.currentBidTeamId === team.teamId;
                const tc = team.color || "#F59E0B";
                const hasDiffCode = team.shortCode && team.teamName && team.shortCode.toLowerCase() !== team.teamName.toLowerCase();
                return (
                  <motion.button
                    key={team.teamId}
                    type="button"
                    onClick={() => setSelectedTeamId(team.teamId)}
                    whileTap={{ scale: 0.97 }}
                    className="flex flex-col justify-between p-3.5 sm:p-4 md:p-5 lg:p-6 rounded-2xl md:rounded-3xl border transition-all cursor-pointer relative overflow-hidden text-left bg-card/40 hover:bg-card/65 backdrop-blur-sm shadow-md min-h-[140px] sm:min-h-[160px] md:min-h-[175px]"
                    style={{
                      backgroundColor: isLeading ? `${tc}18` : undefined,
                      borderColor: isLeading ? `${tc}90` : "rgba(255, 255, 255, 0.08)",
                      boxShadow: isLeading ? `0 0 24px ${tc}35` : "none",
                    }}
                  >
                    {/* Top row: team logo + names + leading badge */}
                    <div className="flex items-start justify-between gap-2 w-full mb-3">
                      <div className="flex items-center gap-3 sm:gap-3.5 md:gap-4 min-w-0 flex-1">
                        {team.logoUrl ? (
                          <img
                            src={cldUrl(team.logoUrl, "teamLogo")}
                            alt=""
                            className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl object-cover flex-shrink-0 border border-white/10 shadow-md"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center font-display font-black text-sm sm:text-base md:text-lg flex-shrink-0 shadow-md"
                            style={{ backgroundColor: `${tc}25`, color: tc, border: `1px solid ${tc}40` }}
                          >
                            {(team.shortCode || team.teamName).slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-display font-black truncate leading-tight tracking-tight text-white">
                            {team.teamName}
                          </h3>
                          {team.ownerName ? (
                            <p className="text-[11px] sm:text-xs md:text-sm text-muted-foreground truncate mt-0.5 font-medium">
                              Owner: {team.ownerName}
                            </p>
                          ) : hasDiffCode ? (
                            <p className="text-[11px] sm:text-xs md:text-sm font-semibold tracking-wider mt-0.5" style={{ color: tc }}>
                              {team.shortCode}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {isLeading && (
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider px-2 sm:px-2.5 py-1 rounded-full border shadow-sm flex-shrink-0"
                          style={{
                            backgroundColor: `${tc}25`,
                            color: tc,
                            borderColor: `${tc}60`,
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          Leading
                        </span>
                      )}
                    </div>

                    {/* Purse Remaining & Squad stats */}
                    <div className="pt-2.5 sm:pt-3 border-t border-white/10 flex items-end justify-between w-full mt-auto">
                      <div>
                        <p className="text-[10px] sm:text-xs md:text-sm uppercase tracking-wider text-muted-foreground font-semibold leading-none">
                          Purse Left
                        </p>
                        <p className="text-base sm:text-lg md:text-xl lg:text-2xl font-display font-black tabular-nums mt-1" style={{ color: tc }}>
                          {formatShort(team.purseRemaining ?? 0)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs md:text-sm uppercase tracking-wider text-muted-foreground font-semibold leading-none">
                          Squad
                        </p>
                        <p className="text-sm sm:text-base md:text-lg lg:text-xl font-mono font-black text-foreground tabular-nums mt-1">
                          {team.playersBought ?? 0}
                          {(team.maximumSquadSize ?? 0) > 0 && (
                            <span className="text-muted-foreground text-xs sm:text-sm font-normal">/{team.maximumSquadSize}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Mini squad capacity bar */}
                    {(team.maximumSquadSize ?? 0) > 0 && (
                      <div className="w-full h-1.5 sm:h-2 bg-white/10 rounded-full mt-2 sm:mt-2.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, ((team.playersBought ?? 0) / (team.maximumSquadSize ?? 1)) * 100)}%`,
                            backgroundColor: tc,
                          }}
                        />
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        </div>
      </div>
        </>
      )}

      {/* ── Sponsor ribbon (patti) ─────────────────────────────────────── */}
      {hasSponsorRibbon && (
        <div className="flex-shrink-0 relative z-20">
          <SponsorTicker logos={sponsorLogos} />
        </div>
      )}

      {/* ── Sheets & Dialogs ─────────────────────────────────────────── */}
      <TeamSquadSheet
        team={selectedTeam}
        players={playerList}
        open={selectedTeamId !== null}
        onClose={() => setSelectedTeamId(null)}
        unit={normalizeAuctionUnit(tournament?.auctionUnit)}
      />
      <AllTeamsSheet
        teams={teamPurses ?? []}
        leadingTeamId={state?.currentBidTeamId}
        open={allTeamsOpen}
        onClose={() => setAllTeamsOpen(false)}
        onSelectTeam={setSelectedTeamId}
      />
      <SoundSettingsDialog
        open={soundSettingsOpen}
        onClose={() => setSoundSettingsOpen(false)}
        settings={soundSettings}
        toggle={toggleSound}
      />

      {/* ── Floating celebratory reactions ── */}
      <FloatingReactionOverlay reactions={anyModalOpen ? [] : floatingReactions} />

      {/* ── Mobile cheer overlay — Instagram Live style auto-feed (xl+ uses CheerFeedRail) ─── */}
      {cheerEnabled && (
        <MobileCheerFeed
          messages={cheerMessages}
          overlayBottom={cheerOverlayBottom}
          hide={anyModalOpen}
        />
      )}

      {/* ── CHEER LIVE pill button ────────────────────────────────────────── */}
      <AnimatePresence>
        {cheerEnabled && !anyModalOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 xl:hidden"
            style={{ bottom: cheerBottomOffset }}
          >
            {heatMeterEnabled && heatLevel && heatLevel !== "CALM" && (
              <div>
                <HeatBadge level={heatLevel} />
              </div>
            )}
            <motion.button
              onClick={() => {
                if (cheerCooldown || cheerCooldownSecondsLeft > 0) return;
                if (!cheerTeamId) {
                  setShowTeamSelector(true);
                } else {
                  setCheerOpen((o) => !o);
                }
              }}
              disabled={cheerCooldown || cheerCooldownSecondsLeft > 0}
              whileTap={{ scale: 0.92 }}
              className="flex items-center gap-2 px-8 py-3.5 md:px-7 md:py-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-display font-black text-base md:text-sm tracking-wider shadow-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: "0 0 30px rgba(245,158,11,0.45), 0 4px 18px rgba(0,0,0,0.55)" }}
            >
              {cheerCooldownSecondsLeft > 0 ? (
                <>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  WAIT {cheerCooldownSecondsLeft}S
                </>
              ) : (
                <>
                  <Flame className="w-5 h-5 md:w-4 md:h-4" />
                  CHEER LIVE
                </>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cheer panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {cheerEnabled && cheerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
              onClick={() => setCheerOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#141416] border-t border-white/10 rounded-t-3xl max-w-lg mx-auto shadow-2xl"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>

              <div className="px-5 pb-8 pt-2">
                {/* Header row: Team banner + close button */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  {cheerTeam ? (
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {cheerTeam.logoUrl ? (
                        <img
                          src={cldUrl(cheerTeam.logoUrl, "teamLogo")}
                          alt=""
                          className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border"
                          style={{ borderColor: cheerTeam.color || "#F59E0B" }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-display font-black text-xs flex-shrink-0"
                          style={{
                            backgroundColor: `${cheerTeam.color || "#F59E0B"}25`,
                            color: cheerTeam.color || "#F59E0B",
                            border: `1px solid ${cheerTeam.color || "#F59E0B"}50`,
                          }}
                        >
                          {(cheerTeam.shortCode || cheerTeam.teamName).slice(0, 3).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Cheering for</p>
                        <p className="text-sm font-bold truncate leading-tight" style={{ color: cheerTeam.color || "#F59E0B" }}>
                          {cheerSupporterLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 ml-2 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 transition-colors"
                        onClick={() => { setCheerOpen(false); setShowTeamSelector(true); }}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Choose your side to cheer</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setCheerOpen(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Cooldown / Alert message */}
                <AnimatePresence>
                  {cheerCooldown && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-1.5 text-xs text-amber-300 font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      Cheer broadcasted! Ready in {cheerCooldownSecondsLeft || cheerCooldownSeconds}s...
                    </motion.div>
                  )}
                  {cheerBlockedMsg && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-red-400 text-center mb-3 bg-red-500/10 py-1.5 px-3 rounded-lg border border-red-500/20"
                    >
                      {cheerBlockedMsg}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Quick Emoji Reaction bar */}
                <div className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                    Quick Burst
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {[
                      { emoji: "🔥", label: "Fire" },
                      { emoji: "👏", label: "Clap" },
                      { emoji: "⚔️", label: "War" },
                      { emoji: "🏆", label: "Win" },
                      { emoji: "💎", label: "Gem" },
                      { emoji: "⚡", label: "Bolt" },
                    ].map((item) => (
                      <motion.button
                        key={item.emoji}
                        type="button"
                        onClick={() => {
                          const matchingIdx = cheerPresets.findIndex((p) => p.includes(item.emoji));
                          sendCheer(matchingIdx >= 0 ? matchingIdx : 0);
                        }}
                        disabled={cheerCooldown}
                        whileTap={{ scale: 0.88 }}
                        className="flex flex-col items-center justify-center py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 active:bg-white/15 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        <span className="text-xl leading-none">{item.emoji}</span>
                        <span className="text-[9px] text-muted-foreground mt-1 font-medium">{item.label}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Preset Messages grid */}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                    Shoutouts
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-[36vh] overflow-y-auto pr-0.5">
                    {cheerPresets.map((preset, i) => (
                      <motion.button
                        key={i}
                        type="button"
                        onClick={() => sendCheer(i)}
                        disabled={cheerCooldown}
                        whileTap={{ scale: 0.95 }}
                        className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none py-3 px-3 text-xs text-white/90 text-left transition-all leading-snug cursor-pointer flex items-center justify-between"
                        style={{
                          borderLeftWidth: "3px",
                          borderLeftColor: cheerTeam?.color || "#F59E0B",
                        }}
                      >
                        <span className="truncate pr-1">{preset}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Pre Auction & Break Timer full-screen countdown on live viewer ── */}
      {!isCompleted && stickyDc && (
        <BreakCountdownOverlay
          key={stickyDc.endsAt}
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
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm"
              onClick={() => setShowTeamSelector(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-[#141416] border-t border-white/10 rounded-t-3xl max-w-lg mx-auto shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/25" />
              </div>
              <div className="px-5 pb-8 pt-2 max-h-[75vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-display font-black text-lg">Choose Your Side</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Your cheers will represent this team live</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTeamSelector(false)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors flex-shrink-0"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  {(teamPurses ?? []).map((team) => {
                    const tc = team.color || "#F59E0B";
                    const isSelected = cheerTeamId === team.teamId;
                    return (
                      <motion.button
                        key={team.teamId}
                        type="button"
                        onClick={() => {
                          setCheerTeamId(team.teamId);
                          try { localStorage.setItem("bidwar-cheer-team", String(team.teamId)); } catch {}
                          setShowTeamSelector(false);
                          setTimeout(() => setCheerOpen(true), 120);
                        }}
                        whileTap={{ scale: 0.96 }}
                        className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border text-center transition-all cursor-pointer relative"
                        style={{
                          borderColor: isSelected ? tc : "rgba(255,255,255,0.08)",
                          backgroundColor: isSelected ? `${tc}18` : "rgba(255,255,255,0.03)",
                          boxShadow: isSelected ? `0 0 20px ${tc}35` : "none",
                        }}
                      >
                        {team.logoUrl ? (
                          <img
                            src={cldUrl(team.logoUrl, "teamLogo")}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border"
                            style={{ borderColor: `${tc}40` }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm flex-shrink-0"
                            style={{ backgroundColor: `${tc}25`, color: tc, border: `1px solid ${tc}50` }}
                          >
                            {(team.shortCode || team.teamName).slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="w-full">
                          <p className="font-bold text-sm leading-tight truncate" style={{ color: tc }}>
                            {team.teamName}
                          </p>
                          <p className="text-[11px] font-mono font-bold text-foreground/85 mt-1">
                            {formatShort(team.purseRemaining ?? 0)} Left
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {team.playersBought ?? 0} player{(team.playersBought ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shadow-md">
                            <Check className="w-3 h-3 text-black stroke-[3]" />
                          </div>
                        )}
                      </motion.button>
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
          onOpenCheer={() => {
            if (!cheerTeamId) {
              setShowTeamSelector(true);
            } else {
              setCheerOpen(true);
            }
          }}
          cheerTeam={cheerTeam}
          cooldownSecondsLeft={cheerCooldownSecondsLeft}
        />
      )}
    </div>
  );
}
