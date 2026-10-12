/**
 * Cricket output links — organizer portal.
 * Route: /tournament/:id/score/links
 */
import { useEffect, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  PageHeader,
} from "@/components/scoring/cricket-page-chrome";
import { useToast } from "@/hooks/use-toast";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketPublicPath,
  scoreDisplayPath,
  cricketObsV2Path,
  cricketObsV2PreviewPath,
} from "@/lib/tournament-navigation";
import { Copy, ExternalLink, Eye, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FanLiveStreamEditor } from "@/components/scoring/fan-live-stream-editor";

function absoluteUrl(path: string): string {
  if (path.startsWith("http")) return path;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

function LinkGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03]">
      <h2 className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className="divide-y divide-white/10 px-4">{children}</div>
    </section>
  );
}

function LinkRow({
  title,
  url,
  note,
  hint,
  open = false,
  whatsapp = false,
  previewUrl,
  shareText,
}: {
  title: string;
  url: string;
  note?: string;
  hint?: ReactNode;
  open?: boolean;
  whatsapp?: boolean;
  previewUrl?: string;
  shareText?: string;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const fullUrl = absoluteUrl(url);
  const fullPreviewUrl = previewUrl ? absoluteUrl(previewUrl) : null;

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function copyToClipboard() {
    void navigator.clipboard.writeText(fullUrl).then(
      () => {
        setCopied(true);
        toast({
          title: "Copied",
          description: `${title} link is on the clipboard.`,
        });
      },
      () => {
        toast({
          title: "Copy failed",
          description: "Select the address and copy it manually.",
          variant: "destructive",
        });
      },
    );
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    shareText ?? `${title}: ${fullUrl}`,
  )}`;

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
        <p className="mt-1 truncate font-mono text-xs text-slate-400" title={fullUrl}>
          {fullUrl}
        </p>
        {hint}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
        <Button
          type="button"
          size="sm"
          variant={open ? "outline" : "default"}
          onClick={copyToClipboard}
        >
          <Copy className="w-3.5 h-3.5" aria-hidden />
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </Button>
        {fullPreviewUrl ? (
          <Button size="sm" variant="outline" asChild>
            <a href={fullPreviewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="w-3.5 h-3.5" aria-hidden />
              Preview
            </a>
          </Button>
        ) : null}
        {whatsapp ? (
          <Button size="sm" variant="outline" asChild>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="w-3.5 h-3.5" aria-hidden />
              WhatsApp
            </a>
          </Button>
        ) : null}
        {open ? (
          <Button size="sm" asChild>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" aria-hidden />
              Open
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function CricketLinksPage() {
  const [, params] = useRoute("/tournament/:id/score/links");
  const tournamentId = parseInt(params?.id || "0", 10);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const ledDisplayUrl = scoreDisplayPath(tournamentId, tournament?.auctionCode);
  const obsV2Url = cricketObsV2Path(tournamentId);
  const obsV2PreviewUrl = cricketObsV2PreviewPath(tournamentId);
  const publicFanUrl = cricketPublicPath(tournamentId);
  const scorerPortalUrl = `/scoring-app/cricket/scorer?tid=${tournamentId}`;
  const fanShareText = `Watch live scores for ${tournament?.name ?? "this tournament"}: ${absoluteUrl(publicFanUrl)}`;

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
        subtitle="Screen addresses, the fan link, and the scorer link."
      />

      <div className="max-w-5xl mx-auto space-y-4 px-3 pb-16 pt-6 sm:px-6">
        <LinkGroup title="Screens">
          <LinkRow
            title="OBS V2 Broadcast Overlay"
            url={obsV2Url}
            previewUrl={obsV2PreviewUrl}
            open
            hint={
              <details className="mt-2 max-w-xl">
                <summary className="cursor-pointer text-xs font-medium text-slate-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm">
                  How to add this in OBS
                </summary>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Choose Add Source, then Browser. Paste this URL. Set the width to 1920 and the height to 1080.
                </p>
              </details>
            }
          />
          <LinkRow
            title="Ground LED Scoreboard"
            url={ledDisplayUrl}
            note="Open this on the stadium laptop, then press F11."
            open
          />
        </LinkGroup>

        <LinkGroup title="People">
          <LinkRow
            title="Fan Hub"
            url={publicFanUrl}
            shareText={fanShareText}
            whatsapp
            open
          />
          <FanLiveStreamEditor tournamentId={tournamentId} plain />
        </LinkGroup>

        <LinkGroup title="Officials">
          <LinkRow
            title="Scorer Console"
            url={scorerPortalUrl}
            note="Officials sign in with the scorer PIN."
          />
        </LinkGroup>
      </div>
    </CricketOrganizerPageShell>
  );
}
