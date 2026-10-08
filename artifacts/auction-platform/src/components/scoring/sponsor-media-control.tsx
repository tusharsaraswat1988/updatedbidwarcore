import { useCallback, useEffect, useMemo, useState } from "react";
import { canPlaySponsorSlot, explainSurfaceReadiness, type SponsorMediaDestination } from "@workspace/scoring-core";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { scoringAppPath } from "@workspace/api-base/scoring-urls";
import {
  createSponsorDisplaySession,
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

function statusLabel(slot: SponsorMediaSlotDto): string {
  if (slot.processingStatus === "empty") return "Empty";
  if (slot.processingStatus === "uploading" || slot.processingStatus === "processing") return "Processing";
  if (slot.processingStatus === "failed") return "Failed";
  if (!slot.active || slot.processingStatus === "disabled") return "Off";
  return slot.assetType === "image" ? "Image" : "Video";
}

export function SponsorMediaControl({ tournamentId, className, density = "default" }: Props) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [obs, setObs] = useState<SponsorSurfaceReportDto | null>(null);
  const [led, setLed] = useState<SponsorSurfaceReportDto | null>(null);
  const [selected, setSelected] = useState(1);
  const [destination, setDestination] = useState<SponsorMediaDestination>("both");
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [preview, setPreview] = useState(false);

  const loadSlots = useCallback(() => {
    if (tournamentId <= 0) return;
    void fetchSponsorMediaSlots(tournamentId).then(setSlots).catch(() => {});
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

  const slot = slots.find((item) => item.slotNumber === selected) ?? null;
  const obsLine = slot ? surfaceLine(obs, slot) : { ready: false, label: "Offline" };
  const ledLine = slot ? surfaceLine(led, slot) : { ready: false, label: "Offline" };
  const obsReady = obsLine.ready;
  const ledReady = ledLine.ready;
  const gate = slot
    ? canPlaySponsorSlot({
      destination,
      processingStatus: slot.processingStatus,
      active: slot.active,
      obsReady,
      ledReady,
    })
    : { ok: false as const, reason: "Choose a slot" };

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

  async function onUpload(file: File | undefined) {
    if (!file || !slot) return;
    setBusy(true);
    try {
      await uploadSponsorMediaSlot(tournamentId, slot.slotNumber, file, slot.title || file.name.replace(/\.[^.]+$/, ""), durationSec);
      toast({ title: "Sponsor media uploaded", description: "It will be ready after processing. Then prepare the screens." });
      loadSlots();
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Could not upload", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (density === "console") {
    return (
      <section className={cn("shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 space-y-1", className)}>
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 shrink-0">Sponsors</span>
          <div className="grid grid-cols-4 gap-1 flex-1 min-w-0">
            {Array.from({ length: 4 }, (_, index) => {
              const item = slots.find((slotItem) => slotItem.slotNumber === index + 1);
              const active = selected === index + 1;
              return (
                <button
                  key={index + 1}
                  type="button"
                  onClick={() => setSelected(index + 1)}
                  title={item?.title || `Slot ${index + 1}`}
                  className={cn(
                    "h-6 rounded border px-1.5 text-left text-[10px] font-semibold truncate min-w-0",
                    active ? "border-amber-400 bg-amber-500/15 text-amber-100" : "border-white/10 bg-black/30 text-slate-300",
                  )}
                >
                  {index + 1} {item?.title || "Empty"}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {DESTINATIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDestination(item.id)}
                className={cn(
                  "h-6 px-1.5 rounded text-[10px] font-bold border",
                  destination === item.id ? "bg-amber-400 text-black border-amber-400" : "border-white/10 text-slate-300",
                )}
              >
                {item.label}
              </button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => {
                void sendSponsorMediaCue(tournamentId, {
                  action: "prepare",
                  slotId: 0,
                  slotNumber: 1,
                  version: 0,
                  destination: "both",
                }).then(() => toast({ title: "Preparing screens" })).catch((err) => {
                  toast({ title: "Prepare failed", description: err instanceof Error ? err.message : "Could not prepare", variant: "destructive" });
                });
              }}
            >
              Prepare
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 px-1.5 text-[10px]"
              onClick={() => {
                if (!cueBase) return;
                void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "stop", destination: "both" })
                  .catch((err) => toast({ title: "Stop failed", description: err instanceof Error ? err.message : "Could not stop", variant: "destructive" }));
              }}
            >
              Stop
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-[10px] font-bold"
              disabled={!gate.ok || busy || !cueBase}
              title={gate.ok ? "Play the prepared asset" : gate.reason}
              onClick={() => {
                if (!cueBase || !gate.ok) return;
                void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "play", destination })
                  .then(() => toast({ title: "Sponsor cue sent" }))
                  .catch((err) => toast({ title: "Play failed", description: err instanceof Error ? err.message : "Could not play", variant: "destructive" }));
              }}
            >
              Play
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0 flex-wrap text-[10px]">
          <span className={cn("shrink-0 font-semibold", obsReady ? "text-emerald-300" : "text-slate-400")}>
            OBS {obsReady ? "✓ READY" : `✕ ${obsLine.label}`}
          </span>
          <span className={cn("shrink-0 font-semibold", ledReady ? "text-emerald-300" : "text-slate-400")}>
            LED {ledReady ? "✓ READY" : `✕ ${ledLine.label}`}
          </span>
          <button type="button" className="text-slate-400 underline" onClick={() => void copyDisplayLink("obs")}>OBS link</button>
          <button type="button" className="text-slate-400 underline" onClick={() => void copyDisplayLink("led")}>LED link</button>
          {slot ? (
            <input
              value={slot.title}
              aria-label="Sponsor title"
              onChange={(event) => {
                const title = event.target.value;
                setSlots((current) => current.map((item) => item.slotNumber === slot.slotNumber ? { ...item, title } : item));
              }}
              onBlur={() => {
                if (!slot.id) return;
                void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { title: slot.title }).catch(() => {});
              }}
              placeholder="Sponsor title"
              className="h-6 min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-1.5 text-[10px] text-white"
            />
          ) : null}
          {slot?.assetType === "image" ? (
            <input
              type="number"
              min={3}
              max={60}
              aria-label="Seconds on screen"
              value={durationSec}
              onChange={(event) => {
                const next = Number(event.target.value);
                setSlots((current) => current.map((item) => item.slotNumber === slot.slotNumber ? { ...item, durationMs: next * 1000 } : item));
              }}
              onBlur={() => {
                if (!slot.id) return;
                void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { durationSec }).then(loadSlots).catch((err) => {
                  toast({ title: "Duration not saved", description: err instanceof Error ? err.message : "Check 3–60 seconds", variant: "destructive" });
                });
              }}
              className="h-6 w-12 rounded border border-white/10 bg-black/30 px-1 text-[10px] text-white"
            />
          ) : null}
          <label className="shrink-0 font-bold text-amber-200 cursor-pointer">
            {slot?.id ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,.mp4,.mov,.png,.jpg,.jpeg,.webp"
              className="hidden"
              disabled={busy || !slot}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onUpload(file);
              }}
            />
          </label>
          {slot?.id ? (
            <button
              type="button"
              className="shrink-0 text-slate-400 underline"
              onClick={() => {
                void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { active: !slot.active })
                  .then(loadSlots)
                  .catch(() => {});
              }}
            >
              {slot.active ? "Off" : "On"}
            </button>
          ) : null}
          {!gate.ok ? <span className="truncate text-amber-200/90">{gate.reason}</span> : null}
        </div>
      </section>
    );
  }

  return (
    <section className={cn("rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white">Sponsor / Promo Media</h3>
          <p className="text-[11px] text-slate-400">Prepare before the match. Play sends only a cue.</p>
          <div className="flex gap-3 text-[10px]">
            <button type="button" className="text-slate-300 underline" onClick={() => void copyDisplayLink("obs")}>Copy OBS link</button>
            <button type="button" className="text-slate-300 underline" onClick={() => void copyDisplayLink("led")}>Copy LED link</button>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-[11px]"
          onClick={() => {
            void sendSponsorMediaCue(tournamentId, {
              action: "prepare",
              slotId: 0,
              slotNumber: 1,
              version: 0,
              destination: "both",
            }).then(() => toast({ title: "Preparing screens" })).catch((err) => {
              toast({ title: "Prepare failed", description: err instanceof Error ? err.message : "Could not prepare", variant: "destructive" });
            });
          }}
        >
          Prepare
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {Array.from({ length: 4 }, (_, index) => {
          const item = slots.find((slotItem) => slotItem.slotNumber === index + 1);
          const active = selected === index + 1;
          return (
            <button
              key={index + 1}
              type="button"
              onClick={() => setSelected(index + 1)}
              className={cn(
                "rounded-lg border px-1.5 py-1.5 text-left min-w-0",
                active ? "border-amber-400/70 bg-amber-500/10" : "border-white/10 bg-black/20",
              )}
            >
              <div className="text-[10px] font-bold text-slate-300">Slot {index + 1}</div>
              <div className="truncate text-[11px] font-semibold text-white">{item?.title || "Empty"}</div>
              <div className="text-[10px] text-slate-400">{item ? statusLabel(item) : "Empty"}</div>
            </button>
          );
        })}
      </div>

      {slot ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {slot.posterUrl ? (
              <img src={slot.posterUrl} alt="" className="h-12 w-16 rounded object-cover bg-black" />
            ) : (
              <div className="h-12 w-16 rounded bg-black/40 border border-white/10" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{slot.title || "No asset"}</div>
              <div className="text-[10px] text-slate-400">
                {slot.assetType ? slot.assetType.toUpperCase() : "EMPTY"}
                {slot.durationMs ? ` · ${Math.round(slot.durationMs / 1000)}s` : ""}
                {slot.errorMessage ? ` · ${slot.errorMessage}` : ""}
              </div>
              <div className="text-[10px] mt-0.5">
                <span className={obsReady ? "text-emerald-300" : "text-slate-400"}>OBS {obsReady ? "✓ READY" : `✕ ${obsLine.label}`}</span>
                <span className="text-slate-600"> · </span>
                <span className={ledReady ? "text-emerald-300" : "text-slate-400"}>LED {ledReady ? "✓ READY" : `✕ ${ledLine.label}`}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <label className="text-[10px] text-slate-400">
              Title
              <input
                value={slot.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setSlots((current) => current.map((item) => item.slotNumber === slot.slotNumber ? { ...item, title } : item));
                }}
                onBlur={() => {
                  if (!slot.id) return;
                  void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { title: slot.title }).catch(() => {});
                }}
                className="mt-0.5 block h-7 w-36 rounded border border-white/10 bg-black/30 px-2 text-[11px] text-white"
              />
            </label>
            {slot.assetType === "image" ? (
              <label className="text-[10px] text-slate-400">
                Seconds
                <input
                  type="number"
                  min={3}
                  max={60}
                  value={durationSec}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSlots((current) => current.map((item) => item.slotNumber === slot.slotNumber ? { ...item, durationMs: next * 1000 } : item));
                  }}
                  onBlur={() => {
                    if (!slot.id) return;
                    void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { durationSec }).then(loadSlots).catch((err) => {
                      toast({ title: "Duration not saved", description: err instanceof Error ? err.message : "Check 3–60 seconds", variant: "destructive" });
                    });
                  }}
                  className="mt-0.5 block h-7 w-16 rounded border border-white/10 bg-black/30 px-2 text-[11px] text-white"
                />
              </label>
            ) : null}
            <label className="text-[10px] font-bold text-amber-200 cursor-pointer">
              {slot.id ? "Replace" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,.mp4,.mov,.png,.jpg,.jpeg,.webp"
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  void onUpload(file);
                }}
              />
            </label>
            {slot.id ? (
              <button
                type="button"
                className="text-[10px] text-slate-400 underline"
                onClick={() => {
                  void updateSponsorMediaSlot(tournamentId, slot.slotNumber, { active: !slot.active })
                    .then(loadSlots)
                    .catch(() => {});
                }}
              >
                {slot.active ? "Turn off" : "Turn on"}
              </button>
            ) : null}
            {slot.broadcastUrl && slot.processingStatus === "ready" ? (
              <button
                type="button"
                className="text-[10px] text-slate-300 underline"
                onClick={() => setPreview(true)}
              >
                Preview here
              </button>
            ) : null}
            {slot.id ? (
              <button
                type="button"
                className="text-[10px] text-red-300 underline"
                onClick={() => {
                  void deleteSponsorMediaSlot(tournamentId, slot.slotNumber).then(loadSlots).catch((err) => {
                    toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Could not delete", variant: "destructive" });
                  });
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {DESTINATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDestination(item.id)}
              className={cn(
                "h-7 px-2 rounded text-[11px] font-bold border",
                destination === item.id ? "bg-amber-400 text-black border-amber-400" : "border-white/10 text-slate-300",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              if (!cueBase) return;
              void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "stop", destination: "both" })
                .catch((err) => toast({ title: "Stop failed", description: err instanceof Error ? err.message : "Could not stop", variant: "destructive" }));
            }}
          >
            Stop
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-[11px] font-bold"
            disabled={!gate.ok || busy || !cueBase}
            title={gate.ok ? "Play the prepared asset" : gate.reason}
            onClick={() => {
              if (!cueBase || !gate.ok) return;
              void sendSponsorMediaCue(tournamentId, { ...cueBase, action: "play", destination })
                .then(() => toast({ title: "Sponsor cue sent" }))
                .catch((err) => toast({ title: "Play failed", description: err instanceof Error ? err.message : "Could not play", variant: "destructive" }));
            }}
          >
            Play
          </Button>
        </div>
      </div>
      {!gate.ok ? <p className="text-[10px] text-amber-200/90">{gate.reason}</p> : null}
      {preview && slot?.broadcastUrl ? (
        <div className="rounded-lg border border-white/10 bg-black p-2 space-y-1">
          <p className="text-[10px] text-slate-400">Preview on this computer only. OBS and the LED are unchanged.</p>
          {slot.assetType === "video" ? (
            <video src={slot.broadcastUrl} controls muted playsInline className="max-h-40 w-full bg-black" />
          ) : (
            <img src={slot.broadcastUrl} alt="" className="max-h-40 w-full object-contain bg-black" />
          )}
          <button type="button" className="text-[10px] text-slate-300 underline" onClick={() => setPreview(false)}>
            Close preview
          </button>
        </div>
      ) : null}

      <button type="button" className="text-[10px] text-slate-500 underline" onClick={() => setDiagnostics((open) => !open)}>
        {diagnostics ? "Hide diagnostics" : "Diagnostics"}
      </button>
      {diagnostics ? (
        <div className="text-[10px] text-slate-400 space-y-1 font-mono">
          <div>Slot {slot?.slotNumber} · v{slot?.version ?? 0} · {slot?.fileSizeBytes ? `${Math.round(slot.fileSizeBytes / 1024 / 1024 * 10) / 10} MB` : "no broadcast file"} · {slot?.checksum?.slice(0, 12) || "no checksum"}</div>
          <div>OBS {obs ? `${obs.playback.status}${obs.playback.error ? ` (${obs.playback.error})` : ""}` : "offline"}</div>
          <div>LED {led ? `${led.playback.status}${led.playback.error ? ` (${led.playback.error})` : ""}` : "offline"}</div>
        </div>
      ) : null}
    </section>
  );
}
