/**
 * Mission Control right rail — live screen controls first; links/QR collapsed.
 * Hot-path controls: never disable on in-flight network; optimistic UI only.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Copy, Monitor, Pause, Play, QrCode, Radio, Tablet, Trophy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import { hubPanelClass } from "@/components/badminton/form-ui";
import { BroadcastLinkCard } from "@/components/badminton/broadcast-link-card";
import {
  sponsorLogosFromBranding,
  useBadmintonBranding,
  type BadmintonBranding,
} from "@/hooks/use-badminton-branding";
import {
  BADMINTON_MATCHES_RECONNECT_POLL_MS,
  useBadmintonTournamentStreamStatus,
} from "@/hooks/use-badminton-match";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import {
  buildCourtBroadcastChips,
  listLiveMatches,
  listUpcomingMatches,
  matchCourtLabel,
  resolvePrimaryBroadcastMatchId,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import type {
  BadmintonOverlayScene,
  BadmintonVenueScene,
} from "@/lib/badminton-broadcast-director";
import {
  onPresentationError,
  onPresentationMutate,
  onPresentationSuccess,
  type PresentationMutateContext,
  type PresentationPatch,
} from "@/lib/badminton-presentation-mutation";
import {
  badmintonQrImageUrl,
  badmintonScorerHomePublicUrl,
} from "@/lib/badminton-broadcast-urls";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  MomentPickerSheet,
  type MomentPickerMode,
} from "@/components/badminton/mission-control/moment-picker-sheet";

const VENUE_MOMENTS: { id: BadmintonVenueScene; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
  { id: "banner", label: "Banner" },
  { id: "next", label: "Next" },
  { id: "results", label: "Results" },
  { id: "leaderboards", label: "Boards" },
];

/** Moments that also push to OBS (Banner is venue/scoreboard only). */
const OBS_MOMENT_SCENES = new Set<BadmintonVenueScene>([
  "intro",
  "winner",
  "sponsor",
  "next",
  "results",
  "leaderboards",
]);

type PickerMode = MomentPickerMode | null;

function trackLabelFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const name = new URL(url).pathname.split("/").pop();
    return name ? decodeURIComponent(name) : null;
  } catch {
    return null;
  }
}

