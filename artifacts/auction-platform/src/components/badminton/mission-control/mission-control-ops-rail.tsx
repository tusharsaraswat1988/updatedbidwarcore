/**
 * Mission Control right rail — screens, scorer access, announcements.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Copy, Monitor, QrCode, Radio, Tablet } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { hubPanelClass } from "@/components/badminton/form-ui";
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
import { BROADCAST_MOMENT_AUTO_CLEAR_MS } from "@/lib/badminton-broadcast-director";
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

const VENUE_MOMENTS: { id: BadmintonVenueScene; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
  { id: "next", label: "Next" },
];

export function MissionControlOpsRail({
  tournamentId,
  onAnnouncement,
}: {
  tournamentId: number;
  onAnnouncement?: (label: string) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: branding } = useBadmintonBranding(tournamentId);
  const [qrOpen, setQrOpen] = useState(false);
  const momentClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scorerHomeUrl = badmintonScorerHomePublicUrl(tournamentId);

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
      toast({ title: "Screens follow this court" });
    },
    onError: (err) => {
      toast({
        title: "Could not switch court",
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
  // Never gate Moments / Venue on primary-court PATCH — that made buttons feel dead
  // while "Screens follow" or a slow request was in flight.
  const presentationBusy = setPresentationMutation.isPending;
  const primaryBusy = setPrimaryMutation.isPending;

  useEffect(
    () => () => {
      if (momentClearTimerRef.current) clearTimeout(momentClearTimerRef.current);
    },
    [],
  );

  function pushTimedMoment(id: BadmintonVenueScene, label: string) {
    if (momentClearTimerRef.current) clearTimeout(momentClearTimerRef.current);
    setPresentationMutation.mutate(
      {
        venueScene: id,
        overlayScene:
          id === "next"
            ? "auto"
            : (id as Extract<BadmintonOverlayScene, "intro" | "winner" | "sponsor">),
      },
      { onSuccess: () => onAnnouncement?.(label) },
    );
    momentClearTimerRef.current = setTimeout(() => {
      setPresentationMutation.mutate({ venueScene: "auto", overlayScene: "auto" });
    }, BROADCAST_MOMENT_AUTO_CLEAR_MS);
  }

  return (
    <aside className="space-y-3" aria-label="Screen and scorer controls">
      <div className={cn(hubPanelClass, "p-3 space-y-2")}>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
          Scorer access
        </p>
        <p className="text-xs text-muted-foreground">
          One link for all courts — scorers sign in with mobile + personal PIN.
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
      </div>

      {courtChips.length > 0 && liveMatches.length > 1 ? (
        <div className={cn(hubPanelClass, "p-3 space-y-2")}>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45">
            Screens follow
          </p>
          <div className="flex flex-col gap-1.5">
            {courtChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                disabled={primaryBusy || chip.matchId == null || chip.status !== "LIVE"}
                onClick={() => chip.matchId != null && setPrimaryMutation.mutate(chip.matchId)}
                className={cn(
                  "min-h-9 px-3 rounded-lg border text-left text-xs font-semibold transition-colors disabled:opacity-40",
                  chip.isPrimary
                    ? "border-amber-500/45 bg-amber-500/20 text-amber-50"
                    : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
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
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45 mb-2">
            Moments (Venue + OBS)
          </p>
          <div className="flex flex-wrap gap-1.5">
            {VENUE_MOMENTS.map((opt) => (
              <RailButton
                key={opt.id}
                label={opt.label}
                active={venueScene === opt.id}
                busy={presentationBusy && venueScene === opt.id}
                onClick={() => pushTimedMoment(opt.id, opt.label)}
              />
            ))}
            <RailButton
              label="Clear"
              active={venueScene === "auto" && overlayScene === "auto"}
              busy={
                presentationBusy && venueScene === "auto" && overlayScene === "auto"
              }
              onClick={() => {
                if (momentClearTimerRef.current) clearTimeout(momentClearTimerRef.current);
                setPresentationMutation.mutate({ venueScene: "auto", overlayScene: "auto" });
              }}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/45 mb-2">
            Venue scene
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["auto", "Auto"],
                ["live_score", "Live score"],
                ["multi", "Multi-court"],
                ["standby", "Standby"],
              ] as const
            ).map(([id, label]) => (
              <RailButton
                key={id}
                label={label}
                active={venueScene === id}
                busy={presentationBusy && venueScene === id}
                onClick={() => setPresentationMutation.mutate({ venueScene: id })}
              />
            ))}
          </div>
        </div>
      </div>

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
}: {
  label: string;
  active: boolean;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-busy={busy || undefined}
      onClick={onClick}
      className={cn(
        "min-h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors",
        active
          ? "bg-amber-500/25 border-amber-500/45 text-amber-50"
          : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10",
        busy && "opacity-80",
      )}
    >
      {label}
    </button>
  );
}
