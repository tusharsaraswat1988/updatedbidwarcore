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
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  FormModal,
  FormField,
  PageHeader,
  SearchInput,
  DarkSelect,
  CricketFilterPill,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/scoring/cricket-page-chrome";
import { TeamForm } from "@/components/team-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { handoffAuctionParticipantsToSports } from "@/lib/scoring-api";
import { Pencil, Plus, Shield, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketTeamsPage() {
  const [, params] = useRoute("/tournament/:id/score/teams");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [importBusy, setImportBusy] = useState(false);

  // Filters state
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name-asc" | "name-desc" | "code-asc" | "newest">("name-asc");

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

  // Both auction and scoring enabled check
  const isAuctionAndScoring = Boolean(
    tournament &&
      (tournament.productMode === "both" ||
        (isAuctionEnabled(tournament) && isScoringEnabled(tournament)))
  );

  // Extract detected categories from team names (e.g. Senior, Junior, etc.)
  const detectedCategories = useMemo(() => {
    const map = new Map<string, number>();
    teams.forEach((t) => {
      const match = t.name.match(/\(([^)]+)\)/);
      if (match && match[1]?.trim()) {
        const cat = match[1].trim();
        map.set(cat, (map.get(cat) || 0) + 1);
      }
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [teams]);

  // Stats
  const teamsWithCoachCount = useMemo(
    () => teams.filter((t) => Boolean(t.coachName?.trim())).length,
    [teams]
  );
  const teamsWithLogoCount = useMemo(
    () => teams.filter((t) => Boolean(t.logoUrl?.trim())).length,
    [teams]
  );

  // Filtered and sorted teams
  const filteredTeams = useMemo(() => {
    let list = [...teams];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const name = (t.name || "").toLowerCase();
        const code = (t.shortCode || "").toLowerCase();
        const owner = (t.ownerName || "").toLowerCase();
        const coach = (t.coachName || "").toLowerCase();
        const phone = (t.ownerMobile || t.coachMobile || "").toLowerCase();
        const email = (t.ownerEmail || "").toLowerCase();
        return (
          name.includes(q) ||
          code.includes(q) ||
          owner.includes(q) ||
          coach.includes(q) ||
          phone.includes(q) ||
          email.includes(q)
        );
      });
    }

    if (categoryFilter !== "all") {
      list = list.filter((t) => {
        const lowerName = t.name.toLowerCase();
        const lowerCat = categoryFilter.toLowerCase();
        return lowerName.includes(`(${lowerCat})`) || lowerName.includes(lowerCat);
      });
    }

    if (staffFilter === "with-coach") {
      list = list.filter((t) => Boolean(t.coachName?.trim()));
    } else if (staffFilter === "missing-coach") {
      list = list.filter((t) => !t.coachName?.trim());
    } else if (staffFilter === "with-logo") {
      list = list.filter((t) => Boolean(t.logoUrl?.trim()));
    } else if (staffFilter === "missing-logo") {
      list = list.filter((t) => !t.logoUrl?.trim());
    } else if (staffFilter === "with-contact") {
      list = list.filter((t) => Boolean(t.ownerMobile?.trim() || t.ownerEmail?.trim()));
    }

    if (sortBy === "name-asc") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "name-desc") {
      list.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === "code-asc") {
      list.sort((a, b) => (a.shortCode || "").localeCompare(b.shortCode || ""));
    } else if (sortBy === "newest") {
      list.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    }

    return list;
  }, [teams, search, categoryFilter, staffFilter, sortBy]);

  const filtersActive =
    search.trim().length > 0 ||
    categoryFilter !== "all" ||
    staffFilter !== "all" ||
    sortBy !== "name-asc";

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setStaffFilter("all");
    setSortBy("name-asc");
  }

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

  const staffOptions = [
    { value: "all", label: "All Teams" },
    { value: "with-coach", label: "With Coach" },
    { value: "missing-coach", label: "Missing Coach" },
    { value: "with-logo", label: "With Logo" },
    { value: "missing-logo", label: "Missing Logo" },
    { value: "with-contact", label: "With Owner Contact" },
  ];

  const sortOptions = [
    { value: "name-asc", label: "Name (A → Z)" },
    { value: "name-desc", label: "Name (Z → A)" },
    { value: "code-asc", label: "Short Code (A → Z)" },
    { value: "newest", label: "Recently Added" },
  ];

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Setup"
        title="Teams"
        badge={
          tournamentLoading || isLoading
            ? "Loading…"
            : `${teams.length} ${teams.length === 1 ? "Team" : "Teams"} Registered`
        }
        subtitle="Sports teams — name, short code, owner, color, logo. No Auction purse."
        actions={
          <div className="flex flex-wrap gap-2">
            {isAuctionAndScoring ? (
              <BtnSecondary disabled={!scoringActive || importBusy} onClick={() => void handleImport()}>
                <Upload className="w-4 h-4" />
                {importBusy ? "Importing…" : "Import from Auction"}
              </BtnSecondary>
            ) : null}
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
            desc={
              isAuctionAndScoring
                ? "Import franchises from Auction, or add a Sports team (name, short code, owner, color, logo)."
                : "Add a Sports team (name, short code, owner, color, logo)."
            }
            action={{ label: "Add Team", onClick: openCreate }}
          />
        ) : (
          <div className="space-y-5">
            {/* Top Stats Ribbon */}
            <div
              className={cn(
                hubPanelClass,
                "px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              )}
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Total Registered:</span>
                  <span className="font-bold text-foreground text-base tabular-nums">
                    {teams.length}
                  </span>
                </div>
                {teamsWithCoachCount > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">With Coach:</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {teamsWithCoachCount}
                    </span>
                  </div>
                ) : null}
                {teamsWithLogoCount > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">With Logo:</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {teamsWithLogoCount}
                    </span>
                  </div>
                ) : null}
                {filtersActive ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Showing:</span>
                    <span className="font-semibold text-primary tabular-nums">
                      {filteredTeams.length} of {teams.length}
                    </span>
                  </div>
                ) : null}
              </div>

              {filtersActive ? (
                <BtnSecondary
                  type="button"
                  onClick={clearFilters}
                  className={cn(btnCompactClass, "h-8 shrink-0 text-xs self-start sm:self-auto")}
                >
                  <X className="w-3.5 h-3.5" />
                  Clear filters
                </BtnSecondary>
              ) : null}
            </div>

            {/* Filter Controls Bar */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by team name, code, coach, owner, phone or email…"
                  className="flex-1 min-w-0"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {detectedCategories.length > 0 ? (
                  <FormField label="Category / Division">
                    <DarkSelect
                      value={categoryFilter}
                      onValueChange={setCategoryFilter}
                      options={[
                        { value: "all", label: `All Categories (${teams.length})` },
                        ...detectedCategories.map((c) => ({
                          value: c.name,
                          label: `${c.name} (${c.count})`,
                        })),
                      ]}
                    />
                  </FormField>
                ) : null}

                <FormField label="Staff / Profile">
                  <DarkSelect
                    value={staffFilter}
                    onValueChange={setStaffFilter}
                    options={staffOptions}
                  />
                </FormField>

                <FormField label="Sort By">
                  <DarkSelect
                    value={sortBy}
                    onValueChange={(v) => setSortBy(v as typeof sortBy)}
                    options={sortOptions}
                  />
                </FormField>
              </div>

              {/* Quick Category / Group Pills */}
              {detectedCategories.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs text-muted-foreground mr-1">Quick Filter:</span>
                  <CricketFilterPill
                    active={categoryFilter === "all"}
                    onClick={() => setCategoryFilter("all")}
                  >
                    All ({teams.length})
                  </CricketFilterPill>
                  {detectedCategories.map((c) => (
                    <CricketFilterPill
                      key={c.name}
                      active={categoryFilter === c.name}
                      onClick={() => setCategoryFilter(c.name)}
                    >
                      {c.name} ({c.count})
                    </CricketFilterPill>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Teams Grid / Filter Empty State */}
            {filteredTeams.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-card/40 space-y-3">
                <Shield className="w-10 h-10 mx-auto text-muted-foreground/60" />
                <h3 className="font-semibold text-base text-foreground">No matching teams</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No teams matched your search or filter criteria. Try adjusting your query or clear the filters.
                </p>
                <BtnSecondary onClick={clearFilters} className={cn(btnCompactClass, "mx-auto")}>
                  Clear Filters
                </BtnSecondary>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeams.map((team) => (
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
                              <p className="text-xs text-muted-foreground">
                                Coach: {team.coachName}
                                {team.coachMobile ? ` · ${team.coachMobile}` : ""}
                              </p>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(team);
                          }}
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
