import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  BtnPrimary,
  BtnSecondary,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
  HubKpiCard,
  HubSectionHeader,
  EmptyState,
  FormModal,
  FormField,
} from "@/components/scoring/cricket-page-chrome";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  createVenue,
  generateDraw,
  listDraws,
  listFixtures,
  listVenues,
} from "@/lib/scoring-foundation-api";
import {
  cricketBrandingQueryKey,
  getCricketBranding,
  getCricketMasterTeams,
  listCricketRulePresets,
  resolveCricketRulePresetSummary,
  formatCricketRulePresetLabel,
  type CricketRulePresetJson,
} from "@/lib/scoring-api";
import type { SportsBranding } from "@/lib/sports-branding-types";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { cricketScoreHubPath, cricketFixturesPath, cricketRulesPath, cricketSettingsPath } from "@/lib/cricket-routes";
import { useScoringMatches } from "@/hooks/use-scoring-match";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Layers,
  Loader2,
  MapPin,
  Plus,
  Radio,
  Repeat,
  RotateCcw,
  Settings,
  Shield,
  Shuffle,
  Sparkles,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";

type DrawFormat = "round_robin" | "knockout" | "league_knockout";

type GroupAllocation = {
  id: string;
  name: string;
  teamIds: number[];
};

function getDefaultGroupName(index: number) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < letters.length) {
    return `Group ${letters[index]}`;
  }
  return `Group ${index + 1}`;
}

const FORMAT_OPTIONS: {
  value: DrawFormat;
  title: string;
  badge: string;
  description: string;
  icon: typeof Repeat;
}[] = [
  {
    value: "round_robin",
    title: "Round Robin",
    badge: "League",
    description: "Every team plays against all other teams. Ranked by points and Net Run Rate.",
    icon: Repeat,
  },
  {
    value: "knockout",
    title: "Knockout",
    badge: "Sudden Death",
    description: "Single-elimination bracket. Losers are eliminated; winner advances each round.",
    icon: Trophy,
  },
  {
    value: "league_knockout",
    title: "Groups + Knockout",
    badge: "Pool Stage",
    description: "Teams play round-robin inside groups (Group A, B, C, D...), followed by playoff finals.",
    icon: Layers,
  },
];

