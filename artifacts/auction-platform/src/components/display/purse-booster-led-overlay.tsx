import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LedPurseBoosterOverlayView } from "@/lib/led-view/types";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import { formatINRFull } from "@/lib/led-view/format-inr";

function overlayIsLive(overlay: LedPurseBoosterOverlayView | null, now: number): boolean {
  if (!overlay) return false;
  const expiresAt = Date.parse(overlay.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export const PurseBoosterLedOverlay = memo(function PurseBoosterLedOverlay({
  overlay,
  unit = "rupee",
}: {
  overlay: LedPurseBoosterOverlayView | null;
  unit?: AuctionUnit;
}) {
  const [now, setNow] = useState(() => Date.now());
  const live = overlayIsLive(overlay, now);
  const animationKey = overlay ? `${overlay.batchId}:${overlay.replayKey}` : "idle";

  const expiresAtMs = overlay ? Date.parse(overlay.expiresAt) : NaN;
  const durationMs = overlay?.durationMs ?? 10_000;
  const progress = useMemo(() => {
    if (!overlay || !Number.isFinite(expiresAtMs)) return 0;
    const remaining = Math.max(0, expiresAtMs - now);
    return Math.min(1, Math.max(0, 1 - remaining / durationMs));
  }, [overlay, expiresAtMs, durationMs, now]);

  useEffect(() => {
    if (!overlay) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    const hideAt = Date.parse(overlay.expiresAt) - Date.now() + 80;
    const hideTimer = window.setTimeout(() => setNow(Date.now()), Math.max(0, hideAt));
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(hideTimer);
    };
  }, [animationKey, overlay?.expiresAt]);

  if (!overlay || !live) return null;

  const subtitle =
    overlay.target === "all"
      ? `${overlay.teams.length} teams updated`
      : overlay.teams[0]?.teamName ?? "Team updated";

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={animationKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
        className="absolute inset-x-0 top-0 z-[70] flex justify-center px-[2vw] pt-[2vh] pointer-events-none"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/35 to-transparent" />

        <motion.div
          initial={{ opacity: 0, y: -36, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -24, scale: 0.98 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[92vw] overflow-hidden rounded-2xl border border-amber-300/25 bg-[#070b16]/92 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-80" />
          <div className="absolute -left-24 top-0 h-full w-48 rotate-12 bg-amber-300/10 blur-3xl" />
          <div className="absolute -right-24 top-0 h-full w-48 -rotate-12 bg-emerald-400/10 blur-3xl" />

          <div className="relative px-[2.2vw] py-[1.6vh] border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <motion.p
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 }}
                  className="text-[clamp(0.55rem,0.9vw,0.75rem)] font-mono uppercase tracking-[0.45em] text-amber-200/75"
                >
                  Purse Booster Applied
                </motion.p>
                <motion.h2
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 }}
                  className="mt-1 font-['Bebas_Neue'] text-[clamp(2rem,4.2vw,4.5rem)] leading-none tracking-[0.08em] text-white"
                >
                  +{formatINRFull(overlay.boosterAmount, unit)}
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.18 }}
                  className="mt-1 text-[clamp(0.7rem,1.1vw,0.95rem)] font-medium text-white/60"
                >
                  {subtitle}
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 18 }}
                className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-right"
              >
                <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-emerald-200/70">
                  Live Update
                </p>
                <p className="font-['Bebas_Neue'] text-[clamp(1.4rem,2.4vw,2.2rem)] tracking-wider text-emerald-300">
                  PURSE UP
                </p>
              </motion.div>
            </div>
          </div>

          <div className="relative max-h-[42vh] overflow-auto">
            <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.9fr))] gap-x-3 px-[2.2vw] py-[1.1vh] text-[clamp(0.55rem,0.85vw,0.72rem)] font-mono uppercase tracking-[0.22em] text-white/35 border-b border-white/8">
              <span>Team</span>
              <span className="text-right">Existing</span>
              <span className="text-right text-amber-200/80">Booster</span>
              <span className="text-right text-emerald-200/80">Total</span>
            </div>

            {overlay.teams.map((team, index) => (
              <motion.div
                key={`${animationKey}-${team.teamId}`}
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.18 + index * 0.07, duration: 0.42, ease: "easeOut" }}
                className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,0.9fr))] items-center gap-x-3 px-[2.2vw] py-[1.15vh] border-b border-white/[0.06] last:border-b-0"
                style={{
                  background:
                    index % 2 === 0
                      ? "linear-gradient(90deg, rgba(255,255,255,0.02), transparent)"
                      : undefined,
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt=""
                      className="h-[clamp(2rem,3.2vw,3rem)] w-[clamp(2rem,3.2vw,3rem)] shrink-0 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-[clamp(2rem,3.2vw,3rem)] w-[clamp(2rem,3.2vw,3rem)] shrink-0 items-center justify-center rounded-full font-['Bebas_Neue'] text-[clamp(0.9rem,1.4vw,1.2rem)] tracking-wider text-black"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.shortCode}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[clamp(0.95rem,1.35vw,1.25rem)] text-white">
                      {team.teamName}
                    </p>
                    <p className="truncate text-[clamp(0.62rem,0.9vw,0.78rem)] uppercase tracking-[0.18em] text-white/40">
                      {team.shortCode}
                    </p>
                  </div>
                </div>

                <p className="text-right font-mono tabular-nums text-[clamp(0.85rem,1.2vw,1.05rem)] text-white/75">
                  {formatINRFull(team.previousCapacity, unit)}
                </p>
                <p className="text-right font-mono tabular-nums text-[clamp(0.85rem,1.2vw,1.05rem)] text-amber-300">
                  +{formatINRFull(team.boosterAmount, unit)}
                </p>
                <p className="text-right font-mono tabular-nums text-[clamp(0.95rem,1.35vw,1.15rem)] font-semibold text-emerald-300">
                  {formatINRFull(team.newCapacity, unit)}
                </p>
              </motion.div>
            ))}
          </div>

          <div className="relative h-1.5 bg-white/5">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-300 via-emerald-400 to-amber-300"
              style={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.2, ease: "linear" }}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
