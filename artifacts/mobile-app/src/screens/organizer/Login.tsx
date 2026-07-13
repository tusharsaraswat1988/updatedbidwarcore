import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { MOBILE_APP_BASE } from "@workspace/api-base/mobile-app-urls";
import { AppShell, BrandMark } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useOrganizerAuth } from "@/auth/organizer/AuthContext";
import { organizerGoogleSignInUrl } from "@/auth/organizer/api";

export function OrganizerLoginScreen() {
  const [, setLocation] = useLocation();
  const { isLoading, isLoggedIn, login, refresh } = useOrganizerAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_ok") === "1") {
      void refresh().then(() => setLocation("/organizer/dashboard"));
    }
  }, [refresh, setLocation]);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      setLocation("/organizer/dashboard");
    }
  }, [isLoading, isLoggedIn, setLocation]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    const result = await login(identifier.trim(), password);
    if (result.success) {
      setLocation("/organizer/dashboard");
    } else {
      setError(result.error || "Login failed");
      setSubmitting(false);
    }
  }

  function handleGoogle() {
    const next = `${MOBILE_APP_BASE}/organizer/dashboard`;
    window.location.href = organizerGoogleSignInUrl(next);
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-7"
        >
          <div className="text-center space-y-3">
            <BrandMark />
            <p className="font-display font-black text-3xl text-amber-400">BidWar</p>
            <h1 className="font-display font-black text-2xl text-white">Organizer Login</h1>
            <p className="text-[#71717a] text-sm leading-relaxed">
              Sign in with Google or email and password. Same Organizer authentication as the web app.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            className="w-full py-4 rounded-2xl border border-[#3f3f46] bg-[#18181b] text-white font-semibold flex items-center justify-center gap-3 hover:border-amber-400/40 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 text-[#52525b] text-xs font-semibold uppercase tracking-wider">
            <div className="flex-1 h-px bg-[#27272a]" />
            or
            <div className="flex-1 h-px bg-[#27272a]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError("");
              }}
              placeholder="Email or mobile"
              className="w-full px-4 py-4 rounded-2xl border border-[#3f3f46] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60"
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="Password"
              className="w-full px-4 py-4 rounded-2xl border border-[#3f3f46] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60"
            />

            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center font-semibold"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={!identifier.trim() || !password || submitting || isLoading}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-display font-black text-lg text-black bg-amber-400 disabled:opacity-40"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>

          <div className="text-center pt-2">
            <SwitchRoleButton />
          </div>
        </motion.div>
      </div>
    </AppShell>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}
