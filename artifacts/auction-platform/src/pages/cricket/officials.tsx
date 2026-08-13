/**
 * Cricket Officials roster — wires existing scoring officials CRUD.
 * Route: /tournament/:id/score/officials
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  hubCardClass,
} from "@/components/badminton/page-chrome";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  createOfficial,
  deleteOfficial,
  listOfficials,
} from "@/lib/scoring-foundation-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { Plus, Trash2, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "umpire", label: "Umpire" },
  { value: "scorer", label: "Scorer" },
  { value: "referee", label: "Referee" },
  { value: "match_referee", label: "Match referee" },
] as const;

export default function CricketOfficialsPage() {
  const [, params] = useRoute("/tournament/:id/score/officials");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("umpire");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: officials, isLoading } = useQuery({
    queryKey: ["scoring-officials", tournamentId],
    queryFn: () => listOfficials(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  async function handleAdd() {
    if (!name.trim()) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await createOfficial(tournamentId, {
        name: name.trim(),
        role,
        mobile: mobile.trim() || null,
      });
      setName("");
      setMobile("");
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({ title: "Official added" });
    } catch (e) {
      toast({
        title: "Could not add official",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteOfficial(tournamentId, id);
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({ title: "Removed" });
    } catch (e) {
      toast({
        title: "Could not remove",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Officials"
        subtitle="Roster of umpires, scorers, and referees. Scorer PIN login (like badminton) ships next."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to manage officials." />
        ) : (
          <>
            <section className={cn(hubCardClass, "p-4 sm:p-5 space-y-4")}>
              <HubSectionHeader title="Add official" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="off-name">Name</Label>
                  <Input
                    id="off-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="off-mobile">Mobile (optional)</Label>
                  <Input
                    id="off-mobile"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Contact number"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <BtnPrimary onClick={() => void handleAdd()} disabled={busy}>
                <Plus className="w-4 h-4" />
                Add official
              </BtnPrimary>
            </section>

            <section>
              <HubSectionHeader
                title="Roster"
                subtitle={`${officials?.length ?? 0} official${(officials?.length ?? 0) === 1 ? "" : "s"}`}
              />
              {isLoading ? (
                <Skeleton className="h-32 w-full rounded-xl mt-3" />
              ) : (officials?.length ?? 0) === 0 ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  No officials yet.
                </div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(officials ?? []).map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{o.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {o.role.replace(/_/g, " ")}
                          {o.mobile ? ` · ${o.mobile}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void handleDelete(o.id)}
                        aria-label={`Remove ${o.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
