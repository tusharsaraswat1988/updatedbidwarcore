import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { AppShell } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useTeamOwnerAuth } from "@/auth/team-owner/AuthContext";
import { establishOwnerWithoutCode, type OwnerOnboardingEntry } from "@/auth/team-owner/api";

/**
 * Step 2 — Select Tournament (when multiple teams match the mobile number).
 */
export function TeamOwnerTournamentPickerScreen() {
  const [, setLocation] = useLocation();
  const { onboardingEntries, mobile, setContext } = useTeamOwnerAuth();
  const [error, setError] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (onboardingEntries.length === 0) {
      setLocation("/team-owner/login");
    }
  }, [onboardingEntries.length, setLocation]);

  async function selectEntry(entry: OwnerOnboardingEntry) {
    const key = `${entry.tournamentId}-${entry.teamId}`;
    setLoadingId(key);
    setError("");

    if (entry.requiresAccessCode) {
      setLocation(`/team-owner/access-code/${entry.tournamentId}/${entry.teamId}`);
      return;
    }

    const ok = await establishOwnerWithoutCode(entry, mobile);
    if (!ok) {
      setError("Could not open team session. Try again.");
      setLoadingId(null);
      return;
    }

    setContext({
      tournamentId: entry.tournamentId,
      teamId: entry.teamId,
      tournamentName: entry.tournamentName,
      teamName: entry.teamName,
      teamShortCode: entry.teamShortCode,
      teamColor: entry.teamColor,
      teamLogoUrl: entry.teamLogoUrl,
      mobile,
    });
    setLocation(`/team-owner/panel/${entry.tournamentId}/${entry.teamId}`);
  }

  return (
    <AppShell>
      <header className="px-5 py-4 border-b border-[#27272a] shrink-0">
        <p className="font-display font-black text-amber-400 text-lg">BidWar</p>
        <h1 className="font-display font-bold text-xl text-white mt-1">Select Tournament</h1>
        <p className="text-[#71717a] text-sm mt-1">Choose the team you want to join</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
        {onboardingEntries.map((entry, i) => {
          const key = `${entry.tournamentId}-${entry.teamId}`;
          const accent = entry.teamColor || "#f59e0b";
          return (
            <motion.button
              key={key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              disabled={loadingId != null}
              onClick={() => void selectEntry(entry)}
              className="w-full text-left rounded-2xl border border-[#27272a] bg-[#18181b] px-4 py-4 disabled:opacity-50"
              style={{ borderLeftWidth: 4, borderLeftColor: accent }}
            >
              <p className="font-semibold text-white">{entry.tournamentName}</p>
              <p className="text-[#a1a1aa] text-sm mt-1">
                {entry.teamName} ({entry.teamShortCode})
              </p>
              <p className="text-[#52525b] text-xs mt-2 uppercase tracking-wider">
                {entry.auctionStatus || entry.tournamentStatus}
                {loadingId === key ? " · Opening…" : ""}
              </p>
            </motion.button>
          );
        })}

        {error ? (
          <p className="text-red-400 text-sm text-center font-semibold">{error}</p>
        ) : null}
      </div>

      <div className="px-5 py-4 border-t border-[#27272a] text-center shrink-0">
        <SwitchRoleButton />
      </div>
    </AppShell>
  );
}
