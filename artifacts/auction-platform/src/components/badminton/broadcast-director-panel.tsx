/**
 * Live Control — Live Displays strip (venue scoreboard + stream overlay).
 * Persistent screen links + primary match + remote scene switches for Venue / OBS.
 */

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, Monitor, Radio, Tablet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import { hubCardClass, hubPanelClass } from "@/components/badminton/form-ui";
import { BroadcastLinkCard } from "@/components/badminton/broadcast-link-card";
import { ObsSafeAreaPreview } from "@/components/badminton/obs-safe-area-preview";
import { useBadmintonBranding, type BadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  BADMINTON_MATCHES_RECONNECT_POLL_MS,
  useBadmintonTournamentStreamStatus,
} from "@/hooks/use-badminton-match";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import {
  buildCourtBroadcastChips,
  currentGameLabel,
  currentScoreLabel,
  listLiveMatches,
  matchCategoryLabel,
  matchCourtLabel,
  resolvePrimaryBroadcastMatchId,
  softFeedStatus,
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
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { useToast } from "@/hooks/use-toast";

const OVERLAY_LAYOUT_OPTIONS: { id: BadmintonOverlayScene; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "compact", label: "Compact" },
  { id: "full", label: "Full" },
  { id: "multi", label: "Both courts (L/R)" },
];

/** Hall / stream moments — same presentation API, organizer language. */
const VENUE_MOMENT_OPTIONS: { id: BadmintonVenueScene; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
  { id: "next", label: "Next match" },
  { id: "results", label: "Results" },
  { id: "leaderboards", label: "Leaderboards" },
];

const VENUE_SCENE_OPTIONS: { id: BadmintonVenueScene; label: string }[] = [
  { id: "auto", label: "Auto (focus court)" },
  { id: "live_score", label: "Live score" },
  { id: "multi", label: "Both courts stacked" },
  { id: "standby", label: "Standby / break" },
];

