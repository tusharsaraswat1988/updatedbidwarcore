/**
 * Compact picker for Next match / Sponsor spotlight / Pin sponsor.
 */

import { X } from "lucide-react";
import {
  matchCourtLabel,
  matchIdentityLine,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import type { SponsorLogo } from "@/lib/sponsor-logo";

export type MomentPickerMode = "next" | "sponsor" | "pin";

export function MomentPickerSheet({
  mode,
  upcoming,
  sponsors,
  onClose,
  onPickMatch,
  onPickSponsor,
}: {
  mode: MomentPickerMode;
  upcoming: BroadcastConsoleMatch[];
  sponsors: SponsorLogo[];
  onClose: () => void;
  onPickMatch: (match: BroadcastConsoleMatch) => void;
  onPickSponsor: (sponsor: SponsorLogo) => void;
}) {
  const isNext = mode === "next";
  const title = isNext
    ? "Show upcoming match"
    : mode === "pin"
      ? "Pin sponsor on live boards"
      : "Show sponsor";
  const empty = isNext ? "No upcoming matches" : "No sponsors in branding";

  return (
    <div
      className="mt-2 rounded-lg border border-white/15 bg-black/40 p-2 space-y-2"
      role="dialog"
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-semibold text-white/85">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-7 min-w-7 inline-flex items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Close picker"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto space-y-1">
        {isNext ? (
          upcoming.length === 0 ? (
            <p className="text-[11px] text-white/45 px-2 py-3">{empty}</p>
          ) : (
            upcoming.map((match) => {
              const court = matchCourtLabel(match);
              const identity = matchIdentityLine(match);
              const detail = match.detail as Record<string, unknown> | null | undefined;
              const meta =
                (typeof detail?.matchLabel === "string" && detail.matchLabel.trim())
                || (typeof detail?.categoryName === "string" && detail.categoryName.trim())
                || null;
              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => onPickMatch(match)}
                  className="w-full min-h-10 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left hover:bg-white/10 transition-colors"
                >
                  <p className="text-[11px] font-semibold text-amber-50">
                    {court}
                    {meta ? ` · ${meta}` : ""}
                  </p>
                  <p className="text-[11px] text-white/70 truncate">{identity}</p>
                </button>
              );
            })
          )
        ) : (() => {
          const withUrl = sponsors.filter((s) => !!s.url?.trim());
          if (withUrl.length === 0) {
            return <p className="text-[11px] text-white/45 px-2 py-3">{empty}</p>;
          }
          return withUrl.map((sponsor) => (
            <button
              key={sponsor.url}
              type="button"
              onClick={() => onPickSponsor(sponsor)}
              className="w-full min-h-10 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-left hover:bg-white/10 transition-colors flex items-center gap-2.5"
            >
              <img
                src={sponsor.url}
                alt=""
                className="h-8 w-12 object-contain rounded bg-white/95 shrink-0"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-white truncate">
                  {sponsor.name?.trim() || "Sponsor"}
                </p>
                {sponsor.type?.trim() ? (
                  <p className="text-[10px] text-white/50 truncate">{sponsor.type}</p>
                ) : null}
              </div>
            </button>
          ));
        })()}
      </div>
    </div>
  );
}
