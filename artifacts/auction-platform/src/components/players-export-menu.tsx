import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Sheet as SheetIcon,
  Unlink,
  Check,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import type { GoogleSheetsStatus } from "@/lib/export-players-google-sheets";
import {
  formatLastSyncedAt,
  formatLastSyncedAtTooltip,
  friendlySyncError,
  getSyncStatusDisplay,
} from "@/lib/google-sheets-ui-helpers";

type ExportTarget = "excel" | "csv" | null;

type PlayersExportMenuProps = {
  filteredCount: number;
  exportingTarget: ExportTarget;
  onExportExcel: () => void;
  onExportCsv: () => void;
  googleSheetsStatus: GoogleSheetsStatus | null;
  sheetsConnected: boolean;
  sheetsNeedsReconnect: boolean;
  sheetsIsSyncing: boolean;
  isConnecting: boolean;
  syncSuccessFlash: boolean;
  showDisconnectDialog: boolean;
  onShowDisconnectDialog: (open: boolean) => void;
  onConnect: () => void;
  onSyncNow: () => void;
  onOpenSheet: () => void;
  onReconnect: () => void;
  onConfirmDisconnect: () => void;
};

function GoogleSheetsStatusCard({
  status,
  sheetsNeedsReconnect,
  sheetsIsSyncing,
  isConnecting,
  syncSuccessFlash,
  onConnect,
  onSyncNow,
  onOpenSheet,
  onReconnect,
  onRequestDisconnect,
}: {
  status: GoogleSheetsStatus | null;
  sheetsNeedsReconnect: boolean;
  sheetsIsSyncing: boolean;
  isConnecting: boolean;
  syncSuccessFlash: boolean;
  onConnect: () => void;
  onSyncNow: () => void;
  onOpenSheet: () => void;
  onReconnect: () => void;
  onRequestDisconnect: () => void;
}) {
  const [errorOpen, setErrorOpen] = useState(false);
  const showLinkedSheet = !!status?.sheetConfigured;

  if (!showLinkedSheet) {
    return (
      <div
        className="mx-1 mb-1 rounded-lg border border-dashed border-border/70 bg-gradient-to-b from-muted/40 to-muted/10 px-3 py-4 text-center"
        onPointerDown={(e) => e.preventDefault()}
      >
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <SheetIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <p className="text-xs font-medium text-foreground leading-snug px-1">
          Automatically keep your tournament workbook synced with Google Sheets.
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-3 h-8 w-full text-xs gap-1.5"
          disabled={isConnecting}
          onClick={onConnect}
        >
          {isConnecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Link2 className="h-3.5 w-3.5" aria-hidden />
          )}
          {sheetsNeedsReconnect ? "Reconnect Google Sheets" : "Connect Google Sheets"}
        </Button>
        <p className="mt-2 text-[10px] text-muted-foreground leading-snug">
          Only one-time authorization is required.
        </p>
      </div>
    );
  }

  const statusDisplay = getSyncStatusDisplay(status?.syncStatus ?? null, {
    isSyncing: sheetsIsSyncing,
    sheetConfigured: !!status?.sheetConfigured,
    googleConnected: !!status?.googleConnected,
    isConnecting,
  });
  const friendlyError = friendlySyncError(status?.lastError);
  const hasError = status?.syncStatus === "ERROR" || !!status?.lastError;

  return (
    <div
      className="mx-1 mb-1 rounded-lg border bg-card/60 p-3 space-y-2.5 min-w-0"
      onPointerDown={(e) => e.preventDefault()}
      role="region"
      aria-label="Google Sheets sync status"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm leading-none shrink-0" aria-hidden>🟢</span>
          <span className="text-xs font-semibold text-foreground truncate">Google Sheets</span>
        </div>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-5 shrink-0 font-medium ${statusDisplay.badgeClassName}`}
        >
          {statusDisplay.label}
        </Badge>
      </div>

      {status?.googleAccountEmail ? (
        <div className="text-[11px] leading-snug min-w-0">
          <span className="text-muted-foreground">Connected as: </span>
          <span className="text-foreground break-all">{status.googleAccountEmail}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-[11px] min-h-[16px]">
        <span className="text-muted-foreground shrink-0">Last sync:</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-foreground truncate text-right underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
              aria-label={`Last sync ${formatLastSyncedAtTooltip(status?.lastSyncedAt ?? null)}`}
            >
              {formatLastSyncedAt(status?.lastSyncedAt ?? null)}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            {formatLastSyncedAtTooltip(status?.lastSyncedAt ?? null)}
          </TooltipContent>
        </Tooltip>
      </div>

      {sheetsIsSyncing ? (
        <div
          className="flex items-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-1.5 text-[11px] text-blue-700 dark:text-blue-300 min-h-[32px]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          <span>Syncing Google Sheets…</span>
        </div>
      ) : syncSuccessFlash ? (
        <div
          className="flex items-center gap-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 min-h-[32px] animate-in fade-in duration-200"
          role="status"
          aria-live="polite"
        >
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Synced successfully</span>
        </div>
      ) : (
        <div className="min-h-[32px]" aria-hidden />
      )}

      {hasError && !sheetsIsSyncing ? (
        <Collapsible open={errorOpen} onOpenChange={setErrorOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1.5 text-left text-[11px] text-red-700 dark:text-red-300 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-expanded={errorOpen}
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="font-medium flex-1">Last error</span>
              <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${errorOpen ? "rotate-90" : ""}`} aria-hidden />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-snug px-0.5">{friendlyError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-[11px] gap-1.5"
              disabled={sheetsIsSyncing}
              onClick={onSyncNow}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Retry sync
            </Button>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] gap-1 px-2 min-w-0"
              onClick={onOpenSheet}
              aria-label="Open Google Sheet in new tab"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Open Sheet</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open in new tab</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-[11px] gap-1 px-2 min-w-0"
              disabled={sheetsIsSyncing}
              onClick={onSyncNow}
              aria-label={sheetsIsSyncing ? "Sync in progress" : "Sync now"}
              aria-busy={sheetsIsSyncing}
            >
              {sheetsIsSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              <span className="truncate">Sync Now</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{sheetsIsSyncing ? "Sync in progress" : "Sync all players now"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] gap-1 px-2 min-w-0"
              disabled={sheetsIsSyncing}
              onClick={onReconnect}
              aria-label="Reconnect Google account"
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Reconnect</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-authorize Google account</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-[11px] gap-1 px-2 min-w-0 text-destructive hover:text-destructive"
              disabled={sheetsIsSyncing}
              onClick={onRequestDisconnect}
              aria-label="Disconnect Google Sheets"
            >
              <Unlink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">Disconnect</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop automatic sync</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export function PlayersExportMenu({
  filteredCount,
  exportingTarget,
  onExportExcel,
  onExportCsv,
  googleSheetsStatus,
  sheetsConnected,
  sheetsNeedsReconnect,
  sheetsIsSyncing,
  isConnecting,
  syncSuccessFlash,
  showDisconnectDialog,
  onShowDisconnectDialog,
  onConnect,
  onSyncNow,
  onOpenSheet,
  onReconnect,
  onConfirmDisconnect,
}: PlayersExportMenuProps) {
  const exportBusy = exportingTarget !== null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            disabled={exportBusy || isConnecting}
            aria-label="Export players"
          >
            {exportBusy || isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="w-3.5 h-3.5" aria-hidden />
            )}
            <span className="hidden md:inline">
              {exportingTarget === "excel"
                ? "Exporting Excel…"
                : exportingTarget === "csv"
                  ? "Exporting CSV…"
                  : isConnecting
                    ? "Connecting…"
                    : "Export"}
            </span>
            <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[min(20rem,calc(100vw-1.5rem))] p-1"
        >
          <DropdownMenuItem
            disabled={exportBusy || filteredCount === 0}
            onClick={onExportExcel}
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={exportBusy || filteredCount === 0}
            onClick={onExportCsv}
            className="gap-2"
          >
            <FileText className="w-4 h-4 shrink-0" aria-hidden />
            CSV
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1" />

          <div className="px-2 pt-1 pb-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Google Sheets
              {sheetsConnected ? (
                <span className="normal-case font-medium text-emerald-600 dark:text-emerald-400 ml-1.5">
                  Connected ✓
                </span>
              ) : null}
            </p>
          </div>

          <GoogleSheetsStatusCard
            status={googleSheetsStatus}
            sheetsNeedsReconnect={sheetsNeedsReconnect}
            sheetsIsSyncing={sheetsIsSyncing}
            isConnecting={isConnecting}
            syncSuccessFlash={syncSuccessFlash}
            onConnect={onConnect}
            onSyncNow={onSyncNow}
            onOpenSheet={onOpenSheet}
            onReconnect={onReconnect}
            onRequestDisconnect={() => onShowDisconnectDialog(true)}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showDisconnectDialog} onOpenChange={onShowDisconnectDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Disconnect Google Sheets?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Automatic synchronization will stop.</p>
            <p>Your spreadsheet will not be deleted.</p>
            <p>You can reconnect anytime.</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onShowDisconnectDialog(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onConfirmDisconnect()}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GoogleSheetsReconnectBanner({
  lastError,
  onReconnect,
}: {
  lastError: string | null | undefined;
  onReconnect: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium text-foreground">Google Sheets disconnected</p>
          <p className="text-muted-foreground text-xs mt-0.5 break-words">
            {friendlySyncError(lastError)}
          </p>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 w-full sm:w-auto"
        onClick={onReconnect}
      >
        <Link2 className="w-3.5 h-3.5 mr-1.5" aria-hidden />
        Reconnect Google
      </Button>
    </div>
  );
}