export function MissionControlOpsRail({
  tournamentId,
  onAnnouncement,
}: {
  tournamentId: number;
  onAnnouncement?: (label: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  // Operator rail: no 8s branding poll — SSE + optimistic PATCH keep UI snappy.
  const { data: branding } = useBadmintonBranding(tournamentId, {
    staleTime: 120_000,
    refetchInterval: false,
  });
  const tournamentSseStatus = useBadmintonTournamentStreamStatus(tournamentId);
  const [qrOpen, setQrOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const presentationSeq = useRef(0);

  const scorerHomeUrl = badmintonScorerHomePublicUrl(tournamentId);

  const { data: matches = [] } = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    staleTime: 10_000,
    refetchInterval: () =>
      sseAwareRefetchInterval(tournamentSseStatus, BADMINTON_MATCHES_RECONNECT_POLL_MS),
    placeholderData: (prev) => prev,
  });

  const liveMatches = listLiveMatches(matches);
  const primaryMatchId = resolvePrimaryBroadcastMatchId(
    matches,
    branding?.primaryBroadcastMatchId ?? null,
  );
  const courtChips = buildCourtBroadcastChips(matches, primaryMatchId);
  const upcomingMatches = listUpcomingMatches(matches, primaryMatchId);
  const sponsors = sponsorLogosFromBranding(branding);
  const pinnedSponsorUrl = branding?.pinnedSponsorUrl ?? null;

  const setPrimaryMutation = useMutation({
    mutationFn: (matchId: number) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId }),
      }),
    onMutate: (matchId) => {
      const previous = qc.getQueryData<BadmintonBranding>([
        "badminton-branding",
        tournamentId,
      ]);
      if (previous) {
        qc.setQueryData<BadmintonBranding>(["badminton-branding", tournamentId], {
          ...previous,
          primaryBroadcastMatchId: matchId,
        });
      }
      return { previous };
    },
    onError: (err, _matchId, context) => {
      const prev = (context as { previous?: BadmintonBranding } | undefined)?.previous;
      if (prev) qc.setQueryData(["badminton-branding", tournamentId], prev);
      toast({
        title: "Could not switch court",
        description: friendlyBadmintonError(err, "Try again."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
      toast({ title: "Screens follow this court" });
    },
  });

  const setPresentationMutation = useMutation({
    mutationFn: (body: PresentationPatch) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onMutate: (body) => onPresentationMutate(qc, tournamentId, body),
    onError: (err, _body, context) => {
      onPresentationError(qc, tournamentId, context as PresentationMutateContext | undefined);
      toast({
        title: "Screen update failed",
        description: friendlyBadmintonError(err, "Moments / scene did not apply. Try again."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      onPresentationSuccess(qc, tournamentId, data);
    },
  });

  const overlayScene = branding?.overlayScene ?? "auto";
  const venueScene = branding?.venueScene ?? "auto";
  const venueMusicPlaying = branding?.venueMusicPlaying === true;
  const venueMusicTrack =
    branding?.venueMusicFileName?.trim()
    || (branding?.resolvedVenueMusicUrl
      ? trackLabelFromUrl(branding.resolvedVenueMusicUrl)
      : null);
  const hasVenueMusicTrack = Boolean(branding?.resolvedVenueMusicUrl?.trim());
  const presentationBusy = setPresentationMutation.isPending;

  function patchPresentation(
    body: PresentationPatch,
    opts?: { announce?: string },
  ) {
    const seq = ++presentationSeq.current;
    setPresentationMutation.mutate(body, {
      onSuccess: () => {
        if (seq !== presentationSeq.current) return;
        if (opts?.announce) onAnnouncement?.(opts.announce);
      },
    });
  }

  /** Moments stay on screen until Clear (or a venue scene change). */
  function pushMoment(id: BadmintonVenueScene, label: string) {
    if (id === "next") {
      setPickerMode("next");
      return;
    }
    if (id === "sponsor") {
      setPickerMode("sponsor");
      return;
    }
    // Banner is venue/scoreboard only — clear OBS moments so stream stays live.
    if (id === "banner" || !OBS_MOMENT_SCENES.has(id)) {
      patchPresentation(
        { venueScene: id, overlayScene: "auto" },
        { announce: label },
      );
      return;
    }
    patchPresentation(
      {
        venueScene: id,
        overlayScene: id as Extract<
          BadmintonOverlayScene,
          "intro" | "winner" | "sponsor" | "next" | "results" | "leaderboards"
        >,
      },
      { announce: label },
    );
  }

  function pushNextMatch(match: BroadcastConsoleMatch) {
    setPickerMode(null);
    const court = matchCourtLabel(match);
    patchPresentation(
      {
        venueScene: "next",
        overlayScene: "next",
        upNextMatchId: match.id,
      },
      { announce: `Next · ${court}` },
    );
  }

  function pushSpotlightSponsor(sponsor: SponsorLogo) {
    setPickerMode(null);
    const name = sponsor.name?.trim() || "Sponsor";
    patchPresentation(
      {
        venueScene: "sponsor",
        overlayScene: "sponsor",
        spotlightSponsorUrl: sponsor.url,
      },
      { announce: `Sponsor · ${name}` },
    );
  }

  function pinSponsor(sponsor: SponsorLogo) {
    setPickerMode(null);
    const name = sponsor.name?.trim() || "Sponsor";
    patchPresentation(
      { pinnedSponsorUrl: sponsor.url },
      { announce: `Pinned · ${name}` },
    );
  }

  function unpinSponsor() {
    patchPresentation({ pinnedSponsorUrl: null }, { announce: "Sponsor unpinned" });
  }

  const primaryChip = courtChips.find((c) => c.isPrimary);
  const showScreensFollow = liveMatches.length >= 1 && courtChips.length > 0;

  return (
    <aside
      className="space-y-3"
      aria-label="Screen and scorer controls"
      data-mission-control-ops="true"
    >
      {showScreensFollow ? (
        <div className={cn(hubPanelClass, "p-3 space-y-2")}>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            Screens follow
          </p>
          {liveMatches.length === 1 && primaryChip ? (
            <p className="text-xs text-amber-100/90 font-semibold">
              Following {primaryChip.label}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            {courtChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={chip.matchId == null || chip.status !== "LIVE"}
                onClick={() => chip.matchId != null && setPrimaryMutation.mutate(chip.matchId)}
                className={cn(
                  "min-h-9 px-3 rounded-lg border text-left text-xs font-semibold transition-colors disabled:opacity-40",
                  chip.isPrimary
                    ? "border-amber-500/45 bg-amber-500/20 text-amber-50"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                  setPrimaryMutation.isPending && chip.isPrimary && "opacity-90",
                )}
              >
                {chip.label}
                {chip.isPrimary ? " · active" : ""}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn(hubPanelClass, "p-3 space-y-3")}>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45 mb-1">
            Moments (Venue + OBS)
          </p>
          <p className="text-[11px] text-muted-foreground mb-2">
            Next and Sponsor open a picker. Stays until Clear. Banner is scoreboard only.
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {VENUE_MOMENTS.map((opt) => (
              <RailButton
                key={opt.id}
                label={opt.label}
                active={venueScene === opt.id}
                busy={presentationBusy && venueScene === opt.id}
                onClick={() => pushMoment(opt.id, opt.label)}
              />
            ))}
            <span className="mx-0.5 h-6 w-px bg-white/15 shrink-0" aria-hidden />
            <RailButton
              label="Clear"
              tone="clear"
              active={venueScene === "auto" && overlayScene === "auto"}
              busy={
                presentationBusy && venueScene === "auto" && overlayScene === "auto"
              }
              onClick={() => {
                patchPresentation({
                  venueScene: "auto",
                  overlayScene: "auto",
                  upNextMatchId: null,
                  spotlightSponsorUrl: null,
                });
              }}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {pinnedSponsorUrl ? (
              <RailButton
                label="Unpin sponsor"
                tone="clear"
                active
                busy={presentationBusy}
                onClick={unpinSponsor}
              />
            ) : (
              <RailButton
                label="Pin sponsor"
                active={false}
                busy={presentationBusy}
                onClick={() => setPickerMode("pin")}
              />
            )}
            {pinnedSponsorUrl ? (
              <p className="text-[11px] text-amber-100/80 truncate max-w-full">
                Pinned on live boards
              </p>
            ) : null}
          </div>
          {pickerMode ? (
            <MomentPickerSheet
              mode={pickerMode}
              upcoming={upcomingMatches}
              sponsors={sponsors}
              onClose={() => setPickerMode(null)}
              onPickMatch={pushNextMatch}
              onPickSponsor={(s) =>
                pickerMode === "pin" ? pinSponsor(s) : pushSpotlightSponsor(s)
              }
            />
          ) : null}
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45 mb-2">
            Venue scene
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["auto", "Auto (focus court)"],
                ["live_score", "Live score"],
                ["multi", "Both courts stacked"],
                ["standby", "Standby"],
              ] as const
            ).map(([id, label]) => (
              <RailButton
                key={id}
                label={label}
                active={venueScene === id}
                busy={presentationBusy && venueScene === id}
                onClick={() =>
                  patchPresentation(
                    id === "multi"
                      ? { venueScene: "multi", overlayScene: "multi" }
                      : {
                          venueScene: id,
                          ...(overlayScene === "multi"
                            ? { overlayScene: "auto" as const }
                            : {}),
                        },
                    id === "multi"
                      ? {
                          announce:
                            "Both courts — Venue stacked, OBS left/right boxes",
                        }
                      : undefined,
                  )
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className={cn(hubPanelClass, "p-3 space-y-2")}>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
          Venue music
        </p>
        <p className="text-[11px] text-white/55 truncate" title={venueMusicTrack ?? undefined}>
          {hasVenueMusicTrack
            ? (venueMusicTrack ?? "Song ready")
            : "No song — set one in Branding"}
        </p>
        <button
          type="button"
          disabled={branding != null && !hasVenueMusicTrack && !venueMusicPlaying}
          onClick={() =>
            patchPresentation(
              { venueMusicPlaying: !venueMusicPlaying },
              {
                announce: venueMusicPlaying
                  ? "Venue music paused"
                  : "Venue music playing",
              },
            )
          }
          className={cn(
            "min-h-9 w-full px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40",
            venueMusicPlaying
              ? "border-emerald-500/45 bg-emerald-500/20 text-emerald-50"
              : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
          )}
          aria-pressed={venueMusicPlaying}
        >
          {venueMusicPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              Play music
            </>
          )}
        </button>
        <p className="text-[10px] text-white/40 leading-snug">
          {venueMusicPlaying
            ? "Playing on Venue scoreboard — tap “enable audio” there once if silent."
            : "Plays on the Venue LED scoreboard only (not OBS)."}
        </p>
      </div>

      <details className={cn(hubPanelClass, "p-3 group")}>
        <summary className="cursor-pointer list-none text-[10px] font-mono uppercase tracking-[0.2em] text-white/45 flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
          <span>Links &amp; access</span>
          <span className="text-white/35 normal-case tracking-normal text-[10px] font-semibold group-open:hidden">
            Scorer · Venue · OBS
          </span>
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Scorers sign in with mobile + personal PIN.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(scorerHomeUrl).then(() => {
                    toast({ title: "Scorer link copied" });
                  });
                }}
                className="min-h-10 px-3 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy link
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="min-h-10 px-3 rounded-lg bg-white/8 hover:bg-white/12 text-white/80 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR code
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2">
            <BroadcastLinkCard
              kind="venue-display"
              tournamentId={tournamentId}
              title="Venue display"
              help="Hall TV / LED"
              icon={Monitor}
            />
            <BroadcastLinkCard
              kind="obs-overlay"
              tournamentId={tournamentId}
              title="OBS overlay"
              help="Browser source URL"
              icon={Radio}
            />
            <BroadcastLinkCard
              kind="scorer-home"
              tournamentId={tournamentId}
              title="Open scorer home"
              help="Opens in new tab"
              icon={Tablet}
            />
            <BroadcastLinkCard
              kind="public-standings"
              tournamentId={tournamentId}
              title="Points for owners"
              help="Public points table + results"
              icon={Trophy}
            />
          </div>
        </div>
      </details>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Scorer home</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <img
              src={badmintonQrImageUrl(scorerHomeUrl)}
              alt="QR code for scorer home"
              className="rounded-lg border border-border"
              width={240}
              height={240}
            />
            <p className="text-xs text-muted-foreground text-center">
              Scan to open scorer home on any court device.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

function RailButton({
  label,
  active,
  busy,
  onClick,
  tone = "default",
}: {
  label: string;
  active: boolean;
  busy?: boolean;
  onClick: () => void;
  /** `clear` = dismiss action, visually separate from moment chips. */
  tone?: "default" | "clear";
}) {
  const isClear = tone === "clear";
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      onClick={onClick}
      className={cn(
        "min-h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors inline-flex items-center gap-1",
        isClear
          ? active
            ? "bg-rose-500/25 border-rose-400/55 text-rose-50"
            : "bg-rose-500/10 border-rose-400/35 text-rose-100 hover:bg-rose-500/18"
          : active
            ? "bg-amber-500/25 border-amber-500/45 text-amber-50"
            : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10",
        busy && "opacity-80",
      )}
    >
      {isClear ? <X className="h-3 w-3 shrink-0" aria-hidden /> : null}
      {label}
    </button>
  );
}
