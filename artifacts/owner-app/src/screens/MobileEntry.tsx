import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, ArrowLeft } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";
import { parseOwnerDeepLink, submitOwnerMobile } from "@/lib/owner-flow";

export function MobileEntry() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const deepLink = useMemo(() => parseOwnerDeepLink(search), [search]);

  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = mobile.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");

    const result = await submitOwnerMobile(trimmed, deepLink);

    if (result.kind === "route") {
      setLocation(result.path);
      return;
    }
    if (result.kind === "teams") {
      setLocation("/join/teams");
      return;
    }
    if (result.kind === "empty") {
      setError("No active auctions found for this number. Check with your organizer.");
    } else {
      setError(result.message);
    }
    setLoading(false);
  }

  return (
    <div className="h-full flex flex-col bg-[#09090b] safe-top safe-bottom">
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-[#71717a] hover:text-[#a1a1aa] text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              {logos.mini ? (
                <img src={logos.mini} alt={brandName} className="h-8 w-auto" />
              ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30">
                  {miniBrandText}
                </div>
              )}
              <span className="font-display font-black text-lg text-white">{brandName}</span>
            </div>
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={mobile}
              onChange={e => { setMobile(e.target.value); setError(""); }}
              placeholder="Mobile number"
              autoFocus
              className="w-full px-5 py-5 rounded-2xl border border-[#3f3f46] text-center text-xl font-semibold bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60 transition-colors"
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center font-semibold leading-relaxed"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={!mobile.trim() || loading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-5 rounded-2xl font-display font-black text-xl text-black bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ boxShadow: "0 0 32px rgba(245,158,11,0.25)" }}
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
              ) : "Find my team"}
            </motion.button>
          </form>

          <p className="text-sm text-[#3f3f46] uppercase tracking-widest text-center">
            {poweredByText}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
