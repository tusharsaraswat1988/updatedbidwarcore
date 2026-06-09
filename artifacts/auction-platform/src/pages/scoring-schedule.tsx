import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  useListTeams,
  getGetTournamentQueryKey,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { ScorerShell } from "@/components/scoring/scorer-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  createVenue,
  generateDraw,
  listDraws,
  listFixtures,
  listVenues,
} from "@/lib/scoring-foundation-api";
import { scoringPath, cricketPublicPath } from "@/lib/tournament-navigation";
import { Calendar, ChevronRight, MapPin, Plus, Trophy } from "lucide-react";

export default function ScoringSchedulePage() {
  const [, params] = useRoute("/tournament/:id/score/schedule");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const scoringActive = tournament?.sport === "cricket" && tournament?.scoringEnabled === true;

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

  const { data: venues, refetch: refetchVenues } = useQuery({
    queryKey: ["scoring-venues", tournamentId],
    queryFn: () => listVenues(tournamentId),
    enabled: scoringActive,
  });

  const teamMap = useMemo(
    () => new Map((teams ?? []).map((t) => [t.id, t])),
    [teams],
  );

  const [showGenerate, setShowGenerate] = useState(false);
  const [drawName, setDrawName] = useState("");
  const [format, setFormat] = useState<"round_robin" | "knockout" | "league_knockout">("round_robin");
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [oversLimit, setOversLimit] = useState(20);
  const [venueId, setVenueId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueCity, setNewVenueCity] = useState("");

  const [groupA, setGroupA] = useState<number[]>([]);
  const [groupB, setGroupB] = useState<number[]>([]);

  function toggleTeam(id: number) {
    setSelectedTeams((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleAddVenue() {
    if (!newVenueName.trim()) return;
    try {
      await createVenue(tournamentId, { name: newVenueName.trim(), city: newVenueCity || null });
      setNewVenueName("");
      setNewVenueCity("");
      await refetchVenues();
      toast({ title: "Venue added" });
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }

  async function handleGenerate() {
    if (!drawName.trim() || selectedTeams.length < 2) {
      toast({ title: "Select at least 2 teams", variant: "destructive" });
      return;
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
      };
      if (format === "league_knockout") {
        if (groupA.length < 2 || groupB.length < 2) {
          toast({ title: "Each group needs 2+ teams", variant: "destructive" });
          return;
        }
        body.groups = [
          { name: "Group A", teamIds: groupA },
          { name: "Group B", teamIds: groupB },
        ];
      }
      const result = await generateDraw(tournamentId, body);
      toast({
        title: "Schedule generated",
        description: `${result.fixtureCount} fixtures created`,
      });
      setShowGenerate(false);
      await qc.invalidateQueries({ queryKey: ["scoring-draws", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-fixtures", tournamentId] });
      await qc.invalidateQueries({ queryKey: ["scoring-matches", tournamentId] });
    } catch (e) {
      toast({ title: "Generation failed", description: String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!scoringActive) {
    return (
      <ScorerShell tournamentId={tournamentId} title="Schedule" backHref={`/tournament/${tournamentId}`}>
        <p className="p-4 text-muted-foreground">Cricket scoring is not enabled.</p>
      </ScorerShell>
    );
  }

  return (
    <ScorerShell
      tournamentId={tournamentId}
      title="Tournament Schedule"
      backHref={scoringPath(tournamentId)}
    >
      <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowGenerate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Generate schedule
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={cricketPublicPath(tournamentId)}>Public page</Link>
          </Button>
        </div>

        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Venues
          </h2>
          <ul className="text-sm space-y-1">
            {(venues ?? []).map((v) => (
              <li key={v.id} className="text-muted-foreground">
                {v.name}
                {v.city ? ` · ${v.city}` : ""}
              </li>
            ))}
            {venues?.length === 0 ? (
              <li className="text-muted-foreground">No venues yet</li>
            ) : null}
          </ul>
          <div className="flex gap-2">
            <Input
              placeholder="Venue name"
              value={newVenueName}
              onChange={(e) => setNewVenueName(e.target.value)}
              className="h-9"
            />
            <Input
              placeholder="City"
              value={newVenueCity}
              onChange={(e) => setNewVenueCity(e.target.value)}
              className="h-9 w-28"
            />
            <Button size="sm" variant="secondary" onClick={handleAddVenue}>
              Add
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Draws
          </h2>
          {drawsLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <ul className="space-y-2">
              {(draws ?? []).map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-sm"
                >
                  <span>
                    {d.name}
                    <span className="text-muted-foreground ml-2 capitalize">{d.format.replace("_", " ")}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{d.status}</span>
                </li>
              ))}
              {draws?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No draws yet — generate a schedule.</p>
              ) : null}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Fixtures
          </h2>
          {fixturesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="space-y-2">
              {(fixtures ?? []).map((f) => {
                const home = teamMap.get(f.homeTeamId)?.name ?? `Team ${f.homeTeamId}`;
                const away = teamMap.get(f.awayTeamId)?.name ?? `Team ${f.awayTeamId}`;
                return (
                  <li
                    key={f.id}
                    className="rounded-lg border border-border/40 px-3 py-2.5 text-sm"
                  >
                    <div className="font-medium">
                      {home} vs {away}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {f.roundName ?? "Fixture"}
                      {f.scheduledAt
                        ? ` · ${new Date(f.scheduledAt).toLocaleDateString()}`
                        : ""}
                      {f.venue ? ` · ${f.venue}` : ""}
                    </div>
                  </li>
                );
              })}
              {fixtures?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fixtures scheduled.</p>
              ) : null}
            </ul>
          )}
        </section>

        {showGenerate ? (
          <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm overflow-y-auto">
            <div className="max-w-lg mx-auto p-4 space-y-4 pb-24">
              <h2 className="text-lg font-semibold">Generate schedule</h2>

              <div className="space-y-2">
                <Label>Draw name</Label>
                <Input value={drawName} onChange={(e) => setDrawName(e.target.value)} placeholder="League 2026" />
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as typeof format)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round Robin (League)</SelectItem>
                    <SelectItem value="knockout">Knockout</SelectItem>
                    <SelectItem value="league_knockout">Groups (League stage)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Teams ({selectedTeams.length} selected)</Label>
                <ul className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {(teams ?? []).map((t) => (
                    <li key={t.id}>
                      <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                        <Checkbox
                          checked={selectedTeams.includes(t.id)}
                          onCheckedChange={() => toggleTeam(t.id)}
                        />
                        <span className="text-sm">{t.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              {format === "league_knockout" ? (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <Label className="text-xs">Group A</Label>
                    <ul className="border rounded p-2 max-h-32 overflow-y-auto mt-1 space-y-1">
                      {selectedTeams.map((id) => {
                        const t = teamMap.get(id);
                        return (
                          <li key={id}>
                            <label className="flex gap-1 items-center cursor-pointer">
                              <Checkbox
                                checked={groupA.includes(id)}
                                onCheckedChange={() =>
                                  setGroupA((p) =>
                                    p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
                                  )
                                }
                              />
                              {t?.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <Label className="text-xs">Group B</Label>
                    <ul className="border rounded p-2 max-h-32 overflow-y-auto mt-1 space-y-1">
                      {selectedTeams.map((id) => {
                        const t = teamMap.get(id);
                        return (
                          <li key={id}>
                            <label className="flex gap-1 items-center cursor-pointer">
                              <Checkbox
                                checked={groupB.includes(id)}
                                onCheckedChange={() =>
                                  setGroupB((p) =>
                                    p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
                                  )
                                }
                              />
                              {t?.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Overs</Label>
                  <Input
                    type="number"
                    value={oversLimit}
                    onChange={(e) => setOversLimit(parseInt(e.target.value, 10) || 20)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>

              {venues && venues.length > 0 ? (
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((v) => (
                        <SelectItem key={v.id} value={String(v.id)}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="flex gap-2 pt-2">
                <Button className="flex-1 h-11" disabled={busy} onClick={handleGenerate}>
                  Generate
                </Button>
                <Button className="h-11" variant="outline" onClick={() => setShowGenerate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ScorerShell>
  );
}
