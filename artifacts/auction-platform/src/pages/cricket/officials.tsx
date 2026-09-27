/**
 * Cricket Officials & Scorers Roster
 * Route: /tournament/:id/score/officials
 *
 * Manages Umpires, Scorers, Referees, and Match Referees.
 * Scorers are provisioned with Mobile + 4-digit PIN for Scorer Login.
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
} from "@/components/scoring/cricket-page-chrome";
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
  resetOfficialLockout,
  unlockOfficialScorer,
  updateOfficial,
  type ScoringOfficial,
} from "@/lib/scoring-foundation-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  LockOpen,
  Plus,
  ShieldAlert,
  Smartphone,
  Trash2,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeMobileInput } from "@workspace/api-base/mobile";

const ROLES = [
  { value: "umpire", label: "Umpire" },
  { value: "scorer", label: "Scorer (Mobile + PIN)" },
  { value: "referee", label: "Referee" },
  { value: "match_referee", label: "Match Referee" },
] as const;

export default function CricketOfficialsPage() {
  const [, params] = useRoute("/tournament/:id/score/officials");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState<string>("scorer");
  const [mobile, setMobile] = useState("");
  const [pin, setPin] = useState("");
  const [showAddPin, setShowAddPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showPinMap, setShowPinMap] = useState<Record<number, boolean>>({});
  const [editingOfficial, setEditingOfficial] = useState<ScoringOfficial | null>(null);
  const [editName, setEditName] = useState("");
  const [editPin, setEditPin] = useState("");
  const [showEditPin, setShowEditPin] = useState(false);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: officials, isLoading } = useQuery({
    queryKey: ["scoring-officials", tournamentId],
    queryFn: () => listOfficials(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const scorerLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/scoring-app/cricket/scorer?tid=${tournamentId}`
      : `/scoring-app/cricket/scorer?tid=${tournamentId}`;

  async function handleAdd() {
    if (!name.trim()) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    if (role === "scorer") {
      if (!mobile.trim() || mobile.replace(/\D/g, "").length < 10) {
        toast({ title: "Valid 10-digit mobile number is required for scorer", variant: "destructive" });
        return;
      }
      if (!pin.trim() || pin.trim().length < 4) {
        toast({ title: "Enter a 4-digit PIN for scorer login", variant: "destructive" });
        return;
      }
    }

    setBusy(true);
    try {
      await createOfficial(tournamentId, {
        name: name.trim(),
        role,
        mobile: mobile.trim() || null,
        pin: pin.trim() || null,
      });
      setName("");
      setMobile("");
      setPin("");
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({
        title: "Official added",
        description: role === "scorer" ? "Scorer credentials created. You can now copy and share the link." : undefined,
      });
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

  async function handleSaveEdit() {
    if (!editingOfficial) return;
    if (!editName.trim()) {
      toast({ title: "Name cannot be empty", variant: "destructive" });
      return;
    }
    if (editPin.trim().length > 0 && editPin.trim().length < 4) {
      toast({ title: "New PIN must be at least 4 digits", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      await updateOfficial(tournamentId, editingOfficial.id, {
        name: editName.trim(),
        pin: editPin.trim() || undefined,
      });
      setEditingOfficial(null);
      setEditName("");
      setEditPin("");
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({ title: "Official updated" });
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(official: ScoringOfficial) {
    try {
      await updateOfficial(tournamentId, official.id, {
        isActive: official.isActive === false ? true : false,
      });
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({
        title: official.isActive === false ? "Scorer activated" : "Scorer set to view-only",
      });
    } catch (e) {
      toast({
        title: "Could not update status",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  async function handleClearLockout(official: ScoringOfficial) {
    try {
      await resetOfficialLockout(tournamentId, official.id);
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({ title: "Login lockout cleared" });
    } catch (e) {
      toast({
        title: "Failed to clear lockout",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  }

  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  async function handleUnlockScorer(official: ScoringOfficial) {
    setUnlockingId(official.id);
    try {
      const res = await unlockOfficialScorer(tournamentId, official.id);
      await qc.invalidateQueries({ queryKey: ["scoring-officials", tournamentId] });
      toast({
        title: "Scorer Unlocked",
        description: res.message || "Match locks cleared and tournament access verified.",
      });
    } catch (e) {
      toast({
        title: "Failed to unlock scorer",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setUnlockingId(null);
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

  function handleCopyScorerAccess(official: ScoringOfficial) {
    const tournamentName = tournament?.name || `Tournament #${tournamentId}`;
    const text = [
      `🏏 BidWar Cricket Scorer Access`,
      `Tournament: ${tournamentName}`,
      `Scorer: ${official.name}`,
      `Mobile: ${official.mobile || "Registered Mobile"}`,
      `PIN: ${official.pin || "(Use the 4-digit PIN set during registration)"}`,
      `Scorer Portal Link: ${scorerLink}`,
      ``,
      `Instructions: Open the link on your mobile, enter your mobile number and 4-digit PIN to select the match and start scoring.`,
    ].join("\n");

    void navigator.clipboard.writeText(text);
    setCopiedId(official.id);
    setTimeout(() => setCopiedId(null), 3000);
    toast({
      title: "Scorer access & link copied!",
      description: "You can now paste and send this message via WhatsApp, SMS, or Email.",
    });
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Officials & Scorers"
        subtitle="Manage umpires, scorers, and referees. Scorers sign in via mobile + 4-digit PIN."
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to manage officials." />
        ) : (
          <>
            {/* Quick Share Info Banner */}
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary shrink-0" />
                  <h3 className="font-bold text-foreground text-sm sm:text-base">
                    Cricket Scorer Portal
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground break-all">
                  {scorerLink}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    void navigator.clipboard.writeText(scorerLink);
                    toast({ title: "Portal link copied to clipboard" });
                  }}
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => window.open(scorerLink, "_blank")}
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview Portal
                </Button>
              </div>
            </div>

            {/* Add Official Form */}
            <section className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
              <HubSectionHeader
                title="Add Official / Scorer"
                subtitle="Assign scorers with PIN for live scoring, or add umpires & referees for official match records."
              />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="off-name">Full Name *</Label>
                  <Input
                    id="off-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rahul Dravid"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Role *</Label>
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
                <div>
                  <Label htmlFor="off-mobile">
                    Mobile Number {role === "scorer" ? "(Required for login) *" : "(Optional)"}
                  </Label>
                  <Input
                    id="off-mobile"
                    type="tel"
                    inputMode="numeric"
                    value={mobile}
                    onChange={(e) => setMobile(sanitizeMobileInput(e.target.value))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="mt-1.5 font-mono"
                  />
                </div>
                {role === "scorer" ? (
                  <div>
                    <Label htmlFor="off-pin">4-Digit Login PIN *</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="off-pin"
                        type={showAddPin ? "text" : "password"}
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                        placeholder="e.g. 1234"
                        maxLength={8}
                        className="font-mono pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAddPin((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        title={showAddPin ? "Hide PIN" : "Show PIN"}
                      >
                        {showAddPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Scorer will enter this PIN along with their mobile on Scorer Home.
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="pt-2">
                <BtnPrimary onClick={() => void handleAdd()} disabled={busy}>
                  <Plus className="w-4 h-4" />
                  Add Official
                </BtnPrimary>
              </div>
            </section>

            {/* Officials Roster List */}
            <section className="space-y-4">
              <HubSectionHeader
                title="Officials Roster"
                subtitle={`${officials?.length ?? 0} registered official${(officials?.length ?? 0) === 1 ? "" : "s"}`}
              />

              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) : (officials?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground space-y-2">
                  <Users className="w-8 h-8 mx-auto opacity-50" />
                  <p className="text-sm font-medium">No officials added yet</p>
                  <p className="text-xs">Add a scorer above with a mobile number and 4-digit PIN to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(officials ?? []).map((o) => {
                    const isScorer = o.role === "scorer";
                    const isPinVisible = !!showPinMap[o.id];
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          hubCardClass,
                          "p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors",
                          isScorer && "border-primary/25 hover:border-primary/40",
                        )}
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-foreground truncate">{o.name}</p>
                            <span
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                                isScorer
                                  ? "bg-primary/15 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-border",
                              )}
                            >
                              {o.role.replace(/_/g, " ")}
                            </span>
                            {isScorer && (
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                                  o.isActive !== false
                                    ? "bg-emerald-500/15 text-emerald-300"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {o.isActive !== false ? "Active" : "View-only"}
                              </span>
                            )}
                            {o.loginLocked ? (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3" />
                                Login Locked
                              </span>
                            ) : null}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2.5 flex-wrap">
                            {o.mobile ? (
                              <span className="font-mono">{o.mobile}</span>
                            ) : (
                              <span>No phone</span>
                            )}
                            {isScorer && (
                              <div className="inline-flex items-center gap-1 font-mono bg-muted/60 px-2 py-0.5 rounded border border-border/60 text-[11px] text-foreground">
                                <span className="text-muted-foreground text-[10px] uppercase font-sans font-semibold">PIN:</span>
                                <span className="font-bold tracking-wider">
                                  {isPinVisible ? (o.pin || "Not set") : (o.pin ? "••••" : "Not set")}
                                </span>
                                {o.pin ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowPinMap((prev) => ({
                                        ...prev,
                                        [o.id]: !prev[o.id],
                                      }))
                                    }
                                    className="ml-0.5 text-muted-foreground hover:text-foreground p-0.5 rounded focus:outline-none"
                                    title={isPinVisible ? "Hide PIN" : "Show PIN"}
                                  >
                                    {isPinVisible ? (
                                      <EyeOff className="w-3 h-3 text-primary" />
                                    ) : (
                                      <Eye className="w-3 h-3" />
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            )}
                            {o.lastLoginAt ? (
                              <span>
                                · Last login: {new Date(o.lastLoginAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                          {isScorer && (
                            <Button
                              type="button"
                              size="sm"
                              variant={copiedId === o.id ? "default" : "secondary"}
                              className={cn(
                                "gap-1.5 text-xs font-semibold",
                                copiedId === o.id && "bg-emerald-600 hover:bg-emerald-500 text-white",
                              )}
                              onClick={() => handleCopyScorerAccess(o)}
                            >
                              {copiedId === o.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  Copy Access & Link
                                </>
                              )}
                            </Button>
                          )}

                          {isScorer && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={unlockingId === o.id}
                              className="text-xs font-semibold text-amber-300 border-amber-500/40 hover:bg-amber-500/10 gap-1.5"
                              onClick={() => void handleUnlockScorer(o)}
                              title="Clear active match locks, reset session deadlocks, and verify tournament access for this scorer"
                            >
                              <LockOpen className={cn("w-3.5 h-3.5", unlockingId === o.id && "animate-spin")} />
                              {unlockingId === o.id ? "Unlocking..." : "Unlock Scorer"}
                            </Button>
                          )}

                          {o.loginLocked ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-xs font-semibold text-amber-300 border-amber-500/40 hover:bg-amber-500/10 gap-1.5"
                              onClick={() => void handleClearLockout(o)}
                            >
                              <LockOpen className="w-3.5 h-3.5" />
                              Unlock
                            </Button>
                          ) : null}

                          {isScorer ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => void handleToggleActive(o)}
                            >
                              {o.isActive !== false ? "Deactivate" : "Activate"}
                            </Button>
                          ) : null}

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingOfficial(o);
                              setEditName(o.name);
                              setEditPin("");
                            }}
                          >
                            Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-8 w-8"
                            onClick={() => void handleDelete(o.id)}
                            aria-label={`Remove ${o.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Edit Official Modal / Dialog */}
            {editingOfficial ? (
              <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <h3 className="text-lg font-bold text-foreground">
                    Edit Official — {editingOfficial.name}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit-name">Full Name</Label>
                      <Input
                        id="edit-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    {editingOfficial.role === "scorer" ? (
                      <div>
                        <Label htmlFor="edit-pin">New 4-Digit PIN (Optional)</Label>
                        <div className="relative mt-1">
                          <Input
                            id="edit-pin"
                            type={showEditPin ? "text" : "password"}
                            inputMode="numeric"
                            value={editPin}
                            onChange={(e) => setEditPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                            placeholder="Leave blank to keep current PIN"
                            maxLength={8}
                            className="font-mono pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEditPin((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                            title={showEditPin ? "Hide PIN" : "Show PIN"}
                          >
                            {showEditPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingOfficial(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                    <BtnPrimary onClick={() => void handleSaveEdit()} disabled={busy}>
                      Save Changes
                    </BtnPrimary>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
