import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  Radio,
  Save,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { organizerAccessLabel } from "@workspace/api-base/organizer-account";
import { displayOrganizerMobile } from "@workspace/api-base/mobile";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MetricCard } from "@/components/admin/admin-metric-card";
import { StatusBadge, organiserAccessTone } from "@/components/admin/admin-status-badge";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import {
  AdminOrganizerRow,
  AdminTournamentRow,
  fetchAdminTournamentDetail,
  listAdminOrganizers,
  listAdminTournaments,
  updateAdminOrganizer,
} from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function getOrganiserId(pathname: string) {
  const match = pathname.match(/\/admin\/organisers\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export default function AdminOrganiserDetailPage() {
  const [location, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const organiserId = getOrganiserId(location);
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Access state
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessError, setAccessError] = useState("");

  // Quota & notes state
  const [quotaVal, setQuotaVal] = useState<string>("1");
  const [notesVal, setNotesVal] = useState<string>("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Contact modal
  const [contactOpen, setContactOpen] = useState(false);

  // Player stats state
  const [playerStats, setPlayerStats] = useState<{ totalPlayers: number; revenue: number } | null>(null);
  const [playerStatsLoading, setPlayerStatsLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listAdminOrganizers(), listAdminTournaments()])
      .then(([organiserRows, tournamentRows]) => {
        if (cancelled) return;
        setOrganisers(organiserRows);
        setTournaments(tournamentRows);
        const current = organiserRows.find((o) => o.id === organiserId);
        if (current) {
          setQuotaVal(String(current.maxTournaments || 1));
          setNotesVal(current.notes || "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, organiserId]);

  const organiser = organisers.find((o) => o.id === organiserId) || null;
  const linkedTournaments = useMemo(
    () => tournaments.filter((t) => t.organizerId === organiserId),
    [organiserId, tournaments],
  );
  const liveCount = linkedTournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked).length;
  const access = organiser ? organizerAccessLabel(organiser.licenseStatus) : "active";
  const accessEnabled = access === "active";
  const cleanPhone = organiser ? displayOrganizerMobile(organiser.mobile) : null;

  // Aggregate real player totals and cumulative auction bids across tournaments
  useEffect(() => {
    if (loading || !organiser) return;
    if (!linkedTournaments.length) {
      setPlayerStats({ totalPlayers: 0, revenue: 0 });
      setPlayerStatsLoading(false);
      return;
    }
    let cancelled = false;
    setPlayerStatsLoading(true);
    Promise.all(linkedTournaments.map((t) => fetchAdminTournamentDetail(t.id)))
      .then((details) => {
        if (cancelled) return;
        let totalPlayers = 0;
        let revenue = 0;
        for (const detail of details) {
          if (!detail) continue;
          totalPlayers += detail.playerCounts.total;
          for (const p of detail.players) {
            if (p.status === "sold" && p.soldPrice) revenue += p.soldPrice;
          }
        }
        setPlayerStats({ totalPlayers, revenue });
      })
      .finally(() => {
        if (!cancelled) setPlayerStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, organiser, linkedTournaments]);

  function formatAuctionVolume(amount: number) {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
    return `₹${amount.toLocaleString("en-IN")}`;
  }

  async function handleAccessToggle(enabled: boolean) {
    if (!organiser) return;
    setAccessSaving(true);
    setAccessError("");
    const result = await updateAdminOrganizer(organiser.id, {
      licenseStatus: enabled ? "active" : "suspended",
    });
    setAccessSaving(false);
    if (!result.success) {
      setAccessError(result.error || "Failed to update account access.");
      return;
    }
    setOrganisers((rows) =>
      rows.map((row) =>
        row.id === organiser.id
          ? { ...row, licenseStatus: enabled ? "active" : "suspended" }
          : row,
      ),
    );
  }

  async function handleSaveSettings() {
    if (!organiser) return;
    setSettingsSaving(true);
    setSettingsSuccess(false);
    const parsedQuota = parseInt(quotaVal, 10);
    const result = await updateAdminOrganizer(organiser.id, {
      maxTournaments: isNaN(parsedQuota) ? 1 : Math.max(1, parsedQuota),
      notes: notesVal.trim(),
    });
    setSettingsSaving(false);
    if (result.success) {
      setSettingsSuccess(true);
      setOrganisers((rows) =>
        rows.map((row) =>
          row.id === organiser.id
            ? { ...row, maxTournaments: isNaN(parsedQuota) ? 1 : Math.max(1, parsedQuota), notes: notesVal.trim() }
            : row,
        ),
      );
      setTimeout(() => setSettingsSuccess(false), 3000);
    }
  }

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title={organiser?.name || "Organiser Detail"}
      eyebrow="Tournament & Organisers › Organisers"
      actions={
        organiser && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setContactOpen(true)} className="gap-1.5 text-xs">
              <MessageSquare className="h-3.5 w-3.5" /> Contact Organiser
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/organisers")} className="gap-1 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" /> All Organisers
            </Button>
          </div>
        )
      }
    >
      {loading || !organiser ? (
        <div className="rounded-xl border border-border bg-card/70 p-6 text-sm text-muted-foreground">
          {loading ? "Loading organiser details..." : "Organiser account not found."}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                  {organiser.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold text-foreground">{organiser.name}</h2>
                    <Badge
                      className={cn(
                        "text-[10px] font-semibold",
                        accessEnabled
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : "bg-destructive/15 text-destructive border border-destructive/30"
                      )}
                    >
                      {accessEnabled ? "Active" : "Locked"}
                    </Badge>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono text-foreground">
                      {cleanPhone || "No direct phone"}
                    </span>
                    {cleanPhone && (
                      <span className="text-[11px]">
                        {organiser.phoneVerified ? (
                          <span className="text-emerald-400 font-medium inline-flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Verified
                          </span>
                        ) : (
                          <span className="text-muted-foreground">(unverified)</span>
                        )}
                      </span>
                    )}
                    <span>·</span>
                    <span>{organiser.email || "No email"}</span>
                    <span>·</span>
                    <span>Member since {new Date(organiser.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard
              label="Tournaments"
              value={linkedTournaments.length}
              sub="Total linked"
              icon={Trophy}
            />
            <MetricCard
              label="Live Now"
              value={liveCount}
              sub="In active progress"
              icon={Radio}
            />
            <MetricCard
              label="Players Managed"
              value={playerStats ? playerStats.totalPlayers : 0}
              sub="Across tournaments"
              icon={Users}
              loading={playerStatsLoading}
            />
            <MetricCard
              label="Auction Volume"
              value={playerStats ? formatAuctionVolume(playerStats.revenue) : "₹0"}
              sub="Cumulative player bids"
              icon={Wallet}
              loading={playerStatsLoading}
            />
            <MetricCard
              label="Tournament Quota"
              value={`${linkedTournaments.length} / ${organiser.maxTournaments}`}
              sub={linkedTournaments.length >= organiser.maxTournaments ? "Quota reached" : "Available"}
              icon={Building2}
            />
          </div>

          {/* Two-Column Details & Settings */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
            {/* Tournaments List */}
            <div className="rounded-xl border border-border bg-card/70 shadow-sm overflow-hidden flex flex-col">
              <div className="border-b border-border px-4 py-3 bg-card/50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Linked Tournaments</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Competitions hosted under this organiser account.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {linkedTournaments.length}
                </Badge>
              </div>

              <AdminListHeader
                gridClassName="sm:grid sm:grid-cols-[minmax(180px,2fr)_100px_100px_120px_80px] sm:items-center sm:gap-3"
                columns={[
                  { label: "Tournament" },
                  { label: "Sport" },
                  { label: "Status" },
                  { label: "Schedule" },
                  { label: "Action", align: "right" },
                ]}
              />

              <AdminScrollPanel>
                <div className="divide-y divide-border">
                  {linkedTournaments.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                      className="block w-full px-4 py-3 text-left text-xs hover:bg-accent/40 transition-colors sm:grid sm:grid-cols-[minmax(180px,2fr)_100px_100px_120px_80px] sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground truncate block">{t.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">#{t.id}</span>
                      </div>

                      <div className="capitalize text-muted-foreground mt-1 sm:mt-0">
                        {t.sport}
                      </div>

                      <div className="mt-1 sm:mt-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium capitalize",
                            t.adminLocked
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : t.licenseStatus === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-muted/40 text-muted-foreground border-border"
                          )}
                        >
                          {t.adminLocked ? "Locked" : t.licenseStatus || "Setup"}
                        </Badge>
                      </div>

                      <div className="text-muted-foreground text-[11px] mt-1 sm:mt-0 truncate">
                        {t.auctionDate ? new Date(t.auctionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Unscheduled"}
                      </div>

                      <div className="text-primary font-medium text-right mt-1 sm:mt-0">
                        Open →
                      </div>
                    </button>
                  ))}
                  {!linkedTournaments.length && (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                      No linked tournaments for this organiser account.
                    </div>
                  )}
                </div>
              </AdminScrollPanel>
            </div>

            {/* Right Column: Account Governance & Settings */}
            <div className="space-y-5">
              {/* Account Access Card */}
              <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm space-y-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Access</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Control tournament creation and portal access.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="org-access" className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer">
                      {accessEnabled ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Lock className="w-3.5 h-3.5 text-destructive" />}
                      {accessEnabled ? "Account Active" : "Account Locked"}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {accessEnabled ? "Organiser can access assigned tournaments." : "Tournament operations are temporarily frozen."}
                    </p>
                  </div>
                  <Switch
                    id="org-access"
                    checked={accessEnabled}
                    disabled={accessSaving}
                    onCheckedChange={(checked) => void handleAccessToggle(checked)}
                  />
                </div>
                {accessError && <p className="text-xs text-destructive">{accessError}</p>}
              </div>

              {/* Quota & Notes Card */}
              <div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Governance & Limits</h3>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Manage tournament capacity and internal staff remarks.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max-tournaments" className="text-xs font-medium">Tournament Limit Quota</Label>
                  <Input
                    id="max-tournaments"
                    type="number"
                    min="1"
                    max="100"
                    value={quotaVal}
                    onChange={(e) => setQuotaVal(e.target.value)}
                    className="h-8.5 text-xs"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Currently managing {linkedTournaments.length} tournament{linkedTournaments.length !== 1 ? "s" : ""}.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="org-notes" className="text-xs font-medium">Internal Notes</Label>
                  <Textarea
                    id="org-notes"
                    value={notesVal}
                    onChange={(e) => setNotesVal(e.target.value)}
                    placeholder="Add verified KYC notes, billing tier, or admin remarks..."
                    className="text-xs resize-none h-20"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {settingsSuccess ? (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Changes saved
                    </span>
                  ) : <span />}
                  <Button
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Contact Dialog */}
      {organiser && (
        <Dialog open={contactOpen} onOpenChange={setContactOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Contact Organiser</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Reach out directly to {organiser.name} via verified communication channels.
              </p>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                <div className="text-xs font-medium text-foreground flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-primary" /> Phone & WhatsApp
                </div>
                {cleanPhone ? (
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{cleanPhone}</span>
                    <div className="flex gap-2">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        Call <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://wa.me/91${cleanPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        WhatsApp <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No phone number registered for this account.</p>
                )}
              </div>

              <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                <div className="text-xs font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-primary" /> Email Correspondence
                </div>
                {organiser.email ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground truncate max-w-[220px]">{organiser.email}</span>
                    <a
                      href={`mailto:${organiser.email}?subject=BidWar Platform Support: ${encodeURIComponent(organiser.name)}`}
                      className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      Email <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No email address on file.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setContactOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  );
}
