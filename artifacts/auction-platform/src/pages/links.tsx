import { useRoute } from "wouter";
import {
  useListTeams,
  useGetTournament,
  useGetRegistrationStatus,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
  getGetRegistrationStatusQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Users, Link2, Copy, ExternalLink, UserSquare2, ClipboardList, CalendarX, Lock, CheckCircle2, Radio } from "lucide-react";
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
  const { data: regStatus } = useGetRegistrationStatus(tournamentId, {
    query: {
      queryKey: getGetRegistrationStatusQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 15000,
    },
  });

  const base = typeof window !== "undefined" ? window.location.origin : "";

  function fmtDate(d: string | null | undefined) {
    if (!d) return "";
    try {
      return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch { return d; }
  }
  const regParts: string[] = [];
  if (regStatus?.deadline) regParts.push(`closes ${fmtDate(regStatus.deadline)}`);
  if (regStatus?.limit != null) regParts.push(`${regStatus.currentCount}/${regStatus.limit} registered`);
  else if (regStatus) regParts.push(`${regStatus.currentCount} registered`);
  const regSuffix = regParts.length ? ` — ${regParts.join(", ")}` : "";

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
            <div className="flex items-center gap-2 mb-1">
              <Monitor className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Screens &amp; Display</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Open these on a projector, TV, or streaming setup during the live auction.</p>
            <LinkRow
              label="LED Big Screen Display"
              url={`${base}/tournament/${tournamentId}/display${tournament?.auctionCode ? `?code=${tournament.auctionCode}` : ""}`}
              description="The main big-screen view for your venue. Shows the current player card, live bid amount, and team logos in broadcast quality. Open on your projector or TV and press F11 for full screen."
            />
            <LinkRow
              label="OBS Camera Overlay"
              url={`${base}/tournament/${tournamentId}/obs`}
              description="For live-streaming to YouTube, Instagram, or Facebook. Add this URL as a Browser Source in OBS Studio (1920×1080, transparent background) — it overlays the auction details on top of your camera feed."
            />
            <LinkRow
              label="Fortune Wheel"
              url={`${base}/tournament/${tournamentId}/fortune-wheel`}
              description="A spin wheel for tie-breaks, draft order draws, or any random selection. Loaded with your team names by default. Spin it live in front of the audience for a transparent result."
            />
          </CardContent>
        </Card>

        {/* Admin Links */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Operator &amp; Admin</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Links for the person running the auction and the organizer.</p>
            <LinkRow
              label="Operator Panel"
              url={`${base}/tournament/${tournamentId}/auction`}
              description="The main auction control screen. The operator uses this to start the auction, call players, accept bids, and mark players as sold. Keep this open on the host's laptop or tablet."
            />
            <LinkRow
              label="Reports &amp; Analytics"
              url={`${base}/tournament/${tournamentId}/reports`}
              description="Summary after the auction — which team spent how much, top players sold, unsold players, and purse breakdown charts."
            />
            <LinkRow
              label="Player Registration Form"
              url={`${base}/tournament/${tournamentId}/register`}
              description={`Share this link with players so they can fill in their own details (name, role, phone, photo). You review and approve before the auction.${regSuffix}`}
            />
            {regStatus && (
              <div className="-mt-3 mb-1 ml-0">
                {regStatus.open ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2.5 py-0.5">
                    <CheckCircle2 className="w-3 h-3" /> Open for registration
                  </span>
                ) : regStatus.reason === "deadline_passed" ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2.5 py-0.5">
                    <CalendarX className="w-3 h-3" /> Closed — deadline passed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2.5 py-0.5">
                    <Lock className="w-3 h-3" /> Closed — limit reached
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Owner Links */}
        {teams && teams.length > 0 && (
          <Card className="border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-1">
                <Users className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg">Team Owner Panels</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Send each team owner their personal link. They open it on their phone or tablet to place bids in real time during the auction — no login required.
              </p>
              {teams.map(team => (
                <LinkRow
                  key={team.id}
                  label={`${team.name} — ${team.ownerName}`}
                  url={`${base}/owner-app/join?tournamentId=${tournamentId}&teamId=${team.id}`}
                  description={`Owner panel for ${team.name}. ${team.ownerMobile ? `Mobile: ${team.ownerMobile}` : ""}`}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Viewer Links */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-5 h-5 text-primary" />
              <h2 className="font-display font-bold text-lg">Spectator Links</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Share these with fans and family who want to watch the auction live from their phone.</p>
            {tournament?.auctionCode && (
              <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-xs text-amber-400">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  These links include the auction code <span className="font-mono font-bold">{tournament.auctionCode}</span> — viewers who open them are admitted automatically.
                </span>
              </div>
            )}
            <LinkRow
              label="Live Auction Viewer"
              url={`${base}/tournament/${tournamentId}/liveviewer${tournament?.auctionCode ? `?code=${tournament.auctionCode}` : ""}`}
              description="Watch the auction live from any device — shows current player, live bid amount, and team updates in real time. Works on phones, tablets, and laptops."
            />
            <LinkRow
              label="LED Big Screen Display"
              url={`${base}/tournament/${tournamentId}/display${tournament?.auctionCode ? `?code=${tournament.auctionCode}` : ""}`}
              description="Full-screen venue display — the same broadcast view shown on the big screen. Share with guests who want a larger view on their own screen."
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
