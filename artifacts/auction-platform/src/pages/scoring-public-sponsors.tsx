import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import { PublicSponsorsStrip, parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import { cricketCardClass, cricketSectionTitleClass } from "@/components/scoring/cricket-page-chrome";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";

export default function ScoringPublicSponsorsPage() {
  const [, params] = useRoute("/tournament/:id/cricket/sponsors");
  const tournamentId = parseInt(params?.id || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
  });

  const liveMatchId = (data?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const sponsors = parseTournamentSponsors(data?.tournament?.sponsorLogos);

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Sponsors not available." />;
  }

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Partners</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{data.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">Official sponsors of this tournament.</p>
      </header>

      {sponsors.length === 0 ? (
        <div className={cn(cricketCardClass, "px-4 py-8 text-center text-sm text-muted-foreground")}>
          Sponsors will appear here when the organizer publishes partner logos.
        </div>
      ) : (
        <div className="space-y-8">
          <PublicSponsorsStrip sponsors={sponsors} title="All sponsors" />
          <section>
            <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Partner directory</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sponsors.map((s, idx) => (
                <li key={`${s.url}-${idx}`} className={cn(cricketCardClass, "px-4 py-4 flex items-center gap-4")}>
                  {s.url ? (
                    <img
                      src={s.url}
                      alt={s.name || "Sponsor"}
                      className="h-14 max-w-[120px] object-contain"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted/40" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name || "Sponsor"}</p>
                    {s.type ? (
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                        {String(s.type).replace(/_/g, " ")}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </CricketFanExperienceShell>
  );
}
