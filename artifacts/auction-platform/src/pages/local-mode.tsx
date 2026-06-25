import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { AppLayout } from "@/components/layout";
import {
  useGetTournament, getGetTournamentQueryKey,
  useGetAuctionState, getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MonitorDown, Download, CheckCircle2, AlertTriangle, Wifi,
  Play, RefreshCw, ExternalLink, Circle, Laptop, Router,
  Smartphone, Monitor, QrCode, Package, FolderOpen, Activity,
} from "lucide-react";
import { LocalConnectionKit } from "@/components/local-connection-kit";
import { isBidWarLocalHost } from "@/lib/local-mode-host";

// ─── Step completion helpers ──────────────────────────────────────────────────

function stepKey(tournamentId: number, step: number) {
  return `local_mode_${tournamentId}_step_${step}`;
}

function loadCompletions(tournamentId: number): boolean[] {
  return [1, 2, 3, 4, 5, 6].map(
    (s) => localStorage.getItem(stepKey(tournamentId, s)) === "1"
  );
}

function saveCompletion(tournamentId: number, step: number, done: boolean) {
  if (done) {
    localStorage.setItem(stepKey(tournamentId, step), "1");
  } else {
    localStorage.removeItem(stepKey(tournamentId, step));
  }
}

// ─── LAN Diagram ─────────────────────────────────────────────────────────────

