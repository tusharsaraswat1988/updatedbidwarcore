import { useState, useEffect, useCallback } from "react";
import { useAdminAuth } from "@/hooks/use-auth";
import { useInactivityLock } from "@/hooks/use-inactivity-lock";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import {
  listAdminTournaments,
  lockTournament,
  unlockTournament,
  fetchAdminTournamentDetail,
  updateAdminTournament,
  createAdminTournament,
  deleteAdminTournament,
  resetTournamentAsAdmin,
  listAdminDisplayAuctions,
  createDisplayAuction,
  updateDisplayAuction,
  deleteDisplayAuction,
  seedDisplayAuctions,
  type DisplayAuction,
  setTournamentLicenseStatus,
  linkOrganizerToTournament,
  listAdminOrganizers,
  updateAdminOrganizer,
  deleteAdminOrganizer,
  AdminTournamentRow,
  AdminTournamentDetail,
  AdminOrganizerRow,
} from "@/lib/auth";
import { LicenseModeControl } from "@/components/admin/license-mode-control";
import { AuditReasonDialog } from "@/components/audit-reason-dialog";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";
import { payloadHasTournamentConfigFields } from "@/lib/audit-reason";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
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
  Sliders,
  Palette,
  MonitorDown,
  CircleDot,
  Hammer,
  GitBranch,
  ExternalLink,
  CircleCheck,
  XCircle,
  CheckCircle2,
  Tv,
  Calendar,
  Loader2,
  Eye,
  EyeOff,
  Images,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
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
import { ADMIN_FLEX_SCROLL_CLASS } from "@/components/admin/admin-scroll-panel";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SportSelect } from "@/components/sport-select";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { Switch } from "@/components/ui/switch";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { DEFAULT_CHEER_PRESETS } from "@/lib/cheer-constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function LicenseBadge({ status }: { status: string }) {
  if (status === "active") {
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

export function LockBadge({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
    <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 text-[10px]">
      <Lock className="w-3 h-3" /> Locked
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
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

export function CreateTournamentModal({
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
    auctionTime: "",
    organizerName: "",
    organizerMobile: "",
    organizerEmail: "",
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
    let organizerMobile: string | undefined;
    if (form.organizerMobile.trim()) {
      const mobileResult = parseIndianMobile(form.organizerMobile);
      if (!mobileResult.ok) {
        setError(mobileResult.error);
        return;
      }
      organizerMobile = mobileResult.normalized;
    }
    setLoading(true);
    setError("");
    const r = await createAdminTournament({
      name: form.name.trim(),
      sport: form.sport,
      venue: form.venue || undefined,
      auctionDate: form.auctionDate || undefined,
      auctionTime: form.auctionTime || undefined,
      organizerName: form.organizerName || undefined,
      organizerMobile,
      organizerEmail: form.organizerEmail || undefined,
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
        <div className={cn(ADMIN_FLEX_SCROLL_CLASS, "pr-1")}>
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
                <SportSelect
                  value={form.sport}
                  onValueChange={(v) => setForm((p) => ({ ...p, sport: v }))}
                />
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
                <DatePicker
                  value={form.auctionDate}
                  onChange={auctionDate => setForm(p => ({ ...p, auctionDate }))}
                  placeholder="Select auction date"
                  disablePastDates
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Auction Time
                </Label>
                <Input
                  type="time"
                  value={form.auctionTime}
                  onChange={f("auctionTime")}
                  placeholder="14:00"
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
                <IndianAmountHint value={form.basePurse} />
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
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.organizerMobile}
                  onChange={e => setForm(p => ({ ...p, organizerMobile: sanitizeMobileInput(e.target.value) }))}
                  placeholder="10-digit mobile"
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
        </div>
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

// ─── Tournament Password Row (admin-only eye toggle) ─────────────────────────

function TournamentPasswordRow({ password }: { password: string | null }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs w-24 flex-shrink-0">Password</span>
      {password ? (
        <span className="font-medium text-xs flex items-center gap-1.5">
          <span className="font-mono">{show ? password : "••••••••"}</span>
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">Not set</span>
      )}
    </div>
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
  const [organizers, setOrganizers] = useState<AdminOrganizerRow[]>([]);
  const [linking, setLinking] = useState(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string>("__none__");
  // Cheer settings
  const [cheerEnabled, setCheerEnabled] = useState(true);
  const [cheerPresets, setCheerPresets] = useState<string[]>([]);
  const [cheerCooldownSeconds, setCheerCooldownSeconds] = useState(2);
  const [cheerHeatMeterEnabled, setCheerHeatMeterEnabled] = useState(false);
  const [cheerFanBattleEnabled, setCheerFanBattleEnabled] = useState(false);
  const [savingCheer, setSavingCheer] = useState(false);
  const [cheerExpanded, setCheerExpanded] = useState(false);
  const [licenseReasonOpen, setLicenseReasonOpen] = useState(false);
  const [pendingLicense, setPendingLicense] = useState<{
    label: string;
    status: "trial" | "active" | "completed";
    alsoLock?: boolean;
  } | null>(null);
  const [resetReason, setResetReason] = useState("");
  const [configSaveReason, setConfigSaveReason] = useState("");

  function requestLicenseChange(
    label: string,
    status: "trial" | "active" | "completed",
    alsoLock = false,
  ) {
    setPendingLicense({ label, status, alsoLock });
    setLicenseReasonOpen(true);
  }

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
        auctionTime: d.tournament.auctionTime || "",
        organizerName: d.tournament.organizerName || "",
        organizerMobile: d.tournament.organizerMobile
          ? sanitizeMobileInput(d.tournament.organizerMobile)
          : "",
        organizerEmail: d.tournament.organizerEmail || "",
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
      setCheerCooldownSeconds((d.tournament as { cheerCooldownSeconds?: number }).cheerCooldownSeconds ?? 2);
      setCheerHeatMeterEnabled((d.tournament as { cheerHeatMeterEnabled?: boolean }).cheerHeatMeterEnabled ?? false);
      setCheerFanBattleEnabled((d.tournament as { cheerFanBattleEnabled?: boolean }).cheerFanBattleEnabled ?? false);
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
            cheerCooldownSeconds,
            cheerHeatMeterEnabled,
            cheerFanBattleEnabled,
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
    if (ef.auctionTime !== undefined)
      payload.auctionTime = ef.auctionTime as string;
    if (ef.organizerName !== undefined)
      payload.organizerName = ef.organizerName as string;
    if (ef.organizerMobile !== undefined) {
      const raw = String(ef.organizerMobile).trim();
      if (raw) {
        const mobileResult = parseIndianMobile(raw);
        if (!mobileResult.ok) {
          flash(mobileResult.error, false);
          setSaving(false);
          return;
        }
        payload.organizerMobile = mobileResult.normalized;
      } else {
        payload.organizerMobile = "";
      }
    }
    if (ef.organizerEmail !== undefined)
      payload.organizerEmail = ef.organizerEmail as string;
    if (ef.basePurse) payload.basePurse = Number(ef.basePurse);
    if (ef.minBid) payload.minBid = Number(ef.minBid);
    if (ef.timerSeconds) payload.timerSeconds = Number(ef.timerSeconds);
    if (ef.bidTimerSeconds)
      payload.bidTimerSeconds = Number(ef.bidTimerSeconds);
    if (ef.playerSelectionMode)
      payload.playerSelectionMode = ef.playerSelectionMode as string;
    if (payloadHasTournamentConfigFields(payload) && !isAuditReasonValid(configSaveReason)) {
      flash("Auction configuration changes require a reason (minimum 10 characters).", false);
      setSaving(false);
      return;
    }
    if (payloadHasTournamentConfigFields(payload)) {
      payload.reason = configSaveReason.trim();
    }
    const r = await updateAdminTournament(
      tournamentId,
      payload as Parameters<typeof updateAdminTournament>[1],
    );
    setSaving(false);
    if (r.success) {
      flash("Saved successfully");
      setEditing(false);
      setConfigSaveReason("");
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
    <div className="flex-1 flex flex-col border-l border-border/40 bg-card/30 min-w-0 min-h-0">
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
        {/* Re-open escape hatch — only shown when tournament is locked */}
        {isLocked && (
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
            Re-open Auction
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
              disabled={saving || !isAuditReasonValid(configSaveReason)}
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
              onClick={() => { setEditing(false); setConfigSaveReason(""); }}
            >
              Cancel
            </Button>
          </>
        )}
        {/* Local Mode toggle (master admin only) */}
        {isMaster && (
          <Button
            size="sm"
            variant="outline"
            className={`h-7 gap-1.5 text-xs ${t.localModeEnabled
              ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              : "border-border text-muted-foreground hover:bg-accent"}`}
            disabled={actionLoading === "Toggle Local Mode"}
            onClick={() =>
              doAction("Toggle Local Mode", () =>
                updateAdminTournament(tournamentId, { localModeEnabled: !t.localModeEnabled }),
              )
            }
            title={t.localModeEnabled ? "Click to disable Local Mode" : "Click to enable Local Mode"}
          >
            {actionLoading === "Toggle Local Mode"
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <MonitorDown className="w-3 h-3" />}
            Local Mode: {t.localModeEnabled ? "ON" : "OFF"}
          </Button>
        )}
        {(t.sport === "cricket" || t.sport === "badminton") && (
          <Button
            size="sm"
            variant="outline"
            className={`h-7 gap-1.5 text-xs ${t.scoringEnabled
              ? "border-primary/40 text-primary hover:bg-primary/10"
              : "border-border text-muted-foreground hover:bg-accent"}`}
            disabled={actionLoading === "Toggle Match Scoring"}
            onClick={() =>
              doAction("Toggle Match Scoring", () =>
                updateAdminTournament(tournamentId, { scoringEnabled: !t.scoringEnabled }),
              )
            }
            title={t.scoringEnabled ? "Disable match scoring for this tournament" : "Enable match scoring for this tournament"}
          >
            {actionLoading === "Toggle Match Scoring"
              ? <RefreshCw className="w-3 h-3 animate-spin" />
              : <CircleDot className="w-3 h-3" />}
            Match Scoring: {t.scoringEnabled ? "ON" : "OFF"}
          </Button>
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

        <div className={cn(ADMIN_FLEX_SCROLL_CLASS, "px-4 pb-4")}>
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
                    <SportSelect
                      value={(editForm.sport as string) || "cricket"}
                      currentSlug={data?.tournament.sport}
                      onValueChange={(v) =>
                        setEditForm((f) => ({ ...f, sport: v }))
                      }
                      triggerClassName="h-8 text-sm"
                    />
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
                    <DatePicker
                      className="h-8 text-sm"
                      value={(editForm.auctionDate as string) || ""}
                      onChange={auctionDate =>
                        setEditForm(f => ({ ...f, auctionDate }))
                      }
                      placeholder="Select auction date"
                      disablePastDates
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Auction Time
                    </Label>
                    <Input
                      type="time"
                      className="h-8 text-sm"
                      value={(editForm.auctionTime as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          auctionTime: e.target.value,
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
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      value={(editForm.organizerMobile as string) || ""}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          organizerMobile: sanitizeMobileInput(e.target.value),
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
                    <IndianAmountHint value={editForm.basePurse as string | number} className="text-[10px]" />
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
                    <IndianAmountHint value={editForm.minBid as string | number} className="text-[10px]" />
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
                <AuditReasonField
                  value={configSaveReason}
                  onChange={setConfigSaveReason}
                  label="Reason for auction config changes (required)"
                  placeholder="Explain why purse, timers, or selection rules are being changed…"
                />
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

                <LicenseModeControl
                  licenseStatus={t.licenseStatus}
                  isMaster={isMaster}
                  actionLoading={actionLoading}
                  onSwitchToTrial={() => requestLicenseChange("Switch to Trial", "trial")}
                  onSwitchToLive={() => requestLicenseChange("Switch to Live", "active")}
                  onEndAuction={() => {
                    if (!window.confirm("This will end the auction and prevent further bidding. Continue?")) return;
                    requestLicenseChange("End auction", "completed", true);
                  }}
                />

                <div className="rounded-lg border border-border/50 bg-muted/10 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Lock status
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    {isLocked ? (
                      <LockBadge locked />
                    ) : (
                      <Badge className="text-[10px] bg-muted/20 text-muted-foreground">
                        Unlocked
                      </Badge>
                    )}
                    {t.licenseGrantedAt && (
                      <span className="text-xs text-muted-foreground">
                        Licence granted {new Date(t.licenseGrantedAt).toLocaleDateString("en-IN")}
                      </span>
                    )}
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
                    <TournamentPasswordRow password={t.organizerPassword} />
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
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={handleLinkOrganizer}
                      disabled={linking}
                    >
                      {linking ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserCheck className="w-3 h-3" />
                      )}
                      {selectedLinkId === "__none__" ? "Unlink" : "Reassign"}
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

                    {/* Cooldown */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Cheer cooldown</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Seconds between cheers from the same viewer
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          className="w-6 h-6 rounded bg-muted/40 hover:bg-muted/70 text-sm font-bold transition-colors flex items-center justify-center"
                          onClick={() => setCheerCooldownSeconds((v) => Math.max(1, v - 1))}
                        >
                          -
                        </button>
                        <span className="text-sm font-bold tabular-nums w-6 text-center">{cheerCooldownSeconds}</span>
                        <button
                          className="w-6 h-6 rounded bg-muted/40 hover:bg-muted/70 text-sm font-bold transition-colors flex items-center justify-center"
                          onClick={() => setCheerCooldownSeconds((v) => Math.min(60, v + 1))}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Heat meter toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Heat Meter</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Show crowd heat level badge on the feed rail
                        </p>
                      </div>
                      <button
                        onClick={() => setCheerHeatMeterEnabled((v) => !v)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                          cheerHeatMeterEnabled ? "bg-amber-500" : "bg-muted/50"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                            cheerHeatMeterEnabled ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>

                    {/* Fan battle toggle */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium">Fan Battle Counter</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Show per-team cheer count bars on the feed rail
                        </p>
                      </div>
                      <button
                        onClick={() => setCheerFanBattleEnabled((v) => !v)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                          cheerFanBattleEnabled ? "bg-amber-500" : "bg-muted/50"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                            cheerFanBattleEnabled ? "translate-x-4" : "translate-x-0.5"
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
        </div>
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
                    <li>All bid records and live bid feed history for this tournament</li>
                    <li>All AI intelligence data (replay, behavior, demand, and briefing reports)</li>
                    <li>All purse usage for every team (back to full purse)</li>
                    <li>All active purse boosters (teams return to original purse capacity)</li>
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
                <AuditReasonField
                  value={resetReason}
                  onChange={setResetReason}
                  placeholder="Explain why auction data is being reset…"
                />
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
                  disabled={resetting || !resetPassword.trim() || !isAuditReasonValid(resetReason)}
                  onClick={async () => {
                    setResetting(true);
                    setResetError(null);
                    const r = await resetTournamentAsAdmin(
                      tournamentId,
                      resetPassword,
                      resetReason.trim(),
                    );
                    setResetting(false);
                    if (r.success) {
                      setConfirmReset(false);
                      setResetPassword("");
                      setResetReason("");
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

      <AuditReasonDialog
        open={licenseReasonOpen}
        onOpenChange={(open) => {
          setLicenseReasonOpen(open);
          if (!open) setPendingLicense(null);
        }}
        title={pendingLicense?.label ?? "Change licence mode"}
        description="Licence changes are recorded in the audit log and require a reason."
        confirmLabel={pendingLicense?.label ?? "Confirm"}
        loading={!!actionLoading}
        onConfirm={async (reason) => {
          if (!pendingLicense) return;
          setActionLoading(pendingLicense.label);
          const r1 = await setTournamentLicenseStatus(tournamentId, pendingLicense.status, reason);
          if (!r1.success) {
            setActionLoading(null);
            flash(r1.error || `${pendingLicense.label} failed`, false);
            return;
          }
          if (pendingLicense.alsoLock) {
            const r2 = await lockTournament(tournamentId);
            if (!r2.success) flash("Marked completed but lock failed — please retry", false);
            else flash("Auction ended");
          } else {
            flash(`${pendingLicense.label} done`);
          }
          setActionLoading(null);
          setLicenseReasonOpen(false);
          setPendingLicense(null);
          await load();
          onRefresh();
        }}
      />
    </div>
  );
}

// ─── Organizers Panel ─────────────────────────────────────────────────────────

function OrganizerLicenseBadge({ status }: { status: string }) {
  const locked = status === "suspended";
  return (
    <Badge
      className={`text-[10px] ${locked ? "bg-red-500/15 text-red-400 border-red-500/30" : "bg-green-500/15 text-green-400 border-green-500/30"}`}
    >
      {locked ? "Locked" : "Active"}
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
    mobile: org.mobile && !org.mobile.startsWith("eml:") && !org.mobile.startsWith("gid_")
      ? sanitizeMobileInput(org.mobile)
      : "",
    notes: org.notes || "",
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
      notes: form.notes || undefined,
    };
    if (form.mobile?.trim()) {
      const mobileResult = parseIndianMobile(form.mobile);
      if (!mobileResult.ok) {
        flash(mobileResult.error, false);
        setSaving(false);
        return;
      }
      payload.mobile = mobileResult.normalized;
    }
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

      <div className={cn(ADMIN_FLEX_SCROLL_CLASS, "px-4 pb-4")}>
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
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.mobile ?? ""}
                    onChange={e => setForm(p => ({ ...p, mobile: sanitizeMobileInput(e.target.value) }))}
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
      </div>

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

export { SportsPanel } from "@/components/admin/sports-panel";

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
        <div className={ADMIN_FLEX_SCROLL_CLASS}>
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
        </div>
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

// ─── SMS Notification Settings Panel ─────────────────────────────────────────

type SmsSettings = {
  dltEnabled: boolean;
  teamOwnerEnabled: boolean;
  teamOwnerTemplateId: string | null;
  teamOwnerTemplateIdFromEnv: string | null;
  playerSoldEnabled: boolean;
  playerSoldTemplateId: string | null;
  playerSoldTemplateIdFromEnv: string | null;
  viewerLinkEnabled: boolean;
  viewerLinkTemplateId: string | null;
  viewerLinkTemplateIdFromEnv: string | null;
};

export function SmsSettingsPanel() {
  const [settings, setSettings] = useState<SmsSettings>({
    dltEnabled: false,
    teamOwnerEnabled: false,
    teamOwnerTemplateId: null,
    teamOwnerTemplateIdFromEnv: null,
    playerSoldEnabled: false,
    playerSoldTemplateId: null,
    playerSoldTemplateIdFromEnv: null,
    viewerLinkEnabled: false,
    viewerLinkTemplateId: null,
    viewerLinkTemplateIdFromEnv: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/admin/sms-settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d: SmsSettings) => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const r = await fetch("/api/auth/admin/sms-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!r.ok) { const d = await r.json() as { error?: string }; throw new Error(d.error ?? "Save failed"); }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading SMS settings...</div>;
  }

  const master = settings.dltEnabled;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-sm mb-0.5">SMS Notifications</h3>
        <p className="text-xs text-muted-foreground">DLT-registered Fast2SMS templates for event notifications. All off by default.</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <div>
          <p className="text-sm font-medium">DLT SMS Master Switch</p>
          <p className="text-xs text-muted-foreground">Enable to allow any DLT SMS to be sent</p>
        </div>
        <Switch
          checked={master}
          onCheckedChange={(v) => setSettings((s) => ({ ...s, dltEnabled: v }))}
        />
      </div>

      {(["teamOwner", "playerSold", "viewerLink"] as const).map((key) => {
        const labels: Record<typeof key, { title: string; desc: string }> = {
          teamOwner: { title: "Team Owner Access Code", desc: "Sent when a team is created with an owner mobile" },
          playerSold: { title: "Player Sold", desc: "Sent to player when marked SOLD in auction" },
          viewerLink: { title: "Viewer Link", desc: "Sent to organizer when they share the live viewer URL" },
        };
        const enabledKey = `${key}Enabled` as "teamOwnerEnabled" | "playerSoldEnabled" | "viewerLinkEnabled";
        const templateKey = `${key}TemplateId` as "teamOwnerTemplateId" | "playerSoldTemplateId" | "viewerLinkTemplateId";
        const envKey = `${key}TemplateIdFromEnv` as "teamOwnerTemplateIdFromEnv" | "playerSoldTemplateIdFromEnv" | "viewerLinkTemplateIdFromEnv";
        const envVal = settings[envKey];
        return (
          <div key={key} className="rounded-lg border border-border/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{labels[key].title}</p>
                <p className="text-xs text-muted-foreground">{labels[key].desc}</p>
              </div>
              <Switch
                checked={settings[enabledKey]}
                disabled={!master}
                onCheckedChange={(v) => setSettings((s) => ({ ...s, [enabledKey]: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">DLT Template ID</Label>
              {envVal ? (
                <div className="flex items-center gap-2">
                  <Input value={envVal} readOnly className="text-sm h-8 font-mono bg-muted/50 cursor-default" />
                  <span className="text-xs text-emerald-500 whitespace-nowrap shrink-0">env var</span>
                </div>
              ) : (
                <Input
                  value={settings[templateKey] ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, [templateKey]: e.target.value || null }))}
                  placeholder="e.g. 215964"
                  disabled={!master || !settings[enabledKey]}
                  className="text-sm h-8"
                />
              )}
            </div>
          </div>
        );
      })}

      {error && <p className="text-destructive text-xs">{error}</p>}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> : null}
        {saved ? "Saved" : "Save SMS Settings"}
      </Button>
    </div>
  );
}

// ─── Installer Settings Panel ────────────────────────────────────────────────

export function InstallerSettingsPanel() {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [releasedAt, setReleasedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/installer-url")
      .then((r) => r.json())
      .then((d: { url?: string | null; version?: string | null; releasedAt?: string | null }) => {
        setUrl(d.url ?? "");
        setVersion(d.version ?? "");
        setReleasedAt(d.releasedAt ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin/settings/installer-url", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || null,
          version: version.trim() || null,
          releasedAt: releasedAt.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? "Save failed");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-lg space-y-6">
        <div>
          <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <MonitorDown className="w-5 h-5 text-amber-400" />
            BidWar Local — Installer Download
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Set the public download URL and version shown to organizers on the Local Mode setup page.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Download URL
              </Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/your-org/bidwar-local/releases/download/v1.0.0/BidWarLocal-Setup.exe"
                className="text-sm font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Paste the direct link to the Windows installer (.exe). Organizers will see a Download button on their Local Mode page.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Version
                </Label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Release Date
                </Label>
                <Input
                  value={releasedAt}
                  onChange={(e) => setReleasedAt(e.target.value)}
                  placeholder="2026-05-19"
                  className="text-sm"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : saved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                {saving ? "Saving..." : saved ? "Saved" : "Save"}
              </Button>
              {saved && (
                <span className="text-xs text-green-400">Changes saved successfully.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Build Trigger Panel ─────────────────────────────────────────────────────

interface BuildStatus {
  configured: boolean;
  hasRuns?: boolean;
  error?: string;
  id?: number;
  status?: string;
  conclusion?: string | null;
  url?: string;
  createdAt?: string;
  title?: string;
  actionsUrl?: string;
}

interface GithubConfig {
  owner: string | null;
  repo: string | null;
  workflowFile: string | null;
}

function buildStatusBadge(status: BuildStatus) {
  if (!status.hasRuns) return null;
  const s = status.status;
  const c = status.conclusion;
  if (s === "completed") {
    if (c === "success") {
      return (
        <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1 text-xs">
          <CircleCheck className="w-3 h-3" /> Build passed
        </Badge>
      );
    }
    if (c === "failure") {
      return (
        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 text-xs">
          <XCircle className="w-3 h-3" /> Build failed
        </Badge>
      );
    }
    return (
      <Badge className="bg-muted text-muted-foreground gap-1 text-xs">
        {c ?? "completed"}
      </Badge>
    );
  }
  if (s === "in_progress") {
    return (
      <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-xs">
        <RefreshCw className="w-3 h-3 animate-spin" /> Building...
      </Badge>
    );
  }
  if (s === "queued" || s === "waiting") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 gap-1 text-xs">
        <RefreshCw className="w-3 h-3" /> Queued
      </Badge>
    );
  }
  return <Badge className="bg-muted text-muted-foreground text-xs">{s}</Badge>;
}

export function BuildTriggerPanel() {
  const [config, setConfig] = useState<GithubConfig>({ owner: "", repo: "", workflowFile: "build-electron.yml" });
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const [version, setVersion] = useState("1.0.0");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [buildStatus, setBuildStatus] = useState<BuildStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  async function loadConfig() {
    const r = await fetch("/api/auth/admin/builds/github-config");
    if (r.ok) {
      const d = await r.json() as GithubConfig;
      setConfig({ owner: d.owner ?? "", repo: d.repo ?? "", workflowFile: d.workflowFile ?? "build-electron.yml" });
    }
    setConfigLoading(false);
  }

  async function fetchStatus() {
    setStatusLoading(true);
    const r = await fetch("/api/auth/admin/builds/status");
    if (r.ok) setBuildStatus(await r.json() as BuildStatus);
    setStatusLoading(false);
  }

  useEffect(() => {
    loadConfig();
    void fetchStatus();
  }, []);

  useEffect(() => {
    if (buildStatus?.status === "in_progress" || buildStatus?.status === "queued") {
      const t = setInterval(() => void fetchStatus(), 15000);
      return () => clearInterval(t);
    }
    return undefined;
  }, [buildStatus?.status]);

  async function saveConfig() {
    setConfigSaving(true);
    setConfigSaved(false);
    setConfigError(null);
    const r = await fetch("/api/auth/admin/builds/github-config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: config.owner?.trim() || null,
        repo: config.repo?.trim() || null,
        workflowFile: config.workflowFile?.trim() || null,
      }),
    });
    if (r.ok) {
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } else {
      const d = await r.json().catch(() => ({})) as { error?: string };
      setConfigError(d.error ?? "Save failed");
    }
    setConfigSaving(false);
  }

  async function triggerBuild() {
    setTriggering(true);
    setTriggerMsg(null);
    const r = await fetch("/api/auth/admin/builds/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: version.trim() }),
    });
    if (r.ok) {
      const d = await r.json() as { ok: boolean; version: string; actionsUrl: string };
      setTriggerMsg({ text: `Build triggered for v${d.version}. Check GitHub Actions for progress.`, ok: true });
      setTimeout(() => void fetchStatus(), 4000);
    } else {
      const d = await r.json().catch(() => ({})) as { error?: string };
      setTriggerMsg({ text: d.error ?? "Trigger failed", ok: false });
    }
    setTriggering(false);
  }

  return (
    <div className="flex-1 overflow-auto p-6 border-t border-border/40">
      <div className="max-w-lg space-y-6">
        <div>
          <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <Hammer className="w-5 h-5 text-blue-400" />
            Windows Build Pipeline
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Trigger the GitHub Actions workflow that builds and uploads the BidWar Local Windows installer.
          </p>
        </div>

        {/* GitHub Config */}
        <div className="space-y-4 rounded-xl border border-border/50 bg-muted/10 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5" /> GitHub Repository
          </p>

          {configLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Owner / Org</Label>
                  <Input
                    value={config.owner ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, owner: e.target.value }))}
                    placeholder="your-org"
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Repository</Label>
                  <Input
                    value={config.repo ?? ""}
                    onChange={(e) => setConfig((c) => ({ ...c, repo: e.target.value }))}
                    placeholder="bidwar-app"
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Workflow File</Label>
                <Input
                  value={config.workflowFile ?? ""}
                  onChange={(e) => setConfig((c) => ({ ...c, workflowFile: e.target.value }))}
                  placeholder="build-electron.yml"
                  className="h-8 text-sm font-mono"
                />
              </div>

              {configError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {configError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={saveConfig} disabled={configSaving}>
                  {configSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  {configSaving ? "Saving..." : configSaved ? "Saved" : "Save Config"}
                </Button>
                {configSaved && <span className="text-xs text-green-400">Saved.</span>}
              </div>
            </div>
          )}
        </div>

        {/* Trigger Build */}
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Hammer className="w-3.5 h-3.5" /> Trigger a Build
          </p>
          <div className="flex items-center gap-3">
            <div className="space-y-1 w-32">
              <Label className="text-xs text-muted-foreground">Version</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="pt-5">
              <Button
                size="sm"
                className="gap-1.5 h-8 bg-blue-600 hover:bg-blue-500 text-white"
                onClick={triggerBuild}
                disabled={triggering || !config.owner || !config.repo}
              >
                {triggering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Hammer className="w-3.5 h-3.5" />}
                {triggering ? "Triggering..." : "Build Windows Installer"}
              </Button>
            </div>
          </div>
          {!config.owner && !configLoading && (
            <p className="text-xs text-muted-foreground">Set the GitHub owner and repo above before triggering a build.</p>
          )}
          {triggerMsg && (
            <p className={`text-xs flex items-center gap-1.5 ${triggerMsg.ok ? "text-green-400" : "text-destructive"}`}>
              {triggerMsg.ok ? <CircleCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {triggerMsg.text}
            </p>
          )}
        </div>

        {/* Build Status */}
        {buildStatus !== null && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Latest Build
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => void fetchStatus()}
                title="Refresh status"
              >
                <RefreshCw className={`w-3 h-3 ${statusLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {!buildStatus.configured && (
              <p className="text-xs text-muted-foreground">Configure GitHub owner and repo to see build status.</p>
            )}
            {buildStatus.configured && !buildStatus.hasRuns && !buildStatus.error && (
              <p className="text-xs text-muted-foreground">No builds yet. Trigger one above.</p>
            )}
            {buildStatus.error && (
              <p className="text-xs text-destructive">{buildStatus.error}</p>
            )}
            {buildStatus.hasRuns && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {buildStatusBadge(buildStatus)}
                  {buildStatus.title && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">{buildStatus.title}</span>
                  )}
                </div>
                {buildStatus.createdAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Started {new Date(buildStatus.createdAt).toLocaleString()}
                  </p>
                )}
                {buildStatus.url && (
                  <a
                    href={buildStatus.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" /> View on GitHub Actions
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

// ─── Display Auction Form Modal ───────────────────────────────────────────────

function DisplayAuctionForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: DisplayAuction | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    sport: initial?.sport ?? "cricket",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    purse: String(initial?.purse ?? 1000000),
    playersPerTeam: String(initial?.playersPerTeam ?? 11),
    teamsCount: String(initial?.teamsCount ?? 8),
    scheduledDate: initial?.scheduledDate ?? "",
    scheduledTime: initial?.scheduledTime ?? "18:00",
    primaryColor: initial?.primaryColor ?? "#1a3a6b",
    accentColor: initial?.accentColor ?? "#f5c842",
    status: initial?.status ?? "upcoming",
    showOnLanding: initial?.showOnLanding ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const f = (key: string, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    const payload = {
      ...form,
      purse: Number(form.purse),
      playersPerTeam: Number(form.playersPerTeam),
      teamsCount: Number(form.teamsCount),
    };
    const result = initial
      ? await updateDisplayAuction(initial.id, payload)
      : await createDisplayAuction(payload);
    setSaving(false);
    if (!result) { setError("Failed to save. Please try again."); return; }
    await onSaved();
  }

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl dark max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Display Auction" : "Add Display Auction"}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-y-auto overscroll-y-contain pr-2">
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tournament Name *</Label>
                <Input className="h-8 text-xs" value={form.name} onChange={e => f("name", e.target.value)} placeholder="Lucknow Premier League Season 4" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Short Code</Label>
                <Input className="h-8 text-xs font-mono" value={form.code} onChange={e => f("code", e.target.value.toUpperCase())} placeholder="LPL" maxLength={6} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sport</Label>
                <SportSelect
                  value={form.sport}
                  currentSlug={initial?.sport}
                  onValueChange={(v) => f("sport", v)}
                  triggerClassName="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <CityAutocomplete
                  value={form.city}
                  onChange={v => f("city", v)}
                  placeholder="Lucknow"
                  className="h-8 text-xs"
                  showHint={false}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">State</Label>
                <Input className="h-8 text-xs" value={form.state} onChange={e => f("state", e.target.value)} placeholder="Uttar Pradesh" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" className="h-8 text-xs" value={form.scheduledDate} onChange={e => f("scheduledDate", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Time (IST)</Label>
                <Input type="time" className="h-8 text-xs" value={form.scheduledTime} onChange={e => f("scheduledTime", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => f("status", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Team Purse (₹ in rupees)</Label>
                <Input type="number" className="h-8 text-xs" value={form.purse} onChange={e => f("purse", e.target.value)} placeholder="3000000" />
                <IndianAmountHint value={form.purse} className="text-[10px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Number of Teams</Label>
                <Input type="number" className="h-8 text-xs" value={form.teamsCount} onChange={e => f("teamsCount", e.target.value)} placeholder="8" min={2} max={32} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Players per Team</Label>
                <Input type="number" className="h-8 text-xs" value={form.playersPerTeam} onChange={e => f("playersPerTeam", e.target.value)} placeholder="11" min={1} max={30} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Primary Color (card background)</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.primaryColor} onChange={e => f("primaryColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <Input className="h-8 text-xs font-mono flex-1" value={form.primaryColor} onChange={e => f("primaryColor", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Accent Color (badges, text)</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.accentColor} onChange={e => f("accentColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                  <Input className="h-8 text-xs font-mono flex-1" value={form.accentColor} onChange={e => f("accentColor", e.target.value)} />
                </div>
              </div>
            </div>

            {/* Live preview chip */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/5">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs text-white flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${form.primaryColor}, ${form.accentColor}55)`,
                  border: `1px solid ${form.accentColor}66`,
                }}
              >
                {(form.code || form.name).slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white truncate">{form.name || "Tournament Name"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {form.city}{form.state ? `, ${form.state}` : ""} · {form.sport}
                </div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground flex-shrink-0">
                <div className="font-semibold text-white/80">{purseLabel}</div>
                <div>{form.teamsCount} Teams · {form.playersPerTeam} Players</div>
              </div>
            </div>

            {/* Show on landing toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/5">
              <div>
                <div className="text-xs font-medium text-white flex items-center gap-1.5">
                  {form.showOnLanding ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                  Show on Landing Page
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Appears in Upcoming Auctions strip and /upcoming-auctions page</div>
              </div>
              <Switch checked={form.showOnLanding} onCheckedChange={v => f("showOnLanding", v)} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : initial ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Display Auctions Panel ───────────────────────────────────────────────────

export function DisplayAuctionsPanel() {
  const [items, setItems] = useState<DisplayAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<DisplayAuction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const data = await listAdminDisplayAuctions();
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    const result = await seedDisplayAuctions();
    if (result) {
      setSeedMsg(`Seeded ${result.seeded} entries (${result.static} dummy + ${result.real} from real tournaments)`);
      await load();
    } else {
      setSeedMsg("Seed failed");
    }
    setSeeding(false);
  }

  async function handleToggleStatus(item: DisplayAuction) {
    const newStatus = item.status === "upcoming" ? "completed" : "upcoming";
    await updateDisplayAuction(item.id, { status: newStatus });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
  }

  async function handleToggleShow(item: DisplayAuction, v: boolean) {
    await updateDisplayAuction(item.id, { showOnLanding: v });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, showOnLanding: v } : i));
  }

  async function handleDelete(id: number) {
    await deleteDisplayAuction(id);
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleteId(null);
  }

  const purseLabel = (p: number) => p >= 10000000
    ? `₹${(p / 10000000).toFixed(1)}Cr`
    : p >= 100000
    ? `₹${(p / 100000).toFixed(0)}L`
    : `₹${p.toLocaleString("en-IN")}`;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Header bar */}
      <div className="flex items-start justify-between px-6 py-4 border-b border-border/40 flex-shrink-0">
        <div>
          <h2 className="font-display font-black text-base text-white flex items-center gap-2">
            <Tv className="w-4 h-4 text-primary" /> Upcoming Auctions Display
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage what appears in the "Upcoming Auctions" strip on the landing page and /upcoming-auctions. Toggle "Show" per entry.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {seedMsg && (
            <span className="text-xs text-green-400 max-w-xs text-right hidden md:block">{seedMsg}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Seed / Sync
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Entry
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {seedMsg && (
          <p className="text-xs text-green-400 mb-3 md:hidden">{seedMsg}</p>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Tv className="w-7 h-7 text-primary/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">No display auctions yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Seed / Sync" to populate with dummy data + real tournaments, or add entries manually.</p>
            </div>
            <Button size="sm" variant="outline" onClick={handleSeed} disabled={seeding} className="gap-1.5">
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Seed with Default Data
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-muted/5">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tournament</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">Sport</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Location</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground">
                    <Calendar className="w-3 h-3 inline mr-1" />Date / Time
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Purse</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Teams</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Players</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-3 py-2.5 font-medium text-muted-foreground">
                    <Eye className="w-3 h-3 inline mr-1" />Show
                  </th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/5 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: item.accentColor }}
                        />
                        <div>
                          <div className="font-medium text-white leading-tight">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{item.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 capitalize text-white/70">{item.sport}</td>
                    <td className="px-3 py-3 text-white/70 hidden md:table-cell">
                      <div>{item.city}</div>
                      {item.state && <div className="text-[10px] text-muted-foreground">{item.state}</div>}
                    </td>
                    <td className="px-3 py-3 text-white/70">
                      <div>{item.scheduledDate || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{item.scheduledTime} IST</div>
                    </td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell">
                      <span className="font-semibold text-white/80">{purseLabel(item.purse)}</span>
                      <div className="text-[10px] text-muted-foreground">per team</div>
                    </td>
                    <td className="px-3 py-3 text-center text-white/70 hidden lg:table-cell">{item.teamsCount}</td>
                    <td className="px-3 py-3 text-center text-white/70 hidden lg:table-cell">{item.playersPerTeam}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                          item.status === "upcoming"
                            ? "bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20"
                            : "bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20"
                        }`}
                      >
                        {item.status === "upcoming" ? "Upcoming" : "Completed"}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Switch
                        checked={item.showOnLanding}
                        onCheckedChange={v => handleToggleShow(item, v)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditItem(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {(addOpen || editItem !== null) && (
        <DisplayAuctionForm
          initial={editItem}
          onClose={() => { setAddOpen(false); setEditItem(null); }}
          onSaved={async () => { setAddOpen(false); setEditItem(null); await load(); }}
        />
      )}

      {/* Delete confirm */}
      <Dialog open={deleteId !== null} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle>Remove Display Entry</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the auction from the upcoming auctions display. The actual tournament (if any) is not affected. Cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId !== null && handleDelete(deleteId)}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Showcase Events Panel ───────────────────────────────────────────────────

interface ShowcaseEventRow {
  id: number;
  imageUrl: string;
  sportName: string;
  tournamentName: string;
  description?: string | null;
  altText?: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function ShowcasePanel() {
  const [events, setEvents] = useState<ShowcaseEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<ShowcaseEventRow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePublicId, setImagePublicId] = useState("");
  const [sportName, setSportName] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [active, setActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/auth/admin/showcase-events", { credentials: "include" });
    if (r.ok) setEvents(await r.json());
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openAdd() {
    setEditItem(null);
    setImageUrl(""); setImagePublicId(""); setSportName(""); setTournamentName(""); setDescription(""); setAltText(""); setActive(true);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(item: ShowcaseEventRow) {
    setEditItem(item);
    setImageUrl(item.imageUrl); setImagePublicId(""); setSportName(item.sportName); setTournamentName(item.tournamentName);
    setDescription(item.description ?? ""); setAltText(item.altText ?? ""); setActive(item.active);
    setError(null);
    setFormOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
    const d = await r.json() as { url?: string; publicId?: string };
    if (r.ok && d.url) {
      setImageUrl(d.url);
      setImagePublicId(d.publicId ?? "");
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const body = {
      imageUrl,
      imagePublicId: imagePublicId || null,
      sportName,
      tournamentName,
      description: description.trim() || undefined,
      altText: altText.trim() || undefined,
      active,
    };
    const url = editItem
      ? `/api/auth/admin/showcase-events/${editItem.id}`
      : "/api/auth/admin/showcase-events";
    const method = editItem ? "PATCH" : "POST";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (r.ok) {
      setFormOpen(false);
      void load();
    } else {
      const d = await r.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    await fetch(`/api/auth/admin/showcase-events/${id}`, { method: "DELETE", credentials: "include" });
    setDeleting(null);
    void load();
  }

  async function handleToggleActive(item: ShowcaseEventRow) {
    await fetch(`/api/auth/admin/showcase-events/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !item.active }),
      credentials: "include",
    });
    void load();
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= events.length) return;
    const ids = events.map((e) => e.id);
    const tmp = ids[target];
    ids[target] = ids[index];
    ids[index] = tmp;
    await fetch("/api/auth/admin/showcase-events/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
      credentials: "include",
    });
    void load();
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Images className="w-5 h-5 text-primary" />
              Events Powered by BidWar
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Manage showcase cards on the public landing page. When more than 6 active cards exist, the page shows an auto-sliding carousel.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 flex-shrink-0" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" /> Add Event
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/40 rounded-2xl">
            <Images className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No events yet. Add your first showcase event.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((ev, i) => (
              <motion.div
                key={ev.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/50 group"
              >
                <img
                  src={ev.imageUrl}
                  alt={ev.altText ?? ev.tournamentName}
                  className="w-16 h-12 rounded-lg object-cover flex-shrink-0 border border-border/30"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{ev.sportName}</span>
                    {!ev.active && (
                      <Badge variant="outline" className="text-[9px] text-muted-foreground h-4 px-1">Hidden</Badge>
                    )}
                  </div>
                  <p className="font-semibold text-sm text-white truncate">{ev.tournamentName}</p>
                  {ev.description && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{ev.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    disabled={i === 0}
                    onClick={() => void handleMove(i, -1)}
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    disabled={i === events.length - 1}
                    onClick={() => void handleMove(i, 1)}
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => void handleToggleActive(ev)}
                    title={ev.active ? "Hide from landing page" : "Show on landing page"}
                  >
                    {ev.active
                      ? <Eye className="w-3.5 h-3.5 text-green-400" />
                      : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0"
                    onClick={() => openEdit(ev)}
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => void handleDelete(ev.id)}
                    disabled={deleting === ev.id}
                    title="Delete"
                  >
                    {deleting === ev.id
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {events.filter((e) => e.active).length} active
            {events.filter((e) => e.active).length > 6 && " — carousel enabled on landing page"}
          </p>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Showcase Event" : "Add Showcase Event"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Event Photo</Label>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-36 object-cover rounded-lg border border-border/30"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) await handleUpload(f);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 pointer-events-none"
                    disabled={uploading}
                    type="button"
                  >
                    {uploading
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <Plus className="w-3.5 h-3.5" />}
                    {imageUrl ? "Replace Photo" : "Upload Photo"}
                  </Button>
                </label>
                {imageUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setImageUrl("")}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Upload a photo (JPEG, PNG, WebP — max 15 MB)</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Sport</Label>
                <Input
                  value={sportName}
                  onChange={(e) => setSportName(e.target.value)}
                  placeholder="Cricket"
                  className="text-sm"
                  maxLength={60}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Visibility</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch checked={active} onCheckedChange={setActive} />
                  <span className="text-sm text-muted-foreground">{active ? "Visible" : "Hidden"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tournament Name</Label>
              <Input
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                placeholder="Mumbai Premier League 2025"
                className="text-sm"
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="16-team franchise auction, 200+ players"
                className="text-sm"
                maxLength={300}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">SEO Alt Text (optional)</Label>
              <Input
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Cricket franchise auction event photo"
                className="text-sm"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground">
                Shown to screen readers and search engines. Auto-generated from sport + tournament name if left blank.
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void handleSave()}
              disabled={saving || !imageUrl || !sportName || !tournamentName}
              className="gap-1.5"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? "Saving..." : "Save Event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const [lockMinutes, setLockMinutes] = useState(10);
  const [warningSeconds, setWarningSeconds] = useState(90);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/auth/admin/settings/session-lock", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { lockMinutes?: number; warningSeconds?: number }) => {
        if (typeof d.lockMinutes === "number" && d.lockMinutes >= 10) {
          setLockMinutes(d.lockMinutes);
        }
        if (typeof d.warningSeconds === "number" && d.warningSeconds > 0) {
          setWarningSeconds(d.warningSeconds);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
  } = useInactivityLock({
    enabled: isLoggedIn,
    timeoutMs: lockMinutes * 60 * 1000,
    warningMs: warningSeconds * 1000,
  });
  const { logos, brandName, miniBrandText } = useBranding();
  const sidebarPreset = getBrandSurfacePreset("sidebar-compact");
  const headerLogoSrc = getBrandLogoSrc(logos, sidebarPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!locked) return;
    void (async () => {
      await logout();
      navigate("/admin/login");
    })();
  }, [locked, logout, navigate]);
  const path = typeof window !== "undefined" ? window.location.pathname : location;
  const routeInitialTab = path.includes("/admin/organisers")
    ? "organizers"
    : path.includes("/admin/tournaments/sports")
      ? "sports"
      : path.includes("/admin/settings/system/upcoming-display")
        ? "display-auctions"
        : path.includes("/admin/settings/system/showcase")
          ? "showcase"
          : path.includes("/admin/settings/system")
            ? "settings"
            : "tournaments";
  const [adminTab, setAdminTab] = useState<"tournaments" | "organizers" | "sports" | "settings" | "display-auctions" | "showcase">(
    routeInitialTab,
  );

  useEffect(() => {
    setAdminTab(routeInitialTab);
    const tournamentMatch = path.match(/\/admin\/tournaments\/(\d+)/);
    if (tournamentMatch) setSelectedId(Number(tournamentMatch[1]));
    if (path === "/admin/tournaments/new") setCreateOpen(true);
  }, [path, routeInitialTab]);

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
            {/* BidWar brand mark */}
            {headerLogoSrc ? (
              <img src={headerLogoSrc} alt={logoAlt} className={sidebarPreset.sizeClass} />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center font-display font-black text-sm text-primary">
                {miniBrandText}
              </div>
            )}
            <div className="w-px h-6 bg-border/60" />
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
              className="gap-2 border-green-500/40 text-green-400 hover:bg-green-500/10"
              onClick={() => navigate("/admin/settings/communication")}
            >
              <MessageSquare className="w-4 h-4" /> Communicate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
              onClick={() => navigate("/admin/settings/intelligence")}
            >
              <Activity className="w-4 h-4" /> Intelligence
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => navigate("/admin/settings/reports")}
            >
              <FileBarChart className="w-4 h-4" /> Report Center
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 border-violet-500/40 text-violet-400 hover:bg-violet-500/10"
              onClick={() => navigate("/admin/settings/branding")}
            >
              <Palette className="w-4 h-4" /> Branding
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
            onClick={() => navigate("/admin/tournaments")}
          >
            <Trophy className="w-3.5 h-3.5" /> Tournaments
          </Button>
          <Button
            size="sm"
            variant={adminTab === "organizers" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate("/admin/organisers")}
          >
            <Users className="w-3.5 h-3.5" /> Organizers
          </Button>
          <Button
            size="sm"
            variant={adminTab === "sports" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate("/admin/tournaments/sports")}
          >
            <Sliders className="w-3.5 h-3.5" /> Sports & Specs
          </Button>
          <Button
            size="sm"
            variant={adminTab === "settings" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate("/admin/settings/system/sms")}
          >
            <MonitorDown className="w-3.5 h-3.5" /> Local App
          </Button>
          <Button
            size="sm"
            variant={adminTab === "display-auctions" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate("/admin/settings/system/upcoming-display")}
          >
            <Tv className="w-3.5 h-3.5" /> Upcoming Display
          </Button>
          <Button
            size="sm"
            variant={adminTab === "showcase" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => navigate("/admin/settings/system/showcase")}
          >
            <Images className="w-3.5 h-3.5" /> Showcase
          </Button>
        </div>

        {/* Body */}
        {adminTab === "organizers" ? (
          <OrganizersPanel isMaster={isMaster} />
        ) : adminTab === "sports" ? (
          <SportsPanel />
        ) : adminTab === "display-auctions" ? (
          <DisplayAuctionsPanel />
        ) : adminTab === "showcase" ? (
          <ShowcasePanel />
        ) : adminTab === "settings" ? (
          <div className="flex-1 flex flex-col overflow-auto divide-y divide-border/40">
            <SmsSettingsPanel />
            <InstallerSettingsPanel />
            <BuildTriggerPanel />
          </div>
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
                    tournaments.filter((t) => t.licenseStatus === "active").length
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
              <div className={ADMIN_FLEX_SCROLL_CLASS}>
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
              </div>
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

      {warningVisible && !locked && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}

    </FullscreenLayout>
  );
}
