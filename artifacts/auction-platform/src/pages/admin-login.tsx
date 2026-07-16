import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Eye, EyeOff, LogIn, ShieldAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { AdminPwaInstallHint } from "@/components/admin/admin-pwa-install-hint";

const authLoginPreset = getBrandSurfacePreset("auth-login");

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { login } = useAdminAuth();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { logos, brandName } = useBranding();
  const logoSrc = getBrandLogoSrc(logos, authLoginPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const result = await login(password.trim());
    if (result.success) {
      navigate("/admin");
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
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center bg-primary/10 border border-primary/30">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div>
              <div className="flex items-center justify-center mb-1">
                <img src={logoSrc} alt={logoAlt} className={authLoginPreset.sizeClass} />
              </div>
              <p className="text-muted-foreground text-sm">Super Admin Login</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <AdminPwaInstallHint />

            <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-border pb-4">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Full access to all tournaments and settings</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <div className="relative">
                  <Input
                    id="password"
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
                    aria-label={showPw ? "Hide password" : "Show password"}
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
                variant="default"
                className="w-full gap-2 font-bold"
                size="lg"
                disabled={loading || !password.trim()}
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Signing in..." : "Sign In as Admin"}
              </Button>
            </form>
          </div>

          <div className="text-center">
            <button
              onClick={() => navigate("/")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Tournaments
            </button>
          </div>
        </motion.div>
      </div>
    </FullscreenLayout>
  );
}
