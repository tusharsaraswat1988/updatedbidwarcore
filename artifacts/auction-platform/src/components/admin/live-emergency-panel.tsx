import { useState } from "react";
import {
  CircleDot,
  MonitorDown,
  RefreshCw,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  AdminTournamentDetail,
  deleteAdminTournament,
  lockTournament,
  resetTournamentAsAdmin,
  setTournamentLicenseStatus,
  unlockTournament,
  updateAdminTournament,
} from "@/lib/auth";
import { LicenseModeControl } from "@/components/admin/license-mode-control";
import { LockBadge, StatusBadge } from "@/pages/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tournamentLiveOpsPath } from "@/lib/admin-live-ops-paths";
import { AuditReasonDialog } from "@/components/audit-reason-dialog";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";
import { LiveTournamentPicker } from "./live-tournament-picker";
import type { AdminTournamentRow } from "@/lib/auth";

export function LiveEmergencyPanel({
  tournaments,
  tournamentId,
  detail,
  isMaster,
  onRefresh,
  navigate,
  pickerHref = (id) => tournamentLiveOpsPath(id, "emergency"),
  monitorHref = (id) => tournamentLiveOpsPath(id, "monitor"),
  showPicker = true,
  afterDeleteHref = "/admin/tournaments",
}: {
  tournaments: AdminTournamentRow[];
  tournamentId: number | null;
  detail: AdminTournamentDetail | null;
  isMaster: boolean;
  onRefresh: () => void;
  navigate: (path: string) => void;
  pickerHref?: (tournamentId: number) => string;
  monitorHref?: (tournamentId: number) => string;
  showPicker?: boolean;
  afterDeleteHref?: string;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetReason, setResetReason] = useState("");
  const [licenseReasonOpen, setLicenseReasonOpen] = useState(false);
  const [pendingLicense, setPendingLicense] = useState<{
    label: string;
    status: "trial" | "active" | "completed";
    alsoLock?: boolean;
  } | null>(null);

  function requestLicenseChange(
    label: string,
    status: "trial" | "active" | "completed",
    alsoLock = false,
  ) {
    setPendingLicense({ label, status, alsoLock });
    setLicenseReasonOpen(true);
  }

  const showFlash = (msg: string, ok = true) => {
    setFlash({ ok, msg });
    window.setTimeout(() => setFlash(null), 4000);
  };

  const reloadDetail = async () => {
    onRefresh();
  };

  const doAction = async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setActionLoading(label);
    try {
      const r = await fn();
      if (!r.success) showFlash(r.error || `${label} failed`, false);
      else showFlash(`${label} done`);
      await reloadDetail();
    } finally {
      setActionLoading(null);
    }
  };

  if (!tournamentId || !detail) {
    return (
      <div className="space-y-4">
        <LiveTournamentPicker
          tournaments={tournaments}
          selectedId={tournamentId}
          buildHref={pickerHref}
          onNavigate={navigate}
          showPicker={showPicker}
          label="Emergency target"
        />
        <div className="rounded-xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          Select a tournament to access emergency controls. Actions are isolated from the auction monitor.
        </div>
      </div>
    );
  }

  const t = detail.tournament;
  const isLocked = t.adminLocked;

  return (
    <div className="space-y-4">
      <LiveTournamentPicker
        tournaments={tournaments}
        selectedId={tournamentId}
        buildHref={pickerHref}
        onNavigate={navigate}
        showPicker={showPicker}
        label="Emergency target"
      />

      {flash && (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${flash.ok ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-400"}`}
        >
          {flash.msg}
        </div>
      )}

      <div className="rounded-xl border border-red-500/30 bg-card/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={t.status} />
              <LockBadge locked={t.adminLocked} />
              {t.localModeEnabled && (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Local mode</span>
              )}
            </div>
            <h2 className="mt-2 font-display text-xl font-black text-white">{t.name}</h2>
            <p className="text-sm text-muted-foreground">
              {t.sport} · ID #{t.id} · {t.organizerName || "No organiser"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(monitorHref(t.id))}>
            Back to monitor
          </Button>
        </div>

        {!isMaster && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Read-only for data-entry admins. Emergency write actions require master access.
          </div>
        )}

        <div className="mt-4">
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
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isMaster && isLocked && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-500/40 text-blue-400"
              disabled={!!actionLoading}
              onClick={() => doAction("Unlock", () => unlockTournament(tournamentId))}
            >
              {actionLoading === "Unlock" ? <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Unlock className="mr-2 h-3.5 w-3.5" />}
              Re-open Auction
            </Button>
          )}
          {isMaster && (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2 sm:w-auto">
              <div className="text-xs text-muted-foreground">
                Operator connection:{" "}
                <span className={t.localModeEnabled ? "font-semibold text-amber-300" : "font-semibold text-white"}>
                  {t.localModeEnabled ? "Local mode" : "Cloud"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={t.localModeEnabled ? "border-amber-500/40 text-amber-400" : ""}
                disabled={!!actionLoading}
                onClick={() =>
                  doAction(t.localModeEnabled ? "Disable local mode" : "Enable local mode", () =>
                    updateAdminTournament(tournamentId, { localModeEnabled: !t.localModeEnabled }),
                  )
                }
              >
                {actionLoading === "Enable local mode" || actionLoading === "Disable local mode" ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MonitorDown className="mr-2 h-3.5 w-3.5" />
                )}
                {t.localModeEnabled ? "Disable local mode" : "Enable local mode"}
              </Button>
            </div>
          )}
          {t.sport === "cricket" && (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/10 px-3 py-2 sm:w-auto">
              <div className="text-xs text-muted-foreground">
                Match scoring:{" "}
                <span className={t.scoringEnabled ? "font-semibold text-primary" : "font-semibold text-white"}>
                  {t.scoringEnabled ? "Enabled (testing)" : "Disabled"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className={t.scoringEnabled ? "border-primary/40 text-primary" : ""}
                disabled={!!actionLoading}
                onClick={() =>
                  doAction(t.scoringEnabled ? "Disable match scoring" : "Enable match scoring", () =>
                    updateAdminTournament(tournamentId, { scoringEnabled: !t.scoringEnabled }),
                  )
                }
              >
                {actionLoading === "Enable match scoring" || actionLoading === "Disable match scoring" ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CircleDot className="mr-2 h-3.5 w-3.5" />
                )}
                {t.scoringEnabled ? "Disable match scoring" : "Enable match scoring"}
              </Button>
            </div>
          )}
          {isMaster && (
            <Button
              size="sm"
              variant="outline"
              className="border-red-500/40 text-red-400"
              onClick={() => {
                setResetPassword("");
                setResetError(null);
                setConfirmReset(true);
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reset Auction
              {(t.resetCount ?? 0) > 0 && (
                <span className="ml-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold">
                  {t.resetCount}×
                </span>
              )}
            </Button>
          )}
          {isMaster && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="dark max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-400">Reset auction data</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This clears bids, player sales, and auction progress for <strong className="text-white">{t.name}</strong>.
            Enter your super admin password to confirm.
          </p>
          <Input
            type="password"
            value={resetPassword}
            onChange={(e) => {
              setResetPassword(e.target.value);
              setResetError(null);
            }}
            placeholder="Super admin password"
            autoComplete="current-password"
          />
          <AuditReasonField
            value={resetReason}
            onChange={setResetReason}
            placeholder="Explain why auction data is being reset…"
          />
          {resetError && <p className="text-xs text-red-400">{resetError}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
            <Button
              className="bg-red-700 hover:bg-red-600"
              disabled={resetting || !resetPassword.trim() || !isAuditReasonValid(resetReason)}
              onClick={async () => {
                setResetting(true);
                setResetError(null);
                const r = await resetTournamentAsAdmin(tournamentId, resetPassword, resetReason.trim());
                setResetting(false);
                if (r.success) {
                  setConfirmReset(false);
                  setResetPassword("");
                  setResetReason("");
                  showFlash("Auction data reset");
                  await reloadDetail();
                } else {
                  setResetError(r.error || "Reset failed");
                }
              }}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${resetting ? "animate-spin" : ""}`} />
              Yes, reset everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="dark max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete tournament</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong className="text-white">{t.name}</strong> and all teams, players, and bid history?
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!!actionLoading}
              onClick={async () => {
                setConfirmDelete(false);
                setActionLoading("Delete");
                const r = await deleteAdminTournament(tournamentId);
                setActionLoading(null);
                if (r.success) {
                  navigate(afterDeleteHref);
                  onRefresh();
                } else {
                  showFlash(r.error || "Delete failed", false);
                }
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tournamentId != null && (
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
            if (!pendingLicense || tournamentId == null) return;
            setActionLoading(pendingLicense.label);
            const r1 = await setTournamentLicenseStatus(tournamentId, pendingLicense.status, reason);
            if (!r1.success) {
              setActionLoading(null);
              showFlash(r1.error || `${pendingLicense.label} failed`, false);
              return;
            }
            if (pendingLicense.alsoLock) {
              const r2 = await lockTournament(tournamentId);
              showFlash(r2.success ? "Auction ended" : "Marked completed but lock failed", r2.success);
            } else {
              showFlash(`${pendingLicense.label} done`);
            }
            setActionLoading(null);
            setLicenseReasonOpen(false);
            setPendingLicense(null);
            await reloadDetail();
          }}
        />
      )}
    </div>
  );
}
