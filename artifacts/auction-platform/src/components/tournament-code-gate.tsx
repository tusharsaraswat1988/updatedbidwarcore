import { useEffect, useState, useCallback, type ReactNode } from "react";
import { useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, AlertTriangle, RefreshCw } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { BootSplash } from "@/components/boot-splash";
import { getBrandLogoAlt } from "@/lib/brand-assets";

import { isBidWarLocalHost } from "@/lib/local-mode-host";

function sessionKey(tid: number) {
  return `tournament_verified_${tid}`;
}

function getCodeParam(search: string): string {
  try {
    return new URLSearchParams(search).get("code") ?? "";
  } catch {
    return "";
  }
}

export function TournamentCodeGate({
  tournamentId,
  children,
}: {
  tournamentId: number;
  children: ReactNode;
}) {
  const search = useSearch();
  const { logos, brandName, poweredByText } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const [status, setStatus] = useState<"loading" | "locked" | "unlocked" | "auction_disabled" | "invalid_module_state" | "error">("loading");
  const [auctionCode, setAuctionCode] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState("");
  const [tournamentLogo, setTournamentLogo] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [inputError, setInputError] = useState("");

  const loadTournament = useCallback(() => {
    if (!tournamentId) return;

    if (isBidWarLocalHost()) {
      setStatus("unlocked");
      return;
    }

    setStatus("loading");

    fetch(`/api/tournaments/${tournamentId}`)
      .then(r => {
        if (!r.ok) {
          // Transient server errors (5xx) → retry screen
          // Not found / client errors (4xx) → locked (no content to show)
          if (r.status >= 500) {
            setStatus("error");
          } else {
            setStatus("locked");
          }
          return null;
        }
        return r.json() as Promise<{
          auctionCode?: string | null;
          name?: string;
          logoUrl?: string;
          auctionEnabled?: boolean | null;
          scoringEnabled?: boolean | null;
          productMode?: string | null;
        }>;
      })
      .then((data) => {
        if (!data) return; // non-ok already handled

        // Product module boundary checks
        if (data.auctionEnabled === false && data.scoringEnabled === false) {
          setStatus("invalid_module_state");
          return;
        }

        if (data.auctionEnabled === false) {
          setStatus("auction_disabled");
          return;
        }

        const ac = (data.auctionCode ?? null);
        setAuctionCode(ac);
        setTournamentName(data.name ?? "");
        setTournamentLogo(
          data.logoUrl && !data.logoUrl.startsWith("data:") ? data.logoUrl : "",
        );

        // Already verified in this browser tab session?
        if (sessionStorage.getItem(sessionKey(tournamentId)) === "1") {
          setStatus("unlocked");
          return;
        }

        if (!ac) {
          // Tournament has no auctionCode — allow through (backward compatible)
          setStatus("unlocked");
          return;
        }

        // Auto-unlock from ?code= query param
        const paramCode = getCodeParam(search).toUpperCase();
        if (paramCode && paramCode === ac.toUpperCase()) {
          sessionStorage.setItem(sessionKey(tournamentId), "1");
          setStatus("unlocked");
          return;
        }

        setStatus("locked");
      })
      .catch(() => {
        // Fail-closed: network / parse errors keep the gate locked
        setStatus("error");
      });
  }, [tournamentId, search]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    if (code.trim().toUpperCase() === (auctionCode ?? "").toUpperCase()) {
      sessionStorage.setItem(sessionKey(tournamentId), "1");
      setStatus("unlocked");
    } else {
      setInputError("Incorrect code. Please try again.");
      setCode("");
    }
  }

  if (status === "loading") {
    return <BootSplash />;
  }

  if (status === "unlocked") {
    return <>{children}</>;
  }

  if (status === "auction_disabled") {
    return (
      <div className="lovable-theme dark min-h-screen flex flex-col items-center justify-center px-6 bg-background selection:bg-primary selection:text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="relative w-full max-w-md space-y-6 text-center"
        >
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-amber-500/15 border-2 border-amber-500/40">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl text-white">Auction Not Enabled</h1>
            <p className="text-[#a1a1aa] text-sm mt-2">
              The Auction module is not enabled for this tournament.
            </p>
          </div>
          <div className="pt-2">
            <a
              href={`/tournament/${tournamentId}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#27272a] text-white hover:bg-[#3f3f46] transition-colors text-sm font-semibold"
            >
              Go to Tournament Home
            </a>
          </div>
          <div className="flex flex-col items-center gap-2 pt-4">
            {logos.mini && <img src={logos.mini} alt={logoAlt} className="h-6 w-auto opacity-40" />}
            <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (status === "invalid_module_state") {
    return (
      <div className="lovable-theme dark min-h-screen flex flex-col items-center justify-center px-6 bg-background selection:bg-primary selection:text-primary-foreground">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-red-500/15 border-2 border-red-500/40">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl text-white">Invalid Tournament State</h1>
            <p className="text-[#a1a1aa] text-sm mt-2">
              A tournament must have at least one enabled product module (auction or scoring).
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 pt-4">
            {logos.mini && <img src={logos.mini} alt={logoAlt} className="h-6 w-auto opacity-40" />}
            <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="lovable-theme dark min-h-screen flex flex-col items-center justify-center px-6 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-red-500/15 border-2 border-red-500/40">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-xl">Could not load tournament</h2>
            <p className="text-[#71717a] text-sm mt-1">Check your connection and try again.</p>
          </div>
          <button
            onClick={loadTournament}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#27272a] text-white hover:bg-[#3f3f46] transition-colors text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  // status === "locked"
  return (
    <div className="lovable-theme dark min-h-screen flex flex-col items-center justify-center px-6 bg-background selection:bg-primary selection:text-primary-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="relative w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-3">
          {tournamentLogo ? (
            <img
              src={tournamentLogo}
              alt=""
              className="w-20 h-20 object-contain mx-auto rounded-xl mb-2"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-yellow-500/15 border-2 border-yellow-500/40">
              <Lock className="w-9 h-9 text-yellow-400" />
            </div>
          )}
          {tournamentName && (
            <h1 className="font-display font-black text-3xl text-white">{tournamentName}</h1>
          )}
          <p className="text-[#a1a1aa] text-sm">Enter the auction code to view this page</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setInputError(""); }}
              placeholder="AUCTION CODE"
              autoComplete="off"
              autoFocus
              className="w-full px-5 py-4 rounded-2xl border border-[#27272a] text-center font-display font-black text-2xl tracking-[0.3em] bg-[#18181b]/80 text-white placeholder:text-[#52525b] outline-none focus:border-yellow-500/60 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-[#a1a1aa] transition-colors"
            >
              {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {inputError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-sm text-center"
              >
                {inputError}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={!code.trim()}
            className="w-full py-4 rounded-2xl bg-yellow-400 text-black font-display font-black text-lg tracking-wide hover:bg-yellow-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enter
          </button>
        </form>

        <div className="flex flex-col items-center gap-2">
          {logos.mini && <img src={logos.mini} alt={logoAlt} className="h-6 w-auto opacity-40" />}
          <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
        </div>
      </motion.div>
    </div>
  );
}
