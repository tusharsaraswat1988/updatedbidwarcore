import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  clearPendingGoogleSheetsConnect,
  connectAndSyncGoogleSheet,
  disconnectGoogleSheet,
  fetchGoogleSheetsStatus,
  GoogleSheetsAuthRequiredError,
  openGoogleSheetUrl,
  readPendingGoogleSheetsConnect,
  savePendingGoogleSheetsConnect,
  syncGoogleSheetNow,
  type GoogleSheetsStatus,
} from "@/lib/export-players-google-sheets";
import { friendlySyncError } from "@/lib/google-sheets-ui-helpers";

export function useGoogleSheetsExport(tournamentId: number, filtersHydrated: boolean) {
  const { toast } = useToast();
  const [googleSheetsStatus, setGoogleSheetsStatus] = useState<GoogleSheetsStatus | null>(null);
  const [sheetsSyncing, setSheetsSyncing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncSuccessFlash, setSyncSuccessFlash] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const syncInFlightRef = useRef(false);
  const successFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshGoogleSheetsStatus = useCallback(async () => {
    if (!tournamentId) return null;
    try {
      const status = await fetchGoogleSheetsStatus(tournamentId);
      setGoogleSheetsStatus(status);
      return status;
    } catch {
      return null;
    }
  }, [tournamentId]);

  const flashSyncSuccess = useCallback(() => {
    if (successFlashTimerRef.current) clearTimeout(successFlashTimerRef.current);
    setSyncSuccessFlash(true);
    successFlashTimerRef.current = setTimeout(() => {
      setSyncSuccessFlash(false);
      successFlashTimerRef.current = null;
    }, 2000);
  }, []);

  useEffect(() => {
    void refreshGoogleSheetsStatus();
  }, [refreshGoogleSheetsStatus]);

  useEffect(() => {
    if (googleSheetsStatus?.syncStatus !== "SYNCING") return;
    const interval = setInterval(() => {
      void refreshGoogleSheetsStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [googleSheetsStatus?.syncStatus, refreshGoogleSheetsStatus]);

  useEffect(() => () => {
    if (successFlashTimerRef.current) clearTimeout(successFlashTimerRef.current);
  }, []);

  const redirectToGoogleSheetsOAuth = useCallback(() => {
    const returnPath = `${window.location.pathname}${window.location.search}`;
    savePendingGoogleSheetsConnect(tournamentId);
    window.location.href = `/api/google/sheets/connect?next=${encodeURIComponent(returnPath)}`;
  }, [tournamentId]);

  const handleConnectGoogleSheets = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    const creating = !googleSheetsStatus?.sheetConfigured;
    if (creating) {
      toast({ title: "Creating Google Sheet...", description: "Setting up your tournament workbook." });
    }
    try {
      const result = await connectAndSyncGoogleSheet(tournamentId);
      clearPendingGoogleSheetsConnect();
      await refreshGoogleSheetsStatus();
      flashSyncSuccess();
      toast({
        title: result.created ? "Google Sheet connected successfully." : "Workbook updated successfully.",
        description: `${result.playerCount} player${result.playerCount === 1 ? "" : "s"} synced.`,
      });
    } catch (err) {
      if (err instanceof GoogleSheetsAuthRequiredError) {
        toast({
          title: "Reconnect required.",
          description: "Authorize Google Sheets to continue.",
          variant: "destructive",
        });
        redirectToGoogleSheetsOAuth();
        return;
      }
      const message = friendlySyncError(err instanceof Error ? err.message : undefined);
      toast({ title: "Sync failed. Retry available.", description: message, variant: "destructive" });
    } finally {
      setIsConnecting(false);
    }
  }, [
    flashSyncSuccess,
    googleSheetsStatus?.sheetConfigured,
    isConnecting,
    redirectToGoogleSheetsOAuth,
    refreshGoogleSheetsStatus,
    toast,
    tournamentId,
  ]);

  const handleSyncGoogleSheetsNow = useCallback(async () => {
    if (syncInFlightRef.current || sheetsSyncing || googleSheetsStatus?.syncStatus === "SYNCING") {
      return;
    }
    syncInFlightRef.current = true;
    setSheetsSyncing(true);
    toast({ title: "Sync started...", description: "Updating your Google Sheet workbook." });
    try {
      const result = await syncGoogleSheetNow(tournamentId);
      await refreshGoogleSheetsStatus();
      flashSyncSuccess();
      toast({
        title: "Sync completed successfully.",
        description: `${result.playerCount} player${result.playerCount === 1 ? "" : "s"} updated.`,
      });
    } catch (err) {
      if (err instanceof GoogleSheetsAuthRequiredError) {
        toast({
          title: "Reconnect required.",
          description: "Your Google authorization expired.",
          variant: "destructive",
        });
        redirectToGoogleSheetsOAuth();
        return;
      }
      await refreshGoogleSheetsStatus();
      const message = friendlySyncError(err instanceof Error ? err.message : undefined);
      toast({ title: "Sync failed. Retry available.", description: message, variant: "destructive" });
    } finally {
      syncInFlightRef.current = false;
      setSheetsSyncing(false);
    }
  }, [
    flashSyncSuccess,
    googleSheetsStatus?.syncStatus,
    redirectToGoogleSheetsOAuth,
    refreshGoogleSheetsStatus,
    sheetsSyncing,
    toast,
    tournamentId,
  ]);

  const handleOpenGoogleSheet = useCallback(async () => {
    try {
      const url = googleSheetsStatus?.spreadsheetUrl ?? await openGoogleSheetUrl(tournamentId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      const message = friendlySyncError(err instanceof Error ? err.message : undefined);
      toast({ title: "Could not open sheet", description: message, variant: "destructive" });
    }
  }, [googleSheetsStatus?.spreadsheetUrl, toast, tournamentId]);

  const handleReconnectGoogleSheets = useCallback(() => {
    toast({ title: "Reconnect required.", description: "Redirecting to Google authorization…" });
    redirectToGoogleSheetsOAuth();
  }, [redirectToGoogleSheetsOAuth, toast]);

  const confirmDisconnectGoogleSheet = useCallback(async () => {
    try {
      await disconnectGoogleSheet(tournamentId);
      await refreshGoogleSheetsStatus();
      setShowDisconnectDialog(false);
      toast({
        title: "Google account disconnected.",
        description: "Automatic sync stopped. Your spreadsheet was not deleted.",
      });
    } catch (err) {
      const message = friendlySyncError(err instanceof Error ? err.message : undefined);
      toast({ title: "Disconnect failed", description: message, variant: "destructive" });
    }
  }, [refreshGoogleSheetsStatus, toast, tournamentId]);

  useEffect(() => {
    if (typeof window === "undefined" || !tournamentId || !filtersHydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_sheets_connected") !== "1") return;

    params.delete("google_sheets_connected");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);

    if (readPendingGoogleSheetsConnect(tournamentId)) {
      void handleConnectGoogleSheets();
    }
  }, [tournamentId, filtersHydrated, handleConnectGoogleSheets]);

  const sheetsConnected =
    !!googleSheetsStatus?.sheetConfigured
    && googleSheetsStatus.syncStatus !== "DISCONNECTED"
    && googleSheetsStatus.googleConnected;

  const sheetsNeedsReconnect =
    googleSheetsStatus?.syncStatus === "DISCONNECTED"
    || (!googleSheetsStatus?.googleConnected && !!googleSheetsStatus?.sheetConfigured);

  const sheetsIsSyncing =
    sheetsSyncing
    || isConnecting
    || googleSheetsStatus?.syncStatus === "SYNCING";

  return {
    googleSheetsStatus,
    sheetsConnected,
    sheetsNeedsReconnect,
    sheetsIsSyncing,
    isConnecting,
    syncSuccessFlash,
    showDisconnectDialog,
    setShowDisconnectDialog,
    handleConnectGoogleSheets,
    handleSyncGoogleSheetsNow,
    handleOpenGoogleSheet,
    handleReconnectGoogleSheets,
    confirmDisconnectGoogleSheet,
  };
}
