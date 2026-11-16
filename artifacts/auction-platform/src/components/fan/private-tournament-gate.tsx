import React, { useState } from "react";
import { Lock, KeyRound, ShieldAlert, ChevronRight, AlertCircle, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

export interface PrivateTournamentGateProps {
  tournamentId: number;
  tournamentName?: string;
  onUnlock: (pin: string) => Promise<boolean>;
}

export function PrivateTournamentGate({
  tournamentId,
  tournamentName,
  onUnlock,
}: PrivateTournamentGateProps) {
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim();
    if (!cleanPin) {
      setError("Please enter the 4-digit access PIN");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const ok = await onUnlock(cleanPin);
      if (!ok) {
        setError("Invalid PIN. Please check with the tournament organizer.");
      }
    } catch {
      setError("Unable to verify access. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md bg-slate-900/90 border border-white/10 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 text-center"
      >
        {/* Lock Icon */}
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-5 text-amber-400 shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        {/* Title & Description */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/25 text-amber-400 mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          Private Spectator Arena
        </span>

        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
          {tournamentName || `Tournament #${tournamentId}`}
        </h1>

        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          This tournament is set to private. Enter the spectator access PIN provided by the organizer to enter the live arena.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(null);
              }}
              placeholder="Enter Access PIN"
              className="w-full px-4 py-3.5 bg-black/50 border border-white/15 focus:border-amber-400 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all"
              autoFocus
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !pin.trim()}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Unlock Spectator Arena</span>
              </>
            )}
          </button>
        </form>

        {/* Bottom Organizer Links */}
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <Link
            to="/fan"
            className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Discover Other Tournaments</span>
          </Link>

          <Link
            to={`/login?redirect=/tournament/${tournamentId}/fan`}
            className="text-amber-400 hover:text-amber-300 font-medium transition-colors cursor-pointer"
          >
            Organizer Login →
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
