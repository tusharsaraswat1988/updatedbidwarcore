import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import {
  signupEmail,
  signupSendOtp,
  signupVerify,
  setOrganizerPassword,
  fetchAuthConfig,
  loginOrganizerAccount,
  checkOrganizerAccountAuth,
  logoutOrganizerAccount,
  createOrganizerTournament,
  updateOrganizerProfile,
  sendOtp,
  resendOtp,
  verifyOtpAndReset,
} from "@/lib/auth";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Trophy, ExternalLink, RefreshCw, ShieldCheck, Search,
  Phone, Lock, User, Gavel, Plus, AlertTriangle, CheckCircle2,
  Eye, EyeOff, ArrowLeft, KeyRound, CheckCheck, RotateCcw, Settings,
} from "lucide-react";

type OrganizerInfo = {
  id: number; name: string; email: string | null; mobile: string | null;
  photoUrl?: string | null; licenseStatus: string; maxTournaments: number; hasPassword?: boolean; needsMobile?: boolean;
};
type Tournament = {
  id: number; name: string; sport: string; status: string;
  licenseStatus: string; venue: string | null; auctionDate: string | null; createdAt: string;
};

// ─── Tournament License Badge ─────────────────────────────────────────────────

function TournamentLicenseBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] gap-1">
        <ShieldCheck className="w-2.5 h-2.5" /> Active
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] gap-1">
        <CheckCheck className="w-2.5 h-2.5" /> Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Trial</Badge>
  );
}

// ─── Indian number words helper ───────────────────────────────────────────────

function toIndianWords(raw: string): string {
  const n = parseInt(raw, 10);
  if (!n || isNaN(n) || n <= 0) return "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${crore} crore`);
  if (lakh) parts.push(`${lakh} lakh`);
  if (thousand) parts.push(`${thousand} thousand`);
  if (rest) parts.push(String(rest));
  return parts.join(" ");
}

// ─── Create Tournament Modal ──────────────────────────────────────────────────

function CreateTournamentModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    sport: "cricket",
    venue: "",
    auctionDate: "",
    auctionTime: "",
    basePurse: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  // Load sports from master table
  const [sports, setSports] = useState<{ slug: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/sports")
      .then(r => r.json())
      .then((d: { slug: string; name: string }[]) => setSports(d))
      .catch(() => {});
  }, []);

  function handleClose() {
    setCreatedCode(null);
    setForm({ name: "", sport: "cricket", venue: "", auctionDate: "", auctionTime: "", basePurse: "" });
    setError("");
    onClose();
  }

  // datetime-local value combined from date + time
  const datetimeValue = form.auctionDate
    ? form.auctionTime ? `${form.auctionDate}T${form.auctionTime}` : form.auctionDate
    : "";

  function handleDatetimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value; // "2026-05-31T14:00" or ""
    setForm(f => ({
      ...f,
      auctionDate: val ? val.slice(0, 10) : "",
      auctionTime: val.length >= 16 ? val.slice(11, 16) : "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Tournament name is required."); return; }
    if (!form.basePurse || parseInt(form.basePurse) <= 0) {
      setError("Total Points per Team is required.");
      return;
    }
    setLoading(true);
    setError("");
    const r = await createOrganizerTournament({
      name: form.name.trim(),
      sport: form.sport,
      venue: form.venue.trim() || undefined,
      auctionDate: form.auctionDate || undefined,
      auctionTime: form.auctionTime || undefined,
      basePurse: parseInt(form.basePurse),
    });
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to create tournament."); return; }
    setCreatedCode(r.tournament?.auctionCode ?? null);
    onCreated();
  }

  const purseWords = toIndianWords(form.basePurse);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-primary" />
            {createdCode ? "Tournament Created" : "New Tournament"}
          </DialogTitle>
        </DialogHeader>

        {createdCode ? (
          <div className="space-y-4 mt-2 text-center">
            <CheckCheck className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-sm text-muted-foreground">Your tournament has been created.</p>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Auction Code</span>
              <span className="font-mono text-2xl font-black tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-2">
                {createdCode}
              </span>
              <p className="text-xs text-muted-foreground mt-1">Share this with team owners to access the bidding panel.</p>
            </div>
            <Button className="w-full" onClick={handleClose}>Go to Dashboard</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Tournament Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Rotary Cricket League 2025"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sport</Label>
                <Select value={form.sport} onValueChange={v => setForm(f => ({ ...f, sport: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sports.length > 0
                      ? sports.map(s => <SelectItem key={s.slug} value={s.slug}>{s.name}</SelectItem>)
                      : (
                        <>
                          <SelectItem value="cricket">Cricket</SelectItem>
                          <SelectItem value="football">Football</SelectItem>
                          <SelectItem value="kabaddi">Kabaddi</SelectItem>
                          <SelectItem value="volleyball">Volleyball</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </>
                      )
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="Stadium name or city"
                />
              </div>
            </div>

            {/* Single datetime-local picker — avoids the HH:MM:SS problem on mobile */}
            <div className="space-y-2">
              <Label>Auction Date &amp; Time</Label>
              <Input
                type="datetime-local"
                value={datetimeValue}
                onChange={handleDatetimeChange}
                step="60"
              />
              {form.auctionDate && (
                <p className="text-xs text-muted-foreground">
                  {new Date(`${form.auctionDate}T${form.auctionTime || "00:00"}`).toLocaleString("en-IN", {
                    dateStyle: "long", timeStyle: form.auctionTime ? "short" : undefined,
                  })}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Total Points per Team *</Label>
              <Input
                type="number"
                value={form.basePurse}
                onChange={e => setForm(f => ({ ...f, basePurse: e.target.value }))}
                placeholder="e.g. 1000000"
                min={1}
                required
              />
              {purseWords && (
                <p className="text-xs text-amber-400/80 font-medium">{purseWords}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Tournament
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Complete Profile Form (Google sign-in, no mobile yet) ────────────────────

function CompleteProfileForm({
  onComplete,
}: {
  onComplete: (org: OrganizerInfo) => void;
}) {
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim()) { setError("Mobile number is required."); return; }
    setLoading(true);
    setError("");
    const r = await updateOrganizerProfile({ mobile: mobile.trim() });
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to save."); return; }
    if (r.organizer) onComplete(r.organizer);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#09090b]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[100px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
            <Phone className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-display font-black text-2xl text-white">One more step</h1>
          <p className="text-muted-foreground text-sm">
            Add your mobile number to complete your profile. This is used as your primary contact.
          </p>
        </div>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile Number *
                </Label>
                <Input
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  inputMode="tel"
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-destructive text-sm flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />{error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Save & Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Forgot Password Flow ─────────────────────────────────────────────────────

function ForgotPasswordFlow({ onBack, onSuccess }: { onBack: () => void; onSuccess: (o: OrganizerInfo, t: Tournament[]) => void }) {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!mobile.trim()) { setError("Enter your registered mobile number"); return; }
    setLoading(true); setError("");
    const r = await sendOtp(mobile.trim());
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to send OTP"); return; }
    setStep("otp");
    setResendCooldown(30);
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setResending(true); setError("");
    const r = await resendOtp(mobile.trim());
    setResending(false);
    if (!r.success) { setError(r.error || "Failed to resend OTP"); return; }
    setResendCooldown(30);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setLoading(true); setError("");
    const r = await verifyOtpAndReset(mobile.trim(), otpCode, newPassword);
    setLoading(false);
    if (!r.success) { setError(r.error || "Password reset failed"); return; }
    setDone(true);
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) onSuccess(me.organizer, me.tournaments ?? []);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
      </button>
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <p className="font-semibold text-sm">Reset Password</p>
      </div>
      {done ? (
        <p className="text-green-400 text-sm flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Password reset — signing you in...
        </p>
      ) : step === "mobile" ? (
        <form onSubmit={handleSendOtp} className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Registered Mobile</Label>
            <Input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" autoFocus />
          </div>
          {error && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !mobile.trim()}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
            Send OTP
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">OTP sent to {mobile}</Label>
            <Input
              type="text"
              inputMode="numeric"
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit OTP"
              maxLength={6}
              autoFocus
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RotateCcw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">New Password</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
          </div>
          {error && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || otpCode.length !== 6}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Verify &amp; Reset Password
          </Button>
          <button
            type="button"
            onClick={() => { setStep("mobile"); setOtpCode(""); setError(""); }}
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors"
          >
            Change mobile number
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Google Sign-In Button ────────────────────────────────────────────────────

function GoogleSignInButton({ next }: { next?: string }) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";
  return (
    <a
      href={href}
      className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors text-sm font-medium"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Continue with Google
    </a>
  );
}

// ─── Google Error Messages ────────────────────────────────────────────────────

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_token_failed: "Google sign-in failed. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_state_mismatch: "Sign-in session expired or invalid. Please try again.",
  not_configured: "Google login is not configured yet.",
  no_email: "Your Google account did not provide an email address.",
};

// ─── Auth Form ────────────────────────────────────────────────────────────────

function AuthForm({ onSuccess, initialError, next }: { onSuccess: (o: OrganizerInfo, t: Tournament[]) => void; initialError?: string; next?: string }) {
  const [view, setView] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [showPw, setShowPw] = useState(false);
  const [, navigate] = useLocation();
  const { logos, brandName } = useBranding();

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", mobile: "", password: "", confirmPassword: "" });
  const [signupMethod, setSignupMethod] = useState<"email" | "mobile">("email");
  const [signupStep, setSignupStep] = useState<"form" | "otp">("form");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);
  const [signupResending, setSignupResending] = useState(false);

  const [smsOtpEnabled, setSmsOtpEnabled] = useState(false);

  useEffect(() => {
    fetchAuthConfig().then(cfg => setSmsOtpEnabled(cfg.smsOtpEnabled));
  }, []);

  useEffect(() => {
    if (signupResendCooldown <= 0) return;
    const t = setTimeout(() => setSignupResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [signupResendCooldown]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginForm.identifier || !loginForm.password) return;
    setLoading(true);
    setError("");
    const r = await loginOrganizerAccount(loginForm.identifier, loginForm.password);
    setLoading(false);
    if (!r.success) { setError(r.error || "Login failed"); return; }
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      onSuccess(me.organizer, me.tournaments ?? []);
      if (next && next.startsWith("/")) navigate(next);
    }
  }

  async function handleSignupEmail(e: React.FormEvent) {
    e.preventDefault();
    const { name, email, password, confirmPassword } = signupForm;
    if (!name || !email || !password) { setError("Name, email, and password are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const r = await signupEmail({ name, email, password });
    setLoading(false);
    if (!r.success) { setError(r.error || "Signup failed"); return; }
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      onSuccess(me.organizer, me.tournaments ?? []);
      if (next && next.startsWith("/")) navigate(next);
    }
  }

  async function handleSignupSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const { name, mobile, email, password, confirmPassword } = signupForm;
    if (!name || !mobile || !password) { setError("Name, mobile, and password are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    const r = await signupSendOtp({ name, mobile, email: email || undefined, password });
    setLoading(false);
    if (!r.success) { setError(r.error || "Signup failed"); return; }
    setSignupStep("otp");
    setSignupResendCooldown(30);
  }

  async function handleSignupVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const r = await signupVerify(signupForm.mobile, signupOtp);
    setLoading(false);
    if (!r.success) { setError(r.error || "Verification failed"); return; }
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      onSuccess(me.organizer, me.tournaments ?? []);
      if (next && next.startsWith("/")) navigate(next);
    }
  }

  async function handleSignupResend() {
    if (signupResendCooldown > 0 || signupResending) return;
    setSignupResending(true); setError("");
    const r = await resendOtp(signupForm.mobile);
    setSignupResending(false);
    if (!r.success) { setError(r.error || "Failed to resend OTP"); return; }
    setSignupResendCooldown(30);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#09090b]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[100px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm space-y-6"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </button>

        <div className="text-center space-y-3">
          <img src={logos.main || "/bidwar-logo-transparent.png"} alt={brandName} className="h-20 w-auto mx-auto" />
          <h1 className="font-display font-black text-3xl text-white">{brandName.toUpperCase()}</h1>
          <p className="text-muted-foreground text-sm">Organizer Portal</p>
        </div>

        {view !== "forgot" && (
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
        )}

        {next && view !== "forgot" && (
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="w-4 h-4 shrink-0" />
            Please log in to continue.
          </div>
        )}

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {view === "forgot" ? (
                <motion.div key="forgot" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <ForgotPasswordFlow onBack={() => { setView("login"); setError(""); }} onSuccess={onSuccess} />
                </motion.div>
              ) : view === "login" ? (
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
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile or Email
                    </Label>
                    <Input
                      value={loginForm.identifier}
                      onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                      placeholder="+91 98765 43210 or email"
                      autoComplete="username"
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setView("forgot"); setError(""); }}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        type={showPw ? "text" : "password"}
                        value={loginForm.password}
                        onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-destructive text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign In
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    By continuing, you agree to BidWar{" "}
                    <a href="/legal/terms" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms</a>
                    {", "}
                    <a href="/legal/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy Policy</a>
                    {", and "}
                    <a href="/legal/acceptable-use" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Platform Policies</a>
                    .
                  </p>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">or</span></div>
                  </div>
                  <GoogleSignInButton next={next} />
                </motion.form>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-4"
                >
                  {/* Method selector */}
                  <div className="flex rounded-lg bg-muted/20 p-0.5 border border-border/40">
                    <button
                      type="button"
                      onClick={() => { setSignupMethod("email"); setSignupStep("form"); setError(""); }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${signupMethod === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Email
                    </button>
                    {smsOtpEnabled ? (
                      <button
                        type="button"
                        onClick={() => { setSignupMethod("mobile"); setSignupStep("form"); setError(""); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${signupMethod === "mobile" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Mobile OTP
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 py-1.5 text-xs font-semibold rounded-md text-muted-foreground/40 cursor-not-allowed"
                        title="Mobile OTP signup is not yet available"
                      >
                        Mobile OTP
                        <span className="ml-1 text-[10px] opacity-60">(coming soon)</span>
                      </button>
                    )}
                  </div>

                  {/* Email signup form */}
                  {signupMethod === "email" && (
                    <form onSubmit={handleSignupEmail} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name *</Label>
                        <Input
                          value={signupForm.name}
                          onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Your full name"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Email *</Label>
                        <Input
                          type="email"
                          value={signupForm.email}
                          onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="name@example.com"
                          autoComplete="username"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm"><Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password *</Label>
                          <Input
                            type="password"
                            value={signupForm.password}
                            onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Min 6 chars"
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Confirm</Label>
                          <Input
                            type="password"
                            value={signupForm.confirmPassword}
                            onChange={e => setSignupForm(f => ({ ...f, confirmPassword: e.target.value }))}
                            placeholder="Repeat"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      {error && <p className="text-destructive text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Account
                      </Button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                        <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">or</span></div>
                      </div>
                      <GoogleSignInButton next={next} />
                    </form>
                  )}

                  {/* Mobile OTP signup form (only shown when smsOtpEnabled) */}
                  {signupMethod === "mobile" && smsOtpEnabled && signupStep === "form" && (
                    <form onSubmit={handleSignupSendOtp} className="space-y-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm"><User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name *</Label>
                        <Input
                          value={signupForm.name}
                          onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Your full name"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile *</Label>
                        <Input
                          type="tel"
                          value={signupForm.mobile}
                          onChange={e => setSignupForm(f => ({ ...f, mobile: e.target.value }))}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Email (optional)</Label>
                        <Input
                          type="email"
                          value={signupForm.email}
                          onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                          placeholder="name@example.com"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2 text-sm"><Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password *</Label>
                          <Input
                            type="password"
                            value={signupForm.password}
                            onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                            placeholder="Min 6 chars"
                            autoComplete="new-password"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Confirm</Label>
                          <Input
                            type="password"
                            value={signupForm.confirmPassword}
                            onChange={e => setSignupForm(f => ({ ...f, confirmPassword: e.target.value }))}
                            placeholder="Repeat"
                            autoComplete="new-password"
                          />
                        </div>
                      </div>
                      {error && <p className="text-destructive text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Send OTP
                      </Button>
                    </form>
                  )}

                  {/* OTP verification step */}
                  {signupMethod === "mobile" && smsOtpEnabled && signupStep === "otp" && (
                    <form onSubmit={handleSignupVerify} className="space-y-4">
                      <p className="text-sm text-muted-foreground">Enter the OTP sent to <span className="text-foreground font-medium">{signupForm.mobile}</span>.</p>
                      <div className="space-y-2">
                        <Label className="text-sm">OTP</Label>
                        <Input
                          value={signupOtp}
                          onChange={e => setSignupOtp(e.target.value)}
                          placeholder="6-digit OTP"
                          maxLength={6}
                          autoFocus
                        />
                      </div>
                      {error && <p className="text-destructive text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Verify & Create Account
                      </Button>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <button type="button" onClick={() => { setSignupStep("form"); setError(""); }} className="hover:text-foreground transition-colors">
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleSignupResend}
                          disabled={signupResendCooldown > 0 || signupResending}
                          className="hover:text-foreground transition-colors disabled:opacity-40"
                        >
                          {signupResendCooldown > 0 ? `Resend in ${signupResendCooldown}s` : signupResending ? "Sending..." : "Resend OTP"}
                        </button>
                      </div>
                    </form>
                  )}

                  {signupMethod === "email" ? null : (
                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      By continuing, you agree to BidWar{" "}
                      <a href="/legal/terms" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms</a>
                      {", "}
                      <a href="/legal/privacy" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy Policy</a>
                      {", and "}
                      <a href="/legal/acceptable-use" target="_blank" className="underline underline-offset-2 hover:text-foreground transition-colors">Platform Policies</a>
                      .
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Organizer Avatar Menu ────────────────────────────────────────────────────

function OrganizerAvatarMenu({ organizer, onLogout }: { organizer: OrganizerInfo; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initials = organizer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors"
        aria-label="Account menu"
      >
        {organizer.photoUrl ? (
          <img src={organizer.photoUrl} alt={organizer.name} className="w-7 h-7 rounded-full object-cover border border-border/60" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary">
            {initials}
          </div>
        )}
        <span className="text-xs font-medium text-foreground max-w-[100px] truncate hidden sm:inline">{organizer.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-card shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40">
            <p className="text-sm font-semibold text-foreground truncate">{organizer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{organizer.email ?? organizer.mobile ?? ""}</p>
          </div>
          <div className="py-1">
            <button
              onClick={() => { setOpen(false); navigate("/organizer/profile"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-muted-foreground" /> Account Settings
            </button>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Organizer Dashboard ──────────────────────────────────────────────────────

function OrganizerDashboard({
  organizer, tournaments, onLogout, onRefresh, onPasswordSet,
}: {
  organizer: OrganizerInfo;
  tournaments: Tournament[];
  onLogout: () => void;
  onRefresh: () => void;
  onPasswordSet: (org: OrganizerInfo) => void;
}) {
  const [, navigate] = useLocation();
  const { logos, brandName, miniBrandText, poweredByText } = useBranding();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [spDismissed, setSpDismissed] = useState(false);
  const [spPassword, setSpPassword] = useState("");
  const [spConfirm, setSpConfirm] = useState("");
  const [spLoading, setSpLoading] = useState(false);
  const [spError, setSpError] = useState("");
  const [spDone, setSpDone] = useState(false);

  const showSetPassword = !organizer.hasPassword && !spDismissed && !spDone;

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (spPassword.length < 6) { setSpError("Password must be at least 6 characters."); return; }
    if (spPassword !== spConfirm) { setSpError("Passwords do not match."); return; }
    setSpLoading(true); setSpError("");
    const r = await setOrganizerPassword(spPassword);
    setSpLoading(false);
    if (!r.success) { setSpError(r.error || "Failed to set password."); return; }
    setSpDone(true);
    if (r.organizer) onPasswordSet(r.organizer);
  }
  const [declareOpen, setDeclareOpen] = useState(false);
  const [declareTid, setDeclareTid] = useState<number | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [declareResult, setDeclareResult] = useState<string | null>(null);

  async function handleDeclareConsent() {
    if (!declareTid) return;
    setDeclaring(true);
    setDeclareResult(null);
    try {
      const r = await fetch("/api/auth/admin/communicate/consent-declare-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: declareTid, recipientType: "all" }),
      });
      if (r.ok) {
        const d = await r.json() as { playerCount: number; ownerCount: number };
        setDeclareResult(`Consent recorded for ${d.playerCount} player(s) and ${d.ownerCount} team owner(s).`);
      } else {
        setDeclareResult("Failed to record consent. Please try again.");
      }
    } finally {
      setDeclaring(false);
    }
  }

  const activeTournaments = tournaments.filter(t => t.licenseStatus === "trial" || t.licenseStatus === "active");
  const completedTournaments = tournaments.filter(t => t.licenseStatus === "completed");

  const filteredTournaments = tournaments.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.sport.toLowerCase().includes(q) || (t.venue || "").toLowerCase().includes(q);
  });

  const statusColor: Record<string, string> = {
    setup: "text-muted-foreground",
    active: "text-green-400",
    paused: "text-yellow-400",
    completed: "text-blue-400",
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <div className="border-b border-border/40 bg-[#09090b]/80 sticky top-0 backdrop-blur-xl z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* BidWar brand logo */}
            {logos.mini ? (
              <img src={logos.mini} alt={brandName} className="h-8 w-auto" />
            ) : logos.main ? (
              <img src={logos.main} alt={brandName} className="h-8 w-auto" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center font-display font-black text-xs text-primary">
                {miniBrandText}
              </div>
            )}
            <span className="font-display font-black text-lg text-white tracking-wide hidden sm:inline">{brandName}</span>
            <div className="w-px h-6 bg-border/60 hidden sm:block" />
            <div>
              <p className="font-display font-bold text-base leading-none text-white">{organizer.name}</p>
              <p className="text-xs text-muted-foreground">{organizer.mobile ?? organizer.email ?? ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-8" onClick={onRefresh}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
            <OrganizerAvatarMenu organizer={organizer} onLogout={onLogout} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Set password banner for Google-only accounts */}
        {showSetPassword && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-300">Set a backup password</p>
              </div>
              <button
                onClick={() => setSpDismissed(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              You signed in with Google. Add a password so you can also log in with your email directly.
            </p>
            {spDone ? (
              <p className="text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Password set — you can now sign in with your email.
              </p>
            ) : (
              <form onSubmit={handleSetPassword} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <Input
                    type="password"
                    value={spPassword}
                    onChange={e => { setSpPassword(e.target.value); setSpError(""); }}
                    placeholder="Min 6 characters"
                    className="h-8 text-sm"
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Confirm</Label>
                  <Input
                    type="password"
                    value={spConfirm}
                    onChange={e => { setSpConfirm(e.target.value); setSpError(""); }}
                    placeholder="Repeat password"
                    className="h-8 text-sm"
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" size="sm" className="h-8" disabled={spLoading || !spPassword || !spConfirm}>
                  {spLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Save Password"}
                </Button>
                {spError && (
                  <p className="w-full text-destructive text-xs flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />{spError}
                  </p>
                )}
              </form>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border bg-card/30 text-center">
            <p className="text-2xl font-display font-black text-primary">{tournaments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/30 text-center">
            <p className="text-2xl font-display font-black text-green-400">{activeTournaments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Active</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-card/30 text-center">
            <p className="text-2xl font-display font-black text-blue-400">{completedTournaments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Completed</p>
          </div>
        </div>

        {/* Tournaments Section */}
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <h2 className="text-lg font-display font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" /> Your Tournaments
            </h2>
            <div className="flex items-center gap-2 flex-1 min-w-0 max-w-xs">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button size="sm" className="gap-1.5 shrink-0 h-8" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4" /> New
              </Button>
            </div>
          </div>

          {tournaments.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome banner for first-time organizers */}
              <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/40 to-card/20 p-8">
                <div className="max-w-lg">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Welcome to BidWar</p>
                  <h2 className="text-2xl font-display font-black text-foreground mb-2">Set up your first auction</h2>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    You are a few steps away from running a professional live sports auction. Create your tournament, add teams and players, then go live — it takes less than 30 minutes.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-xs">
                    {[
                      { step: "1", label: "Create tournament", desc: "Name, sport, teams budget" },
                      { step: "2", label: "Add teams & players", desc: "Franchises and player pool" },
                      { step: "3", label: "Go live", desc: "Operator panel + big screen" },
                    ].map(s => (
                      <div key={s.step} className="rounded-lg border border-border/50 bg-card/30 px-3 py-2.5 flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5">{s.step}</span>
                        <div>
                          <p className="font-semibold text-foreground">{s.label}</p>
                          <p className="text-muted-foreground">{s.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <Button onClick={() => setCreateOpen(true)} size="lg" className="gap-2">
                      <Plus className="w-4 h-4" /> Start Tournament Setup
                    </Button>
                    <a
                      href="/"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> See how it works
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="border-border/50 bg-card/20">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground text-sm">No tournaments match your search.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTournaments.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-border/50 bg-card/30 hover:border-border transition-all h-full">
                    <CardContent className="p-5 space-y-3">
                      <button className="w-full text-left" onClick={() => navigate(`/tournament/${t.id}`)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px] uppercase">{t.sport}</Badge>
                            <TournamentLicenseBadge status={t.licenseStatus} />
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="mt-3">
                          <p className="font-bold text-base leading-snug">{t.name}</p>
                          <p className={`text-[11px] font-semibold uppercase mt-0.5 ${statusColor[t.status] || "text-muted-foreground"}`}>
                            {t.status}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {[t.venue, t.auctionDate].filter(Boolean).join(" · ") || `Created ${new Date(t.createdAt).toLocaleDateString("en-IN")}`}
                        </p>
                      </button>
                      <div className="pt-2 border-t border-border/40">
                        <button
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          onClick={e => { e.stopPropagation(); setDeclareTid(t.id); setDeclareResult(null); setDeclareOpen(true); }}
                        >
                          <CheckCheck className="w-3 h-3" />
                          Record in-person consent
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateTournamentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          onRefresh();
        }}
      />

      {/* In-Person Consent Declaration Dialog */}
      <Dialog open={declareOpen} onOpenChange={v => { if (!v) { setDeclareOpen(false); setDeclareResult(null); } }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCheck className="w-4 h-4 text-primary" /> Record In-Person Consent
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {!declareResult ? (
              <>
                <p>I confirm that I have obtained verbal or written consent from all players and team owners in this tournament to receive WhatsApp auction updates from BidWar.</p>
                <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded px-3 py-2">
                  This declaration is logged with your account and timestamp. Only declare if you have actually obtained consent in person.
                </p>
              </>
            ) : (
              <p className={declareResult.startsWith("Failed") ? "text-red-400" : "text-green-400"}>{declareResult}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="outline" onClick={() => { setDeclareOpen(false); setDeclareResult(null); }}>
              {declareResult ? "Close" : "Cancel"}
            </Button>
            {!declareResult && (
              <Button size="sm" onClick={() => void handleDeclareConsent()} disabled={declaring}>
                {declaring ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Confirm Declaration
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

const DASHBOARD_POLL_INTERVAL_MS = 30_000;

export default function OrganizerPortal() {
  const [organizer, setOrganizer] = useState<OrganizerInfo | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [checking, setChecking] = useState(true);
  const [needsMobile, setNeedsMobile] = useState(false);
  const search = useSearch();
  const [, navigate] = useLocation();

  const nextParam = (() => {
    try { return new URLSearchParams(search).get("next") ?? ""; } catch { return ""; }
  })();

  async function refresh() {
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      setOrganizer(me.organizer);
      setTournaments(me.tournaments ?? []);
      setNeedsMobile(!!me.organizer.needsMobile);
    } else {
      setOrganizer(null);
      setTournaments([]);
      setNeedsMobile(false);
    }
    setChecking(false);
  }

  const [googleError, setGoogleError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const err = params.get("error");
    if (err) {
      setGoogleError(GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed. Please try again.");
      window.history.replaceState({}, "", "/organizer");
    } else if (params.get("require_mobile") === "1") {
      setNeedsMobile(true);
      window.history.replaceState({}, "", "/organizer");
    }
  }, []);

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!organizer) return;
    const id = setInterval(() => { refresh(); }, DASHBOARD_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [organizer]);

  async function handleLogout() {
    await logoutOrganizerAccount();
    setOrganizer(null);
    setTournaments([]);
    setNeedsMobile(false);
  }

  function handleAuthSuccess(org: OrganizerInfo, tours: Tournament[]) {
    setOrganizer(org);
    setTournaments(tours);
    setNeedsMobile(!!org.needsMobile);
    if (nextParam && nextParam.startsWith("/")) navigate(nextParam);
  }

  function handleProfileComplete(org: OrganizerInfo) {
    setOrganizer(org);
    setNeedsMobile(false);
  }

  function handlePasswordSet(org: OrganizerInfo) {
    setOrganizer(org);
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
        {organizer && needsMobile ? (
          <motion.div key="complete-profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <CompleteProfileForm onComplete={handleProfileComplete} />
          </motion.div>
        ) : organizer ? (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <OrganizerDashboard
              organizer={organizer}
              tournaments={tournaments}
              onLogout={handleLogout}
              onRefresh={refresh}
              onPasswordSet={handlePasswordSet}
            />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthForm onSuccess={handleAuthSuccess} initialError={googleError} next={nextParam} />
          </motion.div>
        )}
      </AnimatePresence>
    </FullscreenLayout>
  );
}
