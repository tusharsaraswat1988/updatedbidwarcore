import { useState } from "react";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/hooks/use-branding";

interface AdminLockScreenProps {
  lockMinutes?: number;
  onUnlock: (password: string) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Full-screen lock overlay shown after 2 min of admin inactivity.
 * Sits above all admin content (z-50). Requires correct admin password
 * to dismiss — verifies against the server (same as login) so it cannot
 * be bypassed by clearing local state.
 */
export function AdminLockScreen({ lockMinutes = 2, onUnlock }: AdminLockScreenProps) {
  const { logos, brandName } = useBranding();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const result = await onUnlock(password.trim());
    if (!result.success) {
      setError(result.error || "Incorrect password");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(20px)", background: "rgba(0,0,0,0.75)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, type: "spring" }}
        className="w-full max-w-sm mx-4 space-y-6"
      >
        {/* Header */}
        <div className="text-center space-y-4">
          <motion.div
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-amber-500/10 border border-amber-500/30"
          >
            <Lock className="w-9 h-9 text-amber-400" />
          </motion.div>
          <div>
            <div className="flex items-center justify-center gap-2 mb-1">
              {logos.mini ? (
                <img src={logos.mini} alt={brandName} className="h-8 w-auto opacity-80" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-amber-400" />
              )}
              <span className="font-display font-black text-lg text-white">{brandName.toUpperCase()}</span>
            </div>
            <p className="text-amber-300 font-semibold text-sm">Session Locked</p>
            <p className="text-muted-foreground text-xs mt-1">
              Inactive for {lockMinutes} minute{lockMinutes !== 1 ? "s" : ""} — enter your password to continue
            </p>
          </div>
        </div>

        {/* Password form */}
        <div className="bg-card/80 border border-border rounded-2xl p-6 space-y-4 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lock-password">Admin Password</Label>
              <div className="relative">
                <Input
                  id="lock-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
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

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"
              >
                <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <Button
              type="submit"
              className="w-full gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold"
              size="lg"
              disabled={loading || !password.trim()}
            >
              <Lock className="w-4 h-4" />
              {loading ? "Verifying..." : "Unlock"}
            </Button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
