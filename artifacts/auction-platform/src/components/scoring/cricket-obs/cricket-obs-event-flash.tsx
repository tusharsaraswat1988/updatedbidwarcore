import { AnimatePresence, motion } from "framer-motion";
import type { CricketObsFlashKind } from "@/lib/cricket-obs-view-model";

const LABELS: Record<CricketObsFlashKind, string> = {
  FOUR: "FOUR!",
  SIX: "SIX!",
  WICKET: "WICKET!",
  WIDE: "WIDE",
  NO_BALL: "NO BALL",
};

export function CricketObsEventFlash({
  flash,
  token,
}: {
  flash: CricketObsFlashKind | null;
  token: string | null;
}) {
  return (
    <div className="pointer-events-none flex h-10 max-w-[1180px] items-center self-start">
      <AnimatePresence mode="wait">
        {flash && token ? (
          <motion.div
            key={token}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="rounded-md border px-4 py-1.5 text-sm font-black uppercase tracking-[0.22em]"
            style={{
              borderColor:
                flash === "WICKET"
                  ? "rgba(248,113,113,0.7)"
                  : "color-mix(in srgb, var(--obs-accent) 55%, transparent)",
              background:
                flash === "WICKET"
                  ? "rgba(127,29,29,0.85)"
                  : "color-mix(in srgb, var(--obs-accent) 22%, rgba(0,0,0,0.8))",
              color: flash === "WICKET" ? "#fecaca" : "var(--obs-accent-on)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
            }}
          >
            {LABELS[flash]}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
