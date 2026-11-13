import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LogIn, ShieldAlert } from "lucide-react";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { BidWarNeuralCore } from "@/components/admin/bidwar-neural-core";
import { BidWarLoginMeshBackground } from "@/components/admin/bidwar-login-mesh-background";
import "@/styles/admin-neural-login.css";

// Uses organizer-auth preset for high-contrast primary logo on light pearl surfaces
const authLoginPreset = getBrandSurfacePreset("organizer-auth");

/** Seconds of inactivity before auto-resetting back to intro */
const INACTIVITY_TIMEOUT_MS = 5000;

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { login } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<"intro" | "passwordPrompt" | "authenticating">("intro");
  const [orbHovered, setOrbHovered] = useState(false);
  const [coreSize, setCoreSize] = useState(320);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const inactivityTimerRef = useRef<number | null>(null);

  const { logos, brandName } = useBranding();
  const logoSrc = getBrandLogoSrc(logos, authLoginPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);

  // Lock body scroll while on admin login to eliminate mobile vertical scrolling
  useEffect(() => {
    const origBodyOverflow = document.body.style.overflow;
    const origBodyOverscroll = document.body.style.overscrollBehavior;
    const origDocOverflow = document.documentElement.style.overflow;
    const origDocOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = origBodyOverflow;
      document.body.style.overscrollBehavior = origBodyOverscroll;
      document.documentElement.style.overflow = origDocOverflow;
      document.documentElement.style.overscrollBehavior = origDocOverscroll;
    };
  }, []);

  // Responsive neural core sizing with dynamic mobile viewport height awareness
  useEffect(() => {
    const updateSize = () => {
      if (typeof window === "undefined") return;
      const h = window.innerHeight;
      const w = window.innerWidth;
      if (h < 640 || w < 360) {
        setCoreSize(220);
      } else if (h < 760 || w < 440) {
        setCoreSize(250);
      } else if (w < 1024) {
        setCoreSize(290);
      } else {
        setCoreSize(320);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Clear inactivity timer helper
  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  // Start inactivity timer helper
  const startInactivityTimer = useCallback(() => {
    clearInactivityTimer();
    inactivityTimerRef.current = window.setTimeout(() => {
      // Only reset if password is still empty
      setPassword((current) => {
        if (current.length === 0) {
          setError("");
          setStage("intro");
        }
        return current;
      });
      inactivityTimerRef.current = null;
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearInactivityTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearInactivityTimer();
  }, [clearInactivityTimer]);

  // Manage inactivity timer based on stage and password
  useEffect(() => {
    if (stage === "passwordPrompt") {
      if (password.length === 0) {
        startInactivityTimer();
      } else {
        clearInactivityTimer();
      }
    } else {
      clearInactivityTimer();
    }
  }, [stage, password, startInactivityTimer, clearInactivityTimer]);

  // Autofocus password field when revealed
  useEffect(() => {
    if (stage === "passwordPrompt") {
      const focusTimer = window.setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 350);
      return () => window.clearTimeout(focusTimer);
    }
  }, [stage]);

  const activateCore = () => {
    if (stage !== "intro") return;
    setStage("passwordPrompt");
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;
    setLoading(true);
    setError("");
    setStage("authenticating");
    const result = await login(password.trim());
    if (result.success) {
      navigate("/admin");
    } else {
      setError(result.error || "Login failed");
      setPassword("");
      setStage("passwordPrompt");
    }
    setLoading(false);
  }

  const isPasswordVisible = stage === "passwordPrompt" || stage === "authenticating";

  return (
    <div
      id="bidwar-admin-login-root"
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full bg-[#F8F7F2] text-[#2E281E] overflow-hidden flex flex-col items-center justify-center selection:bg-[#E5C158]/30 selection:text-[#2E281E] font-sans overscroll-none"
    >
      {/* Full-viewport ambient warm champagne background */}
      <BidWarLoginMeshBackground stage={stage} />

      {/* Content layer with refined, balanced spacing */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full px-4 gap-4 sm:gap-6">

        {/* Brand Logo — Compact on Pearl Surface */}
        <motion.div
          className="flex items-center justify-center select-none"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <img
            src={logoSrc}
            alt={logoAlt}
            className="h-9 sm:h-11 md:h-12 w-auto max-w-[175px] sm:max-w-[200px] object-contain drop-shadow-[0_4px_16px_rgba(110,92,70,0.06)]"
          />
        </motion.div>

        {/* 3D Neural Core Hero — Champagne Gold & Pearl Reference Aesthetic */}
        <div className="relative flex items-center justify-center">
          {/* Concentric Ambient Energy Rings (Champagne Gold) */}
          <div className="login-orb-ring" />
          <div className="login-orb-ring login-orb-ring-delay" />

          <button
            type="button"
            onClick={activateCore}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                activateCore();
              }
            }}
            onMouseEnter={() => setOrbHovered(true)}
            onMouseLeave={() => setOrbHovered(false)}
            aria-label="Activate Super Admin authentication"
            className="group relative flex cursor-pointer items-center justify-center rounded-full transition-transform duration-500 ease-out hover:scale-[1.03] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-4 focus-visible:ring-offset-[#F8F7F2]"
            style={{
              width: coreSize,
              height: coreSize,
            }}
          >
            {/* Soft Warm Champagne Radial Sheen on Hover (No Blue) */}
            <span className="pointer-events-none absolute inset-[-20px] rounded-full bg-[#E8C47A]/15 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
            <span className="pointer-events-none absolute inset-[-10px] rounded-full bg-[#F5DE98]/12 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
            <div className="login-orb-sheen" />

            {/* 3D Fibonacci Neural Core Canvas with Champagne Metallic Surface */}
            <BidWarNeuralCore
              size={coreSize}
              charged={isPasswordVisible}
              active={orbHovered}
            />
          </button>
        </div>

        {/* Refined CTA or Password Input */}
        <AnimatePresence mode="wait">
          {stage === "intro" && (
            <motion.button
              key="cta"
              type="button"
              onClick={activateCore}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4, transition: { duration: 0.18 } }}
              transition={{ duration: 0.35 }}
              className="mt-0.5 flex items-center gap-2 px-3.5 py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold tracking-[0.24em] uppercase text-[#4A4035]/75 hover:text-[#2A241A] transition-colors duration-300 select-none cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5B54F] shadow-[0_0_8px_rgba(229,181,79,0.9)] animate-pulse" />
              <span>TAP CORE TO AUTHENTICATE</span>
            </motion.button>
          )}

          {isPasswordVisible && (
            <motion.div
              key="password"
              initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: 0.2 } }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-2.5 w-full max-w-[340px]"
            >
              <form onSubmit={handleSubmit} className="w-full">
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password"
                    disabled={loading}
                    autoComplete="current-password"
                    className="w-full h-11 px-4 pr-20 rounded-xl bg-[#FAF8F5]/90 border border-[#D8C7A8]/45 text-sm font-medium text-[#2E281E] placeholder:text-[#A09482] outline-none backdrop-blur-md shadow-[0_4px_20px_rgba(110,92,70,0.05)] transition-all duration-300 focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/25 focus:shadow-[0_0_24px_rgba(212,175,55,0.18)] disabled:opacity-50"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="p-1.5 text-[#948674] hover:text-[#2E281E] transition-colors"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !password.trim()}
                      aria-label="Sign in"
                      className="p-1.5 text-[#4A4035]/75 hover:text-[#2A241A] hover:bg-[#E5B54F]/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <LogIn className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Loading indicator */}
              {loading && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] text-[#4A4035]/70 tracking-wider font-mono font-medium"
                >
                  Authenticating…
                </motion.p>
              )}

              {/* Error display */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-rose-800 text-xs bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 shadow-sm font-medium"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
