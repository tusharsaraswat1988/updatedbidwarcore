import { memo, useEffect, useMemo, useState } from "react";
import { User, UserRound } from "lucide-react";
import type { LedView } from "@/lib/led-view/types";
import type { PlayerGender } from "@/lib/led-view/player-gender";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";
import {
  buildPortraitInfoRows,
  portraitSpecGridClass,
} from "@/lib/led-view/portrait-footer-stats";

/**
 * PLAYER PORTRAIT — full-bleed photo with identity + spec grid overlaid at bottom.
 * Base price lives in BidCenter only.
 */
export const PlayerPortrait = memo(function PlayerPortrait({
  view,
}: {
  view: LedView;
}) {
  const { currentPlayer, roleLabel } = view;
  const [photoFailed, setPhotoFailed] = useState(false);

  const infoRows = useMemo(
    () =>
      currentPlayer
        ? buildPortraitInfoRows(currentPlayer.age, currentPlayer.specs)
        : [],
    [currentPlayer],
  );

  useEffect(() => {
    setPhotoFailed(false);
  }, [currentPlayer?.id, currentPlayer?.portrait]);

  if (!currentPlayer) return null;

  const showPhoto = hasUsablePortrait(currentPlayer.portrait) && !photoFailed;
  const specGridClass = portraitSpecGridClass(infoRows.length);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-black/40 border border-white/10">
      {showPhoto ? (
        <img
          src={currentPlayer.portrait}
          alt={currentPlayer.name}
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="eager"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/[0.06] via-black/20 to-black/70">
          <GenderPortraitIcon gender={currentPlayer.gender} />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent pointer-events-none" />
      <div
        className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, transparent 45%, var(--accent-glow) 100%)",
        }}
      />

      <div className="absolute top-3 right-3 z-10">
        <div
          className="size-12 sm:size-14 grid place-items-center font-['Bebas_Neue'] text-xl sm:text-2xl italic shadow-2xl"
          style={{
            backgroundColor: "var(--accent)",
            color: "var(--accent-on)",
          }}
        >
          #{currentPlayer.serialNo}
        </div>
      </div>

      <div
        className="absolute top-0 left-0 h-1 w-16 z-10"
        style={{ backgroundColor: "var(--accent)" }}
      />

      <div className="absolute inset-x-0 bottom-0 z-10 px-3 sm:px-4 pb-3 pt-16 sm:pt-20 bg-gradient-to-t from-black via-black/95 to-transparent">
        <p className="mb-1.5 text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.14em] leading-snug">
          <span style={{ color: "var(--accent)" }}>{roleLabel}</span>
          {currentPlayer.city ? (
            <>
              <span className="mx-2 text-white/35 font-normal">•</span>
              <span className="text-white/80 font-mono tracking-[0.18em]">
                {currentPlayer.city}
              </span>
            </>
          ) : null}
        </p>

        <h2 className="font-['Bebas_Neue'] text-[clamp(1.35rem,2.8vw,2.25rem)] leading-[0.92] uppercase text-white tracking-tight">
          {currentPlayer.name}
        </h2>

        {infoRows.length > 0 ? (
          <div
            className={`mt-2 pt-2 border-t border-white/15 grid ${specGridClass} gap-x-3 gap-y-1 sm:gap-y-1.5`}
          >
            {infoRows.map((row, index) => (
              <SpecRow
                key={`${row.label}-${index}`}
                shortLabel={row.shortLabel}
                fullLabel={row.label}
                value={row.value}
                className={
                  infoRows.length > 2 &&
                  infoRows.length % 2 === 1 &&
                  index === infoRows.length - 1
                    ? "col-span-2"
                    : undefined
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

function GenderPortraitIcon({ gender }: { gender: PlayerGender }) {
  const className =
    "w-[clamp(4rem,14vw,7rem)] h-[clamp(4rem,14vw,7rem)] text-white/20";
  if (gender === "female") {
    return <UserRound className={className} strokeWidth={1.15} aria-hidden />;
  }
  return <User className={className} strokeWidth={1.15} aria-hidden />;
}

function SpecRow({
  shortLabel,
  fullLabel,
  value,
  className,
}: {
  shortLabel: string;
  fullLabel: string;
  value: string;
  className?: string;
}) {
  return (
    <p className={`min-w-0 leading-snug ${className ?? ""}`}>
      <span
        className="font-mono text-[12px] sm:text-[13px] uppercase tracking-[0.12em] text-white/50"
        title={fullLabel}
      >
        {shortLabel}:{" "}
      </span>
      <span
        className="font-mono text-[14px] sm:text-[15px] font-bold"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </span>
    </p>
  );
}
