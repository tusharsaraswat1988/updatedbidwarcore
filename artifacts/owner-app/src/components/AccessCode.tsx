import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";
import {
  persistOwnerSession,
  verifyOwnerAccessCode,
} from "@workspace/api-base/owner-auth";
import { useBranding } from "@/hooks/useBranding";

type Props = {
  tournamentId: number;
  teamId: number;
  teamName: string;
  teamShortCode: string;
  teamColor: string;
  onVerified: () => void;
};

/** Single access-code gate for all owner entry paths. */
export function AccessCode({
  tournamentId,
  teamId,
  teamName,
  teamShortCode,
  teamColor,
  onVerified,
}: Props) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");

    const ok = await verifyOwnerAccessCode(tournamentId, teamId, code);
    if (ok) {
      persistOwnerSession(teamId, code);
      onVerified();
    } else {
      setError("Incorrect code. Please try again.");
      setCode("");
    }
    setLoading(false);
  }

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-6 bg-[#09090b] overscroll-none"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}18 0%, transparent 55%), #09090b` }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-5">
          <div className="flex items-center justify-center gap-2 mb-2">
            {logos.mini ? (
              <img src={logos.mini} alt={brandName} className="h-8 w-auto" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30">
                {miniBrandText}
              </div>
            )}
            <span className="font-display font-black text-lg text-white tracking-wide">{brandName}</span>
          </div>

          <div
            className="w-28 h-28 rounded-3xl mx-auto flex items-center justify-center font-display font-black text-4xl"
            style={{ backgroundColor: `${teamColor}25`, border: `3px solid ${teamColor}60`, color: teamColor }}
          >
            {teamShortCode || <Lock className="w-12 h-12" />}
          </div>
          <div>
            <h1 className="font-display font-black text-4xl text-white tracking-wide">{teamName}</h1>
            <p className="text-[#71717a] text-lg mt-2">Enter your access code to join</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder="ACCESS CODE"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              className="w-full px-6 py-6 rounded-2xl border border-[#3f3f46] text-center font-display font-bold text-3xl tracking-[0.35em] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none transition-colors"
              style={{ borderColor: code ? teamColor : undefined }}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors p-2"
            >
              {showCode ? <EyeOff className="w-7 h-7" /> : <Eye className="w-7 h-7" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-base text-center font-semibold"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!code.trim() || loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-6 rounded-2xl font-display font-black text-2xl text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: teamColor, boxShadow: `0 0 40px ${teamColor}44` }}
          >
            {loading ? (
              <div className="w-7 h-7 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            ) : "ENTER"}
          </motion.button>
        </form>

        <p className="text-sm text-[#3f3f46] uppercase tracking-widest text-center">
          {poweredByText}
        </p>
      </motion.div>
    </div>
  );
}
