/**
 * Badminton venue LED banner — upload new, or import auction main banner.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useState } from "react";
import { ImageIcon } from "lucide-react";
import { hubPanelClass, BtnSecondary } from "@/components/badminton/page-chrome";
import { BannerFrame } from "@/components/display/banner-frame";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonBranding, BadmintonBannerFit } from "@/hooks/use-badminton-branding";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { cn } from "@/lib/utils";

const ImageEditorDialog = lazy(() =>
  import("@/components/image-editor-dialog").then((m) => ({ default: m.ImageEditorDialog })),
);

type VenueBannerPatchBody = {
  venueBannerUrl?: string | null;
  venueBannerPublicId?: string | null;
  venueBannerFit?: BadmintonBannerFit;
  importAuctionBanner?: true;
};

export function VenueBannerSettingsPanel({
  tournamentId,
  branding,
  sportLabel = "badminton",
  brandingQueryKey,
  patchPresentation,
}: {
  tournamentId: number;
  branding: BadmintonBranding | undefined;
  sportLabel?: "badminton" | "cricket";
  brandingQueryKey?: readonly unknown[];
  patchPresentation?: (body: VenueBannerPatchBody) => Promise<BadmintonBranding>;
}) {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const queryKey = brandingQueryKey ?? (["badminton-branding", tournamentId] as const);

  const patchMutation = useMutation({
    mutationFn: (body: VenueBannerPatchBody) =>
      patchPresentation
        ? patchPresentation(body)
        : badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
    onSuccess: (data) => {
      qc.setQueryData([...queryKey], data);
    },
    onError: (e: Error) => toastError(e, "Venue banner"),
  });

  const overrideUrl = branding?.venueBannerUrl ?? null;
  const resolvedUrl = branding?.resolvedVenueBannerUrl ?? null;
  const auctionUrl = branding?.auctionMainBannerUrl ?? null;
  const fit = branding?.resolvedVenueBannerFit ?? "cover";
  const sourceLabel = overrideUrl
    ? `Custom banner for ${sportLabel}`
    : auctionUrl
      ? "Using auction main banner"
      : "No banner set yet";

  return (
    <div className={cn(hubPanelClass, "p-4 space-y-3")}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-white/8 p-2">
          <ImageIcon className="h-4 w-4 text-white/70" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-white/90">Venue LED banner</p>
          <p className="text-xs text-muted-foreground">
            Full-screen image for the scoreboard Banner moment (Operator Controls).
            Does not appear on OBS. Import the auction banner or upload a new one.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <BannerFrame
          url={resolvedUrl}
          fit={fit}
          className="w-40 shrink-0 rounded-md border border-white/10"
          emptyLabel="No banner"
        />
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">
            Current banner
          </p>
          <p className="text-[11px] text-white/45">{sourceLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <BtnSecondary
          type="button"
          disabled={patchMutation.isPending}
          onClick={() => setEditorOpen(true)}
        >
          {resolvedUrl ? "Replace banner" : "Upload banner"}
        </BtnSecondary>

        <BtnSecondary
          type="button"
          disabled={patchMutation.isPending || !auctionUrl}
          onClick={() => {
            patchMutation.mutate(
              { importAuctionBanner: true },
              {
                onSuccess: () =>
                  toastSuccess(
                    "Using auction banner",
                    `Saved as the ${sportLabel} venue banner.`,
                  ),
              },
            );
          }}
        >
          Use auction banner
        </BtnSecondary>

        {overrideUrl ? (
          <BtnSecondary
            type="button"
            disabled={patchMutation.isPending}
            onClick={() => {
              patchMutation.mutate(
                { venueBannerUrl: null, venueBannerPublicId: null },
                {
                  onSuccess: () =>
                    toastSuccess(
                      "Custom banner removed",
                      auctionUrl
                        ? "Scoreboard will use the auction banner."
                        : "No banner left — upload or import one.",
                    ),
                },
              );
            }}
          >
            Remove custom banner
          </BtnSecondary>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-white/45 font-semibold">
          Fit
        </span>
        {(["cover", "contain"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={patchMutation.isPending || !resolvedUrl}
            onClick={() => {
              patchMutation.mutate(
                { venueBannerFit: option },
                {
                  onSuccess: () =>
                    toastSuccess(
                      option === "cover" ? "Cover" : "Contain",
                      "Banner fit saved.",
                    ),
                },
              );
            }}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-semibold transition-all disabled:opacity-40",
              fit === option
                ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                : "bg-muted/20 border border-border/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "cover" ? "Cover" : "Contain"}
          </button>
        ))}
        <p className="text-[11px] text-white/40 w-full">
          {fit === "contain"
            ? "Shows the full image; may letterbox on the LED."
            : "Fills the screen; edges may crop."}
        </p>
      </div>

      {editorOpen ? (
        <Suspense fallback={null}>
          <ImageEditorDialog
            open={editorOpen}
            onClose={() => setEditorOpen(false)}
            initialUrl={resolvedUrl ?? undefined}
            aspect={16 / 9}
            title="Venue banner"
            exportMaxWidthOrHeight={1920}
            exportMaxSizeMB={4.5}
            exportHint="16:9 — optimized for LED scoreboards"
            onSave={(upload) => {
              setEditorOpen(false);
              patchMutation.mutate(
                {
                  venueBannerUrl: upload.url,
                  venueBannerPublicId: upload.publicId,
                  venueBannerFit: branding?.venueBannerFit ?? "cover",
                },
                {
                  onSuccess: () =>
                    toastSuccess(
                      "Banner saved",
                      "Push Banner from Operator Controls Moments to show it on the scoreboard.",
                    ),
                },
              );
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
