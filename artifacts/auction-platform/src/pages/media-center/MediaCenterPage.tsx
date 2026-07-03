import { Link, useRoute } from "wouter";
import type { ReactNode } from "react";
import {
  useGetTournament,
  useGetTournamentSummary,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { BuzzStudioFeatureGuard } from "@/components/buzz-studio-feature-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getEnabledTemplates,
  getComingSoonTemplates,
  BuzzTemplateCategory,
} from "@/features/buzz-studio";
import {
  templateStudioPath,
  templateStudioTournamentPath,
} from "@/lib/tournament-navigation";
import { Sparkles, Image, Clock, Trophy, Users, UserCheck, ChevronRight } from "lucide-react";

const CATEGORY_LABELS: Record<BuzzTemplateCategory, string> = {
  [BuzzTemplateCategory.PLAYER]: "Player",
  [BuzzTemplateCategory.AUCTION]: "Auction",
  [BuzzTemplateCategory.TEAM]: "Team",
  [BuzzTemplateCategory.ACHIEVEMENT]: "Achievement",
  [BuzzTemplateCategory.TOURNAMENT]: "Tournament",
};

export default function MediaCenterPage() {
  const [, tournamentParams] = useRoute("/tournament/:id/media-center");
  const [, organizerParams] = useRoute("/organizer/media-center/:id");
  const tournamentId = parseInt(
    tournamentParams?.id || organizerParams?.id || "0",
    10,
  );
  const isOrganizerRoute = Boolean(organizerParams);

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: tournamentId > 0 },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: tournamentId > 0 },
  });

  const enabledTemplates = getEnabledTemplates();
  const comingSoonTemplates = getComingSoonTemplates();

  function templateHref(templateId: string): string {
    return isOrganizerRoute
      ? templateStudioPath(tournamentId, templateId)
      : templateStudioTournamentPath(tournamentId, templateId);
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <BuzzStudioFeatureGuard tournamentId={tournamentId}>
        <div className="space-y-8">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <OrganizerSectionHeader
            tournament={tournament}
            title={
              <span className="flex items-center gap-3">
                <span className="rounded-lg bg-primary/10 p-2.5">
                  <Sparkles className="h-6 w-6 text-primary" />
                </span>
                BidWar Media Center
              </span>
            }
            titleClassName="text-2xl font-display font-black text-white tracking-tight"
            description="Create professional tournament creatives powered by BidWar."
          />

          {/* ── Section 1: Available Templates ──────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Image className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Available Templates
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {enabledTemplates.map((entry) => (
                <Link key={entry.id} href={templateHref(entry.id)}>
                  <Card className="h-full border-border bg-card/70 hover:border-primary/40 hover:bg-card/90 transition-colors cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base font-display font-bold text-white group-hover:text-primary transition-colors">
                          {entry.title}
                        </CardTitle>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <CardDescription className="text-xs leading-relaxed flex-1">
                          {entry.description}
                        </CardDescription>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">
                          {CATEGORY_LABELS[entry.category]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {entry.aspectRatios.map((ratio) => (
                          <Badge key={ratio} variant="secondary" className="text-[10px]">
                            {ratio}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* ── Section 2: Coming Soon ──────────────────────────────────── */}
          {comingSoonTemplates.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Coming Soon
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {comingSoonTemplates.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-border/60 bg-card/40 px-4 py-3 opacity-60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{entry.title}</span>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Soon
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Section 3: Tournament Overview ────────────────────────────── */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Tournament Overview
              </h2>
            </div>
            <Card className="border-border bg-card/70">
              <CardContent className="pt-6">
                {loadingTournament || loadingSummary ? (
                  <p className="text-sm text-muted-foreground">Loading tournament data…</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                    <OverviewStat
                      label="Tournament"
                      value={tournament?.name ?? "—"}
                      icon={<Trophy className="h-4 w-4" />}
                    />
                    <OverviewStat
                      label="Sport"
                      value={(tournament?.sport ?? "—").toUpperCase()}
                      icon={<Sparkles className="h-4 w-4" />}
                    />
                    <OverviewStat
                      label="Teams"
                      value={String(summary?.totalTeams ?? 0)}
                      icon={<Users className="h-4 w-4" />}
                    />
                    <OverviewStat
                      label="Players"
                      value={String(summary?.totalPlayers ?? 0)}
                      icon={<UserCheck className="h-4 w-4" />}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </BuzzStudioFeatureGuard>
    </AppLayout>
  );
}

function OverviewStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-lg font-display font-bold text-white truncate">{value}</div>
    </div>
  );
}
