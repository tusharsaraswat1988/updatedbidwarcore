import { useCallback, useEffect, useMemo, useState } from "react";
import { explainSurfaceReadiness, type SponsorMediaDestination } from "@workspace/scoring-core";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { scoringAppPath } from "@workspace/api-base/scoring-urls";
import {
  createSponsorDisplaySession,
  rememberSponsorDisplayToken,
  deleteSponsorMediaSlot,
  fetchSponsorMediaReadiness,
  fetchSponsorMediaSlots,
  sendSponsorMediaCue,
  updateSponsorMediaSlot,
  uploadSponsorMediaSlot,
  type SponsorMediaSlotDto,
  type SponsorSurfaceReportDto,
} from "@/lib/sponsor-media-api";

type Props = {
  tournamentId: number;
  className?: string;
  /** Fits the live-control deck: one strip, no internal scroll. */
  density?: "default" | "console";
};

const DESTINATIONS: Array<{ id: SponsorMediaDestination; label: string }> = [
  { id: "obs", label: "OBS" },
  { id: "led", label: "LED" },
  { id: "both", label: "Both" },
];

function surfaceLine(report: SponsorSurfaceReportDto | null, slot: SponsorMediaSlotDto): { ready: boolean; label: string } {
  const item = report?.slots.find((entry) => entry.slotNumber === slot.slotNumber) ?? null;
  const label = explainSurfaceReadiness({
    processingStatus: slot.processingStatus,
    active: slot.active,
    version: slot.version,
    surfaceOnline: Boolean(report),
    report: item,
  });
  return { ready: label === "Ready", label };
}

const FILE_ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/quicktime,.mp4,.mov,.png,.jpg,.jpeg,.webp";

function hasSponsor(slot: SponsorMediaSlotDto): boolean {
  return Boolean(slot.id) && slot.processingStatus !== "empty";
}

function screenPhrase(ready: boolean, label: string): string {
  if (ready) return "Ready";
  if (label === "Empty" || label === "Missing asset") return "Not prepared";
  return label;
}

function FilePick({
  label,
  disabled,
  primary,
  onFile,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[11px] font-bold",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        primary
          ? "bg-amber-400 text-black"
          : "border border-white/15 bg-black/30 text-slate-200",
      )}
    >
      {label}
      <input
        type="file"
        accept={FILE_ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onFile(file);
        }}
      />
    </label>
  );
}

