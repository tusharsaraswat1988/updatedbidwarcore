import { useRoute } from "wouter";
import {
  useListTeams,
  useGetTournament,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Users, Link2, Copy, ExternalLink, UserSquare2, ClipboardList } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function LinkRow({ label, url, description }: { label: string; url: string; description: string }) {
  const { toast } = useToast();
  function copy() {
    navigator.clipboard.writeText(url);
    toast({ title: "Copied!", description: "Link copied to clipboard" });
  }
  return (
    <div className="flex items-center gap-4 py-4 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        <p className="text-xs font-mono text-primary mt-1 truncate">{url}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={copy}>
          <Copy className="w-3.5 h-3.5" /> Copy
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
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const base = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
            <Link2 className="w-8 h-8 text-primary" /> Links
          </h1>
          <p className="text-muted-foreground mt-2">
            Share these links for {tournament?.name || "your tournament"}.
          </p>
        </div>

        {/* Broadcast Links */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Broadcast</h2>
            </div>
            <LinkRow
              label="LED Big Screen Display"
              url={`${base}/tournament/${tournamentId}/display`}
              description="Open this on the projector or big screen TV during the auction."
            />
            <LinkRow
              label="OBS Camera Overlay"
              url={`${base}/tournament/${tournamentId}/obs`}
              description="Camera overlay for YouTube live streaming. Add as Browser Source in OBS (1920x1080). Transparent top, animated auction details at the bottom."
            />
            <LinkRow
              label="Fortune Wheel"
              url={`${base}/tournament/${tournamentId}/fortune-wheel`}
              description="Tiebreaker spin wheel — project this for fair draws."
            />
          </CardContent>
        </Card>

        {/* Admin Links */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Admin & Operations</h2>
            </div>
            <LinkRow
              label="Operator Panel"
              url={`${base}/tournament/${tournamentId}/auction`}
              description="Main auction control panel. Keep this open on the host's device."
            />
            <LinkRow
              label="Reports"
              url={`${base}/tournament/${tournamentId}/reports`}
              description="Auction analytics, team purse breakdown, top bids."
            />
            <LinkRow
              label="Player Registration Form"
              url={`${base}/tournament/${tournamentId}/register`}
              description="Send this link to players to self-register. They fill their own details."
            />
          </CardContent>
        </Card>

        {/* Team Owner Links */}
        {teams && teams.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg">Team Owner Panels</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Share each team's link with their respective owner. They can view stats and place bids from their phone.
              </p>
              {teams.map(team => (
                <LinkRow
                  key={team.id}
                  label={`${team.name} — ${team.ownerName}`}
                  url={`${base}/tournament/${tournamentId}/owner/${team.id}`}
                  description={`Owner panel for ${team.name}. ${team.ownerMobile ? `Mobile: ${team.ownerMobile}` : ""}`}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Player Stats View */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserSquare2 className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Viewer Links</h2>
            </div>
            <LinkRow
              label="Live Auction Display (viewer)"
              url={`${base}/tournament/${tournamentId}/display`}
              description="Read-only view showing live bid amounts, team purses, and player details."
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
