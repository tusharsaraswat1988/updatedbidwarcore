import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ArrowRightLeft,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Search,
  Users,
  ShieldAlert,
} from "lucide-react";
import {
  listAdminOrganizers,
  linkOrganizerToTournament,
  type AdminOrganizerRow,
} from "@/lib/auth";
import { displayOrganizerMobile } from "@workspace/api-base/mobile";
import { cn } from "@/lib/utils";

export interface TransferTournamentTarget {
  id: number;
  name: string;
  organizerId?: number | null;
  organizerName?: string | null;
  organizerMobile?: string | null;
  organizerEmail?: string | null;
}

export function TransferOrganizerDialog({
  open,
  onOpenChange,
  tournament,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: TransferTournamentTarget | null;
  onSuccess?: (result: {
    linkedOrganizerId: number | null;
    linkedOrganizerName: string | null;
  }) => void;
}) {
  const [organizers, setOrganizers] = useState<AdminOrganizerRow[]>([]);
  const [loadingOrganizers, setLoadingOrganizers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrganizerId, setSelectedOrganizerId] = useState<string>("__none__");
  const [syncContact, setSyncContact] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load organizers when dialog opens
  useEffect(() => {
    if (open) {
      setError(null);
      setSearchQuery("");
      setSyncContact(true);
      setLoadingOrganizers(true);
      listAdminOrganizers()
        .then((list) => {
          setOrganizers(list);
          if (tournament?.organizerId) {
            setSelectedOrganizerId(String(tournament.organizerId));
          } else {
            setSelectedOrganizerId("__none__");
          }
        })
        .catch(() => {
          setError("Failed to load organiser accounts.");
        })
        .finally(() => {
          setLoadingOrganizers(false);
        });
    }
  }, [open, tournament?.organizerId]);

  const filteredOrganizers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return organizers;
    return organizers.filter((o) => {
      const name = (o.name || "").toLowerCase();
      const mobile = (o.mobile || "").toLowerCase();
      const email = (o.email || "").toLowerCase();
      const cleanPhone = displayOrganizerMobile(o.mobile).toLowerCase();
      return (
        name.includes(q) ||
        mobile.includes(q) ||
        email.includes(q) ||
        cleanPhone.includes(q)
      );
    });
  }, [organizers, searchQuery]);

  const selectedOrg = useMemo(() => {
    if (selectedOrganizerId === "__none__") return null;
    return organizers.find((o) => String(o.id) === selectedOrganizerId) ?? null;
  }, [organizers, selectedOrganizerId]);

  const currentOrgId = tournament?.organizerId ?? null;
  const targetOrgId =
    selectedOrganizerId === "__none__" ? null : Number(selectedOrganizerId);
  const isNoChange = currentOrgId === targetOrgId;

  const currentDisplayPhone = tournament?.organizerMobile
    ? displayOrganizerMobile(tournament.organizerMobile)
    : "";

  async function handleTransfer() {
    if (!tournament) return;
    if (isNoChange) return;

    setSubmitting(true);
    setError(null);

    const res = await linkOrganizerToTournament(tournament.id, targetOrgId, {
      syncContact,
    });

    setSubmitting(false);

    if (res.success) {
      onSuccess?.({
        linkedOrganizerId: res.linkedOrganizerId ?? null,
        linkedOrganizerName: res.linkedOrganizerName ?? null,
      });
      onOpenChange(false);
    } else {
      setError(res.error || "Failed to transfer tournament.");
    }
  }

  if (!tournament) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                {tournament.organizerId ? "Transfer Tournament Organiser" : "Assign Tournament Organiser"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Reassign ownership of{" "}
                <strong className="text-foreground">{tournament.name}</strong> (ID #{tournament.id}) to another verified organiser account.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs Target Host Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Current Host */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs space-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Current Host Assignment
              </span>
              <div className="flex items-center gap-1.5">
                {tournament.organizerId ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                    <UserCheck className="w-3 h-3" /> Linked Account
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
                    <AlertTriangle className="w-3 h-3" /> Unlinked
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-foreground text-sm truncate">
                {tournament.organizerName || "No Name On File"}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {currentDisplayPhone || tournament.organizerEmail || "No contact info"}
              </p>
              {tournament.organizerId && (
                <p className="text-[10px] text-muted-foreground/75 font-mono">
                  Account ID: #{tournament.organizerId}
                </p>
              )}
            </div>

            {/* Target Host */}
            <div className={cn(
              "rounded-lg border p-3 text-xs space-y-1.5 transition-colors",
              selectedOrg
                ? "border-primary/40 bg-primary/[0.04]"
                : targetOrgId === null
                ? "border-amber-500/30 bg-amber-500/[0.04]"
                : "border-border/60 bg-muted/20"
            )}>
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                Target Host Assignment
              </span>
              <div className="flex items-center gap-1.5">
                {selectedOrg ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20 gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Selected New Host
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border gap-1">
                    None (Will Unlink)
                  </Badge>
                )}
              </div>
              <p className="font-semibold text-foreground text-sm truncate">
                {selectedOrg ? selectedOrg.name : "Unassigned (Unlinked)"}
              </p>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {selectedOrg
                  ? displayOrganizerMobile(selectedOrg.mobile) || selectedOrg.email || "No contact info"
                  : "No organiser account linked"}
              </p>
              {selectedOrg && (
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                  <span className="font-mono">Account ID: #{selectedOrg.id}</span>
                  <span className="font-medium text-foreground">
                    Quota: {selectedOrg.tournamentCount} / {selectedOrg.maxTournaments}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quota limit notice */}
          {selectedOrg && selectedOrg.tournamentCount >= selectedOrg.maxTournaments && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <span className="font-semibold">Quota Limit Reached: </span>
                {selectedOrg.name} has already reached their capacity of {selectedOrg.maxTournaments} tournament{selectedOrg.maxTournaments !== 1 ? "s" : ""}.
                As Super Admin, proceeding will transfer the tournament as an authorized administrative override.
              </div>
            </div>
          )}

          {/* Organiser Search & Select */}
          <div className="space-y-2 pt-1">
            <Label className="text-xs font-medium text-foreground flex items-center justify-between">
              <span>Select Pre-Created Organiser Account</span>
              <span className="text-[11px] text-muted-foreground">
                {organizers.length} registered organiser{organizers.length !== 1 ? "s" : ""}
              </span>
            </Label>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by organiser name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            {/* Organisers List Selector */}
            <div className="rounded-lg border border-border/80 bg-background/50 max-h-48 overflow-y-auto divide-y divide-border/40">
              {/* Option: Unlink / None */}
              <button
                type="button"
                onClick={() => setSelectedOrganizerId("__none__")}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors hover:bg-muted/40",
                  selectedOrganizerId === "__none__" && "bg-primary/10 text-primary font-medium"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
                    selectedOrganizerId === "__none__" ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}>
                    {selectedOrganizerId === "__none__" && <div className="w-1.5 h-1.5 bg-background rounded-full" />}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">None (Unlink current host)</span>
                    <span className="block text-[11px] text-muted-foreground">Tournament will have no assigned organiser account</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Unlink</Badge>
              </button>

              {loadingOrganizers ? (
                <div className="p-4 flex items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Loading accounts...
                </div>
              ) : filteredOrganizers.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No organiser accounts match "{searchQuery}"
                </div>
              ) : (
                filteredOrganizers.map((o) => {
                  const isSelected = selectedOrganizerId === String(o.id);
                  const isCurrent = tournament.organizerId === o.id;
                  const displayPhone = displayOrganizerMobile(o.mobile);

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setSelectedOrganizerId(String(o.id))}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-xs flex items-center justify-between transition-colors hover:bg-muted/40",
                        isSelected && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <div className={cn(
                          "w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0",
                          isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                        )}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-background rounded-full" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate">{o.name}</span>
                            {isCurrent && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-muted text-muted-foreground">
                                Current
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {displayPhone && <span className="font-mono">{displayPhone}</span>}
                            {displayPhone && o.email && <span>·</span>}
                            {o.email && <span className="truncate">{o.email}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          Quota: {o.tournamentCount}/{o.maxTournaments}
                        </span>
                        <span className={cn(
                          "text-[10px] font-medium capitalize",
                          o.licenseStatus === "active" ? "text-emerald-400" : "text-amber-400"
                        )}>
                          {o.licenseStatus}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Sync Contact Checkbox */}
          {selectedOrg && (
            <div className="rounded-lg border border-border/60 bg-muted/15 p-3 flex items-start gap-2.5">
              <Checkbox
                id="sync-contact"
                checked={syncContact}
                onCheckedChange={(checked) => setSyncContact(!!checked)}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="sync-contact" className="text-xs font-semibold text-foreground cursor-pointer">
                  Sync tournament host contact info
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Updates tournament host name, mobile ({displayOrganizerMobile(selectedOrg.mobile) || "N/A"}), and email ({selectedOrg.email || "N/A"}) to match {selectedOrg.name}.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-xs text-muted-foreground"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleTransfer}
            disabled={submitting || isNoChange}
            className={cn(
              "text-xs font-medium gap-1.5",
              targetOrgId === null
                ? "bg-amber-600 hover:bg-amber-500 text-white"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Transferring...</span>
              </>
            ) : isNoChange ? (
              <span>Select Different Organiser</span>
            ) : targetOrgId === null ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Confirm Unlink Organiser</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Confirm Transfer</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
