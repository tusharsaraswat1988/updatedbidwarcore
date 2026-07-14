/**
 * Operator Panel — Broadcast Director strip.
 * Persistent screen links + primary match + remote scene switches for Venue / OBS.
 */

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDot, Monitor, Radio, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { hubCardClass, hubPanelClass } from "@/components/badminton/form-ui";
import { BroadcastLinkCard } from "@/components/badminton/broadcast-link-card";
import { useBadmintonBranding, type BadmintonBranding } from "@/hooks/use-badminton-branding";
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

const OVERLAY_SCENE_OPTIONS: { id: BadmintonOverlayScene; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "compact", label: "Compact" },
  { id: "full", label: "Full" },
  { id: "multi", label: "Multi courts" },
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
];

const VENUE_SCENE_OPTIONS: { id: BadmintonVenueScene; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "live_score", label: "Live score" },
  { id: "multi", label: "Multi courts" },
  { id: "standby", label: "Standby" },
];

function SceneButton({
  active,
  label,
  disabled,
  onClick,
}: {
  active: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-9 px-3 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50",
        active
          ? "bg-amber-500/25 border-amber-500/45 text-amber-50"
          : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10",
      )}
    >
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
  const { data: branding } = useBadmintonBranding(tournamentId);

  const { data: matches = [] } = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    refetchInterval: 6_000,
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
  });

  const setPresentationMutation = useMutation({
    mutationFn: (body: { overlayScene?: BadmintonOverlayScene; venueScene?: BadmintonVenueScene }) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
    },
  });

  useEffect(() => {
    if (!highlight) return;
    document.getElementById("broadcast")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlight]);

  // Keep stored primary in sync when only one court is live.
  useEffect(() => {
    if (!tournamentId || liveMatches.length !== 1) return;
    const soleId = liveMatches[0].id;
    if (branding?.primaryBroadcastMatchId === soleId) return;
    if (branding === undefined) return;
    setPrimaryMutation.mutate(soleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only auto-sync on sole-live transitions
  }, [tournamentId, liveMatches.length, liveMatches[0]?.id, branding?.primaryBroadcastMatchId]);

  const overlayScene = branding?.overlayScene ?? "auto";
  const venueScene = branding?.venueScene ?? "auto";
  const pending = setPresentationMutation.isPending || setPrimaryMutation.isPending;

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
            Broadcast Director
          </h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Open Venue Scoreboard and OBS once. Switch what they show from here — screens follow
            automatically.
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

      <div className={cn(hubPanelClass, "p-4 space-y-4")}>
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            OBS Overlay scene
          </p>
          <div className="flex flex-wrap gap-2">
            {OVERLAY_SCENE_OPTIONS.map((opt) => (
              <SceneButton
                key={opt.id}
                label={opt.label}
                active={overlayScene === opt.id}
                disabled={pending}
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
                disabled={pending}
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
                      disabled={pending || chip.matchId == null}
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
