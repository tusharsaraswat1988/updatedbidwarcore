/**
 * Badminton venue LED loop music — upload override or import from auction break track.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { hubPanelClass, BtnSecondary } from "@/components/badminton/page-chrome";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";

export function VenueMusicSettingsPanel({
  tournamentId,
  branding,
}: {
  tournamentId: number;
  branding: BadmintonBranding | undefined;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [volumeDraft, setVolumeDraft] = useState(branding?.venueMusicVolume ?? 80);

  useEffect(() => {
    setVolumeDraft(branding?.venueMusicVolume ?? 80);
  }, [branding?.venueMusicVolume]);

  const patchMutation = useMutation({
    mutationFn: (body: {
      venueMusicUrl?: string | null;
      venueMusicVolume?: number;
      importAuctionMusic?: true;
    }) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
    },
    onError: (e: Error) => toastError(e, "Venue music"),
  });

  const overrideUrl = branding?.venueMusicUrl ?? null;
  const resolvedUrl = branding?.resolvedVenueMusicUrl ?? null;
  const sourceLabel = overrideUrl
    ? "Badminton override"
    : resolvedUrl
      ? "Auction / platform default"
      : "Built-in fallback (no file)";

  async function handleUpload(file: File) {
    if (!file.type.startsWith("audio/") && !/\.(mp3|ogg|wav|aac|m4a)$/i.test(file.name)) {
      toastError("Use mp3, ogg, wav, or aac", "Upload blocked");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toastError("Audio must be under 20 MB", "Upload blocked");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload/audio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      await patchMutation.mutateAsync({ venueMusicUrl: data.url });
      toastSuccess("Venue music uploaded");
    } catch (e) {
      toastError(e, "Venue music");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className={cn(hubPanelClass, "p-4 space-y-3")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/8 p-2">
          <Music2 className="h-4 w-4 text-white/70" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-white/90">Venue LED music</p>
          <p className="text-xs text-muted-foreground">
            Loop track for Control Center On / Pause. Falls back to auction break music, then
            platform default, when no badminton override is set.
          </p>
          <p className="text-[11px] font-mono text-white/45">Source: {sourceLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label
          className={cn(
            "inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10",
            (uploading || patchMutation.isPending) && "pointer-events-none opacity-50",
          )}
        >
          {uploading ? "Uploading…" : "Upload track"}
          <input
            ref={fileRef}
            type="file"
            accept="audio/*,.mp3,.ogg,.wav,.aac,.m4a"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </label>
        <BtnSecondary
          type="button"
          disabled={patchMutation.isPending}
          onClick={() =>
            patchMutation.mutate(
              { importAuctionMusic: true },
              {
                onSuccess: () => toastSuccess("Imported auction break music"),
              },
            )
          }
        >
          Import from auction
        </BtnSecondary>
        {overrideUrl ? (
          <BtnSecondary
            type="button"
            disabled={patchMutation.isPending}
            onClick={() =>
              patchMutation.mutate(
                { venueMusicUrl: null },
                { onSuccess: () => toastSuccess("Override cleared — using fallthrough") },
              )
            }
          >
            Clear override
          </BtnSecondary>
        ) : null}
      </div>

      <label className="flex items-center gap-3 text-xs text-white/70">
        <span className="w-16 shrink-0">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volumeDraft}
          disabled={patchMutation.isPending}
          onChange={(e) => setVolumeDraft(Number(e.target.value) || 80)}
          onPointerUp={() => {
            if (volumeDraft !== (branding?.venueMusicVolume ?? 80)) {
              patchMutation.mutate({ venueMusicVolume: volumeDraft });
            }
          }}
          className="w-full accent-amber-400"
        />
        <span className="w-8 tabular-nums text-right">{volumeDraft}</span>
      </label>
    </div>
  );
}
