/**
 * Cricket Sports Teams — scoring identity fields (no Auction purse).
 * Route: /tournament/:id/score/teams
 */
import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTournamentQueryKey,
  getListTeamsQueryKey,
  useGetTournament,
  useListTeams,
  type Team,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  FormModal,
  PageHeader,
  btnCompactClass,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { TeamForm } from "@/components/team-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { handoffAuctionParticipantsToSports } from "@/lib/scoring-api";
import { Pencil, Plus, Shield, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketTeamsPage() {
  const [, params] = useRoute("/tournament/:id/score/teams");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: teams = [], isLoading } = useListTeams(tournamentId, {
    query: {
      queryKey: getListTeamsQueryKey(tournamentId),
      enabled: scoringActive && !!tournamentId,
    },
  });

  const existingShortCodes = useMemo(() => teams.map((t) => t.shortCode), [teams]);
  const existingTeamColors = useMemo(() => teams.map((t) => t.color), [teams]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(team: Team) {
    setEditing(team);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleImport() {
    setImportBusy(true);
    try {
      const result = await handoffAuctionParticipantsToSports(tournamentId);
      await qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      toast({
        title: "Imported from Auction",
        description: result.message || `${result.teamsReady} teams ready for Sports.`,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not import teams",
        variant: "destructive",
      });
    } finally {
      setImportBusy(false);
    }
  }

  if (tournament?.sport && tournament.sport !== "cricket") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Setup"
        title="Teams"
        subtitle="Sports teams — name, short code, owner, color, logo. No Auction purse."
        actions={
          <div className="flex flex-wrap gap-2">
            <BtnSecondary disabled={!scoringActive || importBusy} onClick={() => void handleImport()}>
              <Upload className="w-4 h-4" />
              {importBusy ? "Importing…" : "Import from Auction"}
            </BtnSecondary>
            <BtnPrimary disabled={!scoringActive} onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add Team
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
        {tournamentLoading || (scoringActive && isLoading) ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Shield}
            title="Scoring not Activated"
            desc="Contact BIDWAR for enabling sport scoring module."
          />
        ) : teams.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No teams yet"
            desc="Import franchises from Auction, or add a Sports team (name, short code, owner, color, logo)."
            action={{ label: "Add Team", onClick: openCreate }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <div
                key={team.id}
                role="button"
                tabIndex={0}
                className={cn(
                  hubCardClass,
                  "overflow-hidden text-left cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                )}
                onClick={() => openEdit(team)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEdit(team);
                  }
                }}
              >
                <div className="h-2" style={{ backgroundColor: team.color || "#444" }} />
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {team.logoUrl ? (
                        <img
                          src={team.logoUrl}
                          alt={team.name}
                          className="w-10 h-10 rounded-lg object-contain border border-border bg-muted/20 shrink-0"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-sm shrink-0"
                          style={{
                            backgroundColor: `${team.color || "#3B82F6"}22`,
                            color: team.color || "#fff",
                            border: `1px solid ${team.color || "#3B82F6"}44`,
                          }}
                        >
                          {team.shortCode}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-bold text-base leading-tight truncate">{team.name}</h3>
                        <p className="text-xs text-muted-foreground">{team.ownerName}</p>
                        {team.coachName ? (
                          <p className="text-xs text-muted-foreground">Coach: {team.coachName}{team.coachMobile ? ` · ${team.coachMobile}` : ""}</p>
                        ) : null}
                        {team.ownerMobile ? (
                          <p className="text-xs text-muted-foreground font-mono">{team.ownerMobile}</p>
                        ) : null}
                        {team.ownerEmail ? (
                          <p className="text-xs text-muted-foreground break-all">{team.ownerEmail}</p>
                        ) : null}
                      </div>
                    </div>
                    <BtnSecondary
                      className={cn(btnCompactClass, "h-8 min-h-8 shrink-0")}
                      onClick={() => openEdit(team)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </BtnSecondary>
                  </div>
                  <div className="flex items-center justify-end text-xs uppercase tracking-wider font-semibold text-foreground/80">
                    {team.shortCode}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {formOpen ? (
        <FormModal
          title={editing ? "Edit Team" : "Add Team"}
          subtitle="Sports scoring fields — no Auction purse"
          onClose={closeForm}
          size="lg"
        >
          <TeamForm
            key={editing?.id ?? "new"}
            tournamentId={tournamentId}
            team={editing ?? undefined}
            existingShortCodes={existingShortCodes}
            existingTeamColors={existingTeamColors}
            variant="sports"
            onClose={closeForm}
          />
        </FormModal>
      ) : null}
    </CricketOrganizerPageShell>
  );
}
