import { useState } from "react";
import { useParams } from "wouter";
import { AppLayout } from "@/components/layout";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MonitorDown, Download, CheckCircle2, AlertTriangle, Wifi, Globe, Laptop } from "lucide-react";

export default function LocalModePage() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = parseInt(id ?? "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleExport() {
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" })) as { error?: string };
        setDownloadMsg({ text: err.error ?? "Export failed", ok: false });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tournament?.name?.replace(/\s+/g, "-").toLowerCase() ?? "tournament"}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg({ text: "Export downloaded. Import this file in the BidWar Local app to begin.", ok: true });
    } catch (e) {
      setDownloadMsg({ text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`, ok: false });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MonitorDown className="w-6 h-6 text-amber-400" />
            Local Mode
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Run your auction offline using BidWar Local, with live cloud mirroring for display screens and OBS.
          </p>
        </div>

        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : !tournament?.localModeEnabled ? (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="py-6 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Local Mode is not enabled</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Contact your BidWar administrator to enable Local Mode for this tournament.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <p className="text-sm text-green-300 font-medium">Local Mode is enabled for this tournament.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  Step 1 — Export Tournament Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Download the tournament export file. This file contains all teams, players, and categories — and an
                  embedded secure token that allows BidWar Local to mirror live state back to the cloud display.
                </p>
                <p className="text-xs text-muted-foreground bg-muted/40 px-3 py-2 rounded border border-border">
                  The export token is valid for 48 hours. Re-export to refresh it.
                </p>
                <Button
                  onClick={handleExport}
                  disabled={downloading}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? "Downloading..." : "Download Export File (.json)"}
                </Button>
                {downloadMsg && (
                  <p className={`text-sm ${downloadMsg.ok ? "text-green-400" : "text-destructive"}`}>
                    {downloadMsg.text}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-primary" />
                  Step 2 — Import into BidWar Local
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <ol className="list-decimal list-inside space-y-2">
                  <li>Open the BidWar Local desktop app on the auction venue computer.</li>
                  <li>Click <strong className="text-foreground">Import Tournament</strong> and select the downloaded export file.</li>
                  <li>BidWar Local will set up all teams, players, and categories automatically.</li>
                  <li>Use the Operator Panel link in BidWar Local to start the auction.</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-primary" />
                  Step 3 — Cloud Mirroring (automatic)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  While the local auction is running, every bid and state change is mirrored to this cloud tournament
                  in real time — as long as the venue computer has internet access.
                </p>
                <p>
                  This means your LED display screen, OBS overlay, and online viewers continue to work from this
                  cloud URL, even though the auction itself is running locally.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  Step 4 — Sync Results After Auction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  After the auction is complete, click <strong className="text-foreground">Sync to Cloud Now</strong> in
                  BidWar Local to push final player statuses, sold prices, and bid history back to this cloud tournament.
                </p>
                <p className="text-xs bg-muted/40 px-3 py-2 rounded border border-border">
                  The cloud sync will mark the tournament as completed and update all player records.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
