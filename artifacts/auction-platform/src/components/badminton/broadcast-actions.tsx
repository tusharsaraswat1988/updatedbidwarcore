import { useState } from "react";
import { Link } from "wouter";
import { ExternalLink, Copy, QrCode, Share2, Monitor, Radio, Tablet, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { BtnPrimary, BtnSecondary } from "@/components/badminton/form-ui";
import { hubCardClass } from "@/components/badminton/form-ui";
import {
  badmintonBroadcastUrl,
  badmintonQrImageUrl,
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
    description: "Court-side scoring tablet for the umpire. Requires match PIN.",
    icon: Tablet,
    openLabel: "Open umpire scorer",
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
    const url = badmintonBroadcastUrl("scorer", matchId, tournamentId);
    const label = matchLabel ?? `Match #${matchId}`;
    const message = [
      `Umpire scorer access — ${label}`,
      url,
      "",
      "For the court umpire only. Enter the PIN set when creating this match.",
      "Match Control (pause, retirement) is separate — use the organizer Matches page.",
    ].join("\n");
    navigator.clipboard.writeText(message).then(() => {
      toast({
        title: "Scorer access copied",
        description: "Share the message with your court official via WhatsApp or email.",
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
