/**
 * Badminton venue LED loop music — upload, preview, or use auction break track.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import { hubPanelClass, BtnSecondary } from "@/components/badminton/page-chrome";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";

function trackLabelFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const name = new URL(url).pathname.split("/").pop();
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

type VenueMusicPatchBody = {
  venueMusicUrl?: string | null;
  venueMusicFileName?: string | null;
  venueMusicVolume?: number;
  importAuctionMusic?: true;
};

export function VenueMusicSettingsPanel({
  tournamentId,
  branding,
  sportLabel = "badminton",
  brandingQueryKey,
  patchPresentation,
}: {
  tournamentId: number;
  branding: BadmintonBranding | undefined;
  /** Surface name in helper copy (badminton | cricket). */
  sportLabel?: "badminton" | "cricket";
  brandingQueryKey?: readonly unknown[];
  patchPresentation?: (body: VenueMusicPatchBody) => Promise<BadmintonBranding>;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [volumeDraft, setVolumeDraft] = useState(branding?.venueMusicVolume ?? 80);
  const queryKey = brandingQueryKey ?? (["badminton-branding", tournamentId] as const);

  useEffect(() => {
    setVolumeDraft(branding?.venueMusicVolume ?? 80);
  }, [branding?.venueMusicVolume]);

  useEffect(() => {
    return () => {
      const el = previewRef.current;
      if (el) {
        el.pause();
        el.src = "";
        previewRef.current = null;
      }
    };
  }, []);

  const patchMutation = useMutation({
    mutationFn: (body: VenueMusicPatchBody) =>
      patchPresentation
        ? patchPresentation(body)
        : badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
    onSuccess: (data) => {
      qc.setQueryData([...queryKey], data);
    },
    onError: (e: Error) => toastError(e, "Venue music"),
  });

  const overrideUrl = branding?.venueMusicUrl ?? null;
  const resolvedUrl = branding?.resolvedVenueMusicUrl ?? null;
  const activeUrl = overrideUrl || resolvedUrl;
  const fileName =
    branding?.venueMusicFileName?.trim()
    || trackLabelFromUrl(overrideUrl)
    || trackLabelFromUrl(resolvedUrl);

  const sourceLabel = overrideUrl
    ? `Custom song for ${sportLabel}`
    : resolvedUrl
      ? "Using auction / platform music"
      : "No song set yet";

  function stopPreview() {
    const el = previewRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPreviewing(false);
  }

  async function togglePreview() {
    setPreviewError("");
    if (!activeUrl) {
      setPreviewError("No song available to preview.");
      return;
    }
    if (previewing) {
      stopPreview();
      return;
    }
    try {
      let el = previewRef.current;
      if (!el || previewUrlRef.current !== activeUrl) {
        el?.pause();
        el = new Audio(activeUrl);
        el.loop = true;
        el.volume = Math.min(1, volumeDraft / 100);
        el.onended = () => setPreviewing(false);
        el.onerror = () => {
          setPreviewing(false);
          setPreviewError("Could not play this file. Try re-uploading the song.");
        };
        previewRef.current = el;
        previewUrlRef.current = activeUrl;
      } else {
        el.volume = Math.min(1, volumeDraft / 100);
      }
      await el.play();
      setPreviewing(true);
    } catch {
      setPreviewing(false);
      setPreviewError("Click Preview again — the browser needs a tap to start audio.");
    }
  }

  async function handleUpload(file: File) {
    if (!file.type.startsWith("audio/") && !/\.(mp3|ogg|wav|aac|m4a)$/i.test(file.name)) {
      toastError("Use mp3, ogg, wav, or aac", "Upload blocked");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toastError("Audio must be under 8 MB", "Upload blocked");
      return;
    }
    stopPreview();
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload/audio", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await r.json()) as {
        url?: string;
        error?: string;
        originalName?: string;
      };
      if (!r.ok || !data.url) {
        throw new Error(data.error || "Upload failed");
      }
      await patchMutation.mutateAsync({
        venueMusicUrl: data.url,
        venueMusicFileName: file.name || data.originalName || null,
      });
      toastSuccess("Song uploaded", "Press Play music in Control Center to play it on the scoreboard.");
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
            Background song for the scoreboard when Control Center presses Play music.
            If you don’t upload one, auction break music is used.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">
          Current song
        </p>
        <p className="text-sm text-white/90 font-medium truncate" title={fileName ?? undefined}>
          {fileName || "None — built-in tone will play"}
        </p>
        <p className="text-[11px] text-white/45">{sourceLabel}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!activeUrl || patchMutation.isPending}
          onClick={() => void togglePreview()}
          className={cn(
            "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold",
            previewing
              ? "border-amber-400/40 bg-amber-500/15 text-amber-100"
              : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
            (!activeUrl || patchMutation.isPending) && "pointer-events-none opacity-50",
          )}
        >
          {previewing ? (
            <>
              <Pause className="h-3.5 w-3.5" aria-hidden />
              Stop preview
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" aria-hidden />
              Preview song
            </>
          )}
        </button>

        <label
          className={cn(
            "inline-flex min-h-9 cursor-pointer items-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10",
            (uploading || patchMutation.isPending) && "pointer-events-none opacity-50",
          )}
        >
          {uploading ? "Uploading…" : "Upload new song"}
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
          onClick={() => {
            stopPreview();
            patchMutation.mutate(
              { importAuctionMusic: true },
              {
                onSuccess: () =>
                  toastSuccess(
                    "Using auction break music",
                    `Saved as the ${sportLabel} venue song.`,
                  ),
              },
            );
          }}
        >
          Use auction break music
        </BtnSecondary>

        {overrideUrl ? (
          <BtnSecondary
            type="button"
            disabled={patchMutation.isPending}
            onClick={() => {
              stopPreview();
              patchMutation.mutate(
                { venueMusicUrl: null, venueMusicFileName: null },
                {
                  onSuccess: () =>
                    toastSuccess("Custom song removed", "Scoreboard will use auction / platform music."),
                },
              );
            }}
          >
            Remove custom song
          </BtnSecondary>
        ) : null}
      </div>

      {previewError ? (
        <p className="text-xs text-amber-300/90" role="alert">
          {previewError}
        </p>
      ) : null}

      <label className="flex items-center gap-3 text-xs text-white/70">
        <span className="w-16 shrink-0">Volume</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volumeDraft}
          disabled={patchMutation.isPending}
          onChange={(e) => {
            const next = Number(e.target.value) || 80;
            setVolumeDraft(next);
            if (previewRef.current) {
              previewRef.current.volume = Math.min(1, next / 100);
            }
          }}
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
