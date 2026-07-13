import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Clock, Eye, EyeOff } from "lucide-react";
import { useLocation } from "wouter";
import { MOBILE_APP_BASE } from "@workspace/api-base/mobile-app-urls";
import { AppShell, BrandMark } from "@/components/AppShell";
import { SwitchRoleButton } from "@/components/SwitchRoleButton";
import { useOrganizerAuth } from "@/auth/organizer/AuthContext";
import {
  fetchAuthConfig,
  fetchLoginGuardStatus,
  organizerGoogleSignInUrl,
  type LoginGuardStatus,
} from "@/auth/organizer/api";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_token_failed: "Google sign-in failed. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_state_mismatch: "Sign-in session expired or invalid. Please try again.",
  google_redirect_mismatch:
    "Google OAuth redirect URI is not registered. Add the Authorized redirect URI in Google Cloud Console.",
  not_configured: "Google login is not configured yet.",
  no_email: "Your Google account did not provide an email address.",
};

/**
 * Production Organizer login — mirrors auction-platform AuthForm login path:
 * login guard polling, cooldown, math captcha when required, Google OAuth.
 */
export function OrganizerLoginScreen() {
  const [, setLocation] = useLocation();
  const { isLoading, isLoggedIn, login } = useOrganizerAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [redirectUriHint, setRedirectUriHint] = useState("");

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [loginGuard, setLoginGuard] = useState<LoginGuardStatus | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    void fetchAuthConfig().then((cfg) => {
      setTurnstileSiteKey(cfg.turnstileSiteKey);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      setRedirectUriHint(params.get("oauth_redirect_uri") ?? "");
      setError(GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed. Please try again.");
    }
    if (params.get("google_ok") === "1") {
      // Prefer full navigation to dashboard so the post-OAuth landing is authoritative.
      window.location.assign(`${MOBILE_APP_BASE}/organizer/dashboard?google_ok=1`);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      setLocation("/organizer/dashboard");
    }
  }, [isLoading, isLoggedIn, setLocation]);

  // Debounced login-guard status — same behaviour as organizer portal.
  useEffect(() => {
    const id = identifier.trim();
    if (!id) {
      setLoginGuard(null);
      setCooldownSec(0);
      return;
    }
    const t = setTimeout(() => {
      void fetchLoginGuardStatus(id).then((guard) => {
        setLoginGuard(guard);
        setCooldownSec(guard.cooldownRemainingSec);
        if (guard.captcha?.captchaId) setCaptchaAnswer("");
      });
    }, 300);
    return () => clearTimeout(t);
  }, [identifier]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec((s) => {
        if (s <= 1) {
          void fetchLoginGuardStatus(identifier.trim()).then((guard) => {
            setLoginGuard(guard);
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec, identifier]);

  const captchaRequired = !!loginGuard?.captchaRequired;
  const signInDisabled =
    submitting ||
    isLoading ||
    cooldownSec > 0 ||
    !identifier.trim() ||
    !password ||
    (captchaRequired && !captchaAnswer.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (signInDisabled) return;
    setSubmitting(true);
    setError("");
    const result = await login(identifier.trim(), password, {
      captchaId: loginGuard?.captcha?.captchaId,
      captchaAnswer: captchaAnswer || undefined,
    });
    if (result.success) {
      setLoginGuard(null);
      setCooldownSec(0);
      setLocation("/organizer/dashboard");
      return;
    }
    setError(result.error || "Login failed");
    if (result.loginGuard) {
      setLoginGuard(result.loginGuard);
      setCooldownSec(result.loginGuard.cooldownRemainingSec);
      setCaptchaAnswer("");
    }
    setSubmitting(false);
  }

  function handleGoogle() {
    const next = `${MOBILE_APP_BASE}/organizer/dashboard`;
    window.location.href = organizerGoogleSignInUrl(next);
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-6 py-4"
        >
          <div className="text-center space-y-3">
            <BrandMark />
            <p className="font-display font-black text-3xl text-amber-400">BidWar</p>
            <h1 className="font-display font-black text-2xl text-white">Organizer Login</h1>
            <p className="text-[#71717a] text-sm leading-relaxed">
              Same Organizer authentication as the web portal — Google or email/password.
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

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
            <input
              type="text"
              autoComplete="username"
              inputMode="tel"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                setError("");
              }}
              placeholder="Mobile or email"
              className="w-full px-4 py-4 rounded-2xl border border-[#3f3f46] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60"
            />
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                className="w-full px-4 py-4 pr-12 rounded-2xl border border-[#3f3f46] bg-[#18181b] text-white placeholder:text-[#52525b] outline-none focus:border-amber-400/60"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#71717a]"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {captchaRequired && loginGuard?.captcha && !turnstileSiteKey ? (
              <div className="space-y-2 rounded-2xl border border-[#3f3f46] bg-[#18181b] p-4">
                <p className="text-sm text-[#a1a1aa]">{loginGuard.captcha.question}</p>
                <input
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Your answer"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full px-4 py-3 rounded-xl border border-[#3f3f46] bg-[#09090b] text-white outline-none focus:border-amber-400/60"
                />
              </div>
            ) : null}

            {cooldownSec > 0 ? (
              <p className="text-amber-400 text-sm flex items-center gap-1.5 font-semibold">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                Too many failed attempts. Try again in {cooldownSec}s.
              </p>
            ) : null}

            <AnimatePresence>
              {error ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-sm text-center font-semibold flex items-start justify-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.p>
              ) : null}
            </AnimatePresence>

            {redirectUriHint ? (
              <p className="text-[11px] text-[#71717a] break-all rounded-xl border border-[#27272a] bg-[#18181b] px-3 py-2 font-mono">
                {redirectUriHint}
              </p>
            ) : null}

            <motion.button
              type="submit"
              disabled={signInDisabled}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-display font-black text-lg text-black bg-amber-400 disabled:opacity-40"
            >
              {submitting
                ? "Signing in…"
                : cooldownSec > 0
                  ? `Sign In (${cooldownSec}s)`
                  : "Sign In"}
            </motion.button>
          </form>

          <div className="text-center pt-1">
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
