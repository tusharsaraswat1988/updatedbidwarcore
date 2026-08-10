/**
 * Cricket Sports Players — scoring-relevant fields only (not Auction purse/bid data).
 * Editable roster with search + filters; team names highlighted by team color.
 * Route: /tournament/:id/score/players
 */
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetTournamentQueryKey,
  getListPlayersQueryKey,
  getListTeamsQueryKey,
  useCreatePlayer,
  useGetTournament,
  useListPlayers,
  useListTeams,
  useUpdatePlayer,
  type Player,
  type Team,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  DarkSelect,
  EmptyState,
  FormActions,
  FormError,
  FormField,
  FormModal,
  PageHeader,
  SearchInput,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
  inputClass,
} from "@/components/badminton/page-chrome";
import { PlayerGenderSelect, formatPlayerGender } from "@/components/player-gender-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { handoffAuctionParticipantsToSports } from "@/lib/scoring-api";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { Pencil, Plus, Upload, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FALLBACK_ROLES = [
  "Batsman",
  "Bowler",
  "All Rounder",
  "Wicket Keeper",
] as const;

const BATTING_STYLES = ["Right-hand bat", "Left-hand bat"] as const;
const BOWLING_STYLES = [
  "Right-arm fast",
  "Right-arm medium",
  "Right-arm spin",
  "Left-arm fast",
  "Left-arm medium",
  "Left-arm spin",
] as const;

const UNASSIGNED_KEY = "unassigned";

type SportsPlayerForm = {
  name: string;
  mobile: string;
  role: string;
  teamId: string;
  jerseyNumber: string;
  city: string;
  gender: string;
  battingStyle: string;
  bowlingStyle: string;
};

const EMPTY_FORM: SportsPlayerForm = {
  name: "",
  mobile: "",
  role: FALLBACK_ROLES[0],
  teamId: "",
  jerseyNumber: "",
  city: "",
  gender: "",
  battingStyle: "",
  bowlingStyle: "",
};

function formFromPlayer(player: Player): SportsPlayerForm {
  return {
    name: player.name || "",
    mobile: player.mobileNumber ? sanitizeMobileInput(player.mobileNumber) : "",
    role: player.role || FALLBACK_ROLES[0],
    teamId: player.teamId != null ? String(player.teamId) : "",
    jerseyNumber: player.jerseyNumber || "",
    city: player.city || "",
    gender: player.gender || "",
    battingStyle: player.battingStyle || "",
    bowlingStyle: player.bowlingStyle || "",
  };
}

