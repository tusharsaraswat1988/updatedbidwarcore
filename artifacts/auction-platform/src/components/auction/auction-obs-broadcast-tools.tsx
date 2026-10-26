import { useCallback, useEffect, useState } from "react";
import { explainSurfaceReadiness, SPONSOR_MEDIA_SLOT_COUNT } from "@workspace/scoring-core";
import type { AuctionState } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSetPresentationContext } from "@/hooks/use-presentation-context";
import type { PrizePlate } from "@/lib/presentation-context";
import {
  createSponsorDisplaySession,
  fetchSponsorMediaReadiness,
  fetchSponsorMediaSlots,
  rememberSponsorDisplayToken,
  sendAuctionSponsorCue,
  uploadSponsorMediaSlot,
  type SponsorMediaSlotDto,
  type SponsorSurfaceReportDto,
} from "@/lib/sponsor-media-api";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: number;
  revision: number;
  prize: PrizePlate | null;
  disabled?: boolean;
  layout: "bar" | "panel";
  onApplied: (state: AuctionState) => void;
};

const FILE_ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/quicktime,.mp4,.mov,.png,.jpg,.jpeg,.webp";

function hasSponsor(slot: SponsorMediaSlotDto): boolean {
  return Boolean(slot.id) && slot.processingStatus !== "empty";
}

function slotReady(report: SponsorSurfaceReportDto | null, slot: SponsorMediaSlotDto): boolean {
  const item = report?.slots.find((entry) => entry.slotNumber === slot.slotNumber) ?? null;
  return explainSurfaceReadiness({
    processingStatus: slot.processingStatus,
    active: slot.active,
    version: slot.version,
    surfaceOnline: Boolean(report),
    report: item,
  }) === "Ready";
}

