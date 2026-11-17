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
  Tv,
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
  streamUrl?: string | null;
  embedded?: boolean;
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
  streamUrl,
  embedded = false,
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
      <header className={cn("z-30 mb-6 space-y-3", !embedded ? "sticky top-0 -mx-4 px-4 sm:-mx-0 sm:px-0" : "w-full")}>
        <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
          {!embedded && (
            <>
              {/* Row 1: Top Bar (Left: Status/Sound, Center: BidWar Logo, Right: Sponsor + Share) */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[hsl(var(--border))]">
                {/* Left: Status Badge + Sound Toggle */}
                <div className="flex items-center gap-2 flex-1 justify-start">
                  {liveCount > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                      SCHEDULED
                    </span>
                  )}
                  {onToggleSound ? (
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className="p-1.5 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
                      title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                      aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
                    >
                      {soundEnabled ? (
                        <Volume2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <VolumeX className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </button>
                  ) : null}
                </div>

                {/* Center: BIDWAR Logo */}
                <div className="flex items-center justify-center flex-shrink-0">
                  <a
                    href={BIDWAR_HOME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center transition-transform hover:scale-105"
                    aria-label="BidWar Official Platform"
                  >
                    <img
                      src={brandLogoSrc}
                      alt={logoAlt || "BidWar"}
                      className="h-7 w-auto object-contain select-none"
                    />
                  </a>
                </div>

                {/* Right: Share */}
                <div className="flex items-center justify-end gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="p-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--accent))] transition-all shadow-sm"
                    title="Share Tournament Fanpage"
                    aria-label="Share Tournament Fanpage"
                  >
                    <Share2 className="h-4 w-4 text-[hsl(var(--primary))]" />
                  </button>
                </div>
              </div>

              {/* Row 2: Tournament Name */}
              <div className="px-4 py-3 text-center border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
                <div className="w-full max-w-[92%] mx-auto flex items-center justify-center gap-3">
                  {tournament.logoUrl ? (
                    <img
                      src={tournament.logoUrl}
                      alt=""
                      className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-[hsl(var(--border))]"
                    />
                  ) : null}
                  <h1 className="font-bold text-sm sm:text-base text-[hsl(var(--foreground))] tracking-tight truncate uppercase">
                    {tournament.name}
                  </h1>
                </div>
              </div>
            </>
          )}

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

          {/* Row 4: Navigation Tabs */}
          <div
            className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 scrollbar-none bg-[hsl(var(--muted))]"
            role="tablist"
          >
            {/* 1. Live Match */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "live"}
              onClick={() => onSelectSection("live")}
              className={cn(
                "flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "live"
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] border-[hsl(var(--border))] shadow-sm"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))/50]",
              )}
            >
              <CircleDot className={cn("h-3.5 w-3.5", liveCount > 0 ? "text-red-500 animate-pulse" : "text-emerald-500")} />
              Live
            </button>
            {/* 2. Upcoming Match & Stats */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "matches_stats"}
              onClick={() => onSelectSection("matches_stats")}
              className={cn(
                "flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "matches_stats"
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] border-[hsl(var(--border))] shadow-sm"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))/50]",
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              Matches & Stats
            </button>
            {/* 3. Fan Arena */}
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === "fan_arena"}
              onClick={() => onSelectSection("fan_arena")}
              className={cn(
                "flex items-center gap-2 shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all border",
                activeSection === "fan_arena"
                  ? "bg-[hsl(var(--background))] text-[hsl(var(--primary))] border-[hsl(var(--border))] shadow-sm"
                  : "border-transparent text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))/50]",
              )}
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" />
              Fan Arena
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

