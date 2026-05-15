import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import {
  listAdminTournaments,
  lockTournament,
  unlockTournament,
  fetchAdminTournamentDetail,
  updateAdminTournament,
  createAdminTournament,
  deleteAdminTournament,
  setOrganizerPassword,
  resetTournamentAsAdmin,
  setTournamentLicenseStatus,
  linkOrganizerToTournament,
  listAdminOrganizers,
  updateAdminOrganizer,
  deleteAdminOrganizer,
  AdminTournamentRow,
  AdminTournamentDetail,
  AdminOrganizerRow,
} from "@/lib/auth";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Trophy,
  LogOut,
  KeyRound,
  Check,
  X,
  RefreshCw,
  Search,
  Users,
  Wallet,
  Gavel,
  Clock,
  Pencil,
  Phone,
  Mail,
  Timer,
  Lock,
  Unlock,
  BadgeCheck,
  AlertTriangle,
  Plus,
  Trash2,
  ChevronRight,
  Building2,
  Shield,
  Database,
  Star,
  UserCheck,
  FileBarChart,
  Activity,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { DEFAULT_CHEER_PRESETS } from "@/lib/cheer-constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LicenseBadge({ status }: { status: string }) {
  if (status === "live") {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1 text-[10px]">
        <BadgeCheck className="w-3 h-3" /> Live
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1 text-[10px]">
        <Check className="w-3 h-3" /> Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
      <AlertTriangle className="w-3 h-3" /> Trial
    </Badge>
  );
}

function LockBadge({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 text-[10px]">
      <Lock className="w-3 h-3" /> Locked
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    setup: "bg-muted/30 text-muted-foreground",
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-blue-500/20 text-blue-400",
  };
  return (
    <Badge className={`text-[10px] uppercase ${map[status] || ""}`}>
      {status}
    </Badge>
  );
}

// ─── Create Tournament Modal ──────────────────────────────────────────────────

function CreateTournamentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    sport: "cricket",
    venue: "",
    auctionDate: "",
    organizerName: "",
    organizerMobile: "",
    organizerEmail: "",
    organizerPassword: "",
    basePurse: "10000000",
    minBid: "100000",
    timerSeconds: "30",
    bidTimerSeconds: "15",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function f(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function handleCreate() {
    if (!form.name.trim()) {
      setError("Tournament name is required");
      return;
    }
    setLoading(true);
    setError("");
    const r = await createAdminTournament({
      name: form.name.trim(),
      sport: form.sport,
      venue: form.venue || undefined,
      auctionDate: form.auctionDate || undefined,
      organizerName: form.organizerName || undefined,
      organizerMobile: form.organizerMobile || undefined,
      organizerEmail: form.organizerEmail || undefined,
      organizerPassword: form.organizerPassword || undefined,
      basePurse: Number(form.basePurse) || 10000000,
      minBid: Number(form.minBid) || 100000,
      timerSeconds: Number(form.timerSeconds) || 30,
      bidTimerSeconds: Number(form.bidTimerSeconds) || 15,
    });
    setLoading(false);
    if (r.success) {
      onCreated();
      onClose();
    } else setError(r.error || "Failed to create");
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl dark max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Create Tournament
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-1">
          <div className="space-y-4 p-1">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Tournament Name *
                </Label>
                <Input
                  value={form.name}
                  onChange={f("name")}
                  placeholder="e.g. IPL 2026"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sport</Label>
                <Select
                  value={form.sport}
                  onValueChange={(v) => setForm((p) => ({ ...p, sport: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "cricket",
                      "football",
                      "kabaddi",
                      "basketball",
                      "hockey",
                      "other",
                    ].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Venue</Label>
                <Input
                  value={form.venue}
                  onChange={f("venue")}
                  placeholder="Stadium / City"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Auction Date
                </Label>
                <Input
                  type="date"
                  value={form.auctionDate}
                  onChange={f("auctionDate")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Base Purse (₹)
                </Label>
                <Input
                  type="number"
                  value={form.basePurse}
                  onChange={f("basePurse")}
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
              Organizer Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  Name
                </Label>
                <Input
                  value={form.organizerName}
                  onChange={f("organizerName")}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  Mobile
                </Label>
                <Input
                  value={form.organizerMobile}
                  onChange={f("organizerMobile")}
                  placeholder="+91..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  Email
                </Label>
                <Input
                  value={form.organizerEmail}
                  onChange={f("organizerEmail")}
                  placeholder="Links to portal account"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  Organizer Password
                </Label>
                <Input
                  type="password"
                  value={form.organizerPassword}
                  onChange={f("organizerPassword")}
                  placeholder="Set access password"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1">
              Auction Settings
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  First Bid Timer (s)
                </Label>
                <Input
                  type="number"
                  value={form.timerSeconds}
                  onChange={f("timerSeconds")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  Subsequent Bid Timer (s)
                </Label>
                <Input
                  type="number"
                  value={form.bidTimerSeconds}
                  onChange={f("bidTimerSeconds")}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading} className="gap-2">
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Create Tournament
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  tournamentId,
  isMaster,
  onClose,
  onRefresh,
}: {
  tournamentId: number;
  isMaster: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [data, setData] = useState<AdminTournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [settingPw, setSettingPw] = useState(false);
  const [organizers, setOrganizers] = useState<AdminOrganizerRow[]>([]);
  const [linking, setLinking] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("__none__");
  // Cheer settings
  const [cheerEnabled, setCheerEnabled] = useState(true);
  const [cheerPresets, setCheerPresets] = useState<string[]>([]);
  const [savingCheer, setSavingCheer] = useState(false);
  const [cheerExpanded, setCheerExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, orgs] = await Promise.all([
      fetchAdminTournamentDetail(tournamentId),
      listAdminOrganizers(),
    ]);
    setData(d);
    setOrganizers(orgs);
    if (d) {
      setEditForm({
        name: d.tournament.name,
        sport: d.tournament.sport,
        venue: d.tournament.venue || "",
        auctionDate: d.tournament.auctionDate || "",
        organizerName: d.tournament.organizerName || "",
        organizerMobile: d.tournament.organizerMobile || "",
        organizerEmail: d.tournament.organizerEmail || "",
        organizerPassword: "",
        basePurse: d.tournament.basePurse,
        minBid: d.tournament.minBid,
        timerSeconds: d.tournament.timerSeconds,
        bidTimerSeconds: d.tournament.bidTimerSeconds,
        playerSelectionMode: d.tournament.playerSelectionMode,
      });
      setSelectedLinkId(
        d.tournament.organizerId !== null
          ? String(d.tournament.organizerId)
          : "__none__",
      );
      // Initialize cheer settings
      setCheerEnabled(d.tournament.cheerMessagesEnabled ?? true);
      if (d.tournament.cheerMessagePresets) {
        try {
          const p = JSON.parse(d.tournament.cheerMessagePresets) as unknown;
          if (Array.isArray(p) && p.length > 0) setCheerPresets(p as string[]);
          else setCheerPresets([]);
        } catch { setCheerPresets([]); }
      } else {
        setCheerPresets([]);
      }
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleSaveCheer() {
    if (!data) return;
    setSavingCheer(true);
    const presetsToSave = cheerPresets.length > 0 ? cheerPresets : DEFAULT_CHEER_PRESETS;
    try {
      const r = await fetch(
        `/api/auth/admin/tournaments/${tournamentId}/cheer-settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cheerMessagesEnabled: cheerEnabled,
            cheerMessagePresets: presetsToSave,
          }),
        },
      );
      if (!r.ok) throw new Error("Failed");
      flash("Cheer settings saved");
      void load();
    } catch {
      flash("Failed to save cheer settings", false);
    } finally {
      setSavingCheer(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const payload: Record<string, string | number> = {};
    const ef = editForm;
    if (ef.name) payload.name = ef.name as string;
    if (ef.sport) payload.sport = ef.sport as string;
    if (ef.venue !== undefined) payload.venue = ef.venue as string;
    if (ef.auctionDate !== undefined)
      payload.auctionDate = ef.auctionDate as string;
    if (ef.organizerName !== undefined)
      payload.organizerName = ef.organizerName as string;
    if (ef.organizerMobile !== undefined)
      payload.organizerMobile = ef.organizerMobile as string;
    if (ef.organizerEmail !== undefined)
      payload.organizerEmail = ef.organizerEmail as string;
    if (ef.organizerPassword)
      payload.organizerPassword = ef.organizerPassword as string;
    if (ef.basePurse) payload.basePurse = Number(ef.basePurse);
    if (ef.minBid) payload.minBid = Number(ef.minBid);
    if (ef.timerSeconds) payload.timerSeconds = Number(ef.timerSeconds);
    if (ef.bidTimerSeconds)
      payload.bidTimerSeconds = Number(ef.bidTimerSeconds);
    if (ef.playerSelectionMode)
      payload.playerSelectionMode = ef.playerSelectionMode as string;
    const contactFieldsChanged =
      ef.organizerMobile !== undefined || ef.organizerEmail !== undefined;
    const r = await updateAdminTournament(
      tournamentId,
      payload as Parameters<typeof updateAdminTournament>[1],
    );
    setSaving(false);
    if (r.success) {
      if (r.linkedOrganizerId) {
        flash(
          `Saved — linked to organizer account: ${r.linkedOrganizerName ?? `#${r.linkedOrganizerId}`}`,
        );
      } else if (
        contactFieldsChanged &&
        (ef.organizerMobile || ef.organizerEmail)
      ) {
        flash(
          "Saved — no matching organizer account found for that mobile/email. Create one in the Organizers tab then link manually.",
          false,
        );
      } else {
        flash("Saved successfully");
      }
      setEditing(false);
      await load();
      onRefresh();
    } else flash(r.error || "Save failed", false);
  }

  async function handleLinkOrganizer() {
    setLinking(true);
    const orgId =
      selectedLinkId === "__none__" ? null : parseInt(selectedLinkId);
    const r = await linkOrganizerToTournament(tournamentId, orgId);
    setLinking(false);
    if (r.success) {
      if (orgId !== null)
        flash(
          `Tournament linked to organizer: ${r.linkedOrganizerName ?? `#${orgId}`}`,
        );
      else flash("Organizer account unlinked");
      await load();
      onRefresh();
    } else flash(r.error || "Link failed", false);
  }

  async function doAction(
    label: string,
    fn: () => Promise<{ success: boolean; error?: string }>,
  ) {
    setActionLoading(label);
    const r = await fn();
    setActionLoading(null);
    if (r.success) {
      flash(`${label} done`);
      await load();
      onRefresh();
    } else flash(r.error || `${label} failed`, false);
  }

  async function handleSetPw() {
    if (!newPw.trim() || newPw.length < 4) {
      flash("Password must be at least 4 characters", false);
      return;
    }
    setSettingPw(true);
    const r = await setOrganizerPassword(tournamentId, newPw.trim());
    setSettingPw(false);
    if (r.success) {
      flash("Password updated");
      setNewPw("");
      await load();
    } else flash(r.error || "Failed", false);
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col border-l border-border/40 bg-card/30">
        <div className="p-5 border-b border-border/40 flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col border-l border-border/40 bg-card/30 items-center justify-center gap-3">
        <p className="text-muted-foreground text-sm">
          Failed to load tournament data
        </p>
        <Button size="sm" variant="outline" onClick={load}>
          Retry
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  const t = data.tournament;
  const isLocked = t.adminLocked;

  return (
    <div className="flex-1 flex flex-col border-l border-border/40 bg-card/30 min-w-0">
      {/* Panel header */}
      <div className="p-4 border-b border-border/40 flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-base truncate">
              {t.name}
            </span>
            <StatusBadge status={t.status} />
            <LicenseBadge status={t.licenseStatus} />
            <LockBadge locked={t.adminLocked} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.sport.toUpperCase()} · ID #{t.id}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2 flex-wrap flex-shrink-0 bg-muted/10">
        {/* License status buttons (master admin only) */}
        {isMaster && t.licenseStatus !== "trial" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            disabled={actionLoading === "Set Trial"}
            onClick={() =>
              doAction("Set Trial", () =>
                setTournamentLicenseStatus(tournamentId, "trial"),
              )
            }
          >
            {actionLoading === "Set Trial" ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            Set Trial
          </Button>
        )}
        {isMaster && t.licenseStatus !== "live" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-green-500/40 text-green-400 hover:bg-green-500/10"
            disabled={actionLoading === "Set Live"}
            onClick={() =>
              doAction("Set Live", () =>
                setTournamentLicenseStatus(tournamentId, "live"),
              )
            }
          >
            {actionLoading === "Set Live" ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <BadgeCheck className="w-3 h-3" />
            )}
            Set Live
          </Button>
        )}
        {isMaster && t.licenseStatus !== "completed" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            disabled={actionLoading === "Set Completed"}
            onClick={() =>
              doAction("Set Completed", () =>
                setTournamentLicenseStatus(tournamentId, "completed"),
              )
            }
          >
            {actionLoading === "Set Completed" ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Set Completed
          </Button>
        )}
        {/* Lock / Unlock */}
        {!isLocked ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
            disabled={actionLoading === "Lock"}
            onClick={() => doAction("Lock", () => lockTournament(tournamentId))}
          >
            {actionLoading === "Lock" ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Lock className="w-3 h-3" />
            )}
            Mark Completed & Lock
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
            disabled={actionLoading === "Unlock"}
            onClick={() =>
              doAction("Unlock", () => unlockTournament(tournamentId))
            }
          >
            {actionLoading === "Unlock" ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Unlock className="w-3 h-3" />
            )}
            Unlock
          </Button>
        )}
        {/* Edit */}
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" /> Edit
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </>
        )}
        {/* Reset Auction (master admin only) */}
        {isMaster && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 ml-auto"
            onClick={() => {
              setResetPassword("");
              setResetError(null);
              setConfirmReset(true);
            }}
            title={`Reset auction data (reset count: ${t.resetCount ?? 0})`}
          >
            <RefreshCw className="w-3 h-3" /> Reset Auction
            {(t.resetCount ?? 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 text-[10px] font-semibold">
                {t.resetCount}×
              </span>
            )}
          </Button>
        )}
        {/* Delete */}
        <Button
          size="sm"
          variant="ghost"
          className={`h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 ${isMaster ? "" : "ml-auto"}`}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>

      {/* Flash message */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-4 mt-3 rounded px-3 py-2 text-sm flex-shrink-0 ${msg.ok ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="mx-4 mt-3 flex-shrink-0 grid grid-cols-4 h-8">
          <TabsTrigger value="overview" className="text-xs">
            Overview
          </TabsTrigger>
          <TabsTrigger value="players" className="text-xs">
            Players ({data.players.length})
          </TabsTrigger>
          <TabsTrigger value="teams" className="text-xs">
            Teams ({data.teams.length})
          </TabsTrigger>
          <TabsTrigger value="bids" className="text-xs">
            Bids ({data.recentBids.length})
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 px-4 pb-4">
          {/* ── Overview ── */}
          <TabsContent value="overview" className="mt-4 space-y-5">
            {editing ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tournament Info
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Name
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      value={(editForm.name as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Sport
                    </Label>
                    <Select
                      value={(editForm.sport as string) || "cricket"}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, sport: v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "cricket",
                          "football",
                          "kabaddi",
                          "basketball",
                          "hockey",
                          "other",
                        ].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Venue
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      value={(editForm.venue as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, venue: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Auction Date
                    </Label>
                    <Input
                      type="date"
                      className="h-8 text-sm"
                      value={(editForm.auctionDate as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          auctionDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Organizer
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      Name
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      value={(editForm.organizerName as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          organizerName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Mobile
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      value={(editForm.organizerMobile as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          organizerMobile: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </Label>
                    <Input
                      className="h-8 text-sm"
                      value={(editForm.organizerEmail as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          organizerEmail: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Auction Settings
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Base Purse (₹)
                    </Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={(editForm.basePurse as number) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          basePurse: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Min Bid (₹)
                    </Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={(editForm.minBid as number) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, minBid: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      First Bid Timer (s)
                    </Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={(editForm.timerSeconds as number) || 30}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          timerSeconds: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Timer className="w-3 h-3" />
                      Subsequent Timer (s)
                    </Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={(editForm.bidTimerSeconds as number) || 15}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          bidTimerSeconds: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Player Selection
                    </Label>
                    <Select
                      value={
                        (editForm.playerSelectionMode as string) || "sequential"
                      }
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, playerSelectionMode: v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sequential">Sequential</SelectItem>
                        <SelectItem value="random">Random</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Organizer Password
                </p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      New password (leave blank to keep current)
                    </Label>
                    <Input
                      type="password"
                      className="h-8 text-sm"
                      value={(editForm.organizerPassword as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          organizerPassword: e.target.value,
                        }))
                      }
                      placeholder="Enter new password..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Stats strip */}
                <div className="grid grid-cols-5 gap-2">
                  {[
                    ["Total", data.playerCounts.total, "text-foreground"],
                    ["Available", data.playerCounts.available, "text-blue-400"],
                    ["Sold", data.playerCounts.sold, "text-green-400"],
                    ["Unsold", data.playerCounts.unsold, "text-destructive"],
                    ["Retained", data.playerCounts.retained, "text-purple-400"],
                  ].map(([label, count, color]) => (
                    <div
                      key={label as string}
                      className="text-center p-3 rounded-lg bg-muted/20 border border-border/50"
                    >
                      <p className={`text-xl font-display font-bold ${color}`}>
                        {count}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* License / lock status */}
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin Status
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-28">
                        License
                      </span>
                      <LicenseBadge status={t.licenseStatus} />
                    </div>
                    {t.licenseGrantedAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-28">
                          Granted at
                        </span>
                        <span className="text-xs">
                          {new Date(t.licenseGrantedAt).toLocaleDateString(
                            "en-IN",
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-28">
                        Lock status
                      </span>
                      {isLocked ? (
                        <LockBadge locked />
                      ) : (
                        <Badge className="text-[10px] bg-muted/20 text-muted-foreground">
                          Unlocked
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Tournament Info
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    {[
                      ["Sport", t.sport.toUpperCase()],
                      ["Venue", t.venue || "—"],
                      ["Auction Date", t.auctionDate || "—"],
                      [
                        "Created",
                        new Date(t.createdAt).toLocaleDateString("en-IN"),
                      ],
                      ["Organizer", t.organizerName || "—"],
                      ["Mobile", t.organizerMobile || "—"],
                      ["Email", t.organizerEmail || "—"],
                      ["Password", t.hasPassword ? "Set" : "Not set"],
                      ["Base Purse", formatIndianRupee(t.basePurse)],
                      ["Min Bid", formatIndianRupee(t.minBid)],
                      ["First Timer", `${t.timerSeconds}s`],
                      ["Bid Timer", `${t.bidTimerSeconds}s`],
                      ["Selection", t.playerSelectionMode],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-24 flex-shrink-0">
                          {k}
                        </span>
                        <span className="font-medium text-xs truncate">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Linked organizer account */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    Linked Organizer Account
                  </p>
                  {t.organizerId ? (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1 text-[10px]">
                        <Check className="w-3 h-3" /> Linked
                      </Badge>
                      <span className="text-xs text-foreground">
                        {organizers.find((o) => o.id === t.organizerId)?.name ??
                          `Account #${t.organizerId}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {organizers.find((o) => o.id === t.organizerId)
                          ?.mobile ?? ""}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
                        <AlertTriangle className="w-3 h-3" /> Unlinked
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        No organizer account linked
                      </span>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <Select
                      value={selectedLinkId}
                      onValueChange={setSelectedLinkId}
                    >
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue placeholder="Select organizer account..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (unlink)</SelectItem>
                        {organizers.map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>
                            {o.name}
                            {o.mobile ? ` · ${o.mobile}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleLinkOrganizer}
                      disabled={linking}
                    >
                      {linking ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      {selectedLinkId === "__none__" ? "Unlink" : "Link"}
                    </Button>
                  </div>
                </div>

                {/* Quick password reset (outside edit mode) */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Set Organizer Password
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="New password (min 4 chars)"
                      className="h-8 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleSetPw()}
                    />
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleSetPw}
                      disabled={settingPw || !newPw.trim()}
                    >
                      {settingPw ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                      Set
                    </Button>
                  </div>
                </div>

                {/* Cheer Messages */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Cheer Messages
                  </p>
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-3">
                    {/* Enable/disable toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Live viewer cheers</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Allow viewers to send cheer reactions on the live screen
                        </p>
                      </div>
                      <button
                        onClick={() => setCheerEnabled((v) => !v)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                          cheerEnabled ? "bg-green-500" : "bg-muted/50"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                            cheerEnabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Preset editor */}
                    <button
                      className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => setCheerExpanded((v) => !v)}
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${cheerExpanded ? "rotate-180" : ""}`}
                      />
                      Edit preset messages
                    </button>

                    {cheerExpanded && (
                      <div className="space-y-1.5">
                        {(cheerPresets.length > 0 ? cheerPresets : DEFAULT_CHEER_PRESETS).map(
                          (p, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-4 flex-shrink-0 text-right">
                                {i + 1}.
                              </span>
                              <Input
                                className="h-7 text-xs flex-1"
                                value={p}
                                maxLength={120}
                                onChange={(e) => {
                                  const base =
                                    cheerPresets.length > 0
                                      ? cheerPresets
                                      : DEFAULT_CHEER_PRESETS;
                                  const next = [...base];
                                  next[i] = e.target.value;
                                  setCheerPresets(next);
                                }}
                              />
                            </div>
                          ),
                        )}
                        <button
                          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mt-1"
                          onClick={() => setCheerPresets([])}
                        >
                          Reset to defaults
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={handleSaveCheer}
                        disabled={savingCheer}
                      >
                        {savingCheer ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Save Cheer Settings
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Players ── */}
          <TabsContent value="players" className="mt-4 space-y-2">
            {data.players.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No players added yet.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_80px_80px_80px_100px] text-[10px] text-muted-foreground uppercase tracking-wider px-3 pb-1">
                  <span>Name</span>
                  <span>Role</span>
                  <span>Base</span>
                  <span>Sold</span>
                  <span>Status</span>
                </div>
                {data.players.map((p) => {
                  const cat = data.categories.find(
                    (c) => c.id === p.categoryId,
                  );
                  const team = data.teams.find((t) => t.id === p.teamId);
                  const statusColor: Record<string, string> = {
                    available: "text-blue-400",
                    sold: "text-green-400",
                    unsold: "text-destructive",
                    retained: "text-purple-400",
                  };
                  return (
                    <div
                      key={p.id}
                      className="grid grid-cols-[1fr_80px_80px_80px_100px] items-center px-3 py-2 rounded-lg hover:bg-muted/10 gap-1"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        {cat && (
                          <p className="text-[10px] text-muted-foreground">
                            {cat.name}
                          </p>
                        )}
                        {team && p.status === "sold" && (
                          <p className="text-[10px] text-primary">
                            {team.name}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {p.role || "—"}
                      </span>
                      <span className="text-xs font-mono">
                        {formatShortIndianRupee(p.basePrice)}
                      </span>
                      <span className="text-xs font-mono">
                        {p.soldPrice
                          ? formatShortIndianRupee(p.soldPrice)
                          : "—"}
                      </span>
                      <span
                        className={`text-xs capitalize font-medium ${statusColor[p.status] || ""}`}
                      >
                        {p.status}
                      </span>
                    </div>
                  );
                })}
              </>
            )}
          </TabsContent>

          {/* ── Teams ── */}
          <TabsContent value="teams" className="mt-4 space-y-2">
            {data.teams.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No teams added yet.
              </p>
            ) : (
              data.teams.map((team) => {
                const pct =
                  team.purse > 0
                    ? Math.min(100, (team.purseUsed / team.purse) * 100)
                    : 0;
                const soldPlayers = data.players.filter(
                  (p) => p.teamId === team.id && p.status === "sold",
                );
                return (
                  <div
                    key={team.id}
                    className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-border/40"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full border border-border/40 flex-shrink-0"
                            style={{ backgroundColor: team.color || "#444" }}
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">{team.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {team.shortCode} · {team.ownerName || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-primary">
                          {formatShortIndianRupee(team.purseUsed)} spent
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          of {formatShortIndianRupee(team.purse)}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {soldPlayers.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        {soldPlayers.length} player
                        {soldPlayers.length !== 1 ? "s" : ""} acquired
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>

          {/* ── Bids ── */}
          <TabsContent value="bids" className="mt-4 space-y-1">
            {data.recentBids.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">
                No bids recorded yet.
              </p>
            ) : (
              data.recentBids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/10"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: bid.teamColor || "#666" }}
                    />
                    <span className="text-xs text-muted-foreground truncate">
                      {bid.playerName}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                    <span className="text-xs truncate">{bid.teamName}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-xs font-mono text-primary">
                      {formatShortIndianRupee(bid.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(bid.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Confirm reset (super admin) */}
      <AnimatePresence>
        {confirmReset && (
          <Dialog open onOpenChange={() => setConfirmReset(false)}>
            <DialogContent className="dark max-w-md border-red-500/40">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-400">
                  <RefreshCw className="w-5 h-5" /> Reset Auction Data
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 space-y-1.5">
                  <p className="text-sm font-semibold text-red-300">
                    The following will be permanently erased:
                  </p>
                  <ul className="text-xs text-red-200/80 space-y-1 list-disc list-inside">
                    <li>
                      Every sold / unsold result — all players reset to
                      "Available"
                    </li>
                    <li>All bid records for this tournament</li>
                    <li>All purse usage for every team (back to full purse)</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground">
                  Retained players and reserved purse amounts will{" "}
                  <strong className="text-foreground">not</strong> be affected.
                  {(t.resetCount ?? 0) > 0 && (
                    <>
                      {" "}
                      This tournament has already been reset{" "}
                      <strong className="text-foreground">
                        {t.resetCount}
                      </strong>{" "}
                      time(s).
                    </>
                  )}
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Super admin password
                  </Label>
                  <Input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => {
                      setResetPassword(e.target.value);
                      setResetError(null);
                    }}
                    placeholder="Confirm with super admin password"
                    autoComplete="current-password"
                  />
                </div>
                {resetError && (
                  <p className="text-xs text-red-400">{resetError}</p>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
                <Button
                  className="bg-red-700 hover:bg-red-600 text-white"
                  disabled={resetting || !resetPassword.trim()}
                  onClick={async () => {
                    setResetting(true);
                    setResetError(null);
                    const r = await resetTournamentAsAdmin(
                      tournamentId,
                      resetPassword,
                    );
                    setResetting(false);
                    if (r.success) {
                      setConfirmReset(false);
                      setResetPassword("");
                      flash("Auction data reset", true);
                      load();
                      onRefresh();
                    } else {
                      setResetError(r.error || "Reset failed");
                    }
                  }}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${resetting ? "animate-spin" : ""}`}
                  />
                  Yes, reset everything
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <Dialog open onOpenChange={() => setConfirmDelete(false)}>
            <DialogContent className="dark max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" /> Delete Tournament
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Permanently delete{" "}
                <strong className="text-foreground">{t.name}</strong> and all
                its teams, players, and bid history? This cannot be undone.
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setConfirmDelete(false);
                    setActionLoading("Delete");
                    const r = await deleteAdminTournament(tournamentId);
                    setActionLoading(null);
                    if (r.success) {
                      onClose();
                      onRefresh();
                    } else flash(r.error || "Delete failed", false);
                  }}
                >
                  Delete Forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Organizers Panel ─────────────────────────────────────────────────────────

function OrganizerLicenseBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <Badge
      className={`text-[10px] capitalize ${map[status] || "bg-muted/20 text-muted-foreground"}`}
    >
      {status}
    </Badge>
  );
}

function OrganizerDetailPanel({
  org,
  isMaster,
  onClose,
  onRefresh,
}: {
  org: AdminOrganizerRow;
  isMaster: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [form, setForm] = useState({
    name: org.name,
    email: org.email || "",
    mobile: org.mobile,
    notes: org.notes || "",
    newPassword: "",
  });

  function flash(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    const payload: Parameters<typeof updateAdminOrganizer>[1] = {
      name: form.name || undefined,
      email: form.email || undefined,
      mobile: (form.mobile ?? undefined) || undefined,
      notes: form.notes || undefined,
      newPassword: form.newPassword || undefined,
    };
    const r = await updateAdminOrganizer(org.id, payload);
    setSaving(false);
    if (r.success) {
      flash("Saved");
      setEditing(false);
      onRefresh();
    } else flash(r.error || "Save failed", false);
  }

  function f(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  return (
    <div className="flex-1 flex flex-col border-l border-border/40 bg-card/30 min-w-0">
      {/* Header */}
      <div className="p-4 border-b border-border/40 flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-base truncate">
              {org.name}
            </span>
            <OrganizerLicenseBadge status={org.licenseStatus} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {org.mobile} · {org.tournamentCount} tournament
            {org.tournamentCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 flex-shrink-0"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2 flex-wrap flex-shrink-0 bg-muted/10">
        {!editing ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setEditing(true)}
          >
            <Pencil className="w-3 h-3" /> Edit
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 ml-auto"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>

      {/* Flash */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-4 mt-3 rounded px-3 py-2 text-sm flex-shrink-0 ${msg.ok ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      <ScrollArea className="flex-1 px-4 pb-4">
        <div className="mt-4 space-y-5">
          {editing ? (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Organizer Details
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.name}
                    onChange={f("name")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Mobile
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.mobile ?? ""}
                    onChange={f("mobile")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </Label>
                  <Input
                    className="h-8 text-sm"
                    value={form.email}
                    onChange={f("email")}
                    placeholder="(optional)"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Internal Notes
                </Label>
                <textarea
                  className="w-full h-20 bg-card border border-border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, notes: e.target.value }))
                  }
                  placeholder="Any internal notes..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <KeyRound className="w-3 h-3" />
                  New Password (leave blank to keep current)
                </Label>
                <Input
                  type="password"
                  className="h-8 text-sm"
                  value={form.newPassword}
                  onChange={f("newPassword")}
                  placeholder="Set new password"
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Info
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                {[
                  ["Name", org.name],
                  ["Mobile", org.mobile ?? "—"],
                  ["Email", org.email || "—"],
                  ["Tournaments", String(org.tournamentCount)],
                  [
                    "Member Since",
                    new Date(org.createdAt).toLocaleDateString("en-IN"),
                  ],
                  ["Notes", org.notes || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start gap-2">
                    <span className="text-muted-foreground text-xs w-32 flex-shrink-0">
                      {k}
                    </span>
                    <span className="font-medium text-xs break-words">{v}</span>
                  </div>
                ))}
              </div>

              {isMaster && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Actions
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => setEditing(true)}
                    >
                      <Pencil className="w-3 h-3" /> Edit Details
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Confirm delete */}
      <AnimatePresence>
        {confirmDelete && (
          <Dialog open onOpenChange={() => setConfirmDelete(false)}>
            <DialogContent className="dark max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" /> Delete Organizer Account
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Permanently delete{" "}
                <strong className="text-foreground">{org.name}</strong>? This
                does not delete their tournaments.
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    setConfirmDelete(false);
                    const r = await deleteAdminOrganizer(org.id);
                    if (r.success) {
                      onClose();
                      onRefresh();
                    } else flash(r.error || "Delete failed", false);
                  }}
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}

function OrganizersPanel({ isMaster }: { isMaster: boolean }) {
  const [organizers, setOrganizers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAdminOrganizers();
    setOrganizers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = organizers.filter((o) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      o.name.toLowerCase().includes(q) ||
      (o.mobile ?? "").includes(q) ||
      (o.email || "").toLowerCase().includes(q)
    );
  });

  const selected = selectedId
    ? (organizers.find((o) => o.id === selectedId) ?? null)
    : null;

  return (
    <div className="flex-1 flex min-h-0">
      {/* Left list */}
      <div
        className={`flex flex-col ${selected ? "w-96 flex-shrink-0" : "flex-1"} border-r border-border/40 min-h-0`}
      >
        {/* Toolbar */}
        <div className="p-3 border-b border-border/40 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organizers..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={load}
            title="Refresh"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {/* Stats row */}
        <div className="px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground border-b border-border/30 flex-shrink-0">
          <span>
            {organizers.length} organizer{organizers.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* List */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search
                ? "No organizers match your search."
                : "No organizer accounts yet."}
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((o, i) => (
                <motion.button
                  key={o.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() =>
                    setSelectedId((prev) => (prev === o.id ? null : o.id))
                  }
                  className={`w-full text-left px-4 py-3 hover:bg-muted/10 transition-colors ${selectedId === o.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate block">
                        {o.name}
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {o.mobile ?? "—"}
                        </span>
                        {o.email && (
                          <span className="text-[10px] text-muted-foreground truncate">
                            {o.email}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {o.tournamentCount} tournament
                        {o.tournamentCount !== 1 ? "s" : ""} · Joined{" "}
                        {new Date(o.createdAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1 transition-transform ${selectedId === o.id ? "rotate-90" : ""}`}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right detail */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="flex-1 flex min-h-0"
          >
            <OrganizerDetailPanel
              org={selected}
              isMaster={isMaster}
              onClose={() => setSelectedId(null)}
              onRefresh={async () => {
                await load();
                if (selectedId) {
                  const fresh = await listAdminOrganizers();
                  const o = fresh.find((x) => x.id === selectedId);
                  if (!o) setSelectedId(null);
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {selectedId === null && !loading && organizers.length > 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
          <Users className="w-5 h-5" />
          Select an organizer to manage their account
        </div>
      )}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const {
    isLoggedIn,
    adminLevel,
    isMaster,
    isLoading: authLoading,
    logout,
  } = useAdminAuth();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, navigate] = useLocation();
  const [adminTab, setAdminTab] = useState<"tournaments" | "organizers">(
    "tournaments",
  );

  async function load() {
    setLoading(true);
    const data = await listAdminTournaments();
    setTournaments(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      window.location.href = "/admin/login";
      return;
    }
    if (!authLoading && isLoggedIn) load();
  }, [isLoggedIn, authLoading]);

  async function handleLogout() {
    await logout();
    window.location.href = "/admin/login";
  }

  const filtered = tournaments.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.organizerMobile && t.organizerMobile.toLowerCase().includes(q)) ||
      (t.organizerEmail && t.organizerEmail.toLowerCase().includes(q)) ||
      (t.organizerName && t.organizerName.toLowerCase().includes(q))
    );
  });

  if (authLoading) {
    return (
      <FullscreenLayout>
        <div className="p-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </FullscreenLayout>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <FullscreenLayout>
      <div className="h-screen flex flex-col">
        {/* Top header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-xl text-white">
                  Super Admin
                </h1>
                {isMaster ? (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1 text-[10px]">
                    <Star className="w-3 h-3" /> Master
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 gap-1 text-[10px]">
                    <Database className="w-3 h-3" /> Data Entry
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                BidWar Platform Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Legend */}
            <div className="hidden md:flex items-center gap-3 mr-3 text-[10px] text-muted-foreground">
              {isMaster && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-400" />
                  Master: grant licenses
                </span>
              )}
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-red-400" />
                Lock when auction ends
              </span>
              <span className="flex items-center gap-1">
                <BadgeCheck className="w-3 h-3 text-green-400" />
                Licensed = can go live
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => navigate("/admin/intelligence")}
            >
              <Activity className="w-4 h-4" /> Intelligence
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => navigate("/admin/reports")}
            >
              <FileBarChart className="w-4 h-4" /> Report Center
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/40 bg-muted/5 flex-shrink-0">
          <Button
            size="sm"
            variant={adminTab === "tournaments" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setAdminTab("tournaments")}
          >
            <Trophy className="w-3.5 h-3.5" /> Tournaments
          </Button>
          <Button
            size="sm"
            variant={adminTab === "organizers" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setAdminTab("organizers")}
          >
            <Users className="w-3.5 h-3.5" /> Organizers
          </Button>
        </div>

        {/* Body */}
        {adminTab === "organizers" ? (
          <OrganizersPanel isMaster={isMaster} />
        ) : (
          <div className="flex-1 flex min-h-0">
            {/* Left: tournament list */}
            <div
              className={`flex flex-col ${selectedId ? "w-96 flex-shrink-0" : "flex-1"} border-r border-border/40 min-h-0`}
            >
              {/* List toolbar */}
              <div className="p-3 border-b border-border/40 flex items-center gap-2 flex-shrink-0">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search tournaments..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={load}
                  title="Refresh"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5" /> New
                </Button>
              </div>

              {/* Stats row */}
              <div className="px-3 py-2 flex items-center gap-4 text-[10px] text-muted-foreground border-b border-border/30 flex-shrink-0">
                <span>{filtered.length} tournaments</span>
                <span className="flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3 text-green-400" />
                  {
                    tournaments.filter((t) => t.licenseStatus === "live").length
                  }{" "}
                  licensed
                </span>
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  {
                    tournaments.filter((t) => t.licenseStatus === "trial")
                      .length
                  }{" "}
                  trial
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-red-400" />
                  {tournaments.filter((t) => t.adminLocked).length} locked
                </span>
              </div>

              {/* List */}
              <ScrollArea className="flex-1">
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    {search
                      ? "No tournaments match your search."
                      : "No tournaments yet. Create one."}
                  </div>
                ) : (
                  <div className="divide-y divide-border/30">
                    {filtered.map((t, i) => (
                      <motion.button
                        key={t.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() =>
                          setSelectedId((prev) => (prev === t.id ? null : t.id))
                        }
                        className={`w-full text-left px-4 py-3 hover:bg-muted/10 transition-colors ${selectedId === t.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{t.id}
                              </span>
                              <span className="font-semibold text-sm truncate">
                                {t.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase h-4 px-1"
                              >
                                {t.sport}
                              </Badge>
                              <StatusBadge status={t.status} />
                              <LicenseBadge status={t.licenseStatus} />
                              {t.adminLocked && <LockBadge locked />}
                              {t.organizerId ? (
                                <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-0.5 text-[9px] h-4 px-1">
                                  <UserCheck className="w-2.5 h-2.5" />
                                  Linked
                                </Badge>
                              ) : (
                                <Badge className="bg-muted/20 text-muted-foreground border-border/40 gap-0.5 text-[9px] h-4 px-1">
                                  Unlinked
                                </Badge>
                              )}
                            </div>
                            {t.organizerName && (
                              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                                <UserCheck className="w-2.5 h-2.5" />
                                {t.organizerName}
                                {t.organizerMobile && ` · ${t.organizerMobile}`}
                              </p>
                            )}
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-1 transition-transform ${selectedId === t.id ? "rotate-90" : ""}`}
                          />
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right: detail panel */}
            <AnimatePresence>
              {selectedId !== null && (
                <motion.div
                  key={selectedId}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  className="flex-1 flex min-h-0"
                >
                  <DetailPanel
                    tournamentId={selectedId}
                    isMaster={isMaster}
                    onClose={() => setSelectedId(null)}
                    onRefresh={load}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty state when no tournament selected */}
            {selectedId === null && !loading && tournaments.length > 0 && (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
                <Shield className="w-5 h-5" />
                Select a tournament to manage it
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create tournament modal */}
      <AnimatePresence>
        {createOpen && (
          <CreateTournamentModal
            onClose={() => setCreateOpen(false)}
            onCreated={load}
          />
        )}
      </AnimatePresence>
    </FullscreenLayout>
  );
}