export function AuctionObsBroadcastTools({
  tournamentId,
  revision,
  prize,
  disabled = false,
  layout,
  onApplied,
}: Props) {
  const { toast } = useToast();
  const setPresentation = useSetPresentationContext();
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [obs, setObs] = useState<SponsorSurfaceReportDto | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const panel = layout === "panel";
  const livePrize = Boolean(prize?.line1 && prize?.line2);

  const loadSlots = useCallback(() => {
    if (tournamentId <= 0) return;
    void fetchSponsorMediaSlots(tournamentId).then(setSlots).catch(() => {});
  }, [tournamentId]);

  const loadReadiness = useCallback(() => {
    if (tournamentId <= 0) return;
    void fetchSponsorMediaReadiness(tournamentId).then((report) => setObs(report.obs)).catch(() => {});
  }, [tournamentId]);

  useEffect(() => {
    loadSlots();
    loadReadiness();
    const slotsTimer = window.setInterval(loadSlots, 5000);
    const readyTimer = window.setInterval(loadReadiness, 3000);
    return () => {
      window.clearInterval(slotsTimer);
      window.clearInterval(readyTimer);
    };
  }, [loadReadiness, loadSlots]);

  const filled = slots.filter(hasSponsor);
  const slot = filled.find((item) => item.slotNumber === selected) ?? filled[0] ?? null;
  const ready = slot ? slotReady(obs, slot) : false;
  const playing = obs?.playback.status === "playing";
  const uploadTarget = slots.find((item) => !hasSponsor(item)) ?? null;

  useEffect(() => {
    if (!slot) return;
    if (selected !== slot.slotNumber) setSelected(slot.slotNumber);
  }, [selected, slot]);

  const wakeObs = useCallback(async () => {
    const session = await createSponsorDisplaySession(tournamentId, "obs");
    rememberSponsorDisplayToken(tournamentId, "obs", session.token);
    await sendAuctionSponsorCue(tournamentId, {
      action: "prepare",
      slotId: 0,
      slotNumber: 1,
      version: 0,
    }, { obs: session.token });
    return session.token;
  }, [tournamentId]);

  useEffect(() => {
    if (tournamentId <= 0 || filled.length === 0) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled || ready) return;
      void wakeObs().catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [filled.length, ready, tournamentId, wakeObs]);

  async function pushPrize() {
    const nextLine1 = line1.trim();
    const nextLine2 = line2.trim();
    if (!nextLine1 || nextLine1.length > 100 || !nextLine2 || nextLine2.length > 180) {
      toast({
        title: "Two lines required",
        description: "Line 1 can be 100 characters. Line 2 can be 180.",
        variant: "destructive",
      });
      return;
    }
    try {
      const result = await setPresentation.mutateAsync({
        tournamentId,
        data: {
          expectedRevision: revision,
          prize: { line1: nextLine1, line2: nextLine2 },
        },
      });
      onApplied(result);
      toast({ title: "Prize is on OBS", description: nextLine1 });
    } catch (err: unknown) {
      toast({
        title: "Prize did not reach OBS",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function closePrize() {
    try {
      const result = await setPresentation.mutateAsync({
        tournamentId,
        data: { expectedRevision: revision, prize: null },
      });
      onApplied(result);
      toast({ title: "Prize plate closed" });
    } catch (err: unknown) {
      toast({
        title: "Prize plate stayed up",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    }
  }

  async function pushAd() {
    if (!slot?.id || !ready) return;
    setBusy(true);
    try {
      const token = await wakeObs();
      await sendAuctionSponsorCue(tournamentId, {
        action: "play",
        slotId: slot.id,
        slotNumber: slot.slotNumber,
        version: slot.version,
      }, { obs: token });
      toast({
        title: "Sponsor is on OBS",
        description: slot.assetType === "image"
          ? "The photo holds, then the live screen returns."
          : "The video plays once, then the live screen returns.",
      });
      loadReadiness();
    } catch (err: unknown) {
      toast({
        title: "Sponsor did not play",
        description: err instanceof Error ? err.message : "Refresh the OBS browser source, then push again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelAd() {
    setBusy(true);
    try {
      await sendAuctionSponsorCue(tournamentId, {
        action: "stop",
        slotId: slot?.id ?? 0,
        slotNumber: slot?.slotNumber ?? 1,
        version: slot?.version ?? 0,
      });
      toast({ title: "Back to the live screen" });
      loadReadiness();
    } catch (err: unknown) {
      toast({
        title: "Could not cancel the sponsor",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File | undefined) {
    if (!file || !uploadTarget) return;
    setBusy(true);
    try {
      const title = file.name.replace(/\.[^.]+$/, "");
      await uploadSponsorMediaSlot(tournamentId, uploadTarget.slotNumber, file, title, 10);
      toast({ title: "Ad added", description: "It can be pushed once OBS shows Ready." });
      loadSlots();
    } catch (err: unknown) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "h-7 rounded border border-white/15 bg-black/30 px-2 text-[11px] text-white placeholder:text-white/30";

  return (
    <div className={cn(
      "flex gap-2",
      panel ? "flex-col" : "flex-wrap items-center",
    )}>
      <div className={cn(
        "flex gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/5",
        panel ? "flex-col p-2" : "items-center px-1.5 py-1",
      )}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-200/80">
          Prize
          {livePrize ? <span className="ml-1 text-amber-300">Live</span> : null}
        </span>
        <input
          value={line1}
          onChange={(event) => setLine1(event.target.value)}
          maxLength={100}
          placeholder="Line 1"
          aria-label="Prize line 1"
          disabled={disabled}
          className={cn(fieldClass, panel ? "w-full" : "w-36")}
        />
        <input
          value={line2}
          onChange={(event) => setLine2(event.target.value)}
          maxLength={180}
          placeholder="Line 2"
          aria-label="Prize line 2"
          disabled={disabled}
          className={cn(fieldClass, panel ? "w-full" : "w-44")}
        />
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-[11px] font-bold"
          disabled={disabled || setPresentation.isPending}
          onClick={() => { void pushPrize(); }}
        >
          Push
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-[11px]"
          disabled={disabled || !livePrize || setPresentation.isPending}
          onClick={() => { void closePrize(); }}
        >
          Close
        </Button>
      </div>

      <div className={cn(
        "flex gap-1.5 rounded-lg border border-red-500/25 bg-red-500/5",
        panel ? "flex-col p-2" : "items-center px-1.5 py-1",
      )}>
        <span className="text-[9px] font-bold uppercase tracking-wider text-red-200/80">
          Sponsor
          {playing ? <span className="ml-1 text-red-300">On air</span> : null}
        </span>
        <select
          aria-label="Sponsor ad"
          value={slot ? String(slot.slotNumber) : ""}
          disabled={disabled || filled.length === 0}
          onChange={(event) => setSelected(Number(event.target.value))}
          className={cn(fieldClass, panel ? "w-full" : "max-w-[11rem]")}
        >
          {filled.length === 0 ? <option value="">No ads yet</option> : null}
          {filled.map((item) => (
            <option key={item.slotNumber} value={item.slotNumber}>
              {item.title || `Ad ${item.slotNumber}`}
              {item.assetType === "image" ? " · Photo" : item.assetType === "video" ? " · Video" : ""}
            </option>
          ))}
        </select>
        <span className={cn("text-[10px] font-semibold", ready ? "text-emerald-300" : "text-white/40")}>
          {slot ? (ready ? "Ready" : "Not ready") : ""}
        </span>
        <Button
          type="button"
          size="sm"
          className="h-7 px-2.5 text-[11px] font-bold"
          disabled={disabled || busy || !ready}
          onClick={() => { void pushAd(); }}
        >
          Push
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5 text-[11px]"
          disabled={disabled || busy}
          onClick={() => { void cancelAd(); }}
        >
          Cancel
        </Button>
        {filled.length < SPONSOR_MEDIA_SLOT_COUNT && uploadTarget ? (
          <label className={cn(
            "inline-flex h-7 items-center rounded border border-white/15 px-2 text-[11px] font-semibold text-white/70",
            disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}>
            Add ad
            <input
              type="file"
              accept={FILE_ACCEPT}
              className="hidden"
              disabled={disabled || busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void onUpload(file);
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
