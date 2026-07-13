import { useState } from "react";
import { Copy, ExternalLink, QrCode, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/form-ui";
import {
  badmintonQrImageUrl,
  badmintonTournamentBroadcastLinkUrl,
  type TournamentBroadcastLinkKind,
} from "@/lib/badminton-broadcast-urls";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BroadcastLinkCardProps = {
  kind: TournamentBroadcastLinkKind;
  tournamentId: number;
  title: string;
  help: string;
  icon: LucideIcon;
  className?: string;
};

export function BroadcastLinkCard({
  kind,
  tournamentId,
  title,
  help,
  icon: Icon,
  className,
}: BroadcastLinkCardProps) {
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState(false);
  const url = badmintonTournamentBroadcastLinkUrl(kind, tournamentId);

  function copyLink() {
    void navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied", description: `${title} link is on your clipboard.` });
    });
  }

  function openLink() {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <article className={cn(hubCardClass, "p-4 flex flex-col gap-3", className)}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-200 shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-display font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{help}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-auto">
          <button
            type="button"
            onClick={openLink}
            className="h-9 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-foreground/90 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Link
          </button>
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            className="h-9 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-foreground/90 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            Show QR
          </button>
        </div>
      </article>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm bg-zinc-950 border-white/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={badmintonQrImageUrl(url, 280)}
              alt={`${title} QR code`}
              className="rounded-lg bg-white p-2 w-[280px] h-[280px]"
            />
            <p className="text-[10px] text-muted-foreground font-mono break-all text-center px-2">
              {url}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
