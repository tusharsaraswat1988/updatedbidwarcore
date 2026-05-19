import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface Props {
  teamName:      string;
  teamShortCode: string;
  teamColor:     string;
  onReady:       () => void;
  onSync?:       () => void;
}

const STEPS = [
  "Connecting to auction room...",
  "Loading player roster...",
  "Syncing live state...",
  "Ready to bid!",
];

export function Warmup({ teamName, teamShortCode, teamColor, onReady, onSync }: Props) {
  const [step,    setStep]    = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const timings = [600, 700, 700, 500];
    let idx = 0;

    function advance() {
      idx++;
      if (idx < STEPS.length) {
        setStep(idx);
        setTimeout(advance, timings[idx]);
      } else {
        setTimeout(onReady, 400);
      }
    }

    const id = setTimeout(advance, timings[0]);
    return () => clearTimeout(id);
  }, [onReady]);

  function handleSync() {
    if (!onSync || syncing) return;
    setSyncing(true);
    onSync();
    setTimeout(() => setSyncing(false), 1200);
  }

  return (
    <div
      className="h-full flex flex-col items-center justify-center bg-[#09090b] px-6"
      style={{
        background: `radial-gradient(ellipse at center, ${teamColor}18 0%, transparent 60%), #09090b`,
      }}
    >
      <div className="text-center space-y-10">
        {/* Team badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <div
            className="w-28 h-28 rounded-3xl mx-auto flex items-center justify-center font-display font-black text-4xl mb-4"
            style={{ backgroundColor: `${teamColor}25`, border: `3px solid ${teamColor}60`, color: teamColor }}
          >
            {teamShortCode}
          </div>
          <h1 className="font-display font-black text-3xl text-white tracking-wide">{teamName}</h1>
        </motion.div>

        {/* Progress steps */}
        <div className="space-y-4">
          <div className="flex justify-center gap-1.5 mb-5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="h-1 rounded-full"
                style={{ backgroundColor: teamColor }}
                initial={{ width: 8, opacity: 0.2 }}
                animate={{ width: i <= step ? 24 : 8, opacity: i <= step ? 1 : 0.2 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[#a1a1aa] text-sm"
          >
            {STEPS[step]}
          </motion.p>
        </div>

        {/* Spinner */}
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: `${teamColor}40`, borderTopColor: teamColor }}
        />
      </div>

      {/* Footer */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest">
          Powered by BidWar
        </p>
        {onSync && (
          <button
            onClick={handleSync}
            className="p-1.5 rounded-full text-[#3f3f46] hover:text-[#71717a] transition-colors"
            title="Sync data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