export default function ScoringSchedulePage() {
  const [, params] = useRoute("/tournament/:id/score/schedule");
  const tournamentId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: !!tournamentId,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { data: draws, isLoading: drawsLoading } = useQuery({
    queryKey: ["scoring-draws", tournamentId],
    queryFn: () => listDraws(tournamentId),
    enabled: scoringActive,
  });

  const { data: fixtures, isLoading: fixturesLoading } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: scoringActive,
  });
  const { data: matches, isLoading: matchesLoading } = useScoringMatches(
    tournamentId,
    scoringActive,
  );

  // Fixture rows outlive deleted matches. Only show a card when Matches Hub
  // still has that match, and use the match status so a stale fixture badge
  // cannot keep saying LIVE after the match is gone.
  const matchStatusByFixtureId = useMemo(() => {
    const map = new Map<number, string>();
    for (const match of matches ?? []) {
      if (match.fixtureId != null) map.set(match.fixtureId, match.status);
    }
    return map;
  }, [matches]);
  const visibleFixtures = useMemo(() => {
    const rows = fixtures ?? [];
    if (!matches) return rows;
    return rows.filter((fixture) => matchStatusByFixtureId.has(fixture.id));
  }, [fixtures, matches, matchStatusByFixtureId]);
  const fixturesSummaryLoading = fixturesLoading || matchesLoading;

  const { data: presets } = useQuery({
    queryKey: ["cricket-rule-presets", tournamentId],
    queryFn: () => listCricketRulePresets(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const { data: venues, refetch: refetchVenues, isLoading: venuesLoading } = useQuery({
    queryKey: ["scoring-venues", tournamentId],
    queryFn: () => listVenues(tournamentId),
    enabled: scoringActive,
  });

  const { data: branding } = useQuery({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<SportsBranding>(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const settingsVenueName =
    branding?.venue?.trim() || tournament?.venue?.trim() || "";
  const settingsCity = tournament?.city?.trim() || "";

  const teamMap = useMemo(
    () => new Map(teams.map((t) => [t.id, t])),
    [teams],
  );

  // Modal & Form States
  const [showGenerate, setShowGenerate] = useState(false);
  const [drawName, setDrawName] = useState("");
  const [format, setFormat] = useState<DrawFormat>("round_robin");
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [rulePresetId, setRulePresetId] = useState<string>("");
  const [oversLimit, setOversLimit] = useState(20);
  const [venueId, setVenueId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);

  const [groups, setGroups] = useState<GroupAllocation[]>([
    { id: "g-0", name: "Group A", teamIds: [] },
    { id: "g-1", name: "Group B", teamIds: [] },
  ]);

  // Venue management modal state
  const [showAddVenue, setShowAddVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCity, setNewVenueCity] = useState("");
  const [venueBusy, setVenueBusy] = useState(false);
  const seededVenueRef = useRef(false);

  const defaultPreset = useMemo(
    () => (presets ?? []).find((p) => p.isDefault) || presets?.[0],
    [presets],
  );

  const activeSchedulePreset = useMemo(
    () => (presets ?? []).find((p) => String(p.id) === rulePresetId) || defaultPreset,
    [presets, rulePresetId, defaultPreset],
  );

  function handleSelectPreset(presetIdStr: string) {
    setRulePresetId(presetIdStr);
    const p = (presets ?? []).find((x) => String(x.id) === presetIdStr);
    if (p) {
      const details = resolveCricketRulePresetSummary(p);
      setOversLimit(details.overs);
    }
  }

  // Handle opening the generate dialog
  function openGenerateDialog() {
    void qc.invalidateQueries({ queryKey: ["cricket-rule-presets", tournamentId] });
    const allTeamIds = teams.map((t) => t.id);
    setSelectedTeams(allTeamIds);
    setDrawName(
      tournament?.name ? `${tournament.name} Stage 1` : "League Stage 2026",
    );
    if (defaultPreset) {
      setRulePresetId(String(defaultPreset.id));
      const details = resolveCricketRulePresetSummary(defaultPreset);
      setOversLimit(details.overs);
    } else {
      setRulePresetId("");
      setOversLimit(20);
    }
    // Determine appropriate initial group count based on team count (>=12 teams -> 4 groups, >=9 -> 3 groups, else 2)
    const initialGroupCount = allTeamIds.length >= 12 ? 4 : (allTeamIds.length >= 9 ? 3 : 2);
    const initialGroups: GroupAllocation[] = Array.from({ length: initialGroupCount }, (_, i) => ({
      id: `g-${i}`,
      name: getDefaultGroupName(i),
      teamIds: allTeamIds.filter((_, idx) => idx % initialGroupCount === i),
    }));
    setGroups(initialGroups);
    setShowGenerate(true);
  }

  // Auto-seed venue from settings when venue list is empty
  useEffect(() => {
    if (!scoringActive || venuesLoading || seededVenueRef.current) return;
    if (venues == null) return;
    if (venues.length > 0) {
      seededVenueRef.current = true;
      return;
    }
    if (!settingsVenueName) {
      seededVenueRef.current = true;
      return;
    }
    seededVenueRef.current = true;
    void (async () => {
      try {
        await createVenue(tournamentId, {
          name: settingsVenueName,
          city: settingsCity || null,
        });
        await refetchVenues();
        toast({
          title: "Venue ready",
          description: `Configured venue “${settingsVenueName}” from Tournament settings.`,
        });
      } catch {
        seededVenueRef.current = false;
      }
    })();
  }, [
    scoringActive,
    venuesLoading,
    venues,
    settingsVenueName,
    settingsCity,
    tournamentId,
    refetchVenues,
    toast,
  ]);

  useEffect(() => {
    if (!showAddVenue) return;
    if (!newVenueName && settingsVenueName) setNewVenueName(settingsVenueName);
    if (!newVenueCity && settingsCity) setNewVenueCity(settingsCity);
  }, [showAddVenue, settingsVenueName, settingsCity, newVenueName, newVenueCity]);

  function setTeamSelected(id: number, selected: boolean) {
    setSelectedTeams((prev) => {
      const next = selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id);
      // Synchronize groups
      if (!selected) {
        setGroups((gList) => gList.map((g) => ({ ...g, teamIds: g.teamIds.filter((x) => x !== id) })));
      } else {
        // Add to the group that currently has the fewest teams
        setGroups((gList) => {
          if (gList.length === 0) return gList;
          let minIdx = 0;
          for (let i = 1; i < gList.length; i++) {
            if (gList[i]!.teamIds.length < gList[minIdx]!.teamIds.length) {
              minIdx = i;
            }
          }
          return gList.map((g, idx) =>
            idx === minIdx ? { ...g, teamIds: g.teamIds.includes(id) ? g.teamIds : [...g.teamIds, id] } : g,
          );
        });
      }
      return next;
    });
  }

  function selectAllTeams() {
    const allIds = teams.map((t) => t.id);
    setSelectedTeams(allIds);
    setGroups((gList) => {
      const count = Math.max(2, gList.length);
      return gList.map((g, idx) => ({
        ...g,
        teamIds: allIds.filter((_, i) => i % count === idx),
      }));
    });
  }

  function clearAllTeams() {
    setSelectedTeams([]);
    setGroups((gList) => gList.map((g) => ({ ...g, teamIds: [] })));
  }

  function setGroupCount(count: number) {
    if (count < 2 || count > 8) return;
    setGroups((prev) => {
      const next: GroupAllocation[] = [];
      for (let i = 0; i < count; i++) {
        if (i < prev.length) {
          next.push({ ...prev[i]!, teamIds: [] });
        } else {
          next.push({
            id: `g-${Date.now()}-${i}`,
            name: getDefaultGroupName(i),
            teamIds: [],
          });
        }
      }
      const shuffled = [...selectedTeams];
      return next.map((g, idx) => ({
        ...g,
        teamIds: shuffled.filter((_, i) => i % count === idx),
      }));
    });
  }

  function autoBalanceGroups() {
    const shuffled = [...selectedTeams].sort(() => Math.random() - 0.5);
    const count = groups.length;
    if (count === 0) return;
    setGroups((prev) =>
      prev.map((g, idx) => ({
        ...g,
        teamIds: shuffled.filter((_, i) => i % count === idx),
      })),
    );
    toast({
      title: "Groups Balanced",
      description: `Distributed ${selectedTeams.length} teams evenly across ${count} groups.`,
    });
  }

  function toggleTeamInGroup(groupId: string, teamId: number) {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id === groupId) {
          const isPresent = g.teamIds.includes(teamId);
          return {
            ...g,
            teamIds: isPresent ? g.teamIds.filter((id) => id !== teamId) : [...g.teamIds, teamId],
          };
        }
        return {
          ...g,
          teamIds: g.teamIds.filter((id) => id !== teamId),
        };
      }),
    );
  }

  function addGroup() {
    if (groups.length >= 8) {
      toast({
        title: "Maximum Groups Reached",
        description: "You can create up to 8 groups.",
        variant: "destructive",
      });
      return;
    }
    const newIdx = groups.length;
    const newG: GroupAllocation = {
      id: `g-${Date.now()}-${newIdx}`,
      name: getDefaultGroupName(newIdx),
      teamIds: [],
    };
    setGroups((prev) => [...prev, newG]);
  }

  function removeGroup(groupId: string) {
    if (groups.length <= 2) {
      toast({
        title: "Minimum 2 Groups",
        description: "At least 2 groups are required for Groups format.",
        variant: "destructive",
      });
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
  }

  function updateGroupName(groupId: string, name: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name } : g)));
  }

  // Estimated fixtures count calculation
  const estimatedMatches = useMemo(() => {
    const n = selectedTeams.length;
    if (n < 2) return 0;
    if (format === "round_robin") {
      return (n * (n - 1)) / 2;
    }
    if (format === "knockout") {
      return n - 1;
    }
    if (format === "league_knockout") {
      const groupMatches = groups.reduce((acc, g) => {
        const len = g.teamIds.length;
        return acc + (len >= 2 ? (len * (len - 1)) / 2 : 0);
      }, 0);
      return groupMatches;
    }
    return 0;
  }, [selectedTeams.length, format, groups]);

  async function handleAddVenue() {
    if (!newVenueName.trim()) return;
    setVenueBusy(true);
    try {
      const added = await createVenue(tournamentId, {
        name: newVenueName.trim(),
        city: newVenueCity.trim() || null,
      });
      setNewVenueName("");
      setNewVenueCity("");
      await refetchVenues();
      if (added?.id) {
        setVenueId(String(added.id));
      }
      setShowAddVenue(false);
      toast({ title: "Venue Added", description: `Added “${newVenueName.trim()}”.` });
    } catch (e) {
      toast({ title: "Failed to Add Venue", description: String(e), variant: "destructive" });
    } finally {
      setVenueBusy(false);
    }
  }

  async function handleGenerate() {
    if (!drawName.trim()) {
      toast({ title: "Stage Name Required", description: "Please enter a draw / stage name.", variant: "destructive" });
      return;
    }
    if (selectedTeams.length < 2) {
      toast({ title: "Teams Required", description: "Please select at least 2 teams to generate fixtures.", variant: "destructive" });
      return;
    }
    if (format === "league_knockout") {
      const incomplete = groups.filter((g) => g.teamIds.length < 2);
      if (incomplete.length > 0) {
        const groupNames = incomplete.map((g) => g.name || "Group").join(", ");
        toast({
          title: "Incomplete Groups",
          description: `Each group must have at least 2 teams assigned (${groupNames} has fewer than 2).`,
          variant: "destructive",
        });
        return;
      }
    }
    setBusy(true);
    try {
      const body: Parameters<typeof generateDraw>[1] = {
        name: drawName.trim(),
        format,
        teamIds: selectedTeams,
        oversLimit,
        venueId: venueId ? parseInt(venueId, 10) : null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        matchesPerDay: 2,
        createMatches: true,
        rulePresetId: rulePresetId ? parseInt(rulePresetId, 10) : undefined,
      };
      if (format === "league_knockout") {
        body.groups = groups.map((g) => ({
          name: g.name.trim() || "Group",
          teamIds: g.teamIds,
        }));
      }
      const result = await generateDraw(tournamentId, body);
      toast({
        title: "Schedule Generated",
        description: `Successfully scheduled ${result.fixtureCount} matches across ${selectedTeams.length} teams.`,
      });
      setShowGenerate(false);
      await qc.invalidateQueries({ queryKey: ["scoring-draws", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
    } catch (e) {
      toast({ title: "Schedule Generation Failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (tournamentLoading) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <PageHeader tournamentId={tournamentId} eyebrow="Cricket Operations" title="Schedule & Generate" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (!scoringActive) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <PageHeader tournamentId={tournamentId} eyebrow="Cricket Operations" title="Schedule & Generate" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <EmptyState
            icon={Trophy}
            title="Cricket Scoring Not Activated"
            desc="Enable cricket scoring module in tournament settings to manage venues, draws, and fixture schedules."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Schedule & Draws"
        subtitle="Configure venues, draw stages, and batch-generate balanced match fixtures"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BtnSecondary href={cricketScoreHubPath(tournamentId)} className={btnCompactClass}>
              <Radio className="w-3.5 h-3.5 mr-1 text-primary" />
              Matches Hub
            </BtnSecondary>
            <BtnSecondary href={cricketPublicPath(tournamentId)} className={btnCompactClass} external>
              <ExternalLink className="w-3.5 h-3.5 mr-1" />
              Public Page
            </BtnSecondary>
            <BtnPrimary onClick={openGenerateDialog} className={btnCompactClass}>
              <Plus className="w-4 h-4 mr-1" />
              New Draw Schedule
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <HubKpiCard
            label="Tournament Draws"
            value={draws?.length ?? 0}
            icon={Trophy}
            tint="primary"
          />
          <HubKpiCard
            label="Scheduled Fixtures"
            value={fixturesSummaryLoading ? 0 : visibleFixtures.length}
            icon={Calendar}
            tint="green"
          />
          <HubKpiCard
            label="Venues Ready"
            value={venues?.length ?? 0}
            icon={MapPin}
            tint="muted"
          />
          <HubKpiCard
            label="Registered Teams"
            value={teams.length}
            icon={Shield}
            tint="primary"
          />
        </div>

        {/* Venues Section */}
        <section className={cn(hubCardClass, "p-4 sm:p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                Tournament Venues
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Venues and grounds assigned to scheduled match fixtures
              </p>
            </div>
            <BtnSecondary
              className={cn(btnCompactClass, "h-8 min-h-8 text-xs")}
              onClick={() => setShowAddVenue(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Venue
            </BtnSecondary>
          </div>

          {venuesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : (venues?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(venues ?? []).map((v) => {
                const fromSettings =
                  settingsVenueName &&
                  v.name.trim().toLowerCase() === settingsVenueName.toLowerCase();
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-3.5 rounded-lg bg-muted/20 border border-border/50 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-sm text-foreground truncate flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{v.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate pl-5">
                        {v.city ? v.city : "Ground venue"}
                      </div>
                    </div>
                    {fromSettings ? (
                      <Badge variant="outline" className="text-[10px] text-primary border-primary/30 shrink-0 font-medium">
                        Tournament Venue
                      </Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : settingsVenueName ? (
            <div className="rounded-lg border border-dashed border-border p-4 bg-muted/10 text-sm text-muted-foreground flex items-center justify-between gap-3">
              <div>
                Using <span className="text-foreground font-semibold">{settingsVenueName}</span>
                {settingsCity ? ` · ${settingsCity}` : ""} configured from{" "}
                <Link href={cricketSettingsPath(tournamentId)} className="text-primary underline hover:text-primary/80 font-medium">
                  Tournament settings
                </Link>
                .
              </div>
              <BtnSecondary className={btnCompactClass} onClick={() => setShowAddVenue(true)}>
                + Add Another
              </BtnSecondary>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 bg-muted/10 text-sm text-muted-foreground flex items-center justify-between gap-3">
              <span>No venues configured yet. Add your ground location for fixtures.</span>
              <BtnSecondary className={btnCompactClass} onClick={() => setShowAddVenue(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Venue
              </BtnSecondary>
            </div>
          )}
        </section>

        {/* Tournament Draws Section */}
        <section className={cn(hubCardClass, "p-4 sm:p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                Tournament Draws & Stages
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active scheduling draws generated for this tournament
              </p>
            </div>
            <BtnPrimary onClick={openGenerateDialog} className={cn(btnCompactClass, "h-8 min-h-8 text-xs")}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              New Draw Schedule
            </BtnPrimary>
          </div>

          {drawsLoading || fixturesSummaryLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : (draws?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(draws ?? []).map((d) => {
                const drawFixtures = visibleFixtures.filter((f) => f.drawId === d.id);
                return (
                  <div
                    key={d.id}
                    className="flex flex-col justify-between rounded-lg border border-border/60 bg-muted/10 p-4 transition-colors hover:border-primary/40 space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-sm text-foreground truncate">{d.name}</span>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold shrink-0 tracking-wider">
                          {d.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[11px] capitalize font-medium text-foreground/80">
                          {d.format.replace(/_/g, " ")}
                        </Badge>
                        <span>·</span>
                        <span>{drawFixtures.length} match{drawFixtures.length === 1 ? "" : "es"}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : "Active"}
                      </span>
                      <Link
                        href={cricketScoreHubPath(tournamentId)}
                        className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                      >
                        Manage in Matches Hub <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="No Draws Generated Yet"
              desc="Set up your first tournament stage (Round Robin, Knockout, or Groups) to automatically create paired fixtures."
              action={{
                label: "Generate First Schedule",
                onClick: openGenerateDialog,
              }}
            />
          )}
        </section>

        {/* Scheduled Fixtures Summary Section */}
        <section className={cn(hubCardClass, "p-4 sm:p-5 space-y-4")}>
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                <Calendar className="h-4 w-4 text-primary" />
                Generated Fixtures Summary
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {visibleFixtures.length} match fixture{visibleFixtures.length === 1 ? "" : "s"} scheduled across active draws
              </p>
            </div>
            {visibleFixtures.length > 0 ? (
              <BtnPrimary href={cricketScoreHubPath(tournamentId)} className={cn(btnCompactClass, "h-8 min-h-8 text-xs")}>
                <Radio className="w-3.5 h-3.5 mr-1" />
                Open Matches Hub
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </BtnPrimary>
            ) : null}
          </div>

          {fixturesSummaryLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : visibleFixtures.length > 0 ? (
            <div className="space-y-3">
              {/* Ready for Match Banner */}
              <div className="p-3.5 rounded-lg border border-primary/25 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-primary" />
                    Matches generated & ready for operations
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Toss execution, live scoring, and scorecard editing are managed in the Matches Hub.
                  </p>
                </div>
                <BtnPrimary href={cricketScoreHubPath(tournamentId)} className={cn(btnCompactClass, "shrink-0 text-xs")}>
                  Manage Matches Hub →
                </BtnPrimary>
              </div>

              {/* Compact Fixtures List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {visibleFixtures.slice(0, 6).map((f) => {
                  const home = teamMap.get(f.homeTeamId);
                  const away = teamMap.get(f.awayTeamId);
                  return (
                    <div
                      key={f.id}
                      className="rounded-lg border border-border/50 bg-muted/15 p-3 text-xs flex flex-col justify-between gap-2 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[11px] text-foreground/80 truncate">
                          {f.roundName ?? "Stage Match"}
                        </span>
                        <Badge variant="outline" className="text-[9px] uppercase font-bold shrink-0">
                          {matchStatusByFixtureId.get(f.id) ?? f.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs truncate">
                        <span className="truncate">{home?.name || `Team ${f.homeTeamId}`}</span>
                        <span className="text-muted-foreground font-bold text-[10px] uppercase shrink-0">vs</span>
                        <span className="truncate">{away?.name || `Team ${f.awayTeamId}`}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/30">
                        <span>
                          {f.scheduledAt
                            ? new Date(f.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric" })
                            : "Date TBD"}
                        </span>
                        {f.venue ? <span className="truncate max-w-[120px]">{f.venue}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {visibleFixtures.length > 6 ? (
                <div className="pt-2 text-center">
                  <BtnSecondary href={cricketScoreHubPath(tournamentId)} className={btnCompactClass}>
                    View All {visibleFixtures.length} Matches in Matches Hub
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </BtnSecondary>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="No Fixtures Scheduled Yet"
              desc="Click 'New Draw Schedule' to pair your tournament teams into fixtures automatically."
              action={{
                label: "Generate Schedule",
                onClick: openGenerateDialog,
              }}
            />
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* Generate Schedule FormModal                                               */}
      {/* ========================================================================= */}
      {showGenerate ? (
        <FormModal
          title="Generate Tournament Schedule"
          subtitle="Auto-pair teams into matches, balance draws, and configure playing rules"
          onClose={() => setShowGenerate(false)}
          size="xl"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>
                  {estimatedMatches > 0
                    ? `Estimated ${estimatedMatches} fixtures will be created`
                    : "Select at least 2 teams to schedule"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BtnSecondary onClick={() => setShowGenerate(false)} disabled={busy}>
                  Cancel
                </BtnSecondary>
                <BtnPrimary
                  onClick={handleGenerate}
                  disabled={busy || selectedTeams.length < 2 || !drawName.trim()}
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Generate Schedule ({estimatedMatches} Matches)
                    </>
                  )}
                </BtnPrimary>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Draw / Stage Name */}
            <FormField label="Draw / Stage Name" required htmlFor="draw-name-input">
              <Input
                id="draw-name-input"
                value={drawName}
                onChange={(e) => setDrawName(e.target.value)}
                placeholder="e.g. League Stage 2026, Premier Division"
                className="h-10 text-sm"
              />
            </FormField>

            {/* Tournament Format Cards */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tournament Format
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FORMAT_OPTIONS.map((opt) => {
                  const active = format === opt.value;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormat(opt.value)}
                      className={cn(
                        "relative flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                        active
                          ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-card/60 hover:border-primary/30 hover:bg-muted/30",
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center text-xs",
                              active ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground",
                            )}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <Badge
                            variant={active ? "default" : "outline"}
                            className="text-[10px] uppercase font-bold"
                          >
                            {opt.badge}
                          </Badge>
                        </div>
                        <div className="font-bold text-sm text-foreground">{opt.title}</div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {opt.description}
                        </p>
                      </div>

                      {active ? (
                        <div className="flex items-center gap-1 text-[11px] font-semibold text-primary mt-2">
                          <Check className="w-3.5 h-3.5" />
                          Selected
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Participating Teams Selection */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  Participating Teams ({selectedTeams.length} of {teams.length} Selected)
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllTeams}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-muted-foreground text-xs">·</span>
                  <button
                    type="button"
                    onClick={clearAllTeams}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {teams.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No teams registered in this tournament yet. Add teams in the Teams & Players section.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg border-border/70 bg-muted/10">
                  {teams.map((t) => {
                    const isChecked = selectedTeams.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setTeamSelected(t.id, !isChecked)}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors",
                          isChecked
                            ? "bg-primary/10 border-primary/40 text-foreground"
                            : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                        )}
                      >
                        <Checkbox
                          id={`team-select-${t.id}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => setTeamSelected(t.id, checked === true)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {t.logoUrl ? (
                          <img
                            src={t.logoUrl}
                            alt=""
                            className="w-5 h-5 rounded object-contain border border-border shrink-0"
                          />
                        ) : (
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] shrink-0"
                            style={{ backgroundColor: `${t.color || "#3B82F6"}22`, color: t.color || "#3B82F6" }}
                          >
                            {t.shortCode?.slice(0, 2) || "T"}
                          </div>
                        )}
                        <span className="font-semibold truncate flex-1">{t.name}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Group Distribution Panel (When Groups format is selected) */}
            {format === "league_knockout" ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-primary/20">
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      Group Stage Allocation ({groups.length} Groups)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Each group must have 2 or more teams assigned for round-robin matches
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Quick Group Presets */}
                    <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/70 text-xs">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground px-1.5">Groups:</span>
                      {[2, 3, 4, 6].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setGroupCount(cnt)}
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-semibold transition-all",
                            groups.length === cnt
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                          )}
                        >
                          {cnt}
                        </button>
                      ))}
                      {groups.length < 8 ? (
                        <button
                          type="button"
                          onClick={addGroup}
                          title="Add another group"
                          className="px-1.5 py-0.5 rounded text-xs font-semibold text-primary hover:bg-primary/10 transition-all flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      ) : null}
                    </div>

                    {/* Auto Balance Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={autoBalanceGroups}
                      className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                    >
                      <Shuffle className="w-3 h-3" />
                      Auto-Balance Teams
                    </Button>
                  </div>
                </div>

                {/* Dynamic Grid of Groups */}
                <div
                  className={cn(
                    "grid gap-3",
                    groups.length === 2
                      ? "grid-cols-1 sm:grid-cols-2"
                      : groups.length === 3
                        ? "grid-cols-1 sm:grid-cols-3"
                        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
                  )}
                >
                  {groups.map((group) => {
                    return (
                      <div key={group.id} className="rounded-lg border border-border bg-card p-3 space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-border/50 text-xs font-bold text-foreground">
                            <input
                              type="text"
                              value={group.name}
                              onChange={(e) => updateGroupName(group.id, e.target.value)}
                              className="bg-transparent font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5 w-24 truncate text-xs"
                              placeholder="Group Name"
                            />
                            <div className="flex items-center gap-1">
                              <Badge variant={group.teamIds.length >= 2 ? "secondary" : "outline"} className={cn("text-[10px]", group.teamIds.length < 2 && "border-amber-500/50 text-amber-600 dark:text-amber-400")}>
                                {group.teamIds.length} Teams
                              </Badge>
                              {groups.length > 2 ? (
                                <button
                                  type="button"
                                  onClick={() => removeGroup(group.id)}
                                  title="Remove group"
                                  className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              ) : null}
                            </div>
                          </div>

                          <ul className="space-y-1 max-h-36 overflow-y-auto mt-2 pr-1">
                            {selectedTeams.map((id) => {
                              const t = teamMap.get(id);
                              const isAssigned = group.teamIds.includes(id);
                              return (
                                <li
                                  key={id}
                                  onClick={() => toggleTeamInGroup(group.id, id)}
                                  className={cn(
                                    "flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer transition-colors",
                                    isAssigned
                                      ? "bg-primary/10 font-semibold text-foreground border border-primary/20"
                                      : "text-muted-foreground hover:bg-muted/50 border border-transparent",
                                  )}
                                >
                                  <Checkbox checked={isAssigned} />
                                  <span className="truncate flex-1">{t?.name || `Team ${id}`}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Match & Schedule Parameters */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Rules & Match Format
                  </Label>
                  <Link
                    href={cricketRulesPath(tournamentId)}
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Settings className="w-3 h-3" />
                    Manage Rules
                  </Link>
                </div>
                {presets && presets.length > 0 ? (
                  <Select
                    value={rulePresetId || (defaultPreset ? String(defaultPreset.id) : "")}
                    onValueChange={handleSelectPreset}
                  >
                    <SelectTrigger className="h-10 text-sm font-semibold">
                      <SelectValue placeholder="Select tournament rule preset" />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {formatCricketRulePresetLabel(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-2.5 rounded-lg border border-border bg-card/40 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Using tournament default rules</span>
                    <Link href={cricketRulesPath(tournamentId)} className="text-primary font-medium hover:underline">
                      Configure Rules
                    </Link>
                  </div>
                )}
                {activeSchedulePreset ? (
                  <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-foreground/80 flex flex-wrap gap-2 items-center">
                    <span className="font-bold text-amber-400">Rules applied:</span>
                    <span>{resolveCricketRulePresetSummary(activeSchedulePreset).overs} Overs</span>
                    <span>•</span>
                    <span>{resolveCricketRulePresetSummary(activeSchedulePreset).wickets} Wickets</span>
                    <span>•</span>
                    <span>{resolveCricketRulePresetSummary(activeSchedulePreset).squadSize} Players / Side</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Start Date
                  </Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Batched by 2 matches / day
                  </span>
                </div>

                {/* Venue */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Venue Ground
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowAddVenue(true)}
                      className="text-[10px] text-primary font-medium hover:underline"
                    >
                      + New
                    </button>
                  </div>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Select Venue (Optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {(venues ?? []).map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.name} {v.city ? `(${v.city})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[10px] text-muted-foreground">
                    Applied to generated fixtures
                  </span>
                </div>
              </div>
            </div>
          </div>
        </FormModal>
      ) : null}

      {/* ========================================================================= */}
      {/* Add Venue FormModal                                                       */}
      {/* ========================================================================= */}
      {showAddVenue ? (
        <FormModal
          title="Add Ground Venue"
          subtitle="Add a match ground or venue location for fixtures"
          onClose={() => setShowAddVenue(false)}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <BtnSecondary onClick={() => setShowAddVenue(false)} disabled={venueBusy}>
                Cancel
              </BtnSecondary>
              <BtnPrimary
                onClick={handleAddVenue}
                disabled={venueBusy || !newVenueName.trim()}
              >
                {venueBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Venue
                  </>
                )}
              </BtnPrimary>
            </div>
          }
        >
          <div className="space-y-4">
            <FormField label="Venue / Ground Name" required htmlFor="venue-name-input">
              <Input
                id="venue-name-input"
                placeholder="e.g. Eden Sports Arena, Stadium 1"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                className="h-10 text-sm"
              />
            </FormField>

            <FormField label="City / Location" htmlFor="venue-city-input">
              <CityAutocomplete
                value={newVenueCity}
                onChange={setNewVenueCity}
                placeholder="City"
                className="h-10"
                showHint={false}
              />
            </FormField>
          </div>
        </FormModal>
      ) : null}
    </CricketOrganizerPageShell>
  );
}
