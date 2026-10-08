/**
 * Cricket Links & Broadcast Hub — Organizer Portal
 * Route: /tournament/:id/score/links
 */
import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  BtnPrimary,
  BtnSecondary,
  PageHeader,
  btnCompactClass,
} from "@/components/scoring/cricket-page-chrome";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketPublicPath,
  cricketObsLivePath,
  scoreDisplayPath,
  cricketObsV2Path,
  cricketObsV2PreviewPath,
  cricketObsV2ControlPath,
} from "@/lib/tournament-navigation";
import {
  Copy,
  ExternalLink,
  Eye,
  Info,
  Laptop,
  MessageCircle,
  Radio,
  RefreshCw,
  Smartphone,
  Sparkles,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FanLiveStreamEditor } from "@/components/scoring/fan-live-stream-editor";

interface EssentialLinkItem {
  id: string;
  category: string;
  categoryTheme: {
    badge: string;
    dot: string;
    iconBg: string;
    iconColor: string;
  };
  title: string;
  badge: string;
  url: string;
  description: string;
  icon: React.ReactNode;
  shareMessage?: string;
  previewUrl?: string;
  infoLines?: { label: string; value: string }[];
  qaUrl?: string;
}

function LinkCard({ item }: { item: EssentialLinkItem }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") return item.url;
    return item.url.startsWith("http") ? item.url : `${window.location.origin}${item.url}`;
  }, [item.url]);

  const fullPreviewUrl = useMemo(() => {
    if (!item.previewUrl) return null;
    if (typeof window === "undefined") return item.previewUrl;
    return item.previewUrl.startsWith("http") ? item.previewUrl : `${window.location.origin}${item.previewUrl}`;
  }, [item.previewUrl]);

  function copyToClipboard() {
    void navigator.clipboard.writeText(fullUrl).then(
      () => {
        setCopied(true);
        toast({
          title: "Copied to clipboard!",
          description: `${item.title} link copied.`,
        });
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        toast({
          title: "Copy failed",
          description: "Please copy the link manually.",
          variant: "destructive",
        });
      },
    );
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    item.shareMessage ?? `${item.title}: ${fullUrl}`,
  )}`;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 sm:p-5 transition hover:bg-white/[0.05] hover:border-white/[0.12] shadow-sm space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className={cn("p-2.5 rounded-xl border shrink-0 mt-0.5", item.categoryTheme.iconBg)}>
            {item.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                {item.title}
              </h3>
              <span
                className={cn(
                  "text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border",
                  item.categoryTheme.badge,
                )}
              >
                {item.badge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
              {item.description}
            </p>

            {/* Informational lines (e.g. Operate from / Display from) */}
            {item.infoLines && item.infoLines.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2 border-t border-white/[0.05] text-[11px]">
                {item.infoLines.map((info, idx) => (
                  <span key={idx} className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-slate-500 font-medium">{info.label}:</span>
                    <strong className="text-slate-200 font-semibold">{info.value}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* URL Box & Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
        <div className="flex-1 min-w-0 flex items-center rounded-xl border border-white/[0.05] bg-black/25 px-3.5 py-2.5 text-xs font-mono text-slate-300 overflow-hidden">
          <span className="truncate select-all">{fullUrl}</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyToClipboard}
            className="h-9 px-3.5 gap-1.5 text-xs font-semibold border-white/10 hover:bg-white/10"
            title="Copy URL"
          >
            <Copy className={cn("w-3.5 h-3.5", copied && "text-emerald-400")} />
            {copied ? "Copied" : "Copy"}
          </Button>

          {fullPreviewUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(fullPreviewUrl, "_blank", "noopener,noreferrer")}
              className="h-9 px-3 gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border-amber-500/30"
              title="Open V2 Broadcast Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            asChild
            className="h-9 px-3.5 gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/25"
            title="Share via WhatsApp"
          >
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => window.open(fullUrl, "_blank", "noopener,noreferrer")}
            className="h-9 px-3.5 gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90"
            title="Open in new window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </Button>
        </div>
      </div>

      {/* Discrete QA Tool link if specified */}
      {item.qaUrl && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5">
          <span>QA Tool:</span>
          <a
            href={item.qaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-amber-300 underline font-mono"
          >
            V2 Test Control — QA
          </a>
        </div>
      )}
    </div>
  );
}

export default function CricketLinksPage() {
  const [, params] = useRoute("/tournament/:id/score/links");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isFetching, refetch } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const scoringActive = useCricketScoringActive(
    tournament?.sport,
    tournament?.scoringEnabled,
  );

  const base = typeof window !== "undefined" ? window.location.origin : "";

  // Core Cricket Links
  const ledDisplayUrl = scoreDisplayPath(tournamentId, tournament?.auctionCode);
  const obsStreamUrl = cricketObsLivePath(tournamentId, tournament?.auctionCode);
  const obsV2Url = cricketObsV2Path(tournamentId);
  const obsV2PreviewUrl = cricketObsV2PreviewPath(tournamentId);
  const obsV2ControlUrl = cricketObsV2ControlPath(tournamentId);
  const publicFanUrl = cricketPublicPath(tournamentId);
  const scorerPortalUrl = `/scoring-app/cricket/scorer?tid=${tournamentId}`;

  const linkItems: EssentialLinkItem[] = useMemo(
    () => [
      {
        id: "obs-v2-broadcast",
        category: "Live Broadcast V2",
        categoryTheme: {
          badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
          dot: "bg-amber-400",
          iconBg: "bg-amber-500/10 border-amber-500/30",
          iconColor: "text-amber-400",
        },
        title: "OBS V2 Broadcast Overlay",
        badge: "V2 · NEW BROADCAST SYSTEM",
        icon: <Sparkles className="w-5 h-5 text-amber-400" />,
        url: obsV2Url,
        description:
          "New BidWar broadcast graphics for live cricket. Use this URL as a 1920×1080 transparent Browser Source in OBS Studio.",
        shareMessage: `🎥 OBS V2 Cricket Broadcast Overlay: ${
          base ? `${base}${obsV2Url}` : obsV2Url
        }`,
        previewUrl: obsV2PreviewUrl,
        qaUrl: obsV2ControlUrl,
        infoLines: [
          { label: "Operate from", value: "Live Control Console" },
          { label: "Display from", value: "OBS V2 Browser Source" },
        ],
      },
      {
        id: "ground-led",
        category: "Venue & Screens",
        categoryTheme: {
          badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          dot: "bg-amber-400",
          iconBg: "bg-amber-500/10 border-amber-500/20",
          iconColor: "text-amber-400",
        },
        title: "Ground LED Scoreboard",
        badge: "Stadium Screen",
        icon: <Tv className="w-5 h-5 text-amber-400" />,
        url: ledDisplayUrl,
        description:
          "Full-screen live scoreboard for stadium LED screens, TVs, and ground projectors. Press F11 on keyboard for clean full-screen mode.",
        shareMessage: `📺 Live Cricket Ground Scoreboard: ${
          base ? `${base}${ledDisplayUrl}` : ledDisplayUrl
        }`,
      },
      {
        id: "obs-stream",
        category: "Live Streaming (Legacy)",
        categoryTheme: {
          badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
          dot: "bg-sky-400",
          iconBg: "bg-sky-500/10 border-sky-500/20",
          iconColor: "text-sky-400",
        },
        title: "OBS Live Stream Overlay (Legacy)",
        badge: "OBS / vMix",
        icon: <Radio className="w-5 h-5 text-sky-400" />,
        url: obsStreamUrl,
        description:
          "Transparent scorebug & lower-third graphics for live streaming. Add as a 1920×1080 Browser Source in OBS Studio.",
        shareMessage: `🎥 OBS Live Streaming Overlay: ${
          base ? `${base}${obsStreamUrl}` : obsStreamUrl
        }`,
      },
      {
        id: "fan-portal",
        category: "Public & Spectators",
        categoryTheme: {
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          dot: "bg-emerald-400",
          iconBg: "bg-emerald-500/10 border-emerald-500/20",
          iconColor: "text-emerald-400",
        },
        title: "Public Fan Scorecard & Hub",
        badge: "Mobile & Fans",
        icon: <Smartphone className="w-5 h-5 text-emerald-400" />,
        url: publicFanUrl,
        description:
          "Live match center for spectators with real-time ball-by-ball commentary, scorecard, tournament points table, and player leaderboards.",
        shareMessage: `🏏 Watch live score & matches for ${
          tournament?.name ?? "the tournament"
        }: ${base ? `${base}${publicFanUrl}` : publicFanUrl}`,
      },
      {
        id: "scorer-portal",
        category: "Officials & Scorers",
        categoryTheme: {
          badge: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
          dot: "bg-indigo-400",
          iconBg: "bg-indigo-500/10 border-indigo-500/20",
          iconColor: "text-indigo-400",
        },
        title: "Scorer & Umpire Console",
        badge: "Scorer Login",
        icon: <Laptop className="w-5 h-5 text-indigo-400" />,
        url: scorerPortalUrl,
        description:
          "Dedicated mobile scoring interface for official match scorers. Login with 4-digit Scorer PIN to log ball-by-ball actions.",
        shareMessage: `📋 Official Scorer Portal Link: ${
          base ? `${base}${scorerPortalUrl}` : scorerPortalUrl
        }`,
      },
    ],
    [
      obsV2Url,
      obsV2PreviewUrl,
      obsV2ControlUrl,
      ledDisplayUrl,
      obsStreamUrl,
      publicFanUrl,
      scorerPortalUrl,
      base,
      tournament?.name,
    ],
  );

  if (tournament?.sport === "badminton") {
    return (
      <CricketScoringSportRedirect
        tournamentId={tournamentId}
        sport={tournament.sport}
      />
    );
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Links"
        subtitle="All live output screens, broadcast overlays, fan scorecards, and scorer pad links in one place."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BtnSecondary
              className={btnCompactClass}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </BtnSecondary>
            <BtnPrimary
              className={btnCompactClass}
              onClick={() => window.open(publicFanUrl, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="w-4 h-4" />
              Open Fan Hub
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-5xl mx-auto px-3 sm:px-6 pt-6 pb-16 space-y-6">
        <FanLiveStreamEditor tournamentId={tournamentId} />

        {/* Core Link Cards */}
        <div className="space-y-4">
          {linkItems.map((item) => (
            <LinkCard key={item.id} item={item} />
          ))}
        </div>

        {/* ─── QUICK SETUP GUIDES (SEAMLESS TRANSLUCENT) ─── */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 space-y-4 shadow-sm mt-8">
          <div className="flex items-center gap-2 text-foreground font-bold text-sm">
            <Info className="w-4 h-4 text-primary" />
            <span>Setup &amp; Broadcast Instructions Guide</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-muted-foreground">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-1.5">
              <p className="font-bold text-amber-400">✨ OBS V2 Broadcast</p>
              <p className="leading-relaxed text-slate-300">
                OBS me <strong>Add Source (+) → Browser</strong> chunein. URL me V2 Broadcast Link dalein. Width: <strong>1920</strong>, Height: <strong>1080</strong>. Live Control Console se sabhi slates aur live scoring sync honge.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-1.5">
              <p className="font-bold text-amber-400">📺 Ground LED Setup</p>
              <p className="leading-relaxed text-slate-300">
                Laptop ko HDMI cable se projector ya stadium LED se connect karein. Scoreboard link open karke <strong>F11</strong> dabayein. Real-time updates auto-sync honge.
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 space-y-1.5">
              <p className="font-bold text-sky-400">🎥 OBS Studio (Legacy)</p>
              <p className="leading-relaxed text-slate-300">
                OBS me <strong>Add Source (+) → Browser</strong> chunein. Width: <strong>1920</strong>, Height: <strong>1080</strong>, FPS: <strong>60</strong> rakhein. Overlay live camera feed ke upar transparent chalega.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
              <p className="font-bold text-emerald-400">📱 WhatsApp Sharing</p>
              <p className="leading-relaxed text-slate-300">
                Fan Hub link ko WhatsApp status aur team groups me share karein taaki spectators aur players live scorecard aur points table dekh sakein.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CricketOrganizerPageShell>
  );
}