function LanDiagram() {
  return (
    <div className="rounded-xl border border-border/40 bg-muted/10 p-5">
      <div className="flex flex-col items-center gap-5">

        {/* Auction Computer */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <Laptop className="w-7 h-7 text-amber-400" />
          </div>
          <span className="text-xs font-semibold text-amber-300">Auction Computer</span>
          <span className="text-[10px] text-muted-foreground">BidWar Local runs here</span>
        </div>

        <div className="flex items-center gap-1">
          <div className="w-px h-6 bg-border/60 mx-auto" />
        </div>

        {/* Router */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30">
            <Router className="w-7 h-7 text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-blue-300">Wi-Fi Router</span>
          <span className="text-[10px] text-muted-foreground">All devices connect here</span>
        </div>

        {/* Lines out */}
        <div className="flex items-end justify-center gap-16 relative">
          <div className="flex flex-col items-center gap-1">
            <div className="w-px h-6 bg-border/60" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-px h-6 bg-border/60" />
          </div>
        </div>

        {/* Devices row */}
        <div className="flex items-start justify-center gap-12">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30">
              <Smartphone className="w-7 h-7 text-green-400" />
            </div>
            <span className="text-xs font-semibold text-green-300">Owner Phones</span>
            <span className="text-[10px] text-muted-foreground text-center max-w-[90px]">Scan QR code to join</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30">
              <Monitor className="w-7 h-7 text-purple-400" />
            </div>
            <span className="text-xs font-semibold text-purple-300">Big Screen</span>
            <span className="text-[10px] text-muted-foreground text-center max-w-[90px]">Open the display link full-screen</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

interface StepCardProps {
  number: number;
  icon: React.ReactNode;
  title: string;
  done: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  accent?: string;
}

function StepCard({ number, icon, title, done, onToggle, children, accent = "text-primary" }: StepCardProps) {
  return (
    <div className={`rounded-xl border bg-card transition-colors ${done ? "border-green-500/30 bg-green-500/[0.03]" : "border-border/50"}`}>
      <div className="flex items-start gap-4 p-5">
        <button
          onClick={onToggle}
          className="flex-shrink-0 mt-0.5 group"
          title={done ? "Mark as not done" : "Mark as done"}
        >
          {done ? (
            <CheckCircle2 className="w-7 h-7 text-green-400 group-hover:text-green-300 transition-colors" />
          ) : (
            <div className="w-7 h-7 rounded-full border-2 border-border/60 group-hover:border-primary/60 transition-colors flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">{number}</span>
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2">
            <span className={accent}>{icon}</span>
            <h3 className="font-semibold text-base">{title}</h3>
            {done && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] h-4 px-1.5">
                Done
              </Badge>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Cloud Sync Status Panel ──────────────────────────────────────────────────

interface CloudSyncStatusProps {
  tournamentId: number;
}

function CloudSyncStatus({ tournamentId }: CloudSyncStatusProps) {
  const { data: auctionState, dataUpdatedAt } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 10000,
    },
  });

  const lastPollTime = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const secondsAgo = lastPollTime ? Math.round((Date.now() - lastPollTime.getTime()) / 1000) : null;
  const isLive = auctionState?.status === "active" || auctionState?.status === "paused";

  function syncStatusLabel() {
    if (!auctionState?.status) return "Not yet started";
    const map: Record<string, string> = {
      idle: "Waiting to start",
      active: "Live at venue",
      paused: "Paused at venue",
      completed: "Auction complete",
    };
    return map[auctionState.status] ?? "Connected";
  }

  function lastCheckedLabel() {
    if (secondsAgo === null) return "Not checked yet";
    if (secondsAgo < 5) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
    return `${Math.round(secondsAgo / 60)} minutes ago`;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-base">Cloud Sync Status</h3>
        <span className="text-xs text-muted-foreground ml-auto">Checks every 10 seconds</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auction Status</p>
          <p className={`text-sm font-semibold ${isLive ? "text-green-400" : "text-muted-foreground"}`}>
            {syncStatusLabel()}
          </p>
        </div>
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Checked</p>
          <p className="text-sm font-semibold text-muted-foreground">{lastCheckedLabel()}</p>
        </div>
      </div>

      {auctionState?.currentPlayer && (
        <div className="bg-muted/30 px-3 py-2 rounded border border-border/40 text-xs text-muted-foreground">
          Current player:{" "}
          <strong className="text-foreground">{auctionState.currentPlayer.name}</strong>
          {auctionState.currentBid
            ? ` — current bid ₹${Number(auctionState.currentBid).toLocaleString("en-IN")}`
            : ""}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        While BidWar Local is running, auction display state is mirrored to the cloud when internet is available —
        so online viewers and the cloud display can follow the venue. Final player results and purses are pushed
        separately with &quot;Sync to Cloud&quot; after the auction ends.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LocalModePage() {
  const { id } = useParams<{ id: string }>();
  const tournamentId = parseInt(id ?? "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [installerUrl, setInstallerUrl] = useState<string | null>(null);
  const [installerVersion, setInstallerVersion] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/settings/installer-url")
      .then((r) => r.json())
      .then((d: { url?: string | null; version?: string | null }) => {
        setInstallerUrl(d.url ?? null);
        setInstallerVersion(d.version ?? null);
      })
      .catch(() => null);
  }, []);

  const [completions, setCompletions] = useState<boolean[]>(() =>
    tournamentId ? loadCompletions(tournamentId) : [false, false, false, false, false, false]
  );

  function toggle(stepIndex: number) {
    const next = completions.map((v, i) => (i === stepIndex ? !v : v));
    setCompletions(next);
    saveCompletion(tournamentId, stepIndex + 1, next[stepIndex]);
  }

  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleDownloadData() {
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" })) as { error?: string };
        setDownloadMsg({ text: err.error ?? "Download failed", ok: false });
        return;
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${tournament?.name?.replace(/\s+/g, "-").toLowerCase() ?? "tournament"}-data.json`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      setDownloadMsg({
        text: "File downloaded. Go to Step 4 and import it in BidWar Local.",
        ok: true,
      });
      if (!completions[2]) {
        const next = completions.map((v, i) => (i === 2 ? true : v));
        setCompletions(next);
        saveCompletion(tournamentId, 3, true);
      }
    } catch (e) {
      setDownloadMsg({ text: `Something went wrong. Please try again.`, ok: false });
    } finally {
      setDownloading(false);
    }
  }

  const doneCount = completions.filter(Boolean).length;

  if (isLoading) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </AppLayout>
    );
  }

  if (!tournament?.localModeEnabled) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MonitorDown className="w-6 h-6 text-amber-400" />
              BidWar Local Setup
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Run your auction at the venue without needing a constant internet connection.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">BidWar Local is not enabled for this tournament</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your BidWar administrator to turn on Local Mode before you begin setup.
              </p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="max-w-2xl space-y-6">

        {/* Header */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MonitorDown className="w-6 h-6 text-amber-400" />
              BidWar Local Setup
            </h1>
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1">
              <Circle className="w-2 h-2 fill-current" /> Local Mode On
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Follow each step below to get ready. Tick a step when you have completed it.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(doneCount / 6) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {doneCount} of 6 steps done
          </span>
        </div>

        {/* ── Step 1 — Download BidWar Local ── */}
        <StepCard
          number={1}
          icon={<Download className="w-4 h-4" />}
          title="Download BidWar Local"
          done={completions[0]}
          onToggle={() => toggle(0)}
          accent="text-amber-400"
        >
          <p className="text-sm text-muted-foreground">
            Download the BidWar Local app and install it on the Windows computer you will use at the venue.
          </p>
          {installerUrl ? (
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={installerUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (!completions[0]) {
                    const next = completions.map((v, i) => (i === 0 ? true : v));
                    setCompletions(next);
                    saveCompletion(tournamentId, 1, true);
                  }
                }}
              >
                <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                  <Download className="w-4 h-4" />
                  Download BidWar Local
                  {installerVersion && (
                    <span className="opacity-70 font-normal">v{installerVersion}</span>
                  )}
                </Button>
              </a>
              <a
                href={installerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Open link
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              No download link has been set up yet. Contact your BidWar administrator.
            </div>
          )}
        </StepCard>

        {/* ── Step 2 — Install the App ── */}
        <StepCard
          number={2}
          icon={<Package className="w-4 h-4" />}
          title="Install the App"
          done={completions[1]}
          onToggle={() => toggle(1)}
          accent="text-blue-400"
        >
          <p className="text-sm text-muted-foreground">
            Install BidWar Local on the auction computer and open it.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Double-click the file you just downloaded.</li>
            <li>If Windows shows a warning, click <strong className="text-foreground">More info</strong>, then <strong className="text-foreground">Run anyway</strong>.</li>
            <li>Follow the on-screen steps until the installation finishes.</li>
            <li>Open <strong className="text-foreground">BidWar Local</strong> from your Desktop.</li>
          </ol>
        </StepCard>

        {/* ── Step 3 — Download Your Tournament Data ── */}
        <StepCard
          number={3}
          icon={<Download className="w-4 h-4" />}
          title="Download Your Tournament Data"
          done={completions[2]}
          onToggle={() => toggle(2)}
          accent="text-green-400"
        >
          <p className="text-sm text-muted-foreground">
            Download the data file for this tournament. It contains all your players and teams,
            and connects the app to this tournament.
          </p>
          <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
            This file is only valid for 48 hours. If you need to start over, come back here and download it again.
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleDownloadData}
              disabled={downloading}
              size="sm"
              className="gap-2"
            >
              {downloading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloading ? "Preparing your file..." : "Download Your Tournament Data"}
            </Button>
          </div>
          {downloadMsg && (
            <p className={`text-sm flex items-center gap-1.5 ${downloadMsg.ok ? "text-green-400" : "text-destructive"}`}>
              {downloadMsg.ok
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {downloadMsg.text}
            </p>
          )}
        </StepCard>

        {/* ── Step 4 — Import Data into the App ── */}
        <StepCard
          number={4}
          icon={<FolderOpen className="w-4 h-4" />}
          title="Import Data into the App"
          done={completions[3]}
          onToggle={() => toggle(3)}
          accent="text-purple-400"
        >
          <p className="text-sm text-muted-foreground">
            Load your tournament into BidWar Local using the file you just downloaded.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Open <strong className="text-foreground">BidWar Local</strong> on the auction computer.</li>
            <li>Click <strong className="text-foreground">Import Tournament</strong>.</li>
            <li>Select the file you downloaded in Step 3.</li>
            <li>Your tournament will load automatically — players, teams, and all.</li>
          </ol>
        </StepCard>

        {/* ── Step 5 — Connect Devices ── */}
        <StepCard
          number={5}
          icon={<Wifi className="w-4 h-4" />}
          title="Connect Devices on the Same Network"
          done={completions[4]}
          onToggle={() => toggle(4)}
          accent="text-cyan-400"
        >
          <p className="text-sm text-muted-foreground">
            All devices — owner phones, the big display screen, and the auction computer — must be on
            the <strong className="text-foreground">same Wi-Fi network</strong>.
            {isBidWarLocalHost()
              ? " Use the connection kit below — scan a QR code or copy the link for each role."
              : " After import, BidWar Local shows a Connection Kit with QR codes for each device."}
          </p>

          {isBidWarLocalHost() ? (
            <LocalConnectionKit tournamentId={tournamentId} />
          ) : (
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>On the auction computer, open <strong className="text-foreground">BidWar Local</strong>.</li>
              <li>Open the <strong className="text-foreground">Connection Kit</strong> after importing your tournament.</li>
              <li>Each team owner scans their team&apos;s QR code to open the bidding screen.</li>
              <li>The big display scans or opens the <strong className="text-foreground">LED Display</strong> link, then goes full-screen.</li>
            </ol>
          )}

          <div className="flex items-center gap-2 bg-muted/30 px-3 py-2 rounded border border-border/40">
            <QrCode className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">BidWar Local is the server.</strong> Every other device connects to it.
              If a device cannot connect, check it is on the same Wi-Fi network as the auction computer.
            </p>
          </div>

          <LanDiagram />

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Laptop className="w-3.5 h-3.5" /> Auction Computer
              </div>
              <p className="text-muted-foreground">Runs BidWar Local. This is where the operator controls the auction.</p>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-green-300">
                <Smartphone className="w-3.5 h-3.5" /> Owner Phones
              </div>
              <p className="text-muted-foreground">Scan the QR code. The bidding screen opens in the phone browser.</p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                <Monitor className="w-3.5 h-3.5" /> Big Screen
              </div>
              <p className="text-muted-foreground">Open the link shown below the QR code. Make it full-screen.</p>
            </div>
          </div>
        </StepCard>

        {/* ── Step 6 — Run the Auction ── */}
        <StepCard
          number={6}
          icon={<Play className="w-4 h-4" />}
          title="Run the Auction"
          done={completions[5]}
          onToggle={() => toggle(5)}
          accent="text-primary"
        >
          <p className="text-sm text-muted-foreground">
            Everything is ready. Open the auction controls and begin.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Click <strong className="text-foreground">Operator Panel</strong> in BidWar Local to open the auction controls.</li>
            <li>Click <strong className="text-foreground">Start Auction</strong> to begin.</li>
            <li>Team owners will see the bidding screen on their devices automatically.</li>
          </ol>
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
            <Activity className="w-3.5 h-3.5 flex-shrink-0 text-primary mt-0.5" />
            <span>
              When the auction is finished, click <strong className="text-foreground">Sync to Cloud</strong> in BidWar Local to save the final results back to this tournament.
            </span>
          </div>
        </StepCard>

        {/* ── Cloud Sync Status ── */}
        <CloudSyncStatus tournamentId={tournamentId} />

      </div>
    </AppLayout>
  );
}
