import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SPONSOR_MEDIA_SLOT_COUNT,
  SPONSOR_IMAGE_DURATION_DEFAULT_SEC,
  SPONSOR_IMAGE_DURATION_MIN_SEC,
  SPONSOR_IMAGE_DURATION_MAX_SEC,
} from "@workspace/scoring-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchSponsorMediaSlots,
  fetchSponsorMediaReadiness,
  uploadSponsorMediaSlot,
  updateSponsorMediaSlot,
  deleteSponsorMediaSlot,
  type SponsorMediaSlotDto,
  type SponsorSurfaceReportDto,
} from "@/lib/sponsor-media-api";
import {
  Clapperboard,
  Upload,
  Trash2,
  Play,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Video,
  Image as ImageIcon,
  Clock,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FILE_ACCEPT =
  "image/png,image/jpeg,image/webp,video/mp4,video/quicktime,.mp4,.mov,.png,.jpg,.jpeg,.webp";

type Props = {
  tournamentId: number;
};

function hasMedia(slot: SponsorMediaSlotDto): boolean {
  return Boolean(slot.id) && slot.processingStatus !== "empty";
}

export function SponsorMediaSettingsEditor({ tournamentId }: Props) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<SponsorMediaSlotDto[]>([]);
  const [, setReadiness] = useState<SponsorSurfaceReportDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [previewSlot, setPreviewSlot] = useState<SponsorMediaSlotDto | null>(null);

  const loadData = useCallback(() => {
    if (tournamentId <= 0) return;
    Promise.all([
      fetchSponsorMediaSlots(tournamentId).catch(() => []),
      fetchSponsorMediaReadiness(tournamentId).catch(() => ({ obs: null, led: null })),
    ])
      .then(([nextSlots, nextReady]) => {
        setSlots(nextSlots);
        setReadiness(nextReady.obs);
      })
      .finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll while any slot is uploading or processing
  const hasProcessing = useMemo(
    () =>
      slots.some(
        (s) => s.processingStatus === "uploading" || s.processingStatus === "processing",
      ),
    [slots],
  );

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = window.setInterval(loadData, 3000);
    return () => window.clearInterval(interval);
  }, [hasProcessing, loadData]);

  // Only filled slots to display
  const activeSlots = useMemo(() => slots.filter(hasMedia), [slots]);

  // Next available slot number (1..5)
  const nextAvailableSlot = useMemo(() => {
    for (let i = 1; i <= SPONSOR_MEDIA_SLOT_COUNT; i++) {
      const match = slots.find((s) => s.slotNumber === i);
      if (!match || !hasMedia(match)) return i;
    }
    return null;
  }, [slots]);

  async function handleUpload(slotNumber: number, file: File | undefined) {
    if (!file || tournamentId <= 0) return;
    setBusySlot(slotNumber);
    try {
      const defaultTitle = file.name.replace(/\.[^.]+$/, "");
      await uploadSponsorMediaSlot(tournamentId, slotNumber, file, defaultTitle, 10);
      toast({
        title: `Commercial added`,
        description: "Media is now processing and will be available on the auction console.",
      });
      loadData();
    } catch (err: unknown) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload media file",
        variant: "destructive",
      });
    } finally {
      setBusySlot(null);
    }
  }

  async function handleTitleBlur(slotNumber: number, title: string) {
    const trimmed = title.trim();
    try {
      await updateSponsorMediaSlot(tournamentId, slotNumber, { title: trimmed });
      loadData();
    } catch (err: unknown) {
      toast({
        title: "Failed to update title",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    }
  }

  async function handleDurationBlur(slotNumber: number, seconds: number) {
    const clamped = Math.max(
      SPONSOR_IMAGE_DURATION_MIN_SEC,
      Math.min(SPONSOR_IMAGE_DURATION_MAX_SEC, seconds || SPONSOR_IMAGE_DURATION_DEFAULT_SEC),
    );
    try {
      await updateSponsorMediaSlot(tournamentId, slotNumber, { durationSec: clamped });
      loadData();
    } catch (err: unknown) {
      toast({
        title: "Failed to update duration",
        description: err instanceof Error ? err.message : "Check 3–60 seconds",
        variant: "destructive",
      });
    }
  }

  async function handleToggleActive(slotNumber: number, active: boolean) {
    setBusySlot(slotNumber);
    try {
      await updateSponsorMediaSlot(tournamentId, slotNumber, { active });
      loadData();
      toast({
        title: active ? `Ad enabled` : `Ad disabled`,
        description: active
          ? "This ad will appear on the Live Auction Console."
          : "This ad is hidden from the Live Auction Console.",
      });
    } catch (err: unknown) {
      toast({
        title: "Could not update status",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusySlot(null);
    }
  }

  async function handleDelete(slotNumber: number) {
    if (!window.confirm(`Are you sure you want to remove this commercial?`)) return;
    setBusySlot(slotNumber);
    try {
      await deleteSponsorMediaSlot(tournamentId, slotNumber);
      toast({
        title: `Commercial removed`,
        description: "The media file has been cleared.",
      });
      loadData();
    } catch (err: unknown) {
      toast({
        title: "Failed to remove",
        description: err instanceof Error ? err.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setBusySlot(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        <span className="text-xs">Checking broadcast media...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── EMPTY STATE: When no videos are configured ── */}
      {activeSlots.length === 0 ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-dashed border-border/80 bg-muted/10 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Clapperboard className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                No Sponsor Videos or Commercials Added (Optional)
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                If your sponsors have promotional video clips (MP4) or full-screen ads for stream breaks, you can upload up to 5 here.
              </p>
            </div>
          </div>

          {nextAvailableSlot && (
            <label
              className={cn(
                "inline-flex items-center justify-center gap-1.5 h-8 px-3.5 rounded-lg border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-semibold cursor-pointer shrink-0 transition-colors",
                busySlot !== null && "pointer-events-none opacity-50",
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload Commercial
              <input
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                disabled={busySlot !== null}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void handleUpload(nextAvailableSlot, file);
                }}
              />
            </label>
          )}
        </div>
      ) : (
        /* ── FILLED STATE: Compact, clean list of only added slots ── */
        <div className="space-y-2.5">
          {activeSlots.map((slot) => {
            const isBusy = busySlot === slot.slotNumber;
            const isProcessing =
              slot.processingStatus === "uploading" || slot.processingStatus === "processing";
            const isFailed = slot.processingStatus === "failed";
            const isReady = slot.processingStatus === "ready";
            const durationSec = Math.round((slot.durationMs || 10000) / 1000);

            return (
              <div
                key={slot.slotNumber}
                className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border transition-all duration-150",
                  slot.active
                    ? "border-border/80 bg-card/90 shadow-sm"
                    : "border-border/40 bg-muted/10 opacity-70",
                )}
              >
                {/* Left: Thumbnail & basic info */}
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail */}
                  <div className="relative w-24 h-14 rounded-md overflow-hidden bg-black shrink-0 border border-border/50 flex items-center justify-center group">
                    {slot.assetType === "video" ? (
                      <>
                        {slot.posterUrl || slot.broadcastUrl ? (
                          <video
                            src={slot.broadcastUrl || undefined}
                            poster={slot.posterUrl || undefined}
                            preload="metadata"
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Video className="w-5 h-5 text-muted-foreground opacity-50" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewSlot(slot)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          title="Preview video"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </button>
                      </>
                    ) : (
                      <>
                        {slot.broadcastUrl ? (
                          <img
                            src={slot.broadcastUrl}
                            alt={slot.title}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-muted-foreground opacity-50" />
                        )}
                        <button
                          type="button"
                          onClick={() => setPreviewSlot(slot)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                          title="View image"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* Title & Badges */}
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        defaultValue={slot.title}
                        placeholder={`Commercial ${slot.slotNumber}`}
                        className="h-7 text-xs font-medium w-48 sm:w-56 bg-background/70 border-border/60"
                        disabled={isBusy}
                        onBlur={(e) => void handleTitleBlur(slot.slotNumber, e.target.value)}
                      />
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {slot.assetType === "video" ? (
                          <span className="flex items-center gap-1">
                            <Video className="w-2.5 h-2.5 text-indigo-400" />
                            {durationSec > 0 ? `${durationSec}s Video` : "Video"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <ImageIcon className="w-2.5 h-2.5 text-sky-400" />
                            {durationSec}s Graphic
                          </span>
                        )}
                      </Badge>

                      {isProcessing ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-300 bg-amber-500/10">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" /> Processing
                        </Badge>
                      ) : isFailed ? (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertCircle className="w-2.5 h-2.5" /> Failed
                        </Badge>
                      ) : isReady ? (
                        <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-400 bg-emerald-500/10">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                        </Badge>
                      ) : null}
                    </div>

                    {slot.assetType === "image" && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>Display hold:</span>
                        <input
                          type="number"
                          min={SPONSOR_IMAGE_DURATION_MIN_SEC}
                          max={SPONSOR_IMAGE_DURATION_MAX_SEC}
                          defaultValue={durationSec}
                          className="h-5 w-12 rounded border border-border/60 bg-background/50 px-1 text-[11px] text-foreground text-center"
                          onBlur={(e) =>
                            void handleDurationBlur(slot.slotNumber, Number(e.target.value))
                          }
                        />
                        <span>seconds</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Toggle & Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pr-2 border-r border-border/40">
                    <span className="text-[11px] font-medium hidden md:inline">Console:</span>
                    <Switch
                      checked={slot.active}
                      disabled={isBusy || isProcessing}
                      title={slot.active ? "Enabled on Live Console" : "Disabled on Live Console"}
                      onCheckedChange={(checked) =>
                        void handleToggleActive(slot.slotNumber, checked)
                      }
                    />
                  </div>

                  {slot.broadcastUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setPreviewSlot(slot)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Preview
                    </Button>
                  )}

                  <label
                    className={cn(
                      "inline-flex items-center gap-1 h-7 px-2 rounded-md border border-border/60 bg-background/60 hover:bg-accent text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors",
                      isBusy && "pointer-events-none opacity-50",
                    )}
                    title="Replace media file"
                  >
                    <Upload className="w-3 h-3" />
                    Replace
                    <input
                      type="file"
                      accept={FILE_ACCEPT}
                      className="hidden"
                      disabled={isBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        void handleUpload(slot.slotNumber, file);
                      }}
                    />
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    disabled={isBusy}
                    onClick={() => void handleDelete(slot.slotNumber)}
                    title="Remove commercial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Add another button if under 5 */}
          {nextAvailableSlot && (
            <div className="flex items-center justify-between pt-1">
              <label
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-dashed border-border/80 hover:border-amber-400/50 bg-background/50 hover:bg-amber-400/5 text-xs font-medium text-muted-foreground hover:text-amber-300 cursor-pointer transition-colors",
                  busySlot !== null && "pointer-events-none opacity-50",
                )}
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Add Another Commercial ({activeSlots.length} of {SPONSOR_MEDIA_SLOT_COUNT} used)
                <input
                  type="file"
                  accept={FILE_ACCEPT}
                  className="hidden"
                  disabled={busySlot !== null}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void handleUpload(nextAvailableSlot, file);
                  }}
                />
              </label>

              <span className="text-[10px] text-muted-foreground">
                Ads automatically sync to the Live Auction Operator Console.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={Boolean(previewSlot)} onOpenChange={(open) => !open && setPreviewSlot(null)}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Clapperboard className="w-4 h-4 text-amber-400" />
              {previewSlot?.title || `Sponsor Slot ${previewSlot?.slotNumber}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preview on this device. Live OBS stream and big screen remain unaffected.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg overflow-hidden bg-black border border-border/60 aspect-video flex items-center justify-center mt-2">
            {previewSlot?.broadcastUrl ? (
              previewSlot.assetType === "video" ? (
                <video
                  src={previewSlot.broadcastUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={previewSlot.broadcastUrl}
                  alt={previewSlot.title}
                  className="w-full h-full object-contain"
                />
              )
            ) : (
              <p className="text-xs text-muted-foreground">No media available to preview</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
