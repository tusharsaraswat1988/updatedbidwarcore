import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import {
  CircleDot,
  Flame,
  Zap,
  Radio,
  Trophy,
  CalendarDays,
  Sparkles,
  Users,
  Target,
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Check,
  MessageCircle,
  X,
} from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import {
  isBrandLogoPlaceholderSrc,
  getBrandLogoAlt,
  getBrandLogoSrc,
  getBrandWordmarkSrc,
} from "@/lib/brand-assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PublicTournamentMeta, PublicMatch } from "@/lib/public-tournament-types";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import { cn } from "@/lib/utils";

const BIDWAR_HOME_URL = "https://bidwar.in/";

export type TournamentSectionTab = "live" | "matches_stats" | "sponsors" | "fan_arena";

interface TournamentFanHeaderProps {
  tournament: PublicTournamentMeta;
  activeSection: TournamentSectionTab;
  onSelectSection: (section: TournamentSectionTab) => void;
  liveMatch?: PublicMatch | null;
  liveState?: CricketScoreboardState | null;
  teamMap?: Map<number, { name: string; shortCode: string; color: string | null }>;
  liveCount?: number;
  upcomingCount?: number;
  completedCount?: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  tournamentCode?: string;
}

export function TournamentFanHeader({
  tournament,
  activeSection,
  onSelectSection,
  liveMatch,
  liveState,
  teamMap,
  liveCount = 0,
  upcomingCount = 0,
  completedCount = 0,
  soundEnabled = true,
  onToggleSound,
  tournamentCode,
}: TournamentFanHeaderProps) {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  // Share Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Short canonical fan page link (e.g. bidwar.in/IPL26/fanpage or /fan/10)
  const codeOrId = tournamentCode || tournament.code || tournament.id;
  const fanPageUrl = typeof window !== "undefined"
    ? `${window.location.origin}/${codeOrId}/fanpage`
    : "";

  const handleCopyLink = () => {
    if (!fanPageUrl) return;
    navigator.clipboard.writeText(fanPageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`🏏 Watch ${tournament.name} Live on BidWar!\nLive scores, stream & fan arena: ${fanPageUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  };

  // Reliable BidWar official logo resolution (never fallback to dev placeholder SVG)
  const brandLogoSrc = useMemo(() => {
    const candidates = [
      logos.mini,
      logos.mainReverse,
      logos.main,
      miniLogoSrc,
      mainWordmarkSrc,
    ];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos, miniLogoSrc, mainWordmarkSrc]);

  // Parse sponsor logo for top-right slot
  const topSponsor = useMemo(() => {
    try {
      if (!tournament.sponsorLogos) return null;
      const parsed =
        typeof tournament.sponsorLogos === "string"
          ? JSON.parse(tournament.sponsorLogos)
          : tournament.sponsorLogos;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch {}
    return null;
  }, [tournament.sponsorLogos]);

  // Ephemeral Match Moments State ("Moments should not stick. it should come and go")
  const [activeMoment, setActiveMoment] = useState<{
    id: string;
    type: string;
    label: string;
    sub: string;
    badgeBg: string;
  } | null>(null);

  const lastProcessedRef = useRef<string>("");

  useEffect(() => {
    if (!liveState) return;

    let newEvent: { type: string; label: string; sub: string; badgeBg: string } | null = null;
    let eventKey = "";

    const deliveries = liveState.thisOver ?? [];
    if (deliveries.length > 0) {
      const last = deliveries[deliveries.length - 1];
      const ballKey = `${deliveries.length}-${last.runsOffBat}-${last.isWicket}-${last.extrasType || ""}`;
      if (last.isWicket) {
        newEvent = {
          type: "wicket",
          label: "🚨 OUT! WICKET FALLEN!",
          sub: "Big breakthrough for the bowling side!",
          badgeBg: "bg-red-600 text-white border-red-400 animate-bounce",
        };
        eventKey = `wicket-${ballKey}`;
      } else if (last.runsOffBat === 6) {
        newEvent = {
          type: "six",
          label: "🔥 MAXIMUM! HUGE 6️⃣ OVER THE ROPES!",
          sub: "Monster hit sailed into the crowd!",
          badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-yellow-300 animate-pulse",
        };
        eventKey = `six-${ballKey}`;
      } else if (last.runsOffBat === 4) {
        newEvent = {
          type: "four",
          label: "💥 BOUNDARY 4️⃣! CRACKING SHOT!",
          sub: "Timed to perfection across the boundary carpet!",
          badgeBg: "bg-emerald-500 text-white border-emerald-300",
        };
        eventKey = `four-${ballKey}`;
      }
    }

    if (!newEvent && liveState.freeHitActive) {
      newEvent = {
        type: "free_hit",
        label: "⚡ FREE HIT DELIVERY!",
        sub: "No dismissal on this ball except run-out!",
        badgeBg: "bg-amber-500 text-black border-amber-400 animate-pulse",
      };
      eventKey = `freehit-${liveState.freeHitActive}`;
    }

    if (newEvent && eventKey && eventKey !== lastProcessedRef.current) {
      lastProcessedRef.current = eventKey;
      setActiveMoment({ id: eventKey, ...newEvent });

      // Automatically auto-dismiss after 6 seconds!
      const timer = setTimeout(() => {
        setActiveMoment((curr) => (curr?.id === eventKey ? null : curr));
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [liveState]);

  return (
    <>
      <header className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-0 sm:px-0 mb-5 space-y-2">
        <div className="rounded-2xl border border-white/15 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* ── ROW 1: Top Bar (Left: Status/Sound, Center: BidWar Logo, Right: Sponsor + Share) ─ */}
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 sm:px-6 sm:py-3 border-b border-white/10">
            {/* Left: Status Badge + Sound Toggle */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-start">
              {liveCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-emerald-400 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white/60">
                  SCHEDULED
                </span>
              )}

              {onToggleSound ? (
                <button
                  type="button"
                  onClick={onToggleSound}
                  className="p-1 sm:p-1.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white transition-colors"
                  title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                  aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
                >
                  {soundEnabled ? (
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5 text-white/40" />
                  )}
                </button>
              ) : null}
            </div>

            {/* Center: PROMINENT BIDWAR OFFICIAL GOLDEN GLOWING LOGO */}
            <div className="flex items-center justify-center flex-shrink-0 px-2">
              <a
                href={BIDWAR_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center group transition-transform hover:scale-105"
                aria-label="BidWar Official Platform"
              >
                <img
                  src={brandLogoSrc}
                  alt={logoAlt || "BidWar"}
                  className="h-8 sm:h-9 md:h-10 w-auto object-contain select-none filter drop-shadow-[0_0_14px_rgba(234,179,8,0.5)] transition-transform hover:scale-105"
                />
              </a>
            </div>

            {/* Right: Sponsor Logo (if any) + Small Share Icon */}
            <div className="flex items-center justify-end gap-2 flex-1">
              {topSponsor?.url ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                  <span className="text-[9px] uppercase tracking-widest font-black text-amber-400 hidden sm:inline-block">
                    Sponsor
                  </span>
                  <img
                    src={topSponsor.url}
                    alt={topSponsor.name || "Sponsor"}
                    className="h-4 sm:h-5 max-w-[65px] object-contain"
                  />
                </div>
              ) : null}

              {/* Small Share Icon Button (Opens 2-field dialog) */}
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="p-1.5 sm:p-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/15 text-white/80 hover:text-white transition-all shadow-sm active:scale-95"
                title="Share Tournament Fanpage"
                aria-label="Share Tournament Fanpage"
              >
                <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400" />
              </button>
            </div>
          </div>

          {/* ── ROW 2: Tournament Name & Logo in ONE SINGLE CLEAN LINE ─ */}
          <div className="px-4 py-2.5 text-center border-b border-white/5">
            <div className="w-full max-w-[92%] mx-auto flex items-center justify-center gap-2.5 sm:gap-3">
              {tournament.logoUrl ? (
                <img
                  src={tournament.logoUrl}
                  alt=""
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl object-cover flex-shrink-0 bg-white/5 border border-white/15 shadow-sm"
                />
              ) : (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-display font-bold text-xs text-emerald-300 flex-shrink-0">
                  {tournament.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <h1 className="font-display font-black text-sm sm:text-lg md:text-xl text-white tracking-tight truncate drop-shadow-md uppercase">
                {tournament.name}
              </h1>
            </div>
          </div>

          {/* ── ROW 3: Ephemeral Match Moments (Auto-Dismisses after 6s) ── */}
          {activeMoment ? (
            <div
              className={cn(
                "flex items-center justify-between gap-2 px-4 py-2 border-t text-xs font-bold transition-all shadow-inner animate-fade-in",
                activeMoment.badgeBg,
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="tracking-wide uppercase font-black">{activeMoment.label}</span>
                <span className="hidden md:inline-block font-normal text-[11px] opacity-95">
                  — {activeMoment.sub}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-widest font-black">MOMENT</span>
                <button
                  type="button"
                  onClick={() => setActiveMoment(null)}
                  className="rounded-full p-0.5 hover:bg-black/20 text-current transition-colors"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : null}

          {/* ── ROW 4: The 4 Clean Top Sections ─────────────────────────── */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-t border-white/10 scrollbar-none bg-black/40"
            role="tablist"
          >
            {/* 1. Live Match */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "live"}
              onClick={() => onSelectSection("live")}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "live"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-md ring-1 ring-emerald-400/30"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <CircleDot
                className={cn(
                  "h-3.5 w-3.5",
                  liveCount > 0 ? "text-red-400 animate-pulse" : "text-emerald-400",
                )}
              />
              <span>Live Match</span>
              {liveCount > 0 ? (
                <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                  {liveCount}
                </span>
              ) : null}
            </button>

            {/* 2. Upcoming Match & Stats */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "matches_stats"}
              onClick={() => onSelectSection("matches_stats")}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "matches_stats"
                  ? "bg-primary/20 text-primary border-primary/60 shadow-md ring-1 ring-primary/30"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
              <span>Upcoming Match & Stats</span>
              {upcomingCount > 0 ? (
                <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.2 text-[9px] text-white/80">
                  {upcomingCount}
                </span>
              ) : null}
            </button>

            {/* 3. Sponsors */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "sponsors"}
              onClick={() => onSelectSection("sponsors")}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "sponsors"
                  ? "bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-md ring-1 ring-amber-400/30"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Sponsors</span>
            </button>

            {/* 4. Fan Arena */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "fan_arena"}
              onClick={() => onSelectSection("fan_arena")}
              className={cn(
                "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "fan_arena"
                  ? "bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border-amber-400/60 shadow-md ring-1 ring-amber-400/30"
                  : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
              )}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span>Fan Arena</span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] text-amber-300 font-bold uppercase">
                Cheer
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Compact 2-Field Share Dialog (Triggered by Top-Right Share Icon) ─ */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md bg-[#0c1822] border-white/15 text-white rounded-2xl shadow-2xl p-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Share2 className="h-5 w-5 text-emerald-400" />
              Share Tournament Fanpage
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Field 1: Short Fanpage URL with Copy Button */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Fanpage Short Link</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={fanPageUrl}
                  className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-mono text-white/90 select-all outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 active:scale-95",
                    copied
                      ? "bg-emerald-500 text-black font-black"
                      : "bg-white/15 text-white hover:bg-white/20 border border-white/10",
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-black" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Field 2: Direct WhatsApp Share Button */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/70">Social Share</label>
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 text-xs transition-all shadow-lg shadow-emerald-950/40 active:scale-98"
              >
                <MessageCircle className="h-4 w-4" />
                Share on WhatsApp
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

