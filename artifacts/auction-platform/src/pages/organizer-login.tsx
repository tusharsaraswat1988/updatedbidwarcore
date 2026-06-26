import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, Trophy, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNextPath(): string | null {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) {
      return next;
    }
  } catch {
    /* ignore malformed query */
  }
  return null;
}

export default function OrganizerLogin() {
  const [, params] = useRoute("/tournament/:id/login");
  const tournamentId = parseInt(params?.id || "0");
  const [, navigate] = useLocation();

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { isLoggedIn, isLoading: authLoading, login } = useOrganizerAuth(tournamentId);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const defaultPath = `/tournament/${tournamentId}`;
  const postLoginPath = safeNextPath() ?? defaultPath;

  function goAfterLogin(path: string) {
    if (path.startsWith(SCORING_APP_BASE)) {
      window.location.href = path;
      return;
    }
    navigate(path);
  }

  // If already authenticated (e.g. organizer-account owner who just created this tournament),
  // skip the login gate entirely
  useEffect(() => {
    if (!authLoading && isLoggedIn && tournamentId) {
      goAfterLogin(postLoginPath);
    }
  }, [authLoading, isLoggedIn, tournamentId, postLoginPath]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const result = await login(password.trim());
    if (result.success) {
      goAfterLogin(postLoginPath);
    } else {
      setError(result.error || "Login failed");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <FullscreenLayout>
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, type: "spring" }}
          className="w-full max-w-sm space-y-8"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-primary/10 border border-primary/30">
              {tournament?.logoUrl ? (
                <img src={tournament.logoUrl} alt={tournament.name} className="h-14 w-14 object-contain rounded-xl" />
              ) : (
                <Trophy className="w-10 h-10 text-primary" />
              )}
            </div>
            <div>
              <h1 className="font-display font-black text-3xl text-white">
                {tournament?.name || "BidWar"}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">Organizer Access</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-border pb-4">
              <Lock className="w-4 h-4" />
              <span>Enter your organizer password to manage this tournament</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter organizer password"
                    autoFocus
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
                  >
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={loading || !password.trim()}
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>

        </motion.div>
      </div>
    </FullscreenLayout>
  );
}
