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
  Globe, Laptop, Activity, Smartphone, Monitor, Router,
  ArrowRight, Package, FolderOpen, Play, RefreshCw, ExternalLink,
  Circle,
} from "lucide-react";

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
    <div className="relative w-full py-6 px-4">
      {/* Center: Router */}
      <div className="flex flex-col items-center gap-8">

        {/* Top row: Operator Laptop */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30">
            <Laptop className="w-7 h-7 text-amber-400" />
          </div>
          <span className="text-xs font-medium text-amber-300">Operator Laptop</span>
          <span className="text-[10px] text-muted-foreground text-center max-w-[120px]">BidWar Local runs here</span>
        </div>

        {/* Connector down */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-px h-5 bg-border/60" />
          <span className="text-[10px] text-muted-foreground">Wi-Fi / LAN cable</span>
          <div className="w-px h-5 bg-border/60" />
        </div>

        {/* Router */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30">
            <Router className="w-7 h-7 text-blue-400" />
          </div>
          <span className="text-xs font-medium text-blue-300">Wi-Fi Router</span>
          <span className="text-[10px] text-muted-foreground text-center max-w-[140px]">All devices on the same network</span>
        </div>

        {/* Bottom row: Owner Phones + Display */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <div className="w-14 h-px bg-border/60" />
            <div className="w-px h-5 bg-border/60" />
            <div className="w-14 h-px bg-border/60" />
          </div>
        </div>
        <div className="flex items-start justify-center gap-10 flex-wrap">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/30">
              <Smartphone className="w-7 h-7 text-green-400" />
            </div>
            <span className="text-xs font-medium text-green-300">Owner Phones</span>
            <span className="text-[10px] text-muted-foreground text-center max-w-[100px]">Open owner panel URL in browser</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/30">
              <Monitor className="w-7 h-7 text-purple-400" />
            </div>
            <span className="text-xs font-medium text-purple-300">LED Display</span>
            <span className="text-[10px] text-muted-foreground text-center max-w-[100px]">Open display URL in full-screen browser</span>
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
        {/* Step number + completion indicator */}
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
          {/* Header */}
          <div className="flex items-center gap-2">
            <span className={accent}>{icon}</span>
            <h3 className="font-semibold text-base">{title}</h3>
            {done && (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] h-4 px-1.5">
                Done
              </Badge>
            )}
          </div>

          {/* Content */}
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Mirror Status Panel ──────────────────────────────────────────────────────

interface MirrorStatusProps {
  tournamentId: number;
}

function MirrorStatusPanel({ tournamentId }: MirrorStatusProps) {
  const { data: auctionState, dataUpdatedAt } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 10000,
    },
  });

  const lastPollTime = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const secondsAgo = lastPollTime ? Math.round((Date.now() - lastPollTime.getTime()) / 1000) : null;
  const mirrorActive = auctionState?.status === "active" || auctionState?.status === "paused";

  function statusLabel() {
    if (!auctionState?.status) return "Not started";
    const map: Record<string, string> = {
      idle: "Waiting to start",
      active: "Auction running",
      paused: "Auction paused",
      completed: "Auction finished",
    };
    return map[auctionState.status] ?? auctionState.status;
  }

  function pollLabel() {
    if (secondsAgo === null) return "Not polled yet";
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    return `${Math.round(secondsAgo / 60)}m ago`;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-base">Cloud Mirror Status</h3>
        <span className="text-xs text-muted-foreground ml-auto">Polls every 10s</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Auction State</p>
          <p className={`text-sm font-semibold ${mirrorActive ? "text-green-400" : "text-muted-foreground"}`}>
            {statusLabel()}
          </p>
        </div>
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Polled</p>
          <p className="text-sm font-semibold text-muted-foreground">{pollLabel()}</p>
        </div>
      </div>

      {auctionState?.currentPlayer && (
        <div className="bg-muted/30 px-3 py-2 rounded border border-border/40 text-xs text-muted-foreground">
          Player on cloud:{" "}
          <strong className="text-foreground">{auctionState.currentPlayer.name}</strong>
          {auctionState.currentBid
            ? ` — current bid ₹${Number(auctionState.currentBid).toLocaleString("en-IN")}`
            : ""}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        When BidWar Local is running and has internet access, every bid and
        state change automatically mirrors here in real time. Your LED display
        and online viewers see live updates from this cloud URL.
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

  // Installer info (public endpoint)
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

  // Per-step completion state (persisted to localStorage)
  const [completions, setCompletions] = useState<boolean[]>(() =>
    tournamentId ? loadCompletions(tournamentId) : [false, false, false, false, false, false]
  );

  function toggle(stepIndex: number) {
    const next = completions.map((v, i) => (i === stepIndex ? !v : v));
    setCompletions(next);
    saveCompletion(tournamentId, stepIndex + 1, next[stepIndex]);
  }

  // Export tournament data
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/export`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" })) as { error?: string };
        setExportMsg({ text: err.error ?? "Export failed", ok: false });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tournament?.name?.replace(/\s+/g, "-").toLowerCase() ?? "tournament"}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportMsg({
        text: "File downloaded. Import it in BidWar Local to begin.",
        ok: true,
      });
      // Auto-mark step 3 done on successful export
      if (!completions[2]) {
        const next = completions.map((v, i) => (i === 2 ? true : v));
        setCompletions(next);
        saveCompletion(tournamentId, 3, true);
      }
    } catch (e) {
      setExportMsg({ text: `Error: ${e instanceof Error ? e.message : "Unknown error"}`, ok: false });
    } finally {
      setExporting(false);
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
              Run your auction without internet — on a local network at the venue.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">Local Mode is not enabled for this tournament</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact your BidWar administrator to enable Local Mode before proceeding.
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

        {/* Page header */}
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MonitorDown className="w-6 h-6 text-amber-400" />
              BidWar Local Setup
            </h1>
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1">
              <Circle className="w-2 h-2 fill-current" /> Local Mode Enabled
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Follow these steps to run your auction offline at the venue. Tick each step as you complete it.
          </p>
        </div>

        {/* Progress */}
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

        {/* ── Step 1: Download ── */}
        <StepCard
          number={1}
          icon={<Download className="w-4 h-4" />}
          title="Download BidWar Local"
          done={completions[0]}
          onToggle={() => toggle(0)}
          accent="text-amber-400"
        >
          <p className="text-sm text-muted-foreground">
            Download and install the BidWar Local desktop app on the Windows computer you will use at the venue.
          </p>
          {installerUrl ? (
            <div className="flex items-center gap-3 flex-wrap">
              <a href={installerUrl} target="_blank" rel="noreferrer" onClick={() => {
                if (!completions[0]) {
                  const next = completions.map((v, i) => (i === 0 ? true : v));
                  setCompletions(next);
                  saveCompletion(tournamentId, 1, true);
                }
              }}>
                <Button size="sm" className="gap-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold">
                  <Download className="w-4 h-4" />
                  Download Installer
                  {installerVersion && <span className="opacity-70 font-normal">v{installerVersion}</span>}
                </Button>
              </a>
              <a href={installerUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <ExternalLink className="w-3 h-3" /> Open link
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              No installer link configured yet. Contact your BidWar administrator.
            </div>
          )}
        </StepCard>

        {/* ── Step 2: Install ── */}
        <StepCard
          number={2}
          icon={<Package className="w-4 h-4" />}
          title="Install the App"
          done={completions[1]}
          onToggle={() => toggle(1)}
          accent="text-blue-400"
        >
          <p className="text-sm text-muted-foreground">
            Run the downloaded installer on the venue computer and follow the setup wizard.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Double-click the <strong className="text-foreground">.exe</strong> installer file you downloaded.</li>
            <li>If Windows shows a security prompt, click <strong className="text-foreground">More info</strong> then <strong className="text-foreground">Run anyway</strong>.</li>
            <li>Follow the on-screen steps — the app will install and launch automatically.</li>
          </ol>
        </StepCard>

        {/* ── Step 3: Export data ── */}
        <StepCard
          number={3}
          icon={<Download className="w-4 h-4" />}
          title="Export Your Tournament Data"
          done={completions[2]}
          onToggle={() => toggle(2)}
          accent="text-green-400"
        >
          <p className="text-sm text-muted-foreground">
            Download the tournament data file from here. This file contains all your teams, players, and categories.
            It also includes a secure token so BidWar Local can send live updates back to the cloud display.
          </p>
          <div className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
            The token in this file is valid for 48 hours. If you need to export again, the old token will be replaced.
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={handleExport}
              disabled={exporting}
              size="sm"
              className="gap-2"
            >
              {exporting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {exporting ? "Preparing file..." : "Download Export File (.json)"}
            </Button>
          </div>
          {exportMsg && (
            <p className={`text-sm flex items-center gap-1.5 ${exportMsg.ok ? "text-green-400" : "text-destructive"}`}>
              {exportMsg.ok
                ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {exportMsg.text}
            </p>
          )}
        </StepCard>

        {/* ── Step 4: Import ── */}
        <StepCard
          number={4}
          icon={<FolderOpen className="w-4 h-4" />}
          title="Import Data into BidWar Local"
          done={completions[3]}
          onToggle={() => toggle(3)}
          accent="text-purple-400"
        >
          <p className="text-sm text-muted-foreground">
            Open BidWar Local on the venue computer and load the file you just downloaded.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Open <strong className="text-foreground">BidWar Local</strong> on the laptop.</li>
            <li>Click <strong className="text-foreground">Import Tournament</strong> on the home screen.</li>
            <li>Select the <strong className="text-foreground">.json</strong> file you downloaded in Step 3.</li>
            <li>BidWar Local will load all teams, players, and categories automatically.</li>
          </ol>
        </StepCard>

        {/* ── Step 5: Connect devices ── */}
        <StepCard
          number={5}
          icon={<Wifi className="w-4 h-4" />}
          title="Connect Devices on the Venue Network"
          done={completions[4]}
          onToggle={() => toggle(4)}
          accent="text-cyan-400"
        >
          <p className="text-sm text-muted-foreground">
            All devices — owner phones, the LED display screen, and the operator laptop — must be on the same
            Wi-Fi network. BidWar Local shows you the URLs to open on each device.
          </p>

          <LanDiagram />

          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                <Laptop className="w-3.5 h-3.5" /> Operator
              </div>
              <p className="text-muted-foreground">Runs BidWar Local. Controls the auction from this computer.</p>
            </div>
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-green-300">
                <Smartphone className="w-3.5 h-3.5" /> Owner Phones
              </div>
              <p className="text-muted-foreground">Open the owner panel URL in any phone browser. Tap to bid.</p>
            </div>
            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-purple-300">
                <Monitor className="w-3.5 h-3.5" /> LED Screen
              </div>
              <p className="text-muted-foreground">Open the display URL in full-screen mode on the big screen.</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
            BidWar Local shows you the exact URLs to share — look for the network address panel in the app.
          </p>
        </StepCard>

        {/* ── Step 6: Run the auction ── */}
        <StepCard
          number={6}
          icon={<Play className="w-4 h-4" />}
          title="Run the Auction"
          done={completions[5]}
          onToggle={() => toggle(5)}
          accent="text-primary"
        >
          <p className="text-sm text-muted-foreground">
            You are ready. Open the Operator Panel in BidWar Local and start the auction.
          </p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>In BidWar Local, click <strong className="text-foreground">Open Operator Panel</strong>.</li>
            <li>Start bidding — every sold player is tracked locally and mirrored to the cloud.</li>
            <li>When the auction is complete, click <strong className="text-foreground">Sync to Cloud</strong> to push final results back here.</li>
          </ol>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded border border-border/40">
            <Globe className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
            <span>
              As long as the venue laptop has internet access, live bid updates will mirror to this cloud URL
              automatically — so your LED display and online viewers stay in sync.
            </span>
          </div>
        </StepCard>

        {/* ── Mirror Status ── */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3" /> Cloud Mirror Status
          </p>
          <MirrorStatusPanel tournamentId={tournamentId} />
        </div>

      </div>
    </AppLayout>
  );
}
