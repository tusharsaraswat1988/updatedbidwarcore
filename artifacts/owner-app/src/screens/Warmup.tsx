import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { resolveSplashLogoUrl } from "@/lib/brand-assets";
import { TeamLogo } from "@/components/TeamLogo";

interface Props {
  teamName:      string;
  teamShortCode: string;
  teamColor:     string;
  teamLogoUrl?:  string | null;
  onReady:       () => void;
  onSync?:       () => void;
}

const STEPS = [
  "Connecting to auction room...",
  "Loading player roster...",
  "Syncing live state...",
  "Ready to bid!",
];

export function Warmup({ teamName, teamShortCode, teamColor, teamLogoUrl, onReady }: Props) {
  const [step, setStep] = useState(0);
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();
  const splashSrc = resolveSplashLogoUrl(logos);

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

  return (
    <div
      className="h-full flex flex-col items-center justify-center bg-[#09090b] px-6"
      style={{ background: `radial-gradient(ellipse at center, ${teamColor}18 0%, transparent 60%), #09090b` }}
    >
      <div className="w-full max-w-sm text-center space-y-10">
        {/* Brand logo */}
        <div className="flex items-center justify-center gap-2.5">
          {splashSrc ? (
            <img src={splashSrc} alt={brandName} className="h-12 w-auto max-w-[220px] object-contain" />
          ) : logos.mini ? (
            <img src={logos.mini} alt={brandName} className="h-9 w-auto" />
          ) : (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-sm bg-amber-400/20 text-amber-400 border border-amber-400/30">
              {miniBrandText}
            </div>
          )}
          {!splashSrc && (
            <span className="font-display font-black text-2xl text-white tracking-wide">{brandName}</span>
          )}
        </div>

        {/* Team badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="space-y-4"
        >
          <TeamLogo
            logoUrl={teamLogoUrl}
            shortCode={teamShortCode}
            teamName={teamName}
            teamColor={teamColor}
            className="w-36 h-36 rounded-3xl mx-auto"
            textClassName="text-5xl"
          />
          <h1 className="font-display font-black text-4xl text-white tracking-wide">{teamName}</h1>
        </motion.div>

        {/* Progress steps */}
        <div className="space-y-4">
          <div className="flex justify-center gap-2 mb-5">
            {STEPS.map((_, i) => (
              <motion.div
                key={i}
                className="h-1.5 rounded-full"
                style={{ backgroundColor: teamColor }}
                initial={{ width: 10, opacity: 0.2 }}
                animate={{ width: i <= step ? 28 : 10, opacity: i <= step ? 1 : 0.2 }}
                transition={{ duration: 0.3 }}
              />
            ))}
          </div>

          <motion.p
            key={step}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[#a1a1aa] text-lg"
          >
            {STEPS[step]}
          </motion.p>
        </div>

        {/* Spinner */}
        <div
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: `${teamColor}40`, borderTopColor: teamColor }}
        />
      </div>

      <p className="absolute bottom-8 text-sm text-[#3f3f46] uppercase tracking-widest">
        {poweredByText}
      </p>
    </div>
  );
}
