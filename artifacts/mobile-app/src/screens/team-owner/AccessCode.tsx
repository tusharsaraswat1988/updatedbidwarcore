import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useLocation, useParams } from "wouter";
import {
  fetchOwnerAccessLockoutStatus,
} from "@workspace/api-base/owner-auth";
import { AppShell } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useTeamOwnerAuth } from "@/auth/team-owner/AuthContext";
import { verifyAndPersistOwnerAccess } from "@/auth/team-owner/api";

/**
 * Step 3 — Enter Access Code (same verify-access API as web owner-app).
 */
export function TeamOwnerAccessCodeScreen() {
  const params = useParams<{ tournamentId: string; teamId: string }>();
  const tournamentId = parseInt(params.tournamentId || "0", 10);
  const teamId = parseInt(params.teamId || "0", 10);
  const [, setLocation] = useLocation();
  const { onboardingEntries, mobile, setContext, clearOnboarding } = useTeamOwnerAuth();

  const entry = useMemo(() => {
    return onboardingEntries.find(
      (e) => e.tournamentId === tournamentId && e.teamId === teamId,
    ) ?? null;
  }, [onboardingEntries, tournamentId, teamId]);

  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState(0);
  const lockedOut = lockoutRemainingSec > 0;

  useEffect(() => {
    if (!entry) {
      setLocation("/team-owner/login");
    }
  }, [entry, setLocation]);

  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const timer = window.setInterval(() => {
      setLockoutRemainingSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockoutRemainingSec > 0]);

  useEffect(() => {
    if (!lockedOut || !entry) return;
    let cancelled = false;
    const poll = async () => {
      const status = await fetchOwnerAccessLockoutStatus(tournamentId, teamId);
      if (cancelled) return;
      if (!status.locked) {
        setLockoutRemainingSec(0);
        setError("");
      } else if (status.lockoutRemainingSec > 0) {
        setLockoutRemainingSec(status.lockoutRemainingSec);
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [lockedOut, tournamentId, teamId, entry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || !code.trim() || loading || lockedOut) return;
    setLoading(true);
    setError("");

    const result = await verifyAndPersistOwnerAccess(entry, code, mobile);
    if (result.ok) {
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
      clearOnboarding();
      setLocation(`/team-owner/panel/${entry.tournamentId}/${entry.teamId}`);
      return;
    }

    if (result.reason === "lockout") {
      setLockoutRemainingSec(result.lockoutRemainingSec);
      setError(
        "Too many incorrect attempts. Please try again later or contact the tournament organiser.",
      );
      setCode("");
    } else {
      setError("Incorrect code. Please try again.");
      setCode("");
    }
    setLoading(false);
  }

  if (!entry) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]" aria-busy="true">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const accent = entry.teamColor || "#f59e0b";

  return (
    <AppShell>
      <div
        className="flex-1 flex flex-col items-center justify-center px-6"
        style={{
          background: `radial-gradient(ellipse at top, ${accent}18 0%, transparent 55%), #09090b`,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6"
        >
          <div className="text-center space-y-3">
            <div
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border"
              style={{ background: `${accent}22`, borderColor: `${accent}55` }}
            >
              <Lock className="w-7 h-7" style={{ color: accent }} />
            </div>
            <h1 className="font-display font-black text-3xl text-white">Enter Access Code</h1>
            <p className="text-[#a1a1aa] text-sm leading-relaxed">
              {entry.teamName} · {entry.tournamentName}
            </p>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="relative">
              <input
                type={showCode ? "text" : "password"}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="Access code"
                autoFocus
                disabled={lockedOut}
                className="w-full px-5 py-5 pr-14 rounded-2xl border border-[#3f3f46] text-center text-xl font-semibold tracking-widest bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowCode((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71717a]"
                aria-label={showCode ? "Hide code" : "Show code"}
              >
                {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center font-semibold leading-relaxed"
                >
                  {error}
                  {lockedOut && lockoutRemainingSec > 0
                    ? ` (${lockoutRemainingSec}s)`
                    : ""}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={!code.trim() || loading || lockedOut}
              whileTap={{ scale: 0.97 }}
              className="w-full py-5 rounded-2xl font-display font-black text-xl text-black bg-amber-400 disabled:opacity-40"
            >
              {loading ? "Verifying…" : "Continue"}
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
