import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Link2, Copy, ExternalLink, MessageCircle, Radio } from "lucide-react";
import { BroadcastOverlayInfo } from "@/components/broadcast/broadcast-overlay-info";
import { broadcastOverlayUrl, broadcastOverlayPreviewUrl } from "@/lib/broadcast-overlay";
import { liveViewerPath, sideDisplayPath } from "@/lib/tournament-navigation";
import { useToast } from "@/hooks/use-toast";

function LinkRow({ label, url, description, shareText }: { label: string; url: string; description: string; shareText?: string }) {
  const { toast } = useToast();
  function copy() {
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  }
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText ?? `${label}: ${url}`)}`;
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        <p className="text-xs font-mono text-primary mt-1 truncate">{url}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={copy}>
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="w-3.5 h-3.5" /> Open
        </Button>
      </div>
    </div>
  );
}

export default function LinksPage() {
  const [, params] = useRoute("/tournament/:id/links");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const displayUrl = `${base}/tournament/${tournamentId}/display`;
  const sideSponsorUrl = `${base}${sideDisplayPath(tournamentId, "sponsors", tournament?.auctionCode)}`;
  const sidePlayerUrl = `${base}${sideDisplayPath(tournamentId, "player", tournament?.auctionCode)}`;
  const liveViewerUrl = `${base}${liveViewerPath(tournamentId)}`;
  const broadcastOverlayUrlValue = broadcastOverlayUrl(base, tournamentId);
  const broadcastPreviewUrlValue = broadcastOverlayPreviewUrl(base, tournamentId);

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8 max-w-3xl">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<span className="flex items-center gap-3"><Link2 className="w-8 h-8 text-primary" /> Links</span>}
          description="Share links for auction day — LED screen, streaming, and spectators."
        />

        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-6">
            <h2 className="font-display font-bold text-lg mb-1">LED Big Screen</h2>
            <p className="text-xs text-muted-foreground mb-4">Open on your projector laptop on auction day.</p>
            <LinkRow
              label="LED Big Screen (projector / TV)"
              url={displayUrl}
              description={
                tournament?.auctionCode
                  ? `When the screen asks for a code, enter ${tournament.auctionCode}. Team owners do not need this code.`
                  : "Open on the big screen at your venue. Press F11 for full screen."
              }
              shareText={`Big screen link for ${tournament?.name ?? "our auction"}: ${displayUrl}`}
            />
            <LinkRow
              label="Side LED — Sponsors (left / right screen)"
              url={sideSponsorUrl}
              description="Portrait or landscape flanking screen — professional sponsor carousel. Stays on sponsors even when operator switches main LED to team/player/top 5 views."
              shareText={`Sponsor side screen for ${tournament?.name ?? "our auction"}: ${sideSponsorUrl}`}
            />
            <LinkRow
              label="Side LED — Live Player Profile"
              url={sidePlayerUrl}
              description="Portrait or landscape flanking screen — full profile of the player on block with live bid and timer. Independent of operator LED overlay controls."
              shareText={`Player profile side screen for ${tournament?.name ?? "our auction"}: ${sidePlayerUrl}`}
            />
          </CardContent>
        </Card>

        <Card className="border-violet-500/25 bg-violet-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Broadcast Overlay</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Transparent live graphics for streaming — add as a Browser Source in OBS, vMix, Wirecast, or similar (1920×1080).
            </p>
            <LinkRow
              label="Broadcast Overlay URL"
              url={broadcastOverlayUrlValue}
              description="Real-time player card, live bid, team ticker, and sponsor branding over your stream. Set browser source to 1920×1080 with a transparent background."
              shareText={`Broadcast Overlay for ${tournament?.name ?? "our auction"}: ${broadcastOverlayUrlValue}`}
            />
            <LinkRow
              label="Camera preview (test without OBS)"
              url={broadcastPreviewUrlValue}
              description="See the live overlay on your laptop or phone camera — same layout as OBS, no streaming software needed."
              shareText={`Overlay camera preview: ${broadcastPreviewUrlValue}`}
            />
            <div className="mt-4">
              <BroadcastOverlayInfo />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Spectator viewing (optional)</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Share this link on WhatsApp, Instagram, or QR codes — fans open it and watch immediately. No auction code required.
            </p>
            <LinkRow
              label="Live Auction Viewer (spectators)"
              url={liveViewerUrl}
              description="Opens directly on any phone, tablet, laptop, or OBS browser source — auction loads automatically."
              shareText={`Watch our auction live: ${liveViewerUrl}`}
            />
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
