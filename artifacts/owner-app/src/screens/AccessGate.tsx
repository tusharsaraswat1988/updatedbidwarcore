import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff } from "lucide-react";

interface Props {
  teamName: string;
  teamShortCode: string;
  teamColor: string;
  onVerified: (code: string) => void;
  verifyCode: (code: string) => Promise<boolean>;
}

export function AccessGate({ teamName, teamShortCode, teamColor, onVerified, verifyCode }: Props) {
  const [code, setCode]           = useState("");
  const [showCode, setShowCode]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError("");
    const ok = await verifyCode(code.trim().toUpperCase());
    if (ok) {
      onVerified(code.trim().toUpperCase());
    } else {
      setError("Incorrect code. Please try again.");
      setCode("");
    }
    setLoading(false);
  }

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-6 bg-[#09090b] overscroll-none"
      style={{
        background: `radial-gradient(ellipse at top, ${teamColor}18 0%, transparent 55%), #09090b`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Team badge */}
        <div className="text-center space-y-4">
          <div
            className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center font-display font-black text-3xl"
            style={{ backgroundColor: `${teamColor}25`, border: `3px solid ${teamColor}60`, color: teamColor }}
          >
            {teamShortCode || <Lock className="w-10 h-10" />}
          </div>
          <div>
            <h1 className="font-display font-black text-3xl text-white tracking-wide">{teamName}</h1>
            <p className="text-[#71717a] text-sm mt-1">Enter your access code to join</p>
          </div>
        </div>

        {/* Code input */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder="ACCESS CODE"
              autoComplete="off"
              autoFocus
              className="w-full px-5 py-5 rounded-2xl border border-[#3f3f46] text-center font-display font-bold text-2xl tracking-[0.35em] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-[color:var(--team-color)] transition-colors"
              style={{ "--team-color": teamColor } as React.CSSProperties}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors p-1"
            >
              {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={!code.trim() || loading}
            whileTap={{ scale: 0.97 }}
            className="w-full py-5 rounded-2xl font-display font-black text-xl text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: teamColor, boxShadow: `0 0 40px ${teamColor}44` }}
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
            ) : (
              "ENTER"
            )}
          </motion.button>
        </form>

        <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest text-center">
          Powered by BidWar
        </p>
      </motion.div>
    </div>
  );
}
