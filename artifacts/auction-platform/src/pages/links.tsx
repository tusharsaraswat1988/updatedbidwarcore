import { useRoute } from "wouter";
import {
  useListTeams,
  useGetTournament,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { ownerJoinPublicUrl } from "@workspace/api-base/owner-urls";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Users, Link2, Copy, ExternalLink, MessageCircle, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Team } from "@workspace/api-client-react";

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

function TeamOwnerRow({
  team,
  tournamentId,
  tournamentName,
}: {
  team: Team;
  tournamentId: number;
  tournamentName?: string;
}) {
  const { toast } = useToast();
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const ownerUrl = ownerJoinPublicUrl(base, tournamentId, team.id);
  const shareLines = [
    `${tournamentName ?? "Auction"} — ${team.name}`,
    team.ownerName ? `Owner: ${team.ownerName}` : null,
    team.accessCode ? `Access code: ${team.accessCode}` : null,
    `Bidding link: ${ownerUrl}`,
  ].filter(Boolean);
  const whatsappHref = `https://wa.me/${team.ownerMobile ? team.ownerMobile.replace(/\D/g, "") : ""}?text=${encodeURIComponent(shareLines.join("\n"))}`;

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: label });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 py-5 border-b border-border/50 last:border-0">
      <div className="flex items-start gap-3 sm:w-56 flex-shrink-0">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt={team.name}
            className="w-12 h-12 rounded-lg object-contain border border-border bg-muted/20"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center font-display font-bold text-sm flex-shrink-0"
            style={{ backgroundColor: `${team.color ?? "#444"}22`, color: team.color || "#fff", border: `1px solid ${team.color ?? "#444"}44` }}
          >
            {team.shortCode}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-sm leading-tight">{team.name}</p>
          {team.ownerName && <p className="text-xs text-muted-foreground mt-0.5">{team.ownerName}</p>}
          {team.ownerMobile && <p className="text-xs font-mono text-muted-foreground mt-0.5">{team.ownerMobile}</p>}
          {team.ownerEmail && <p className="text-xs text-muted-foreground mt-0.5 break-all">{team.ownerEmail}</p>}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        {team.accessCode && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <KeyRound className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Owner access code</p>
              <p className="text-sm font-display font-black tracking-[0.15em] text-primary">{team.accessCode}</p>
            </div>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyText(team.accessCode!, "Access code copied")}>
              <Copy className="w-3 h-3" /> Copy
            </Button>
          </div>
        )}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner bidding link</p>
          <p className="text-xs font-mono text-primary truncate">{ownerUrl}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 flex-wrap sm:flex-col sm:items-stretch">
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => copyText(ownerUrl, "Owner link copied")}>
          <Copy className="w-3.5 h-3.5" /> Copy link
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => window.open(ownerUrl, "_blank")}>
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
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const displayUrl = `${base}/tournament/${tournamentId}/display`;
  const scoreDisplayUrl = `${base}/tournament/${tournamentId}/score-display`;
  const liveViewerUrl = `${base}/tournament/${tournamentId}/liveviewer`;
  const obsUrl = `${base}/tournament/${tournamentId}/obs`;

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Link2 className="w-8 h-8 text-primary" /> Links
          </h1>
          <p className="text-muted-foreground mt-2">
            Share links for auction day — LED screen, streaming, and team owners.
          </p>
        </div>

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
          </CardContent>
        </Card>

        {tournament?.sport === "cricket" ? (
          <Card className="border-emerald-500/25 bg-emerald-500/5">
            <CardContent className="p-6">
              <h2 className="font-display font-bold text-lg mb-1">Cricket Scoreboard (LED)</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Live ball-by-ball score for the ground projector — updates automatically from the phone scorer.
              </p>
              <LinkRow
                label="Cricket LED Scoreboard"
                url={scoreDisplayUrl}
                description={
                  tournament?.auctionCode
                    ? `Enter code ${tournament.auctionCode} if prompted.`
                    : "Open on a TV or projector at the ground."
                }
              />
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">More screens &amp; streaming (optional)</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">For YouTube live or fans watching from home.</p>
            <LinkRow
              label="OBS Camera Overlay"
              url={obsUrl}
              description="For live-streaming to YouTube, Instagram, or Facebook. Add as a Browser Source in OBS Studio (1920×1080, transparent background)."
            />
            <LinkRow
              label="Live Auction Viewer (spectators)"
              url={liveViewerUrl}
              description="Share with fans and family — watch the auction live from any phone, tablet, or laptop."
              shareText={`Watch our auction live: ${liveViewerUrl}`}
            />
          </CardContent>
        </Card>

        {teams && teams.length > 0 ? (
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg">Team Owner Panels</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Send each owner their access code and personal bidding link. They open it on their phone to place bids — no login required.
              </p>
              {teams.map(team => (
                <TeamOwnerRow
                  key={team.id}
                  team={team}
                  tournamentId={tournamentId}
                  tournamentName={tournament?.name}
                />
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-border">
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Team owner links</p>
              <p>Add teams first — each owner&apos;s access code and bidding link will appear here.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
