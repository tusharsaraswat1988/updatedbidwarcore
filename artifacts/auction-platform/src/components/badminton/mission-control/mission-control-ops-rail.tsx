/**
 * Mission Control right rail — screens, scorer access, announcements.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  badmintonQrImageUrl,
  badmintonScorerHomePublicUrl,
} from "@/lib/badminton-broadcast-urls";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ANNOUNCEMENTS: { id: BadmintonOverlayScene; label: string }[] = [
  { id: "intro", label: "Intro" },
  { id: "winner", label: "Winner" },
  { id: "sponsor", label: "Sponsor" },
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
                disabled={pending || chip.matchId == null || chip.status !== "LIVE"}
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
            OBS scene
          </p>
          <div className="flex flex-wrap gap-1.5">
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
              label="Auto"
              active={overlayScene === "auto"}
              disabled={pending}
              onClick={() => setPresentationMutation.mutate({ overlayScene: "auto" })}
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
                disabled={pending}
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
        "min-h-8 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50",
        active
          ? "bg-amber-500/25 border-amber-500/45 text-amber-50"
          : "bg-white/5 border-white/10 text-white/75 hover:bg-white/10",
      )}
    >
      {label}
    </button>
  );
}
