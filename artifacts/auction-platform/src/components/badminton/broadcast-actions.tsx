import { useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Copy, QrCode, Share2, Monitor, Radio, Tablet, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { BtnPrimary, BtnSecondary } from "@/components/badminton/form-ui";
import { hubCardClass } from "@/components/badminton/form-ui";
import {
  badmintonBroadcastUrl,
  badmintonQrImageUrl,
  badmintonScorerHomePublicUrl,
  type BadmintonBroadcastKind,
} from "@/lib/badminton-broadcast-urls";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BroadcastOutput {
  kind: BadmintonBroadcastKind;
  title: string;
  description: string;
  icon: typeof Monitor;
  openLabel: string;
}

const OUTPUTS: BroadcastOutput[] = [
  {
    kind: "display",
    title: "Venue display",
    description: "Full-screen scoreboard for LED walls and projectors.",
    icon: Monitor,
    openLabel: "Open display",
  },
  {
    kind: "overlay-compact",
    title: "Stream overlay (compact)",
    description: "Lower-third bar for OBS and live streams.",
    icon: Radio,
    openLabel: "Open overlay",
  },
  {
    kind: "overlay-full",
    title: "Stream overlay (full)",
    description: "Complete match scorecard for broadcasts.",
    icon: Radio,
    openLabel: "Open overlay",
  },
  {
    kind: "scorer",
    title: "Umpire scorer",
    description: "Per-match scoring link (compatibility). Prefer Scorer Home below for day-of use.",
    icon: Tablet,
    openLabel: "Open match scorer",
  },
];

export function BadmintonBroadcastActions({
  matchId,
  tournamentId,
  matchLabel,
  className,
}: {
  matchId: number;
  tournamentId: number;
  matchLabel?: string;
  className?: string;
}) {
  const { toast } = useToast();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrTitle, setQrTitle] = useState("");

  function copyUrl(kind: BadmintonBroadcastKind, title: string) {
    const url = badmintonBroadcastUrl(kind, matchId, tournamentId);
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied", description: `${title} link is on your clipboard.` });
    });
  }

  function openUrl(kind: BadmintonBroadcastKind) {
    window.open(badmintonBroadcastUrl(kind, matchId, tournamentId), "_blank", "noopener,noreferrer");
  }

  function showQr(kind: BadmintonBroadcastKind, title: string) {
    const url = badmintonBroadcastUrl(kind, matchId, tournamentId);
    setQrTitle(title);
    setQrUrl(badmintonQrImageUrl(url));
  }

  function shareScorerAccess() {
    const homeUrl = badmintonScorerHomePublicUrl(tournamentId);
    const directUrl = badmintonBroadcastUrl("scorer", matchId, tournamentId);
    const label = matchLabel ?? `Match #${matchId}`;
    const message = [
      `Umpire Scorer Home — ${label}`,
      homeUrl,
      "",
      "Enter the match PIN once, then choose which match to score.",
      "Assign the same PIN to every match this umpire should open.",
      "",
      `Direct match link (optional): ${directUrl}`,
      "Match Control (pause, retirement) stays with the organizer.",
    ].join("\n");
    navigator.clipboard.writeText(message).then(() => {
      toast({
        title: "Scorer access copied",
        description: "Share Scorer Home + PIN with your court official.",
      });
    });
  }

  return (
    <>
      <div className={cn("space-y-4", className)}>
        <div className={cn(hubCardClass, "p-4 border-amber-500/25 bg-amber-500/5")}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
              <Shield className="w-4 h-4 text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Match Control</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tournament director panel — pause, retirement, walkover. Separate from umpire scoring.
              </p>
            </div>
          </div>
          <Link
            href={badmintonMatchControlPath(tournamentId, matchId)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground border border-primary-border px-4 py-2.5 font-semibold text-sm shadow-[var(--shadow-glow)] hover-elevate active-elevate-2 transition-all w-full sm:w-auto"
          >
            <Shield className="w-3.5 h-3.5" />
            Open Match Control
          </Link>
        </div>

        <div className={cn(hubCardClass, "p-4 border-sky-500/25 bg-sky-500/5")}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-lg bg-sky-500/15 shrink-0">
              <Tablet className="w-4 h-4 text-sky-300" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Scorer Home (recommended)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                One link + PIN. Umpire picks which assigned match to score. Reuse the same PIN across
                that umpire&apos;s matches.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <BtnPrimary
              type="button"
              onClick={() =>
                window.open(badmintonScorerHomePublicUrl(tournamentId), "_blank", "noopener,noreferrer")
              }
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Scorer Home
            </BtnPrimary>
            <BtnSecondary
              type="button"
              onClick={() => {
                const url = badmintonScorerHomePublicUrl(tournamentId);
                navigator.clipboard.writeText(url).then(() => {
                  toast({ title: "Link copied", description: "Scorer Home link is on your clipboard." });
                });
              }}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Scorer Home
            </BtnSecondary>
            <BtnSecondary type="button" onClick={shareScorerAccess} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              Share with PIN tips
            </BtnSecondary>
          </div>
        </div>

        {OUTPUTS.map((output) => {
          const Icon = output.icon;
          return (
            <div key={output.kind} className={cn(hubCardClass, "p-4")}>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{output.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{output.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <BtnPrimary type="button" onClick={() => openUrl(output.kind)} className="gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {output.openLabel}
                </BtnPrimary>
                <BtnSecondary type="button" onClick={() => copyUrl(output.kind, output.title)} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  Copy link
                </BtnSecondary>
                <BtnSecondary type="button" onClick={() => showQr(output.kind, output.title)} className="gap-1.5">
                  <QrCode className="w-3.5 h-3.5" />
                  Generate QR
                </BtnSecondary>
                {output.kind === "scorer" && (
                  <BtnSecondary type="button" onClick={shareScorerAccess} className="gap-1.5">
                    <Share2 className="w-3.5 h-3.5" />
                    Share scorer access
                  </BtnSecondary>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!qrUrl} onOpenChange={(open) => !open && setQrUrl(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{qrTitle}</DialogTitle>
          </DialogHeader>
          {qrUrl && (
            <div className="flex flex-col items-center gap-3 py-2">
              <img src={qrUrl} alt={`QR code for ${qrTitle}`} className="rounded-lg border border-border" width={240} height={240} />
              <p className="text-xs text-muted-foreground text-center">
                Scan to open on a phone or tablet. No URL typing needed.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
