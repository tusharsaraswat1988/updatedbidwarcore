import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { AppShell, BrandMark } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useTeamOwnerAuth } from "@/auth/team-owner/AuthContext";
import {
  establishOwnerWithoutCode,
  lookupOwnerTeams,
  parseOwnerDeepLink,
  resolveAfterMobileLookup,
  type OwnerOnboardingEntry,
} from "@/auth/team-owner/api";

/**
 * Step 1 — Enter Mobile Number (same Team Owner auth as web owner-app).
 * Supports ?tournamentId=&teamId= deep links identical to owner-app /join.
 */
export function TeamOwnerMobileEntryScreen() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const deepLink = useMemo(() => parseOwnerDeepLink(search), [search]);
  const {
    mobile,
    setMobile,
    setOnboardingEntries,
    clearOnboarding,
    setContext,
    context,
    isAuthenticated,
  } = useTeamOwnerAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated && context) {
      setLocation(`/team-owner/panel/${context.tournamentId}/${context.teamId}`);
    }
  }, [isAuthenticated, context, setLocation]);

  async function openResolvedEntry(entry: OwnerOnboardingEntry, allEntries: OwnerOnboardingEntry[], normalizedMobile: string) {
    if (entry.requiresAccessCode) {
      setOnboardingEntries(allEntries);
      setLocation(`/team-owner/access-code/${entry.tournamentId}/${entry.teamId}`);
      return;
    }

    const ok = await establishOwnerWithoutCode(entry, normalizedMobile);
    if (!ok) {
      setError("Could not open team session. Try again.");
      setLoading(false);
      return;
    }

    clearOnboarding();
    setContext({
      tournamentId: entry.tournamentId,
      teamId: entry.teamId,
      tournamentName: entry.tournamentName,
      teamName: entry.teamName,
      teamShortCode: entry.teamShortCode,
      teamColor: entry.teamColor,
      teamLogoUrl: entry.teamLogoUrl,
      mobile: normalizedMobile,
    });
    setLocation(`/team-owner/panel/${entry.tournamentId}/${entry.teamId}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseIndianMobile(mobile);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (loading) return;

    setLoading(true);
    setError("");
    clearOnboarding();

    try {
      const entries = await lookupOwnerTeams(parsed.normalized);
      setMobile(parsed.normalized);

      if (entries.length === 0) {
        setError("No active auctions found for this number. Check with your organizer.");
        setLoading(false);
        return;
      }

      const resolved = resolveAfterMobileLookup(entries, deepLink);
      if (resolved.kind === "route") {
        await openResolvedEntry(resolved.entry, entries, parsed.normalized);
        return;
      }

      setOnboardingEntries(entries);
      setLocation("/team-owner/tournaments");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-4">
            <BrandMark />
            <p className="font-display font-black text-3xl text-amber-400">BidWar</p>
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-amber-400/15 border border-amber-400/30">
              <Phone className="w-8 h-8 text-amber-400" />
            </div>
            <div>
              <h1 className="font-display font-black text-3xl text-white">Join your auction</h1>
              <p className="text-[#71717a] text-base mt-2 leading-relaxed">
                Enter the mobile number registered with your team
              </p>
              {deepLink ? (
                <p className="text-amber-400/90 text-sm mt-3 font-semibold">
                  Team link detected — verify your mobile to continue.
                </p>
              ) : null}
            </div>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(sanitizeMobileInput(e.target.value));
                setError("");
              }}
              placeholder="Mobile number"
              autoFocus
              className="w-full px-5 py-5 rounded-2xl border border-[#3f3f46] text-center text-xl font-semibold bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60"
            />

            <AnimatePresence>
              {error ? (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center font-semibold leading-relaxed"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={mobile.length < 10 || loading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-5 rounded-2xl font-display font-black text-xl text-black bg-amber-400 disabled:opacity-40"
            >
              {loading ? "Finding…" : "Find my team"}
            </motion.button>
          </form>

          <div className="text-center">
            <SwitchRoleButton />
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}
