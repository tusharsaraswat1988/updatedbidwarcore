import { type ReactNode } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Link2, Copy, ExternalLink, MessageCircle, Radio, Users } from "lucide-react";
import { ownerJoinPublicUrl } from "@workspace/platform-core";
import { broadcastOverlayUrl } from "@/lib/broadcast-overlay";
import { liveViewerPath, sideDisplayPath } from "@/lib/tournament-navigation";
import { useToast } from "@/hooks/use-toast";

function LinkSectionHeader({
  title,
  icon,
}: {
  title: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/60 bg-card/50">
      {icon ? <span className="text-primary">{icon}</span> : null}
      <h2 className="font-display text-sm font-bold text-foreground">{title}</h2>
    </div>
  );
}

function LinkRow({ label, url, description, shareText }: { label: string; url: string; description: string; shareText?: string }) {
  const { toast } = useToast();
  const whatsappText = shareText ?? `${label}: ${url}`;

  function copyUrl() {
    void navigator.clipboard.writeText(url).then(
      () => toast({ title: "Copied", description: "Link copied to clipboard" }),
      () => toast({ title: "Copy failed", description: "Select the address and copy it manually.", variant: "destructive" }),
    );
  }

  function copyWhatsApp() {
    void navigator.clipboard.writeText(whatsappText).then(
      () => toast({ title: "Copied", description: "Message and link copied. Paste them in WhatsApp." }),
      () => toast({ title: "Copy failed", description: "Could not copy the WhatsApp message.", variant: "destructive" }),
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5 h-8 px-2.5" onClick={copyUrl}>
          <Copy className="w-3.5 h-3.5" /> Copy
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 px-2.5" onClick={copyWhatsApp}>
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8 px-2.5" onClick={() => window.open(url, "_blank")}>
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
  const teamPortalUrl = ownerJoinPublicUrl(base, tournamentId);

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content max-w-3xl !space-y-4">
        <OrganizerSectionHeader
          tournament={tournament}
          title={<span className="flex items-center gap-3"><Link2 className="w-8 h-8 text-primary" /> Links</span>}
          description="Auction day screens, stream, and fans."
        />

        <Card className="overflow-hidden panel border-none">
          <CardContent className="p-0">
            <LinkSectionHeader title="LED" />
            <div className="px-4">
              <LinkRow
                label="Big screen"
                url={displayUrl}
                description={
                  tournament?.auctionCode
                    ? `Projector or TV. Enter ${tournament.auctionCode} if the screen asks.`
                    : "Projector or TV. Press F11 for full screen."
                }
                shareText={`Big screen link for ${tournament?.name ?? "our auction"}: ${displayUrl}`}
              />
              <LinkRow
                label="Side screen — sponsors"
                url={sideSponsorUrl}
                description="Left or right screen. Stays on the sponsor carousel."
                shareText={`Sponsor side screen for ${tournament?.name ?? "our auction"}: ${sideSponsorUrl}`}
              />
              <LinkRow
                label="Side screen — player"
                url={sidePlayerUrl}
                description="Player on the block, with the live bid and timer."
                shareText={`Player profile side screen for ${tournament?.name ?? "our auction"}: ${sidePlayerUrl}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden panel border-none">
          <CardContent className="p-0">
            <LinkSectionHeader icon={<Radio className="h-4 w-4" />} title="Broadcast" />
            <div className="px-4">
              <LinkRow
                label="Overlay"
                url={broadcastOverlayUrlValue}
                description="Add a Browser Source, paste the link, set 1920×1080."
                shareText={`Broadcast Overlay for ${tournament?.name ?? "our auction"}: ${broadcastOverlayUrlValue}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden panel border-none">
          <CardContent className="p-0">
            <LinkSectionHeader icon={<Monitor className="h-4 w-4" />} title="Spectators" />
            <div className="px-4">
            <LinkRow
              label="Live viewer"
              url={liveViewerUrl}
              description="Fans open this and the auction loads. No code needed."
              shareText={`Watch our auction live: ${liveViewerUrl}`}
            />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden panel border-none">
          <CardContent className="p-0">
            <LinkSectionHeader icon={<Users className="h-4 w-4" />} title="Team portal" />
            <div className="px-4">
              <LinkRow
                label="Open team portal"
                url={teamPortalUrl}
                description="Owners sign in with their mobile and access code."
                shareText={`Team portal for ${tournament?.name ?? "our auction"}: ${teamPortalUrl}`}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