function SceneButton({
  active,
  label,
  busy,
  onClick,
  tone = "default",
}: {
  active: boolean;
  label: string;
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
        "min-h-9 px-3 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5",
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
      {isClear ? <X className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      {label}
    </button>
  );
}

export function BadmintonBroadcastDirectorPanel({
  tournamentId,
  highlight = false,
}: {
  tournamentId: number;
  highlight?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: branding } = useBadmintonBranding(tournamentId, {
    staleTime: 120_000,
    refetchInterval: false,
  });
  const tournamentSseStatus = useBadmintonTournamentStreamStatus(tournamentId);
  const autoSyncedSoleIdRef = useRef<number | null>(null);

  const { data: matches = [] } = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: () =>
      sseAwareRefetchInterval(tournamentSseStatus, BADMINTON_MATCHES_RECONNECT_POLL_MS),
  });

  const liveMatches = useMemo(() => listLiveMatches(matches), [matches]);
  const primaryMatchId = useMemo(
    () =>
      resolvePrimaryBroadcastMatchId(matches, branding?.primaryBroadcastMatchId ?? null),
    [matches, branding?.primaryBroadcastMatchId],
  );
  const primaryMatch = matches.find((m) => m.id === primaryMatchId) ?? null;
  const feedStatus = softFeedStatus(!!primaryMatch);
  const courtChips = useMemo(
    () => buildCourtBroadcastChips(matches, primaryMatchId),
    [matches, primaryMatchId],
  );

  const setPrimaryMutation = useMutation({
    mutationFn: (matchId: number) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
    },
    onError: (err) => {
      toast({
        title: "Could not set primary court",
        description: friendlyBadmintonError(err, "Try again."),
        variant: "destructive",
      });
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
        description: friendlyBadmintonError(err, "Scene did not apply. Try again."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      onPresentationSuccess(qc, tournamentId, data);
    },
  });

  /** Moments stay until Clear (or another scene is chosen). */
  function pushMoment(venueScene: BadmintonVenueScene) {
    setPresentationMutation.mutate({
      venueScene,
      overlayScene:
        venueScene === "next"
          ? "auto"
          : (venueScene as Extract<
              BadmintonOverlayScene,
              "intro" | "winner" | "sponsor" | "results" | "leaderboards"
            >),
    });
  }

  useEffect(() => {
    if (!highlight) return;
    document.getElementById("broadcast")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlight]);

  // Keep stored primary in sync when only one court is live (once per sole match).
  useEffect(() => {
    if (!tournamentId || liveMatches.length !== 1) {
      if (liveMatches.length !== 1) autoSyncedSoleIdRef.current = null;
      return;
    }
    const soleId = liveMatches[0].id;
    if (branding?.primaryBroadcastMatchId === soleId) {
      autoSyncedSoleIdRef.current = soleId;
      return;
    }
    if (branding === undefined) return;
    if (autoSyncedSoleIdRef.current === soleId) return;
    if (setPrimaryMutation.isPending) return;
    autoSyncedSoleIdRef.current = soleId;
    setPrimaryMutation.mutate(soleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-sync on sole-live transitions
  }, [tournamentId, liveMatches.length, liveMatches[0]?.id, branding?.primaryBroadcastMatchId]);

  const overlayScene = branding?.overlayScene ?? "auto";
  const venueScene = branding?.venueScene ?? "auto";
  const presentationBusy = setPresentationMutation.isPending;

  return (
    <section
      id="broadcast"
      className={cn(
        "space-y-4 scroll-mt-4",
        highlight && "ring-2 ring-amber-500/40 rounded-xl p-1",
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">
            Live Displays
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Open the venue scoreboard and stream overlay once. Switch what they show from here —
            screens follow automatically.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider">
          <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white/60">
            Overlay · {feedStatus.overlay}
          </span>
          <span className="rounded border border-white/10 bg-white/5 px-2 py-1 text-white/60">
            Venue · {feedStatus.venue}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <BroadcastLinkCard
          kind="venue-display"
          tournamentId={tournamentId}
          title="Venue Scoreboard Display"
          help="Hall TV / projector. Same URL all day."
          icon={Monitor}
        />
        <BroadcastLinkCard
          kind="obs-overlay"
          tournamentId={tournamentId}
          title="OBS Overlay"
          help="OBS Browser Source. Same URL all day."
          icon={Radio}
        />
        <BroadcastLinkCard
          kind="scorer-home"
          tournamentId={tournamentId}
          title="Scorer Home"
          help="One link + PIN for scorers."
          icon={Tablet}
        />
      </div>

      <div className={cn(hubPanelClass, "p-4")}>
        <ObsSafeAreaPreview />
      </div>

      <div className={cn(hubPanelClass, "p-4 space-y-4")}>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            Announcements
          </p>
          <p className="text-xs text-muted-foreground">
            Push intro, winner, sponsor, next-match, results, or leaderboards to Venue + OBS.
            Moments stay on screen until you press Clear.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {VENUE_MOMENT_OPTIONS.map((opt) => (
              <SceneButton
                key={opt.id}
                label={opt.label}
                active={venueScene === opt.id}
                busy={presentationBusy && venueScene === opt.id}
                onClick={() => pushMoment(opt.id)}
              />
            ))}
            <span className="mx-0.5 h-7 w-px bg-white/15 shrink-0" aria-hidden />
            <SceneButton
              label="Clear moments"
              tone="clear"
              active={venueScene === "auto" && overlayScene === "auto"}
              busy={
                presentationBusy && venueScene === "auto" && overlayScene === "auto"
              }
              onClick={() => {
                setPresentationMutation.mutate({ venueScene: "auto", overlayScene: "auto" });
              }}
            />
            <SceneButton
              label="Venue standby"
              active={venueScene === "standby"}
              busy={presentationBusy && venueScene === "standby"}
              onClick={() => setPresentationMutation.mutate({ venueScene: "standby" })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            OBS Overlay layout
          </p>
          <div className="flex flex-wrap gap-2">
            {OVERLAY_LAYOUT_OPTIONS.map((opt) => (
              <SceneButton
                key={opt.id}
                label={opt.label}
                active={overlayScene === opt.id}
                busy={presentationBusy && overlayScene === opt.id}
                onClick={() => setPresentationMutation.mutate({ overlayScene: opt.id })}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            Venue Scoreboard scene
          </p>
          <div className="flex flex-wrap gap-2">
            {VENUE_SCENE_OPTIONS.map((opt) => (
              <SceneButton
                key={opt.id}
                label={opt.label}
                active={venueScene === opt.id}
                busy={presentationBusy && venueScene === opt.id}
                onClick={() => setPresentationMutation.mutate({ venueScene: opt.id })}
              />
            ))}
          </div>
        </div>
      </div>

      {courtChips.length > 0 ? (
        <div className={cn(hubPanelClass, "p-4 space-y-3")}>
          <div>
            <h3 className="text-sm font-display font-bold text-foreground">Primary Broadcast</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              When multiple courts are live, pick which match Venue + OBS follow.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {courtChips.map((chip) => (
              <div
                key={chip.key}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                  chip.status === "LIVE"
                    ? "border-red-500/40 bg-red-500/10 text-red-100"
                    : "border-sky-500/35 bg-sky-500/10 text-sky-100",
                )}
              >
                <CircleDot className="w-3.5 h-3.5" />
                <span className="font-semibold">{chip.label}</span>
                <span className="uppercase tracking-wider font-mono opacity-80">{chip.status}</span>
                {chip.status === "LIVE" && liveMatches.length > 1 ? (
                  chip.isPrimary ? (
                    <span className="ml-1 rounded bg-amber-500/20 text-amber-100 px-1.5 py-0.5 font-bold uppercase tracking-wide">
                      Primary
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={chip.matchId == null}
                      onClick={() => chip.matchId != null && setPrimaryMutation.mutate(chip.matchId)}
                      className="ml-1 rounded border border-white/15 px-1.5 py-0.5 font-semibold hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Set Primary
                    </button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          hubCardClass,
          "p-4 border-red-500/20 bg-gradient-to-br from-red-500/10 via-transparent to-transparent",
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className={cn(
              "inline-flex h-2.5 w-2.5 rounded-full",
              primaryMatch ? "bg-red-500 animate-pulse" : "bg-white/25",
            )}
          />
          <h3 className="text-xs font-mono uppercase tracking-[0.25em] text-red-200/90 font-bold">
            Now on screens
          </h3>
        </div>
        {primaryMatch?.state ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-mono">
              {matchCourtLabel(primaryMatch)} · {matchCategoryLabel(primaryMatch)}
            </p>
            <TeamPlayerVs
              left={identityFromSideInfo(primaryMatch.state.leftSide)}
              right={identityFromSideInfo(primaryMatch.state.rightSide)}
              size="md"
              tone="muted"
              layout="stack"
            />
            <p className="text-sm text-white/80 font-mono">
              {currentGameLabel(primaryMatch.state)} · {currentScoreLabel(primaryMatch.state)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No live match — Venue and OBS stay on standby chrome until a match goes live.
          </p>
        )}
      </div>
    </section>
  );
}
