import { useRoute } from "wouter";
import type { ReactNode } from "react";
import {
  useGetTournament,
  useGetTournamentSummary,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { BuzzStudioFeatureGuard } from "@/components/buzz-studio-feature-guard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getEnabledTemplates,
  getComingSoonTemplates,
  BuzzTemplateCategory,
} from "@/features/buzz-studio";
import { Sparkles, Image, Clock, Trophy, Users, UserCheck } from "lucide-react";

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
  const { toast } = useToast();

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: tournamentId > 0 },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: tournamentId > 0 },
  });

  const enabledTemplates = getEnabledTemplates();
  const comingSoonTemplates = getComingSoonTemplates();

  function handleGenerateClick() {
    toast({
      title: "Coming soon",
      description: "Creative generation coming soon.",
    });
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <BuzzStudioFeatureGuard tournamentId={tournamentId}>
        <div className="space-y-8">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-black text-white tracking-tight">
                  BidWar Media Center
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Create professional tournament creatives powered by BidWar.
                </p>
              </div>
            </div>
          </div>

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
                <Card key={entry.id} className="border-border bg-card/70 hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base font-display font-bold text-white">
                        {entry.title}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary">
                        {CATEGORY_LABELS[entry.category]}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs leading-relaxed">
                      {entry.description}
                    </CardDescription>
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

          {/* ── Section 4: Generate Button ────────────────────────────────── */}
          <section className="flex justify-center pt-2 pb-4">
            <Button
              size="lg"
              className="font-display font-bold px-10"
              onClick={handleGenerateClick}
            >
              Generate Creative
            </Button>
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