export function SponsorMediaControl({ tournamentId, className, density = "default" }: Props) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [obs, setObs] = useState<SponsorSurfaceReportDto | null>(null);
  const [led, setLed] = useState<SponsorSurfaceReportDto | null>(null);
  const [selected, setSelected] = useState(1);
  const [destination, setDestination] = useState<SponsorMediaDestination>("obs");
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [preview, setPreview] = useState(false);
  const [screenLinksOpen, setScreenLinksOpen] = useState(false);
  const [slotsLoaded, setSlotsLoaded] = useState(false);

  const loadSlots = useCallback(() => {
    if (tournamentId <= 0) return;
    void fetchSponsorMediaSlots(tournamentId).then((next) => {
      setSlots(next);
      setSlotsLoaded(true);
    }).catch(() => setSlotsLoaded(true));
  }, [tournamentId]);

  const loadReadiness = useCallback(() => {
    if (tournamentId <= 0) return;
    void fetchSponsorMediaReadiness(tournamentId).then((report) => {
      setObs(report.obs);
      setLed(report.led);
    }).catch(() => {});
  }, [tournamentId]);

  useEffect(() => {
    loadSlots();
    loadReadiness();
    const slotsTimer = window.setInterval(loadSlots, 4000);
    const readyTimer = window.setInterval(loadReadiness, 3000);
    return () => {
      window.clearInterval(slotsTimer);
      window.clearInterval(readyTimer);
    };
  }, [loadReadiness, loadSlots]);

  useEffect(() => {
    if (tournamentId <= 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const [obsSession, ledSession] = await Promise.all([
          createSponsorDisplaySession(tournamentId, "obs"),
          createSponsorDisplaySession(tournamentId, "led"),
        ]);
        if (cancelled) return;
        rememberSponsorDisplayToken(tournamentId, "obs", obsSession.token);
        rememberSponsorDisplayToken(tournamentId, "led", ledSession.token);
      } catch {
        // Screen links still work from the button.
      }
    })();
    return () => { cancelled = true; };
  }, [tournamentId]);

  useEffect(() => {
    const filledNumbers = slots.filter(hasSponsor).map((item) => item.slotNumber);
    if (filledNumbers.length === 0) return;
    if (!filledNumbers.includes(selected)) setSelected(filledNumbers[0]);
  }, [slots, selected]);

  const slot = slots.find((item) => item.slotNumber === selected) ?? null;
  const obsLine = slot ? surfaceLine(obs, slot) : { ready: false, label: "Offline" };
  const ledLine = slot ? surfaceLine(led, slot) : { ready: false, label: "Offline" };
  const obsReady = obsLine.ready;
  const ledReady = ledLine.ready;

  const durationSec = slot ? Math.round(slot.durationMs / 1000) : 10;

  const cueBase = useMemo(() => {
    if (!slot?.id) return null;
    return { slotId: slot.id, slotNumber: slot.slotNumber, version: slot.version };
  }, [slot?.id, slot?.slotNumber, slot?.version]);

  async function copyDisplayLink(surface: "obs" | "led") {
    try {
      const session = await createSponsorDisplaySession(tournamentId, surface);
      const path = surface === "obs"
        ? `/tournament/${tournamentId}/cricket/obs/v2`
        : scoringAppPath(`/tournament/${tournamentId}/score-display`);
      const url = `${window.location.origin}${path}?display=${encodeURIComponent(session.token)}`;
      await navigator.clipboard.writeText(url);
      toast({
        title: surface === "obs" ? "OBS link copied" : "LED link copied",
        description: "Open this link on that screen. It can report ready only for this tournament and this screen.",
      });
    } catch (err) {
      toast({
        title: "Could not create display link",
        description: err instanceof Error ? err.message : "Could not create display link",
        variant: "destructive",
      });
    }
  }

  async function onUpload(file: File | undefined, target: SponsorMediaSlotDto | null) {
    if (!file || !target) return;
    setSelected(target.slotNumber);
    setBusy(true);
    try {
      const title = (target.id ? target.title : "") || file.name.replace(/\.[^.]+$/, "");
      const seconds = target.assetType === "image" ? Math.round(target.durationMs / 1000) : 10;
      await uploadSponsorMediaSlot(tournamentId, target.slotNumber, file, title, seconds);
      toast({ title: "Sponsor added", description: "It will finish processing, then you can prepare the screens." });
      loadSlots();
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  const filled = slots.filter(hasSponsor);
  const uploadTarget = slots.find((item) => !hasSponsor(item)) ?? null;
  const sponsor = slot && hasSponsor(slot) ? slot : null;
  const processing = sponsor?.processingStatus === "uploading" || sponsor?.processingStatus === "processing";
  const failed = sponsor?.processingStatus === "failed";
  const broadcastReady = sponsor?.processingStatus === "ready" && sponsor.active;
  const compact = density === "console";

  async function prepareScreens() {
    try {
      const [obsSession, ledSession] = await Promise.all([
        createSponsorDisplaySession(tournamentId, "obs"),
        createSponsorDisplaySession(tournamentId, "led"),
      ]);
      rememberSponsorDisplayToken(tournamentId, "obs", obsSession.token);
      rememberSponsorDisplayToken(tournamentId, "led", ledSession.token);
      await sendSponsorMediaCue(tournamentId, {
        action: "prepare",
        slotId: 0,
        slotNumber: 1,
        version: 0,
        destination: "both",
      }, { obs: obsSession.token, led: ledSession.token });
      toast({ title: "Connecting screens", description: "Refresh the OBS browser source once if it stays offline. The video appears when you press Play." });
    } catch (err) {
      toast({ title: "Prepare failed", description: err instanceof Error ? err.message : "Could not prepare", variant: "destructive" });
    }
  }

  function play() {
    if (!cueBase || !broadcastReady) return;
    void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "play", destination })
      .then(() => toast({ title: "Play sent", description: "Refresh the OBS browser source once if the video does not appear." }))
      .catch((err) => toast({ title: "Play failed", description: err instanceof Error ? err.message : "Could not play", variant: "destructive" }));
  }

  function stop() {
    if (!cueBase) return;
    void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "stop", destination: "both" })
      .then(() => toast({ title: "Stopped", description: "The scoreboard is back." }))
      .catch((err) => toast({ title: "Stop failed", description: err instanceof Error ? err.message : "Could not stop", variant: "destructive" }));
  }

  const nextStep = !sponsor
    ? null
    : processing
      ? "Processing. Play stays off until this finishes."
      : failed
        ? (sponsor.errorMessage || "Processing failed. Replace the file.")
        : !sponsor.active
          ? "This sponsor is off."
          : null;

  return (
    <section className={cn(
      compact
        ? "shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 space-y-1.5"
        : "rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-2",
      className,
    )}>
      <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 shrink-0">Sponsors</span>
        {filled.length === 0 ? (
          <FilePick
            label={!slotsLoaded ? "Loading…" : busy ? "Uploading…" : "Add sponsor video"}
            primary
            disabled={busy || !slotsLoaded || !uploadTarget}
            onFile={(file) => void onUpload(file, uploadTarget)}
          />
        ) : filled.map((item) => (
          <button
            key={item.slotNumber}
            type="button"
            onClick={() => { setSelected(item.slotNumber); setPreview(false); }}
            className={cn(
              "h-7 max-w-[9rem] truncate rounded-md border px-2 text-left text-[11px] font-semibold",
              item.slotNumber === sponsor?.slotNumber
                ? "border-amber-400 bg-amber-500/15 text-amber-100"
                : "border-white/10 bg-black/30 text-slate-200",
            )}
          >
            {item.title || "Sponsor"}
          </button>
        ))}
        {filled.length > 0 && filled.length < 4 && uploadTarget ? (
          <FilePick label={busy ? "Uploading…" : "Add another"} disabled={busy} onFile={(file) => void onUpload(file, uploadTarget)} />
        ) : null}
        <button
          type="button"
          className="ml-auto text-[10px] text-slate-400 underline"
          onClick={() => setScreenLinksOpen((open) => !open)}
        >
          {screenLinksOpen ? "Hide screen links" : "Screen links"}
        </button>
      </div>

      {screenLinksOpen ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
          <span>Open each link on that screen once.</span>
          <button type="button" className="text-slate-200 underline" onClick={() => void copyDisplayLink("obs")}>Copy OBS link</button>
          <button type="button" className="text-slate-200 underline" onClick={() => void copyDisplayLink("led")}>Copy LED link</button>
        </div>
      ) : null}

      {sponsor ? (
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <input
            value={sponsor.title}
            aria-label="Sponsor name"
            onChange={(event) => {
              const title = event.target.value;
              setSlots((current) => current.map((item) => item.slotNumber === sponsor.slotNumber ? { ...item, title } : item));
            }}
            onBlur={() => {
              if (!sponsor.id) return;
              void updateSponsorMediaSlot(tournamentId, sponsor.slotNumber, { title: sponsor.title }).catch(() => {});
            }}
            className="h-7 w-36 min-w-0 rounded-md border border-white/10 bg-black/30 px-2 text-[11px] text-white"
          />
          <span className="text-[10px] text-slate-400">
            {sponsor.assetType === "image" ? "Image" : sponsor.assetType === "video" ? "Video" : "File"}
            {sponsor.assetType === "image" ? ` · ${durationSec}s` : ""}
          </span>
          {sponsor.assetType === "image" ? (
            <input
              type="number"
              min={3}
              max={60}
              aria-label="Seconds on screen"
              value={durationSec}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSlots((current) => current.map((item) => item.slotNumber === sponsor.slotNumber ? { ...item, durationMs: next * 1000 } : item));
              }}
              onBlur={() => {
                void updateSponsorMediaSlot(tournamentId, sponsor.slotNumber, { durationSec }).then(loadSlots).catch((err) => {
                  toast({ title: "Duration not saved", description: err instanceof Error ? err.message : "Check 3–60 seconds", variant: "destructive" });
                });
              }}
              className="h-7 w-14 rounded-md border border-white/10 bg-black/30 px-1.5 text-[11px] text-white"
            />
          ) : null}
          {!sponsor.active && !processing && !failed ? (
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px] font-bold"
              onClick={() => {
                void updateSponsorMediaSlot(tournamentId, sponsor.slotNumber, { active: true }).then(loadSlots).catch(() => {});
              }}
            >
              Turn on
            </Button>
          ) : null}
          {broadcastReady ? (
            <>
              <span className={cn("text-[10px] font-semibold", obsReady ? "text-emerald-300" : "text-slate-400")}>
                OBS {screenPhrase(obsReady, obsLine.label)}
              </span>
              <span className={cn("text-[10px] font-semibold", ledReady ? "text-emerald-300" : "text-slate-400")}>
                LED {screenPhrase(ledReady, ledLine.label)}
              </span>
              {DESTINATIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDestination(item.id)}
                  className={cn(
                    "h-7 px-2 rounded-md text-[11px] font-bold border",
                    destination === item.id ? "bg-amber-400 text-black border-amber-400" : "border-white/10 text-slate-300",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <Button type="button" size="sm" className="h-7 px-3 text-[11px] font-bold" disabled={busy} onClick={play}>
                Play
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => void prepareScreens()}>
                Prepare
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={stop}>
                Stop
              </Button>
            </>
          ) : null}
          {!processing ? (
            <FilePick
              label={failed ? "Replace file" : "Replace"}
              primary={failed}
              disabled={busy}
              onFile={(file) => void onUpload(file, sponsor)}
            />
          ) : null}
          {sponsor.broadcastUrl && broadcastReady ? (
            <button type="button" className="text-[10px] text-slate-400 underline" onClick={() => setPreview((open) => !open)}>
              {preview ? "Close preview" : "Preview"}
            </button>
          ) : null}
          <button
            type="button"
            className="text-[10px] text-slate-500 underline"
            onClick={() => {
              void deleteSponsorMediaSlot(tournamentId, sponsor.slotNumber).then(loadSlots).catch((err) => {
                toast({ title: "Remove failed", description: err instanceof Error ? err.message : "Could not remove", variant: "destructive" });
              });
            }}
          >
            Remove
          </button>
        </div>
      ) : null}

      {nextStep ? <p className="text-[10px] text-slate-300">{nextStep}</p> : null}

      {preview && sponsor?.broadcastUrl ? (
        <div className="rounded-md border border-white/10 bg-black p-2 space-y-1">
          <p className="text-[10px] text-slate-400">Preview on this computer only. OBS and the LED stay as they are.</p>
          {sponsor.assetType === "video" ? (
            <video src={sponsor.broadcastUrl} controls muted playsInline className="max-h-40 w-full bg-black" />
          ) : (
            <img src={sponsor.broadcastUrl} alt="" className="max-h-40 w-full object-contain bg-black" />
          )}
        </div>
      ) : null}

      {sponsor ? (
        <button type="button" className="text-[10px] text-slate-500 underline" onClick={() => setDiagnostics((open) => !open)}>
          {diagnostics ? "Hide details" : "Details"}
        </button>
      ) : null}
      {diagnostics && sponsor ? (
        <div className="text-[10px] text-slate-400 space-y-1 font-mono">
          <div>Slot {sponsor.slotNumber} · v{sponsor.version} · {sponsor.fileSizeBytes ? `${Math.round(sponsor.fileSizeBytes / 1024 / 1024 * 10) / 10} MB` : "no broadcast file"} · {sponsor.checksum?.slice(0, 12) || "no checksum"}</div>
          <div>OBS {obs ? `${obs.playback.status}${obs.playback.error ? ` (${obs.playback.error})` : ""}` : "offline"}</div>
          <div>LED {led ? `${led.playback.status}${led.playback.error ? ` (${led.playback.error})` : ""}` : "offline"}</div>
        </div>
      ) : null}
    </section>
  );
}
