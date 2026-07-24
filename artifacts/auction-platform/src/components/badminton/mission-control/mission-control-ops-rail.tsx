/**
 * Mission Control right rail — Venue / OBS / Scorer / Announcements / Emergency.
 * Reuses existing presentation + broadcast link APIs. No new endpoints.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, Radio, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { hubCardClass, hubPanelClass } from "@/components/badminton/form-ui";
import { BroadcastLinkCard } from "@/components/badminton/broadcast-link-card";
import { useBadmintonBranding, type BadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  buildCourtBroadcastChips,
  listLiveMatches,
  resolvePrimaryBroadcastMatchId,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import type {
  BadmintonOverlayScene,
  BadmintonVenueScene,
} from "@/lib/badminton-broadcast-director";
import { useToast } from "@/hooks/use-toast";

const ANNOUNCEMENTS: { id: BadmintonOverlayScene; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
];

export function MissionControlOpsRail({
  tournamentId,
  onAnnouncement,
  onEmergency,
  emergencyActive,
  onResumeScreens,
}: {
  tournamentId: number;
  onAnnouncement?: (label: string) => void;
  onEmergency?: () => void;
  emergencyActive?: boolean;
  onResumeScreens?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: branding } = useBadmintonBranding(tournamentId);

  const { data: matches = [] } = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    refetchInterval: 6_000,
  });

  const liveMatches = listLiveMatches(matches);
  const primaryMatchId = resolvePrimaryBroadcastMatchId(
    matches,
    branding?.primaryBroadcastMatchId ?? null,
  );
  const courtChips = buildCourtBroadcastChips(matches, primaryMatchId);

  const setPrimaryMutation = useMutation({
    mutationFn: (matchId: number) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId }),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
      toast({ title: "Screens follow this court", description: "Venue + OBS + LED updated." });
    },
  });

  const setPresentationMutation = useMutation({
    mutationFn: (body: {
      overlayScene?: BadmintonOverlayScene;
      venueScene?: BadmintonVenueScene;
    }) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
    },
  });

  const overlayScene = branding?.overlayScene ?? "auto";
  const venueScene = branding?.venueScene ?? "auto";
  const pending = setPresentationMutation.isPending || setPrimaryMutation.isPending;

  function emergencyStandby() {
    if (onEmergency) {
      onEmergency();
      return;
    }
    setPresentationMutation.mutate(
      { venueScene: "standby", overlayScene: "sponsor" },
      {
        onSuccess: () => {
          toast({
            title: "Emergency standby",
            description: "Venue on standby. OBS on sponsor scene.",
          });
        },
      },
    );
  }

  return (
    <aside className="space-y-4" aria-label="Quick operations">
      <div>
        <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">
          Quick operations
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Screens and announcements — one click. Stay on this page.
        </p>
      </div>

      <div className="space-y-3">
        <BroadcastLinkCard
          kind="venue-display"
          tournamentId={tournamentId}
          title="Venue Display"
          help="Hall TV / LED. Same URL all day."
          icon={Monitor}
        />
        <BroadcastLinkCard
          kind="obs-overlay"
          tournamentId={tournamentId}
          title="OBS"
          help="OBS Browser Source. Same URL all day."
          icon={Radio}
        />
        <BroadcastLinkCard
          kind="scorer-home"
          tournamentId={tournamentId}
          title="Scorer Home"
          help="One link + PIN for court scorers."
          icon={Tablet}
        />
      </div>

      <div className={cn(hubPanelClass, "p-3 space-y-2")}>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
          Announcements
        </p>
        <div className="flex flex-wrap gap-2">
            {ANNOUNCEMENTS.map((opt) => (
              <RailButton
                key={opt.id}
                label={opt.label}
                active={overlayScene === opt.id}
                disabled={pending}
                onClick={() => {
                  setPresentationMutation.mutate(
                    { overlayScene: opt.id },
                    { onSuccess: () => onAnnouncement?.(opt.label) },
                  );
                }}
              />
            ))}
            <RailButton
              label="Sponsor scene"
              active={overlayScene === "sponsor"}
              disabled={pending}
              onClick={() => {
                setPresentationMutation.mutate(
                  { overlayScene: "sponsor" },
                  { onSuccess: () => onAnnouncement?.("Sponsor") },
                );
              }}
            />
        </div>
      </div>

      <div className={cn(hubPanelClass, "p-3 space-y-2")}>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
          Venue scene
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["auto", "Auto"],
              ["live_score", "Live score"],
              ["multi", "Multi"],
              ["standby", "Standby"],
            ] as const
          ).map(([id, label]) => (
            <RailButton
              key={id}
              label={label}
              active={venueScene === id}
              disabled={pending}
              onClick={() => setPresentationMutation.mutate({ venueScene: id })}
            />
          ))}
        </div>
      </div>

      {courtChips.length > 0 ? (
        <div className={cn(hubPanelClass, "p-3 space-y-2")}>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            Screens follow
          </p>
          <p className="text-xs text-muted-foreground">
            Pick which live court Venue + OBS + LED follow.
          </p>
          <div className="flex flex-col gap-2">
            {courtChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={pending || chip.matchId == null || chip.status !== "LIVE"}
                onClick={() => chip.matchId != null && setPrimaryMutation.mutate(chip.matchId)}
                className={cn(
                  "min-h-10 px-3 rounded-lg border text-left text-xs font-semibold transition-colors disabled:opacity-40",
                  chip.isPrimary
                    ? "border-amber-500/45 bg-amber-500/20 text-amber-50"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                )}
              >
                {chip.label} · {chip.status}
                {chip.isPrimary ? " · Following" : ""}
              </button>
            ))}
          </div>
          {liveMatches.length <= 1 ? (
            <p className="text-[11px] text-muted-foreground">
              With one live court, screens follow automatically.
            </p>
          ) : null}
        </div>
      ) : null}

      {emergencyActive ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => onResumeScreens?.()}
          className={cn(
            hubCardClass,
            "w-full min-h-12 px-4 text-sm font-bold text-emerald-100 border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-50",
          )}
        >
          Resume tournament screens
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={emergencyStandby}
          className={cn(
            hubCardClass,
            "w-full min-h-12 px-4 text-sm font-bold text-orange-100 border-orange-500/40 bg-orange-500/15 hover:bg-orange-500/25 disabled:opacity-50",
          )}
        >
          Emergency pause
        </button>
      )}
    </aside>
  );
}

function RailButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
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
