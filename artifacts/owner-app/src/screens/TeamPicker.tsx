import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Zap, Clock, Pause } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";
import {
  loadOnboardingEntries,
  clearOnboardingEntries,
  ownerDashboardRoute,
  type OwnerOnboardingEntry,
} from "@/lib/owner-flow";

function StatusBadge({ entry }: { entry: OwnerOnboardingEntry }) {
  if (entry.auctionStatus === "active") {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 uppercase tracking-wider font-bold flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Live
      </span>
    );
  }
  if (entry.auctionStatus === "paused") {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wider font-bold flex items-center gap-1">
        <Pause className="w-3 h-3" />
        Paused
      </span>
    );
  }
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider font-semibold flex items-center gap-1">
      <Clock className="w-3 h-3" />
      Upcoming
    </span>
  );
}

function TeamCard({ entry, onSelect }: { entry: OwnerOnboardingEntry; onSelect: () => void }) {
  const color = entry.teamColor || "#F59E0B";
  const live = entry.auctionStatus === "active";

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className="w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98]"
      style={{
        borderColor: live ? `${color}60` : "#27272a",
        backgroundColor: live ? `${color}12` : "#18181b",
      }}
    >
      <div className="flex items-center gap-3">
        <TeamLogo
          logoUrl={entry.teamLogoUrl}
          shortCode={entry.teamShortCode}
          teamName={entry.teamName}
          teamColor={color}
          className="w-14 h-14 rounded-xl"
          textClassName="text-lg"
        />
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-lg text-white truncate">{entry.teamName}</p>
          <p className="text-sm text-[#71717a] truncate">{entry.tournamentName}</p>
          {entry.licenseStatus === "trial" && (
            <p className="text-xs text-amber-400/80 mt-0.5 font-semibold uppercase tracking-wide">Trial</p>
          )}
        </div>
        <StatusBadge entry={entry} />
      </div>
      {live && (
        <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: `${color}25` }}>
          <Zap className="w-3.5 h-3.5" style={{ color }} />
          <p className="text-xs font-semibold" style={{ color }}>Tap to join live auction</p>
        </div>
      )}
    </motion.button>
  );
}

export function TeamPicker() {
  const [, setLocation] = useLocation();
  const [entries, setEntries] = useState<OwnerOnboardingEntry[]>([]);
  const { brandName, logos, miniBrandText } = useBranding();

  useEffect(() => {
    const loaded = loadOnboardingEntries();
    if (loaded.length === 0) {
      setLocation("/join");
      return;
    }
    setEntries(loaded);
  }, [setLocation]);

  function handleSelect(entry: OwnerOnboardingEntry) {
    clearOnboardingEntries();
    setLocation(ownerDashboardRoute(entry.tournamentId, entry.teamId));
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const liveCount = entries.filter(e => e.auctionStatus === "active").length;

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom">
      <div className="px-5 pt-5 pb-4 flex-shrink-0 border-b border-[#27272a]">
        <button
          type="button"
          onClick={() => { clearOnboardingEntries(); setLocation("/join"); }}
          className="flex items-center gap-2 text-[#71717a] hover:text-[#a1a1aa] text-sm font-semibold mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Change number
        </button>
        <div className="flex items-center gap-3 mb-2">
          {logos.mini ? (
            <img src={logos.mini} alt={brandName} className="h-7 w-auto" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30">
              {miniBrandText}
            </div>
          )}
          <span className="font-display font-black text-lg text-white">{brandName}</span>
        </div>
        <h1 className="font-display font-black text-2xl text-white">Select your team</h1>
        <p className="text-sm text-[#71717a] mt-1">
          {liveCount > 0
            ? `${liveCount} auction${liveCount === 1 ? "" : "s"} live right now`
            : `${entries.length} active tournament${entries.length === 1 ? "" : "s"} found`}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 min-h-0">
        {entries.map(entry => (
          <TeamCard
            key={`${entry.tournamentId}-${entry.teamId}`}
            entry={entry}
            onSelect={() => handleSelect(entry)}
          />
        ))}
      </div>
    </div>
  );
}
