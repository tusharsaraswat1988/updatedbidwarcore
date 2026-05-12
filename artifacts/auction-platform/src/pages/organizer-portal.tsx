import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  signupOrganizerAccount,
  loginOrganizerAccount,
  checkOrganizerAccountAuth,
  logoutOrganizerAccount,
} from "@/lib/auth";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserCircle2, LogOut, Trophy, ExternalLink, RefreshCw, ShieldCheck,
  Mail, Phone, Lock, User, Gavel,
} from "lucide-react";

type View = "login" | "signup" | "dashboard";
type OrganizerInfo = { id: number; name: string; email: string; mobile: string };
type Tournament = { id: number; name: string; sport: string; status: string; venue: string | null; auctionDate: string | null };

function AuthForm({ onSuccess }: { onSuccess: (organizer: OrganizerInfo, tournaments: Tournament[]) => void }) {
  const [view, setView] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", mobile: "", password: "", confirmPassword: "" });

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginForm.identifier || !loginForm.password) return;
    setLoading(true);
    setError("");
    const r = await loginOrganizerAccount(loginForm.identifier, loginForm.password);
    setLoading(false);
    if (!r.success) { setError(r.error || "Login failed"); return; }
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) onSuccess(me.organizer, me.tournaments ?? []);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const { name, email, mobile, password, confirmPassword } = signupForm;
    if (!name || !email || !mobile || !password) { setError("All fields are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    setError("");
    const r = await signupOrganizerAccount({ name, email, mobile, password });
    setLoading(false);
    if (!r.success) { setError(r.error || "Signup failed"); return; }
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) onSuccess(me.organizer, me.tournaments ?? []);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#09090b]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Gavel className="w-8 h-8 text-primary" />
          </div>
          <h1 className="font-display font-black text-3xl text-white">BidWar</h1>
          <p className="text-muted-foreground text-sm">Organizer Portal</p>
        </div>

        <div className="flex rounded-xl bg-muted/20 p-1 border border-border/50">
          <button
            onClick={() => { setView("login"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${view === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setView("signup"); setError(""); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${view === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            Create Account
          </button>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {view === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email or Mobile
                    </Label>
                    <Input
                      value={loginForm.identifier}
                      onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                      placeholder="name@example.com or +91 98765 43210"
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                    </Label>
                    <Input
                      type="password"
                      value={loginForm.password}
                      onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="signup"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleSignup}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm">
                      <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
                    </Label>
                    <Input
                      value={signupForm.name}
                      onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Your full name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                      </Label>
                      <Input
                        type="email"
                        value={signupForm.email}
                        onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile
                      </Label>
                      <Input
                        value={signupForm.mobile}
                        onChange={e => setSignupForm(f => ({ ...f, mobile: e.target.value }))}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-sm">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                      </Label>
                      <Input
                        type="password"
                        value={signupForm.password}
                        onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Min 6 characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Confirm Password</Label>
                      <Input
                        type="password"
                        value={signupForm.confirmPassword}
                        onChange={e => setSignupForm(f => ({ ...f, confirmPassword: e.target.value }))}
                        placeholder="Repeat password"
                      />
                    </div>
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Your tournaments must have your email set by the admin to appear here.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function Dashboard({
  organizer,
  tournaments,
  onLogout,
  onRefresh,
}: {
  organizer: OrganizerInfo;
  tournaments: Tournament[];
  onLogout: () => void;
  onRefresh: () => void;
}) {
  const [, navigate] = useLocation();

  const statusColor: Record<string, string> = {
    setup: "text-muted-foreground",
    active: "text-green-400",
    paused: "text-yellow-400",
    completed: "text-blue-400",
  };

  return (
    <div className="min-h-screen bg-[#09090b] p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <UserCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display font-black text-xl text-white">{organizer.name}</h1>
              <p className="text-xs text-muted-foreground">{organizer.email} · {organizer.mobile}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={onRefresh}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
              onClick={onLogout}
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </Button>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-display font-bold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" /> Your Tournaments
          </h2>

          {tournaments.length === 0 ? (
            <Card className="border-border/50 bg-card/30">
              <CardContent className="py-12 text-center text-muted-foreground text-sm">
                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium mb-1">No tournaments linked yet</p>
                <p className="text-xs">Ask your admin to set your email on your tournaments.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {tournaments.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Card className="border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base">{t.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.sport}</Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase ${statusColor[t.status] || ""}`}
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[t.venue, t.auctionDate].filter(Boolean).join(" · ") || "No details set"}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5 shrink-0"
                        onClick={() => navigate(`/tournament/${t.id}/login`)}
                      >
                        <Gavel className="w-3.5 h-3.5" /> Manage
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Use your tournament password to manage it at{" "}
          <code className="text-primary">/tournament/:id/login</code>
        </p>
      </div>
    </div>
  );
}

export default function OrganizerPortal() {
  const [, navigate] = useLocation();
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [checking, setChecking] = useState(true);

  async function refresh() {
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      setOrganizer(me.organizer);
      setTournaments(me.tournaments ?? []);
    } else {
      setOrganizer(null);
      setTournaments([]);
    }
    setChecking(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleLogout() {
    await logoutOrganizerAccount();
    setOrganizer(null);
    setTournaments([]);
  }

  function handleAuthSuccess(org: OrganizerInfo, tours: Tournament[]) {
    setOrganizer(org);
    setTournaments(tours);
  }

  if (checking) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <AnimatePresence mode="wait">
        {organizer ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Dashboard
              organizer={organizer}
              tournaments={tournaments}
              onLogout={handleLogout}
              onRefresh={refresh}
            />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthForm onSuccess={handleAuthSuccess} />
          </motion.div>
        )}
      </AnimatePresence>
    </FullscreenLayout>
  );
}
