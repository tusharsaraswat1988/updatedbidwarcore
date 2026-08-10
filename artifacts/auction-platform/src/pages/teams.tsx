import { useState, useEffect, useMemo } from "react";
import { useRoute, useLocation, useSearch, Link } from "wouter";
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useGetTournament,
  useGetTeamPurses,
  useGetAuctionState,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
  getGetTeamPursesQueryKey,
  getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, Wallet, ExternalLink, Copy, Check, KeyRound, RefreshCw, Wand2, AlertTriangle, Upload, Image as ImageIcon, X, ShieldAlert, TrendingDown, LockOpen, Zap, MessageCircle, ChevronLeft } from "lucide-react";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { normalizeAuctionUnit } from "@workspace/api-base/auction-unit";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { resetOwnerAccessLockout } from "@workspace/api-base/owner-auth";
import { OptionalEmailField } from "@/components/optional-email-field";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { OrganizerFormDialogHeader, OrganizerSectionHeader } from "@/components/organizer-page-chrome";
import { resolveReturnPath, returnPathBackLabel } from "@/lib/tournament-navigation";
import { TeamForm } from "@/components/team-form";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={copy} title="Copy owner link">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

export default function Teams() {
  const [, params] = useRoute("/tournament/:id/teams");
  const [, navigate] = useLocation();
  const search = useSearch();
  const tournamentId = parseInt(params?.id || "0");
  const returnFrom = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  ).get("from");
  const returnTo = resolveReturnPath(returnFrom, tournamentId);
  const showReturn =
    Boolean(returnFrom?.startsWith("/") && !returnFrom.startsWith("//")) &&
    returnTo !== `/tournament/${tournamentId}/teams`;
  const qc = useQueryClient();
  const { data: teams, isLoading } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { formatShort, formatAmount, budgetLabel } = useAuctionUnit(tournament);
  const { data: auctionState } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const isAuctionEnded =
    tournament?.status === "completed" ||
    auctionState?.licenseStatus === "completed" ||
    auctionState?.status === "completed";
  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deleteTeam = useDeleteTeam();
  const updateTeam = useUpdateTeam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [regenerateTarget, setRegenerateTarget] = useState<number | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ id: number; name: string } | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  const existingShortCodes = (teams || []).map(t => t.shortCode);
  const existingTeamColors = useMemo(() => (teams || []).map(t => t.color), [teams]);
  const basePurse = tournament?.basePurse ?? 10000000;
  const hasLockedTeam = (teams ?? []).some(
    (t) => (t as { ownerAccessLocked?: boolean }).ownerAccessLocked,
  );

  useEffect(() => {
    if (!hasLockedTeam || !tournamentId) return;
    const interval = window.setInterval(() => {
      void qc.refetchQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [hasLockedTeam, tournamentId, qc]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await deleteTeam.mutateAsync({ tournamentId, teamId: deleteTarget.id });
      qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
      setDeleteTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete team.";
      setDeleteError(message);
    }
  }

  function handleRegenerateCode(teamId: number) {
    setRegenerateTarget(teamId);
  }

  async function confirmRegenerateCode() {
    if (!regenerateTarget) return;
    await updateTeam.mutateAsync({
      tournamentId,
      teamId: regenerateTarget,
      data: { regenerateCode: true },
    });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
    setRegenerateTarget(null);
  }

  async function confirmUnlockAccess() {
    if (!unlockTarget) return;
    setUnlockLoading(true);
    setUnlockError("");
    try {
      const result = await resetOwnerAccessLockout(tournamentId, unlockTarget.id);
      if (result.success) {
        await qc.refetchQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
        setUnlockTarget(null);
      } else {
        setUnlockError(result.message ?? "Could not unlock owner access.");
      }
    } catch {
      setUnlockError("Could not unlock owner access. Please try again.");
    } finally {
      setUnlockLoading(false);
    }
  }

  function getOwnerLink(teamId: number) {
    return `${location.origin}/owner-app/join?tournamentId=${tournamentId}&teamId=${teamId}`;
  }

  function getOwnerWhatsAppHref(team: { id: number; name: string; ownerName?: string | null; ownerMobile?: string | null; accessCode?: string | null }) {
    const ownerLink = getOwnerLink(team.id);
    const shareLines = [
      `${tournament?.name ?? "Auction"} — ${team.name}`,
      team.ownerName ? `Owner: ${team.ownerName}` : null,
      team.accessCode ? `Access code: ${team.accessCode}` : null,
      `Bidding link: ${ownerLink}`,
    ].filter(Boolean);
    const mobile = team.ownerMobile?.replace(/\D/g, "") ?? "";
    return `https://wa.me/${mobile}?text=${encodeURIComponent(shareLines.join("\n"))}`;
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content">
        {showReturn ? (
          <Link
            href={returnTo}
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors w-fit"
          >
            <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
            {returnPathBackLabel(returnTo)}
          </Link>
        ) : null}
        {/* T011: flow guard — remind organiser once exactly 1 team added */}
        {!isLoading && (teams?.length ?? 0) === 1 && !isAuctionEnded && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-start gap-3 max-w-xl">
            <Users className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 text-sm">Teams: 1 of 2 — add one more</p>
              <p className="text-xs text-muted-foreground mt-1">
                An auction needs at least 2 teams bidding against each other. Add a second franchise to continue.
              </p>
            </div>
          </div>
        )}
        {!isLoading && (teams?.length ?? 0) > 2 && tournament?.licenseStatus !== "active" && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-start gap-3 max-w-2xl">
            <Users className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
                  <p className="font-semibold text-amber-300 text-sm">Trial: only 2 teams can auction</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can add all teams now, but in trial only the first 2 teams can bid, use the owner panel, or receive manual sells. All teams unlock after live activation.
                  </p>
            </div>
          </div>
        )}
        <OrganizerSectionHeader
          tournament={tournament}
          title="Franchise Teams"
          description={
            (teams?.length || 0) >= 2
              ? `${teams?.length} teams added — ready for players`
              : `Teams: ${teams?.length || 0} of 2 minimum`
          }
          actions={
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                <Plus className="w-5 h-5" /> Add Team
              </Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-lg dark"
              onPointerDownOutside={e => e.preventDefault()}
              onEscapeKeyDown={e => e.preventDefault()}
            >
              <OrganizerFormDialogHeader
                tournament={tournament}
                title={editing ? "Edit Team" : "Add New Team"}
              />
              <TeamForm
                key={editing?.id ?? "new"}
                tournamentId={tournamentId}
                team={editing}
                existingShortCodes={existingShortCodes}
                existingTeamColors={existingTeamColors}
                basePurse={basePurse}
                purseLabel={budgetLabel}
                formatShortAmount={formatShort}
                amountUnit={normalizeAuctionUnit(tournament?.auctionUnit)}
                onClose={() => { setOpen(false); setEditing(null); }}
              />
            </DialogContent>
          </Dialog>
          }
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52" />)}
          </div>
        ) : teams?.length === 0 ? (
          <div className="org-surface-card border-dashed py-16 px-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="font-display font-bold text-xl mb-2">Add your first team</h3>
            <p className="text-muted-foreground text-sm mb-1">
              Teams are the franchises that will bid in the auction. Each team gets a budget (purse) to spend on players.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              You need at least 2 teams before you can add players.
            </p>
            <Button className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4" /> Add First Team
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams?.map(team => {
              const ownerLink = getOwnerLink(team.id);
              return (
                <Card key={team.id} className="overflow-hidden border-border hover:border-primary/30 transition-all">
                  <div className="h-2" style={{ backgroundColor: team.color || "#444" }} />
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="w-10 h-10 rounded-lg object-contain border border-border bg-muted/20"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-display font-bold text-sm"
                            style={{ backgroundColor: `${team.color}22`, color: team.color || "#fff", border: `1px solid ${team.color}44` }}
                          >
                            {team.shortCode}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-lg leading-tight">{team.name}</h3>
                          <p className="text-xs text-muted-foreground">{team.ownerName}</p>
                          {team.ownerMobile && <p className="text-xs text-muted-foreground font-mono">{team.ownerMobile}</p>}
                          {team.ownerEmail && <p className="text-xs text-muted-foreground break-all">{team.ownerEmail}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(team); setOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { setDeleteError(""); setDeleteTarget({ id: team.id, name: team.name }); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Purse + Squad Summary */}
                    {(() => {
                      const tp = teamPurses?.find(p => p.teamId === team.id);
                      const originalPurse = tp?.originalPurse ?? team.purse;
                      const boosterTotal = tp?.boosterTotal ?? 0;
                      const effectiveCapacity = tp?.effectiveCapacity ?? team.purse;
                      const purseRemaining = effectiveCapacity - (team.purseUsed || 0);
                      const maxAllowedBid = tp?.maxAllowedBid ?? purseRemaining;
                      const reserved = tp?.futureReservePurse ?? tp?.reservePurse ?? 0;
                      const bought = tp?.playersBought ?? 0;
                      const slotsNeeded = tp?.futureSlotsRequired ?? tp?.slotsRequired ?? 0;
                      const maxSquad = tp?.maximumSquadSize ?? 0;
                      const maxReached = maxSquad > 0 && bought >= maxSquad;
                      return (
                        <div className="space-y-3 pt-3 border-t border-border">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {boosterTotal > 0 && (
                              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] gap-1">
                                <Zap className="w-3 h-3" />
                                Booster +{formatShort(boosterTotal)}
                              </Badge>
                            )}
                            <Badge
                              variant={team.isBiddingEnabled ? "default" : "secondary"}
                              className={team.isBiddingEnabled ? "bg-green-500/20 text-green-400 border-green-500/20 text-[10px]" : "text-[10px]"}
                            >
                              {team.isBiddingEnabled ? "Bidding ON" : "Blocked"}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className={`rounded-lg border px-3 py-2 col-span-2 ${boosterTotal > 0 ? "bg-amber-500/6 border-amber-500/25" : "bg-muted/20 border-border"}`}>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                <Wallet className="w-2.5 h-2.5" /> Budget
                              </p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShort(effectiveCapacity)}</p>
                              {boosterTotal > 0 ? (
                                <p className="text-[10px] mt-0.5">
                                  <span className="text-muted-foreground">{formatShort(originalPurse)} base</span>
                                  <span className="text-amber-400 font-semibold"> + {formatShort(boosterTotal)} booster</span>
                                </p>
                              ) : (
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5">Original purse · no active booster</p>
                              )}
                            </div>
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Spent</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShort(team.purseUsed || 0)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Remaining</p>
                              <p className="text-sm font-bold font-mono tabular-nums text-foreground">{formatShort(purseRemaining)}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
                              <p className="text-[10px] text-emerald-400/80 uppercase tracking-wider mb-0.5">Max Bid / Player</p>
                              <p className={`text-sm font-bold font-mono tabular-nums ${maxReached ? "text-red-400" : "text-emerald-400"}`}>
                                {maxReached ? "Squad full" : formatShort(maxAllowedBid)}
                              </p>
                            </div>
                            {reserved > 0 ? (
                              <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                                <p className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                  <ShieldAlert className="w-2.5 h-2.5" /> Reserved
                                </p>
                                <p className="text-sm font-bold font-mono tabular-nums text-amber-400">{formatShort(reserved)}</p>
                                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">for {slotsNeeded} slot{slotsNeeded !== 1 ? "s" : ""}</p>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-muted/20 border border-border px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Reserved</p>
                                <p className="text-sm font-bold font-mono tabular-nums text-muted-foreground/50">—</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Access Code */}
                    {team.accessCode && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                          <KeyRound className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Access Code</p>
                            <p className="text-sm font-display font-black tracking-[0.2em] text-primary">{team.accessCode}</p>
                          </div>
                          <CopyButton text={team.accessCode} />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                            title="Regenerate access code"
                            disabled={updateTeam.isPending}
                            onClick={() => handleRegenerateCode(team.id)}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                        {(team as { ownerAccessLocked?: boolean }).ownerAccessLocked && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                              Owner Access Locked
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => {
                                setUnlockError("");
                                setUnlockTarget({ id: team.id, name: team.name });
                              }}
                            >
                              <LockOpen className="w-3 h-3" />
                              Unlock Owner Access
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Owner Panel Link */}
                    {isAuctionEnded ? (
                      <div className="flex items-center gap-2 bg-muted/20 border border-border/50 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Panel Link</p>
                          <p className="text-xs text-muted-foreground/50 italic">Auction ended</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Owner Panel Link</p>
                          <p className="text-xs font-mono text-muted-foreground truncate">{ownerLink}</p>
                        </div>
                        <CopyButton text={ownerLink} />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-green-400 flex-shrink-0"
                          title="Send via WhatsApp"
                          asChild
                        >
                          <a href={getOwnerWhatsAppHref(team)} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                          onClick={() => window.open(getOwnerLink(team.id), "_blank", "noopener,noreferrer")}
                          title="Open owner panel"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <Card
              className="border-dashed border-2 border-border hover:border-primary/50 cursor-pointer transition-all flex items-center justify-center h-52"
              onClick={() => { setEditing(null); setOpen(true); }}
            >
              <div className="text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">Add Team</p>
              </div>
            </Card>
          </div>
        )}
      </div>

      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) { setDeleteTarget(null); setDeleteError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from this tournament? This cannot be undone.
          </p>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteTeam.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleteTeam.isPending} onClick={() => void confirmDelete()}>
              {deleteTeam.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Removing…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Yes, remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateTarget !== null} onOpenChange={(open) => { if (!open) setRegenerateTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Regenerate owner access code?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            The old code will stop working immediately. Team owners will need the new code to bid.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenerateTarget(null)} disabled={updateTeam.isPending}>
              Cancel
            </Button>
            <Button disabled={updateTeam.isPending} onClick={() => void confirmRegenerateCode()}>
              {updateTeam.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Regenerating…
                </>
              ) : (
                "Regenerate code"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlockTarget !== null} onOpenChange={(open) => { if (!open) { setUnlockTarget(null); setUnlockError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Unlock owner access?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Clear the access-code lockout for <strong className="text-foreground">{unlockTarget?.name}</strong>?
            The team owner will be able to try their code again immediately.
          </p>
          {unlockError && (
            <p className="text-sm text-red-400 font-medium">{unlockError}</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockTarget(null)} disabled={unlockLoading}>
              Cancel
            </Button>
            <Button disabled={unlockLoading} onClick={() => void confirmUnlockAccess()}>
              {unlockLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Unlocking…
                </>
              ) : (
                <>
                  <LockOpen className="w-3.5 h-3.5 mr-1.5" /> Unlock access
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
