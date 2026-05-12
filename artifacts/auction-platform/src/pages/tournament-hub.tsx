import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  useUpdateTournament,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { setOrganizerPassword } from "@/lib/auth";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  Gavel, Monitor, Trophy, ExternalLink, Pencil, Link2, Dices, KeyRound,
  Building2, Timer, PlusCircle, Trash2, ChevronDown, ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type SponsorLogo = { url: string; name: string };

function SponsorLogosEditor({
  logos,
  onChange,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
}) {
  return (
    <div className="space-y-2">
      {logos.map((logo, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            className="flex-1 h-8 text-sm"
            value={logo.url}
            onChange={e => {
              const next = [...logos];
              next[i] = { ...next[i], url: e.target.value };
              onChange(next);
            }}
            placeholder="Logo URL (https://...)"
          />
          <Input
            className="w-28 h-8 text-sm"
            value={logo.name}
            onChange={e => {
              const next = [...logos];
              next[i] = { ...next[i], name: e.target.value };
              onChange(next);
            }}
            placeholder="Sponsor name"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onChange(logos.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 h-8 text-xs"
        onClick={() => onChange([...logos, { url: "", name: "" }])}
      >
        <PlusCircle className="w-3.5 h-3.5" /> Add Sponsor Logo
      </Button>
    </div>
  );
}

export default function TournamentHub() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"identity" | "auction">("identity");
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [sponsorLogos, setSponsorLogos] = useState<SponsorLogo[]>([]);
  const [bidTiers, setBidTiers] = useState<Array<{ upTo?: number; increment: number }>>([
    { upTo: 100000, increment: 25000 },
    { upTo: 200000, increment: 50000 },
    { increment: 100000 },
  ]);
  const [orgPassword, setOrgPassword] = useState("");

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const updateTournament = useUpdateTournament();

  function openEdit() {
    if (!tournament) return;
    setEditForm({
      name: tournament.name,
      sport: tournament.sport,
      venue: tournament.venue || "",
      auctionDate: tournament.auctionDate || "",
      organizerName: tournament.organizerName || "",
      organizerMobile: tournament.organizerMobile || "",
      organizerEmail: (tournament as any).organizerEmail || "",
      logoUrl: tournament.logoUrl || "",
      basePurse: String(tournament.basePurse ?? ""),
      minBid: String(tournament.minBid ?? ""),
      timerSeconds: String(tournament.timerSeconds ?? "30"),
      bidTimerSeconds: String((tournament as any).bidTimerSeconds ?? "15"),
      playerSelectionMode: (tournament as any).playerSelectionMode || "sequential",
    });
    // Load bidTiers from JSON column, fall back to legacy 5-column values
    try {
      const rawTiers = (tournament as any).bidTiers;
      if (rawTiers) {
        const parsed = JSON.parse(rawTiers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBidTiers(parsed);
        } else { throw new Error("empty"); }
      } else {
        setBidTiers([
          { upTo: (tournament as any).bidTier1UpTo ?? 100000, increment: (tournament as any).bidTier1Increment ?? 25000 },
          { upTo: (tournament as any).bidTier2UpTo ?? 200000, increment: (tournament as any).bidTier2Increment ?? 50000 },
          { increment: (tournament as any).bidTier3Increment ?? 100000 },
        ]);
      }
    } catch {
      setBidTiers([{ upTo: 100000, increment: 25000 }, { upTo: 200000, increment: 50000 }, { increment: 100000 }]);
    }
    try {
      const parsed = tournament.sponsorLogos ? JSON.parse(tournament.sponsorLogos) : [];
      setSponsorLogos(Array.isArray(parsed) ? parsed : []);
    } catch { setSponsorLogos([]); }
    setOrgPassword("");
    setActiveSection("identity");
    setEditOpen(true);
  }

  async function handleSave() {
    const filteredLogos = sponsorLogos.filter(l => l.url.trim());
    await updateTournament.mutateAsync({
      tournamentId,
      data: {
        name: editForm.name as string,
        sport: editForm.sport as string,
        venue: editForm.venue as string || undefined,
        auctionDate: editForm.auctionDate as string || undefined,
        organizerName: editForm.organizerName as string || undefined,
        organizerMobile: editForm.organizerMobile as string || undefined,
        logoUrl: editForm.logoUrl as string || undefined,
        sponsorLogos: JSON.stringify(filteredLogos),
        basePurse: Number(editForm.basePurse) || undefined,
        minBid: Number(editForm.minBid) || undefined,
        bidTiers: JSON.stringify(bidTiers.filter(t => t.increment > 0)),
        timerSeconds: Number(editForm.timerSeconds) || undefined,
        bidTimerSeconds: Number(editForm.bidTimerSeconds) || undefined,
        playerSelectionMode: editForm.playerSelectionMode as string || undefined,
      } as any,
    });
    if (orgPassword.trim()) {
      await setOrganizerPassword(tournamentId, orgPassword.trim());
    }
    qc.invalidateQueries({ queryKey: getGetTournamentQueryKey(tournamentId) });
    setEditOpen(false);
  }

  if (loadingTournament) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        {/* Title + Quick Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              {tournament?.logoUrl && (
                <img src={tournament.logoUrl} alt={tournament.name} className="h-10 w-10 object-contain rounded" />
              )}
              <h1 className="text-4xl font-bold tracking-tight">{tournament?.name}</h1>
              <span className="px-3 py-1 bg-primary/20 text-primary border border-primary/30 rounded-full text-xs font-bold tracking-widest uppercase">
                {tournament?.status}
              </span>
              <button
                onClick={openEdit}
                className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                title="Edit tournament"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              {tournament?.sport?.toUpperCase()}
              {tournament?.organizerName && ` · ${tournament.organizerName}`}
              {tournament?.venue && ` · ${tournament.venue}`}
              {" · "} BASE PURSE: {formatIndianRupee(tournament?.basePurse)}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => navigate(`/tournament/${tournamentId}/auction`)}
            >
              <Gavel className="w-4 h-4" /> Operator Panel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
            >
              <Monitor className="w-4 h-4" /> LED Display <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-60" />
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/links`)}
            >
              <Link2 className="w-4 h-4" /> Links
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/fortune-wheel`)}
            >
              <Dices className="w-4 h-4" /> Fortune Wheel
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/tournament/${tournamentId}/reports`)}
            >
              <Trophy className="w-4 h-4" /> Reports
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Players</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold">{summary?.totalPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg"><Users className="w-5 h-5 text-blue-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Sold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-green-500">{summary?.soldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg"><UserCheck className="w-5 h-5 text-green-500" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Unsold</p>
                  {loadingSummary ? <Skeleton className="h-9 w-16" /> : <p className="text-3xl font-display font-bold text-destructive">{summary?.unsoldPlayers || 0}</p>}
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg"><UserMinus className="w-5 h-5 text-destructive" /></div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Spent</p>
                  {loadingSummary ? <Skeleton className="h-9 w-24" /> : <p className="text-3xl font-display font-bold text-primary">{formatShortIndianRupee(summary?.totalSpent)}</p>}
                </div>
                <div className="p-3 bg-primary/10 rounded-lg"><Wallet className="w-5 h-5 text-primary" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Purses */}
        <div>
          <h2 className="text-xl font-display font-bold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Team Purses
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingPurses ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)
            ) : teamPurses?.map(team => {
              const usedPercentage = (team.purseUsed / team.purse) * 100;
              return (
                <Card key={team.teamId} className="bg-card/50 border-border">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <img src={team.logoUrl} alt={team.teamName} className="w-10 h-10 object-contain rounded" />
                        ) : (
                          <div className="w-4 h-8 rounded-sm" style={{ backgroundColor: team.color || "#444" }} />
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-none">{team.teamName}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">{team.playersBought} Players</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs font-mono text-muted-foreground">{team.shortCode}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
                        <p className="font-mono font-bold text-primary">{formatShortIndianRupee(team.purseRemaining)}</p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatShortIndianRupee(team.purseUsed)} Used</span>
                        <span>{formatShortIndianRupee(team.purse)} Total</span>
                      </div>
                      <Progress value={usedPercentage} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Edit Tournament Dialog — Two Sections */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl dark max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" /> Edit Tournament
            </DialogTitle>
          </DialogHeader>

          {/* Section Tabs */}
          <div className="flex rounded-lg bg-muted/20 p-1 border border-border/50 gap-1">
            <button
              onClick={() => setActiveSection("identity")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${activeSection === "identity" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Building2 className="w-4 h-4" /> Tournament Identity
            </button>
            <button
              onClick={() => setActiveSection("auction")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md transition-all ${activeSection === "auction" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Gavel className="w-4 h-4" /> Auction Settings
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-1">
              {activeSection === "identity" ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tournament Name</Label>
                      <Input value={editForm.name as string || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Sport</Label>
                      <Select value={editForm.sport as string || "cricket"} onValueChange={v => setEditForm(f => ({ ...f, sport: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          {["cricket","football","kabaddi","badminton","volleyball","esports","other"].map(s => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Venue</Label>
                      <Input value={editForm.venue as string || ""} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))} placeholder="Stadium name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Auction Date</Label>
                      <Input value={editForm.auctionDate as string || ""} onChange={e => setEditForm(f => ({ ...f, auctionDate: e.target.value }))} placeholder="15 March 2025" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Organizer Name</Label>
                      <Input value={editForm.organizerName as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Organizer Mobile</Label>
                      <Input value={editForm.organizerMobile as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerMobile: e.target.value }))} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Organizer Email</Label>
                    <Input
                      type="email"
                      value={editForm.organizerEmail as string || ""}
                      onChange={e => setEditForm(f => ({ ...f, organizerEmail: e.target.value }))}
                      placeholder="name@example.com — links to organizer account"
                    />
                    <p className="text-xs text-muted-foreground">If this email matches an organizer account, they'll see this tournament in their portal.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Tournament Logo URL</Label>
                    <Input value={editForm.logoUrl as string || ""} onChange={e => setEditForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
                    {editForm.logoUrl && (
                      <img src={editForm.logoUrl as string} alt="Logo preview" className="h-10 w-10 object-contain rounded mt-1" onError={e => (e.currentTarget.style.display = "none")} />
                    )}
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-primary" /> Organizer Login Password
                    </Label>
                    <Input
                      type="password"
                      value={orgPassword}
                      onChange={e => setOrgPassword(e.target.value)}
                      placeholder="Leave blank to keep existing password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used by organizers to sign in at <code className="text-primary">/tournament/{tournamentId}/login</code>
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Sponsor Logos</Label>
                    <SponsorLogosEditor logos={sponsorLogos} onChange={setSponsorLogos} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                    <div className="space-y-2">
                      <Label>Base Purse (₹)</Label>
                      <Input type="number" value={editForm.basePurse as number || 0} onChange={e => setEditForm(f => ({ ...f, basePurse: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Min Bid (₹)</Label>
                      <Input type="number" value={editForm.minBid as number || 0} onChange={e => setEditForm(f => ({ ...f, minBid: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-semibold">Bid Increment Tiers</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">Increment rises as bids grow. Last tier has no upper limit.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setBidTiers(t => [...t.slice(0, -1), { upTo: 0, increment: 0 }, { increment: t[t.length - 1]?.increment ?? 100000 }])}
                      >
                        + Add Tier
                      </Button>
                    </div>
                    {bidTiers.map((tier, i) => {
                      const isLast = i === bidTiers.length - 1;
                      return (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">{isLast ? "Above all — Increment (₹)" : `Tier ${i + 1} — Up to (₹)`}</Label>
                            {isLast ? (
                              <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-muted/20 text-muted-foreground text-sm">No limit</div>
                            ) : (
                              <Input
                                type="number"
                                value={tier.upTo ?? ""}
                                onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, upTo: Number(e.target.value) || 0 } : x))}
                                placeholder="e.g. 100000"
                              />
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Increment (₹)</Label>
                            <Input
                              type="number"
                              value={tier.increment || ""}
                              onChange={e => setBidTiers(t => t.map((x, j) => j === i ? { ...x, increment: Number(e.target.value) || 0 } : x))}
                              placeholder="e.g. 25000"
                            />
                          </div>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            disabled={bidTiers.length <= 1}
                            onClick={() => setBidTiers(t => {
                              const next = t.filter((_, j) => j !== i);
                              if (next.length === 0) return t;
                              // Ensure last tier has no upTo
                              const last = { ...next[next.length - 1] };
                              delete last.upTo;
                              return [...next.slice(0, -1), last];
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-muted-foreground" /> First Bid Timer (seconds)
                      </Label>
                      <Input type="number" value={editForm.timerSeconds as number || 30} onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))} min={5} max={300} />
                      <p className="text-xs text-muted-foreground">Timer when a new player is presented (no bids yet)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Timer className="w-3.5 h-3.5 text-primary" /> Subsequent Bid Timer (seconds)
                      </Label>
                      <Input type="number" value={editForm.bidTimerSeconds as number || 15} onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))} min={5} max={300} />
                      <p className="text-xs text-muted-foreground">Auto-restarts after every bid — owner panel bidding locks when it expires</p>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-border pt-4">
                    <Label className="flex items-center gap-1.5">
                      <Dices className="w-3.5 h-3.5 text-muted-foreground" /> Player Selection Mode
                    </Label>
                    <Select
                      value={editForm.playerSelectionMode as string || "sequential"}
                      onValueChange={v => setEditForm(f => ({ ...f, playerSelectionMode: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="dark">
                        <SelectItem value="sequential">Sequential — players come in order (by ID)</SelectItem>
                        <SelectItem value="random">Random — randomized draw each time</SelectItem>
                        <SelectItem value="manual">Manual — operator picks player from the queue</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Controls what "Next Player" does in the operator panel. Manual hides the Next button — operator must select from the queue list.
                    </p>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button className="flex-1" onClick={handleSave} disabled={updateTournament.isPending}>
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