function normalizeTeamColor(color?: string | null): string {
  const raw = color?.trim();
  if (!raw) return "#64748b";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function teamChipStyle(color?: string | null): CSSProperties {
  const c = normalizeTeamColor(color);
  return {
    color: c,
    backgroundColor: `${c}1F`,
    borderColor: `${c}66`,
  };
}

function playerSearchHaystack(player: Player, team: Team | undefined): string {
  return [
    player.name,
    player.mobileNumber,
    player.role,
    player.jerseyNumber,
    player.city,
    player.gender,
    player.battingStyle,
    player.bowlingStyle,
    team?.name,
    team?.shortCode,
    team?.ownerName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(player: Player, team: Team | undefined, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  if (/^\d+$/.test(query)) {
    if (player.jerseyNumber && String(player.jerseyNumber) === query) return true;
    if (query.length >= 4 && (player.mobileNumber || "").includes(query)) return true;
    if (player.jerseyNumber?.includes(query)) return true;
    return false;
  }

  return playerSearchHaystack(player, team).includes(query);
}

export default function CricketPlayersPage() {
  const [, params] = useRoute("/tournament/:id/score/players");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [form, setForm] = useState<SportsPlayerForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [sportRoles, setSportRoles] = useState<string[]>([...FALLBACK_ROLES]);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [teamFilter, setTeamFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [battingFilter, setBattingFilter] = useState("all");
  const [bowlingFilter, setBowlingFilter] = useState("all");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const enabled = scoringActive && !!tournamentId;

  const { data: players = [], isLoading: playersLoading } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled },
  });
  const { data: teams = [] } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sports/by-slug/cricket/roles", { credentials: "include" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const roles = Array.isArray(data)
          ? data
              .map((item) =>
                item && typeof item === "object" && typeof (item as { roleName?: unknown }).roleName === "string"
                  ? (item as { roleName: string }).roleName
                  : null,
              )
              .filter((r): r is string => !!r)
          : [];
        if (!cancelled && roles.length > 0) setSportRoles(roles);
      } catch {
        /* keep fallback roles */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamById = useMemo(() => {
    const map = new Map<number, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>([...sportRoles, ...FALLBACK_ROLES]);
    for (const p of players) {
      if (p.role?.trim()) set.add(p.role.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [players, sportRoles]);

  const battingOptions = useMemo(() => {
    const set = new Set<string>([...BATTING_STYLES]);
    for (const p of players) {
      if (p.battingStyle?.trim()) set.add(p.battingStyle.trim());
    }
    return [...set];
  }, [players]);

  const bowlingOptions = useMemo(() => {
    const set = new Set<string>([...BOWLING_STYLES]);
    for (const p of players) {
      if (p.bowlingStyle?.trim()) set.add(p.bowlingStyle.trim());
    }
    return [...set];
  }, [players]);

  const filtersActive =
    deferredSearch.trim().length > 0 ||
    teamFilter !== "all" ||
    roleFilter !== "all" ||
    genderFilter !== "all" ||
    battingFilter !== "all" ||
    bowlingFilter !== "all";

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const team = p.teamId != null ? teamById.get(p.teamId) : undefined;

      if (!matchesSearch(p, team, deferredSearch)) return false;

      if (teamFilter === UNASSIGNED_KEY) {
        if (p.teamId != null) return false;
      } else if (teamFilter !== "all" && String(p.teamId) !== teamFilter) {
        return false;
      }

      if (roleFilter === "unset") {
        if (p.role?.trim()) return false;
      } else if (roleFilter !== "all" && (p.role || "") !== roleFilter) {
        return false;
      }

      if (genderFilter === "unspecified") {
        if (p.gender) return false;
      } else if (genderFilter !== "all" && p.gender !== genderFilter) {
        return false;
      }

      if (battingFilter === "unset") {
        if (p.battingStyle?.trim()) return false;
      } else if (battingFilter !== "all" && (p.battingStyle || "") !== battingFilter) {
        return false;
      }

      if (bowlingFilter === "unset") {
        if (p.bowlingStyle?.trim()) return false;
      } else if (bowlingFilter !== "all" && (p.bowlingStyle || "") !== bowlingFilter) {
        return false;
      }

      return true;
    });
  }, [
    players,
    teamById,
    deferredSearch,
    teamFilter,
    roleFilter,
    genderFilter,
    battingFilter,
    bowlingFilter,
  ]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, Player[]>();
    for (const p of filtered) {
      const key = p.teamId != null ? String(p.teamId) : UNASSIGNED_KEY;
      const list = buckets.get(key) ?? [];
      list.push(p);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (a === UNASSIGNED_KEY) return 1;
      if (b === UNASSIGNED_KEY) return -1;
      const an = teamById.get(Number(a))?.name ?? a;
      const bn = teamById.get(Number(b))?.name ?? b;
      return an.localeCompare(bn);
    });
  }, [filtered, teamById]);

  const playersWithoutTeam = players.filter((p) => p.teamId == null).length;
  const searchStale = search !== deferredSearch;

  function clearFilters() {
    setSearch("");
    setTeamFilter("all");
    setRoleFilter("all");
    setGenderFilter("all");
    setBattingFilter("all");
    setBowlingFilter("all");
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role: sportRoles[0] || FALLBACK_ROLES[0] });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(player: Player) {
    setEditing(player);
    setForm(formFromPlayer(player));
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  }

  async function handleImport() {
    setImportBusy(true);
    try {
      const result = await handoffAuctionParticipantsToSports(tournamentId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) }),
        qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) }),
      ]);
      toast({
        title: "Imported from Auction",
        description: result.message || `${result.playersReady} players ready for Sports.`,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not import players",
        variant: "destructive",
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function handleSave() {
    setFormError("");
    const parsedMobile = parseIndianMobile(form.mobile);
    if (!form.name.trim()) {
      setFormError("Player name is required");
      return;
    }
    if (!parsedMobile.ok) {
      setFormError(parsedMobile.error);
      return;
    }

    const assignedTeamId = form.teamId ? Number(form.teamId) : null;
    const sportsPayload = {
      name: form.name.trim(),
      mobileNumber: parsedMobile.normalized,
      role: form.role || undefined,
      jerseyNumber: form.jerseyNumber.trim() || undefined,
      city: form.city.trim() || undefined,
      gender: (form.gender || undefined) as "M" | "F" | undefined,
      battingStyle: form.battingStyle || undefined,
      bowlingStyle: form.bowlingStyle && form.bowlingStyle !== "None" ? form.bowlingStyle : undefined,
      teamId: assignedTeamId,
      ...(assignedTeamId
        ? { status: "sold" as const }
        : { status: "available" as const }),
    };

    try {
      if (editing) {
        await updatePlayer.mutateAsync({
          tournamentId,
          playerId: editing.id,
          data: sportsPayload,
        });
        toast({ title: "Player updated" });
      } else {
        await createPlayer.mutateAsync({
          tournamentId,
          data: sportsPayload,
        });
        toast({ title: "Player added" });
      }
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save player");
    }
  }

  const saving = createPlayer.isPending || updatePlayer.isPending;

  if (tournament?.sport && tournament.sport !== "cricket") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Setup"
        title="Players"
        subtitle="Sports roster — search, filter, and edit scoring fields"
        actions={
          <div className="flex flex-wrap gap-2">
            <BtnSecondary disabled={!scoringActive || importBusy} onClick={() => void handleImport()}>
              <Upload className="w-4 h-4" />
              {importBusy ? "Importing…" : "Import from Auction"}
            </BtnSecondary>
            <BtnPrimary disabled={!scoringActive} onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add Player
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-5">
        {tournamentLoading || (scoringActive && playersLoading) ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !scoringActive ? (
          <EmptyState
            icon={UserRound}
            title="Scoring not Activated"
            desc="Contact BIDWAR for enabling sport scoring module."
          />
        ) : players.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No players yet"
            desc="Import from Auction, or add scoring players manually (name, role, team, jersey)."
            action={{ label: "Add Player", onClick: openCreate }}
          />
        ) : (
          <>
            <div className={cn(hubPanelClass, "px-4 py-3")}>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Total</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{players.length}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">In teams</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {players.length - playersWithoutTeam}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Without team</span>{" "}
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      playersWithoutTeam > 0 ? "text-amber-300" : "text-foreground",
                    )}
                  >
                    {playersWithoutTeam}
                  </span>
                </p>
                {filtersActive ? (
                  <p>
                    <span className="text-muted-foreground">Showing</span>{" "}
                    <span
                      className={cn(
                        "font-semibold tabular-nums text-foreground",
                        searchStale && "opacity-70",
                      )}
                    >
                      {filtered.length}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search name, team, role, jersey, city, mobile…"
                  className="flex-1 min-w-0"
                />
                {filtersActive ? (
                  <BtnSecondary type="button" onClick={clearFilters} className="shrink-0">
                    <X className="w-4 h-4" />
                    Clear filters
                  </BtnSecondary>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <FormField label="Team">
                  <DarkSelect
                    value={teamFilter}
                    onValueChange={setTeamFilter}
                    options={[
                      { value: "all", label: "All teams" },
                      { value: UNASSIGNED_KEY, label: "No team assigned" },
                      ...teams
                        .toSorted((a, b) => a.name.localeCompare(b.name))
                        .map((t) => ({ value: String(t.id), label: `${t.name} (${t.shortCode})` })),
                    ]}
                  />
                </FormField>
                <FormField label="Role">
                  <DarkSelect
                    value={roleFilter}
                    onValueChange={setRoleFilter}
                    options={[
                      { value: "all", label: "All roles" },
                      { value: "unset", label: "No role set" },
                      ...roleOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
                <FormField label="Gender">
                  <DarkSelect
                    value={genderFilter}
                    onValueChange={setGenderFilter}
                    options={[
                      { value: "all", label: "All genders" },
                      { value: "M", label: "Male" },
                      { value: "F", label: "Female" },
                      { value: "unspecified", label: "Not specified" },
                    ]}
                  />
                </FormField>
                <FormField label="Batting">
                  <DarkSelect
                    value={battingFilter}
                    onValueChange={setBattingFilter}
                    options={[
                      { value: "all", label: "All batting" },
                      { value: "unset", label: "Not set" },
                      ...battingOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
                <FormField label="Bowling">
                  <DarkSelect
                    value={bowlingFilter}
                    onValueChange={setBowlingFilter}
                    options={[
                      { value: "all", label: "All bowling" },
                      { value: "unset", label: "Not set" },
                      ...bowlingOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title="No players match"
                desc="Try clearing search or changing team / role / gender filters."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            ) : (
              <div className={cn("space-y-7", searchStale && "opacity-80 transition-opacity")}>
                {grouped.map(([key, list]) => {
                  const isUnassigned = key === UNASSIGNED_KEY;
                  const team = !isUnassigned ? teamById.get(Number(key)) : undefined;
                  const teamColor = normalizeTeamColor(team?.color);
                  const heading = isUnassigned
                    ? "Players without team"
                    : team?.name ?? `Team #${key}`;

                  return (
                    <section key={key} className="space-y-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-8 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: isUnassigned ? "#64748b" : teamColor }}
                          aria-hidden
                        />
                        {!isUnassigned && team ? (
                          <span
                            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase shrink-0"
                            style={teamChipStyle(team.color)}
                          >
                            {team.shortCode}
                          </span>
                        ) : null}
                        <h2
                          className="text-base font-semibold tracking-tight truncate"
                          style={isUnassigned ? undefined : { color: teamColor }}
                        >
                          {heading}
                        </h2>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {list.length} {list.length === 1 ? "player" : "players"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {list.map((p) => {
                          const cardTeam = p.teamId != null ? teamById.get(p.teamId) : undefined;
                          const accent = normalizeTeamColor(cardTeam?.color);
                          const meta = [
                            p.role,
                            p.jerseyNumber ? `#${p.jerseyNumber}` : null,
                            p.gender ? formatPlayerGender(p.gender) : null,
                          ].filter(Boolean);

                          return (
                            <div
                              key={p.id}
                              role="button"
                              tabIndex={0}
                              className={cn(
                                hubCardClass,
                                "relative overflow-hidden p-3 pl-3.5 space-y-1.5 text-left cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                              )}
                              onClick={() => openEdit(p)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openEdit(p);
                                }
                              }}
                            >
                              <span
                                className="absolute inset-y-0 left-0 w-1"
                                style={{ backgroundColor: cardTeam ? accent : "transparent" }}
                                aria-hidden
                              />
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 space-y-1">
                                  <p className="font-medium text-foreground truncate">{p.name}</p>
                                  {cardTeam ? (
                                    <span
                                      className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold truncate"
                                      style={teamChipStyle(cardTeam.color)}
                                      title={cardTeam.name}
                                    >
                                      <span
                                        className="h-1.5 w-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: accent }}
                                      />
                                      <span className="truncate">{cardTeam.name}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                      No team
                                    </span>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    {meta.length > 0 ? meta.join(" · ") : "No role set"}
                                  </p>
                                  {p.mobileNumber ? (
                                    <p className="text-xs text-muted-foreground font-mono">{p.mobileNumber}</p>
                                  ) : null}
                                  {p.battingStyle || p.bowlingStyle ? (
                                    <p className="text-[11px] text-muted-foreground/80 truncate">
                                      {[p.battingStyle, p.bowlingStyle].filter(Boolean).join(" · ")}
                                    </p>
                                  ) : null}
                                </div>
                                <BtnSecondary
                                  className={cn(btnCompactClass, "h-8 min-h-8 shrink-0")}
                                  onClick={() => openEdit(p)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </BtnSecondary>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {formOpen ? (
        <FormModal
          title={editing ? "Edit Player" : "Add Player"}
          subtitle="Sports scoring fields only"
          onClose={closeForm}
          size="lg"
        >
          <div className="space-y-3">
            <FormField label="Name" required>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Player name"
              />
            </FormField>
            <FormField label="Mobile" required>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: sanitizeMobileInput(e.target.value) }))}
                placeholder="10-digit mobile"
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Role">
                <DarkSelect
                  value={form.role || sportRoles[0] || FALLBACK_ROLES[0]}
                  onValueChange={(role) => setForm((f) => ({ ...f, role }))}
                  options={sportRoles.map((r) => ({ value: r, label: r }))}
                />
              </FormField>
              <FormField label="Team">
                <DarkSelect
                  value={form.teamId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, teamId: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Unassigned" },
                    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
                  ]}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Jersey number">
                <input
                  className={inputClass}
                  value={form.jerseyNumber}
                  onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                  placeholder="e.g. 18"
                />
              </FormField>
              <FormField label="City">
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </FormField>
            </div>
            <PlayerGenderSelect
              value={form.gender}
              onChange={(gender) => setForm((f) => ({ ...f, gender }))}
              triggerClassName={inputClass}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Batting">
                <DarkSelect
                  value={form.battingStyle || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, battingStyle: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Not set" },
                    ...BATTING_STYLES.map((r) => ({ value: r, label: r })),
                  ]}
                />
              </FormField>
              <FormField label="Bowling">
                <DarkSelect
                  value={form.bowlingStyle || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, bowlingStyle: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Not set" },
                    ...BOWLING_STYLES.map((r) => ({ value: r, label: r })),
                    { value: "None", label: "None" },
                  ]}
                />
              </FormField>
            </div>
            {formError ? <FormError message={formError} /> : null}
            <FormActions
              onCancel={closeForm}
              onSubmit={() => void handleSave()}
              submitLabel={saving ? "Saving…" : editing ? "Update player" : "Save player"}
              saving={saving}
              disabled={saving}
            />
          </div>
        </FormModal>
      ) : null}
    </CricketOrganizerPageShell>
  );
}
