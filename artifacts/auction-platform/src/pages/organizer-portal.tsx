import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { SportSelect } from "@/components/sport-select";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import {
  signupEmail,
  setOrganizerPassword,
  fetchAuthConfig,
  fetchLoginGuardStatus,
  loginOrganizerAccount,
  type LoginGuardStatus,
  checkOrganizerAccountAuth,
  checkOrganizerAuth,
  logoutOrganizerAccount,
  createOrganizerTournament,
  updateOrganizerProfile,
  sendOtp,
  resendOtp,
  verifyOtpAndReset,
} from "@/lib/auth";
import { cldUrl } from "@/lib/cloudinary";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Trophy, ExternalLink, RefreshCw, ShieldCheck, Search,
  Phone, Lock, User, Gavel, Plus, AlertTriangle, CheckCircle2,
  Eye, EyeOff, ArrowLeft, KeyRound, CheckCheck, RotateCcw, Settings, Clock, Mail, Info,
} from "lucide-react";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { HintLabel } from "@/components/ui/hint-label";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { isOrganizerAccountLocked } from "@workspace/api-base/organizer-account";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const authLoginPreset = getBrandSurfacePreset("auth-login");
const organizerHeaderPreset = getBrandSurfacePreset("organizer-dashboard-header");

type OrganizerInfo = {
  id: number; name: string; email: string | null; mobile: string | null;
  photoUrl?: string | null; licenseStatus: string; maxTournaments: number; hasPassword?: boolean; needsMobile?: boolean;
};
type Tournament = {
  id: number; name: string; sport: string; status: string;
  licenseStatus: string; city: string | null; venue: string | null; auctionDate: string | null; createdAt: string;
};

// ─── Tournament License Badge ─────────────────────────────────────────────────

function TournamentLicenseBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px] gap-1" title="Live auction is activated">
        <ShieldCheck className="w-2.5 h-2.5" /> Live Ready
      </Badge>
    );
  }
  if (status === "completed") {
    return (
      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] gap-1" title="Auction has finished">
        <CheckCheck className="w-2.5 h-2.5" /> Auction Done
      </Badge>
    );
  }
  return <TrialLicenseBadge />;
}

type TimePeriod = "AM" | "PM";

function to24HourTime(hour12: number, minute: number, period: TimePeriod): string {
  let h = hour12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatAuctionSchedulePreview(date: string, hour12: number, minute: number, period: TimePeriod): string {
  const d = new Date(`${date}T${to24HourTime(hour12, minute, period)}:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const TIME_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const TIME_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

// ─── Create Tournament Modal ──────────────────────────────────────────────────

function AuthStepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <p className="text-[11px] text-center text-muted-foreground">
      Step {step} of {total}
    </p>
  );
}

function CreateTournamentModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (tournamentId?: number) => void;
}) {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    name: "",
    sport: "cricket",
    city: "",
    venue: "",
    auctionDate: "",
    timeHour: "",
    timeMinute: "00",
    timePeriod: "PM" as TimePeriod,
    basePurse: "",
    minBid: "",
    bidIncrement: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [createdTournamentId, setCreatedTournamentId] = useState<number | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);

  function handleClose() {
    setCreatedCode(null);
    setCreatedTournamentId(null);
    setWizardStep(1);
    setForm({
      name: "", sport: "cricket", city: "", venue: "", auctionDate: "",
      timeHour: "", timeMinute: "00", timePeriod: "PM",
      basePurse: "", minBid: "", bidIncrement: "",
    });
    setError("");
    onClose();
  }

  const auctionTime = form.timeHour
    ? to24HourTime(parseInt(form.timeHour, 10), parseInt(form.timeMinute, 10) || 0, form.timePeriod)
    : "";
  const schedulePreview = form.auctionDate && form.timeHour
    ? formatAuctionSchedulePreview(
        form.auctionDate,
        parseInt(form.timeHour, 10),
        parseInt(form.timeMinute, 10) || 0,
        form.timePeriod,
      )
    : form.auctionDate
      ? new Date(`${form.auctionDate}T12:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Tournament name is required."); return; }
    if (!form.city.trim()) { setError("City is required."); return; }
    if (!form.basePurse || parseInt(form.basePurse, 10) <= 0) {
      setError("Team budget (purse) is required.");
      return;
    }
    const minBid = parseInt(form.minBid, 10);
    if (!form.minBid || Number.isNaN(minBid) || minBid < 1) {
      setError("Minimum player value is required.");
      return;
    }
    const bidIncrement = parseInt(form.bidIncrement, 10);
    if (!form.bidIncrement || Number.isNaN(bidIncrement) || bidIncrement < 1) {
      setError("Bid increase amount is required.");
      return;
    }
    setLoading(true);
    setError("");
    const r = await createOrganizerTournament({
      name: form.name.trim(),
      sport: form.sport,
      city: form.city.trim(),
      venue: form.venue.trim() || undefined,
      auctionDate: form.auctionDate || undefined,
      auctionTime: auctionTime || undefined,
      basePurse: parseInt(form.basePurse, 10),
      minBid,
      bidIncrement,
    });
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to create tournament."); return; }
    setCreatedCode(r.tournament?.auctionCode ?? null);
    setCreatedTournamentId(r.tournament?.id ?? null);
    onCreated(r.tournament?.id);
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-lg dark">
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
              <span className="text-xs text-muted-foreground uppercase tracking-wide">LED Screen Code</span>
              <span className="font-mono text-2xl font-black tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-4 py-2">
                {createdCode}
              </span>
              <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
                Open the LED Big Screen on your projector laptop. When it asks for a code, enter this. Team owners do not need this code.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                const id = createdTournamentId;
                handleClose();
                if (id) navigate(`/tournament/${id}/teams`);
              }}
            >
              Add Teams Now →
            </Button>
            <Button variant="outline" className="w-full" onClick={handleClose}>
              Back to My Tournaments
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <AuthStepIndicator step={wizardStep} total={2} />
            <p className="text-xs text-center text-muted-foreground -mt-2">
              {wizardStep === 1 ? "Basic details" : "Budget & pricing (required)"}
            </p>

            {wizardStep === 1 ? (
              <>
                <div className="space-y-2">
                  <Label>Tournament Name *</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Enter the name of your tournament"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sport</Label>
                  <SportSelect
                    value={form.sport}
                    onValueChange={(v) => setForm((f) => ({ ...f, sport: v }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>City *</Label>
                  <CityAutocomplete
                    value={form.city}
                    onChange={v => setForm(f => ({ ...f, city: v }))}
                    placeholder="Start typing city name"
                    minChars={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Venue</Label>
                  <Input
                    value={form.venue}
                    onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                    placeholder="Stadium or ground name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auction Date</Label>
                  <DatePicker
                    value={form.auctionDate}
                    onChange={auctionDate => setForm(f => ({ ...f, auctionDate }))}
                    placeholder="Select auction date"
                    disablePastDates
                  />
                </div>
                <div className="space-y-2">
                  <Label>Auction Time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={form.timeHour || undefined} onValueChange={v => setForm(f => ({ ...f, timeHour: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Hour" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_HOURS.map(h => (
                          <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={form.timeMinute} onValueChange={v => setForm(f => ({ ...f, timeMinute: v }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Min" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_MINUTES.map(m => (
                          <SelectItem key={m} value={String(m).padStart(2, "0")}>
                            {String(m).padStart(2, "0")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={form.timePeriod} onValueChange={v => setForm(f => ({ ...f, timePeriod: v as TimePeriod }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {schedulePreview && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Scheduled: <span className="text-foreground font-medium">{schedulePreview}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground rounded-lg border border-border/50 bg-muted/10 px-3 py-2">
                  Enter your auction budget and bid rules below. These fields are required — nothing is pre-filled.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      <HintLabel hint="Har team ke paas kitna paisa kharch karne ko milega — jaise 1 crore">
                        Team Budget (Purse) *
                      </HintLabel>
                    </Label>
                    <Input
                      type="number"
                      value={form.basePurse}
                      onChange={e => setForm(f => ({ ...f, basePurse: e.target.value }))}
                      placeholder="e.g. 10000000"
                      min={1}
                      required
                    />
                    <IndianAmountHint value={form.basePurse} />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      <HintLabel hint="Sabse kam daam jahan se bidding shuru hogi">
                        Minimum Player Value (₹) *
                      </HintLabel>
                    </Label>
                    <Input
                      type="number"
                      value={form.minBid}
                      onChange={e => setForm(f => ({ ...f, minBid: e.target.value }))}
                      placeholder="e.g. 10000"
                      min={1}
                      required
                    />
                    <IndianAmountHint value={form.minBid} />
                  </div>
                  <div className="space-y-2">
                    <Label>
                      <HintLabel hint="Har baar bid badhne par kitna add hoga">
                        Bid Increase Amount (₹) *
                      </HintLabel>
                    </Label>
                    <Input
                      type="number"
                      value={form.bidIncrement}
                      onChange={e => setForm(f => ({ ...f, bidIncrement: e.target.value }))}
                      placeholder="e.g. 5000"
                      min={1}
                      required
                    />
                    <IndianAmountHint value={form.bidIncrement} />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              {wizardStep === 1 ? (
                <>
                  <Button
                    type="button"
                    className="flex-1"
                    onClick={() => {
                      if (!form.name.trim()) { setError("Tournament name is required."); return; }
                      if (!form.city.trim()) { setError("City is required."); return; }
                      setError("");
                      setWizardStep(2);
                    }}
                  >
                    Continue →
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Create Tournament
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setWizardStep(1); setError(""); }}>
                    Back
                  </Button>
                </>
              )}
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
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) { setError(mobileResult.error); return; }
    setLoading(true);
    setError("");
    const r = await updateOrganizerProfile({ mobile: mobileResult.normalized });
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
          <AuthStepIndicator step={1} total={1} />
          <h1 className="font-display font-black text-2xl text-white">Confirm your mobile</h1>
          <p className="text-muted-foreground text-sm">
            Add your mobile number so team owners and BidWar support can reach you.
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
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(sanitizeMobileInput(e.target.value))}
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  inputMode="numeric"
                  maxLength={10}
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
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
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
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) { setError(mobileResult.error); return; }
    setLoading(true); setError("");
    const r = await sendOtp(mobileResult.normalized);
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to send OTP"); return; }
    setMobile(mobileResult.normalized);
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
      {!done && <AuthStepIndicator step={step === "mobile" ? 1 : 2} total={2} />}
      {done ? (
        <p className="text-green-400 text-sm flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> Password reset — signing you in...
        </p>
      ) : step === "mobile" ? (
        <form onSubmit={handleSendOtp} className="space-y-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground" /> Registered Mobile</Label>
            <Input
              type="tel"
              value={mobile}
              onChange={e => setMobile(sanitizeMobileInput(e.target.value))}
              placeholder="10-digit mobile (e.g. 9876543210)"
              inputMode="numeric"
              maxLength={10}
              autoFocus
            />
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
            <div className="relative">
              <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" className="pr-10" />
              <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Confirm Password</Label>
            <div className="relative">
              <Input type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" className="pr-10" />
              <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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

function GoogleSignInButton({ next, prominent }: { next?: string; prominent?: boolean }) {
  const href = next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google";
  return (
    <a
      href={href}
      className={`flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-lg border transition-colors text-sm font-medium ${
        prominent
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20"
          : "border-border bg-card hover:bg-accent"
      }`}
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

function GoogleSignupBlock({ next }: { next?: string }) {
  return (
    <div className="space-y-3.5">
      <p className="text-xs text-center text-muted-foreground tracking-wide">
        Fastest way — use your Google account
      </p>
      <GoogleSignInButton next={next} prominent />
      <div
        role="note"
        className="flex gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3.5"
      >
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Info className="h-3.5 w-3.5 text-primary" aria-hidden />
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground text-left">
          After your first Google sign-in, we&apos;ll ask you to verify your mobile number to secure your account.
        </p>
      </div>
    </div>
  );
}

// ─── Google Error Messages ────────────────────────────────────────────────────

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: "Google sign-in was cancelled.",
  google_token_failed: "Google sign-in failed. Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_state_mismatch: "Sign-in session expired or invalid. Please try again.",
  google_redirect_mismatch:
    "Google OAuth redirect URI is not registered. Add the URI shown below to Google Cloud Console → Credentials → your OAuth client → Authorized redirect URIs.",
  google_sheets_state_mismatch:
    "Google Sheets connection expired. Try sign-in again, or disconnect Sheets and retry.",
  not_configured: "Google login is not configured yet.",
  no_email: "Your Google account did not provide an email address.",
};

// ─── Auth Form ────────────────────────────────────────────────────────────────

const SESSION_SAVE_ERROR =
  "Sign-in worked but your browser did not save the session. Clear cookies for this site and try again.";

function readAuthTabFromLocation(): "login" | "signup" {
  try {
    return new URLSearchParams(window.location.search).get("tab") === "signup" ? "signup" : "login";
  } catch {
    return "login";
  }
}

function AuthForm({ onSuccess, initialError, initialRedirectUriHint, next, initialView = "login" }: { onSuccess: (o: OrganizerInfo, t: Tournament[]) => void; initialError?: string; initialRedirectUriHint?: string; next?: string; initialView?: "login" | "signup" }) {
  const [view, setView] = useState<"login" | "signup" | "forgot">(() => {
    const fromUrl = readAuthTabFromLocation();
    return fromUrl === "signup" ? "signup" : initialView;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [redirectUriHint] = useState(initialRedirectUriHint ?? "");
  const [showPw, setShowPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const [, navigate] = useLocation();
  const { logos, brandName } = useBranding();
  const logoSrc = getBrandLogoSrc(logos, authLoginPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [signupForm, setSignupForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [loginGuard, setLoginGuard] = useState<LoginGuardStatus | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    fetchAuthConfig().then(cfg => {
      setTurnstileSiteKey(cfg.turnstileSiteKey);
    });
  }, []);

  useEffect(() => {
    if (view !== "login") return;
    const id = loginForm.identifier.trim();
    if (!id) {
      setLoginGuard(null);
      setCooldownSec(0);
      return;
    }
    const t = setTimeout(() => {
      void fetchLoginGuardStatus(id).then(guard => {
        setLoginGuard(guard);
        setCooldownSec(guard.cooldownRemainingSec);
        if (guard.captcha?.captchaId) setCaptchaAnswer("");
      });
    }, 300);
    return () => clearTimeout(t);
  }, [view, loginForm.identifier]);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => {
      setCooldownSec(s => {
        if (s <= 1) {
          void fetchLoginGuardStatus(loginForm.identifier.trim()).then(guard => {
            setLoginGuard(guard);
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSec, loginForm.identifier]);

  async function finishAccountSession(): Promise<boolean> {
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      onSuccess(me.organizer, me.tournaments ?? []);
      if (next && next.startsWith("/")) navigate(next);
      return true;
    }
    if (me.serverError) {
      setError("Sign-in succeeded but the server is slow to respond. Please wait a moment and try again.");
      return false;
    }
    setError(SESSION_SAVE_ERROR);
    return false;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!loginForm.identifier || !loginForm.password || cooldownSec > 0) return;
    setLoading(true);
    setError("");
    try {
      const r = await loginOrganizerAccount(loginForm.identifier, loginForm.password, {
        captchaId: loginGuard?.captcha?.captchaId,
        captchaAnswer: captchaAnswer || undefined,
      });
      if (!r.success) {
        setError(r.error || "Login failed");
        if (r.loginGuard) {
          setLoginGuard(r.loginGuard);
          setCooldownSec(r.loginGuard.cooldownRemainingSec);
          setCaptchaAnswer("");
        }
        return;
      }
      setLoginGuard(null);
      setCooldownSec(0);
      // Use organizer + tournaments from the login response directly — avoids a
      // second slow GET /me round-trip which is the main cause of the long spinner.
      if (r.organizer) {
        onSuccess(r.organizer, r.tournaments ?? []);
        if (next && next.startsWith("/")) navigate(next);
        return;
      }
      // Fallback: login response didn't include organizer data (older server)
      await finishAccountSession();
    } finally {
      setLoading(false);
    }
  }

  const captchaRequired = !!loginGuard?.captchaRequired;
  const signInDisabled =
    loading ||
    cooldownSec > 0 ||
    (captchaRequired && !captchaAnswer.trim());

  async function handleSignupEmail(e: React.FormEvent) {
    e.preventDefault();
    const { name, email, password, confirmPassword } = signupForm;
    if (!name || !email || !password) { setError("Name, email, and password are required."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const r = await signupEmail({ name, email, password });
      if (!r.success) { setError(r.error || "Signup failed"); return; }
      await finishAccountSession();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 sm:px-6 py-10 bg-[#09090b]">
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
          <img src={logoSrc} alt={logoAlt} className={authLoginPreset.sizeClass} />
          <p className="text-muted-foreground text-sm">My Tournaments</p>
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
          <CardContent className={view === "signup" ? "p-6 sm:p-7" : "p-6"}>
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
                  {captchaRequired && loginGuard?.captcha && !turnstileSiteKey && (
                    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-3">
                      <Label className="text-sm text-muted-foreground">{loginGuard.captcha.question}</Label>
                      <Input
                        value={captchaAnswer}
                        onChange={e => setCaptchaAnswer(e.target.value)}
                        placeholder="Your answer"
                        inputMode="numeric"
                        autoComplete="off"
                      />
                    </div>
                  )}
                  {cooldownSec > 0 && (
                    <p className="text-amber-400 text-sm flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Too many failed attempts. Try again in {cooldownSec}s.
                    </p>
                  )}
                  {error && <p className="text-destructive text-sm flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</p>}
                  {redirectUriHint ? (
                    <p className="text-xs text-muted-foreground break-all rounded-md border border-border/50 bg-muted/30 px-3 py-2 font-mono">
                      {redirectUriHint}
                    </p>
                  ) : null}
                  <Button type="submit" className="w-full" disabled={signInDisabled}>
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                    {cooldownSec > 0 ? `Sign In (${cooldownSec}s)` : "Sign In"}
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
                  <p className="text-center text-xs text-muted-foreground">
                    Need help?{" "}
                    <a
                      href="mailto:bidwarsupport@gmail.com"
                      className="text-primary hover:underline underline-offset-2"
                    >
                      Contact Support
                    </a>
                  </p>
                </motion.form>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  {/* Google — visually prominent path */}
                  <GoogleSignupBlock next={next} />

                  <div className="relative py-0.5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/80" />
                    </div>
                    <div className="relative flex justify-center text-xs text-muted-foreground">
                      <span className="bg-card px-3">or sign up with email</span>
                    </div>
                  </div>

                  {/* Email signup — primary CTA for this path */}
                  <form onSubmit={handleSignupEmail} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="flex items-center gap-2 text-sm font-medium">
                        <User className="w-3.5 h-3.5 text-muted-foreground" /> Full Name
                      </Label>
                      <Input
                        id="signup-name"
                        value={signupForm.name}
                        onChange={e => setSignupForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Your full name"
                        autoFocus
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" /> Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        value={signupForm.email}
                        onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="name@example.com"
                        autoComplete="username"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignupPw ? "text" : "password"}
                          value={signupForm.password}
                          onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="At least 6 characters"
                          autoComplete="new-password"
                          className="h-11 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSignupPw ? "Hide password" : "Show password"}
                        >
                          {showSignupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm-password" className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="signup-confirm-password"
                          type={showSignupConfirm ? "text" : "password"}
                          value={signupForm.confirmPassword}
                          onChange={e => setSignupForm(f => ({ ...f, confirmPassword: e.target.value }))}
                          placeholder="Re-enter your password"
                          autoComplete="new-password"
                          className="h-11 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showSignupConfirm ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showSignupConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error ? (
                      <p className="text-destructive text-sm flex items-start gap-1.5 pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </p>
                    ) : null}

                    <div className="pt-2 space-y-3.5">
                      <Button type="submit" className="w-full h-11" disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Create Account
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
                    </div>
                  </form>
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
  const avatarSrc = cldUrl(organizer.photoUrl, "thumbnail");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-accent transition-colors"
        aria-label="Account menu"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt={organizer.name} className="w-7 h-7 rounded-full object-cover border border-border/60" />
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
  const logoAlt = getBrandLogoAlt(brandName);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [spDismissed, setSpDismissed] = useState(false);
  const [spPassword, setSpPassword] = useState("");
  const [spConfirm, setSpConfirm] = useState("");
  const [spShowPw, setSpShowPw] = useState(false);
  const [spShowConfirm, setSpShowConfirm] = useState(false);
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

  const isLocked = isOrganizerAccountLocked(organizer.licenseStatus);
  const activeTournaments = tournaments.filter(t => t.licenseStatus === "trial" || t.licenseStatus === "active");
  const completedTournaments = tournaments.filter(t => t.licenseStatus === "completed");

  const filteredTournaments = tournaments.filter(t => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return t.name.toLowerCase().includes(q) || t.sport.toLowerCase().includes(q) || (t.city || "").toLowerCase().includes(q) || (t.venue || "").toLowerCase().includes(q);
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
            {/* BidWar brand mark */}
            {(() => {
              const headerLogoSrc = getBrandLogoSrc(logos, organizerHeaderPreset.logoOrder);
              return headerLogoSrc ? (
                <img src={headerLogoSrc} alt={logoAlt} className={organizerHeaderPreset.sizeClass} />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center font-display font-black text-xs text-primary">
                  {miniBrandText}
                </div>
              );
            })()}
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
        {isLocked && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <div className="flex items-start gap-2">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
              <div>
                <p className="font-semibold text-red-100">Your account has been locked. Please contact admin.</p>
                <p className="mt-1 text-xs text-red-200/80">
                  You can still sign in, but opening existing tournaments and creating new ones is disabled until your account is restored.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Set password banner for Google-only accounts */}
        {showSetPassword && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-300">Set a password (optional)</p>
              </div>
              <button
                onClick={() => setSpDismissed(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              You signed in with Google. Add a password if you also want to log in with email and password later.
            </p>
            {spDone ? (
              <p className="text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Password set — you can now sign in with your email.
              </p>
            ) : (
              <form onSubmit={handleSetPassword} className="flex flex-wrap items-end gap-3">
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      type={spShowPw ? "text" : "password"}
                      value={spPassword}
                      onChange={e => { setSpPassword(e.target.value); setSpError(""); }}
                      placeholder="Min 6 characters"
                      className="h-8 text-sm pr-8"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setSpShowPw(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {spShowPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1 flex-1 min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Confirm</Label>
                  <div className="relative">
                    <Input
                      type={spShowConfirm ? "text" : "password"}
                      value={spConfirm}
                      onChange={e => { setSpConfirm(e.target.value); setSpError(""); }}
                      placeholder="Repeat password"
                      className="h-8 text-sm pr-8"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setSpShowConfirm(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {spShowConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
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
              <Button
                size="sm"
                className="gap-1.5 shrink-0 h-8"
                disabled={isLocked}
                onClick={() => setCreateOpen(true)}
              >
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
                      { step: "3", label: "Run practice auction", desc: "Auction control + big screen" },
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
                    <Button onClick={() => setCreateOpen(true)} size="lg" className="gap-2" disabled={isLocked}>
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
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.985, y: 0 }}
                >
                  <Card
                    role={isLocked ? undefined : "button"}
                    tabIndex={isLocked ? -1 : 0}
                    onClick={isLocked ? undefined : () => navigate(`/tournament/${t.id}`)}
                    onKeyDown={isLocked ? undefined : e => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/tournament/${t.id}`);
                      }
                    }}
                    aria-disabled={isLocked}
                    className={`group border-border/50 bg-card/30 h-full select-none transition-all duration-200 focus-visible:outline-none ${
                      isLocked
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer hover:border-primary/35 hover:bg-card/55 hover:shadow-[0_10px_40px_rgba(0,0,0,0.45),0_0_0_1px_hsl(var(--primary)/0.12)] active:shadow-[0_4px_20px_rgba(0,0,0,0.35)] focus-visible:ring-2 focus-visible:ring-primary/40"
                    }`}
                  >
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] uppercase">{t.sport}</Badge>
                          <TournamentLicenseBadge status={t.licenseStatus} />
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                      <div>
                        <p className="font-bold text-base leading-snug group-hover:text-primary transition-colors">{t.name}</p>
                        <p className={`text-[11px] font-semibold uppercase mt-0.5 ${statusColor[t.status] || "text-muted-foreground"}`}>
                          {t.status}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[t.city, t.venue, t.auctionDate].filter(Boolean).join(" · ") || `Created ${new Date(t.createdAt).toLocaleDateString("en-IN")}`}
                      </p>
                      <div className="pt-2 border-t border-border/40">
                        <button
                          type="button"
                          disabled={isLocked}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded px-1 -mx-1 py-0.5 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-50"
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
        onCreated={(tournamentId) => {
          if (!tournamentId) setCreateOpen(false);
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

  // Capture before auth-check effects strip ?tab=signup from the URL.
  const [authInitialView] = useState<"login" | "signup">(readAuthTabFromLocation);

  async function refresh(): Promise<boolean> {
    const me = await checkOrganizerAccountAuth();
    if (me.loggedIn && me.organizer) {
      setOrganizer(me.organizer);
      setTournaments(me.tournaments ?? []);
      setNeedsMobile(!!me.organizer.needsMobile);
      setChecking(false);
      return true;
    }
    // Transient server error (DB cold start, 500, network blip) — do NOT log the
    // user out. Keep the existing session state. Only clear on an explicit "not
    // logged in" response (serverError is false and loggedIn is false).
    if (me.serverError) {
      setChecking(false);
      return false;
    }
    setOrganizer(null);
    setTournaments([]);
    setNeedsMobile(false);
    setChecking(false);
    return false;
  }

  const [googleError, setGoogleError] = useState("");

  const [googleRedirectUriHint, setGoogleRedirectUriHint] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const redirectUri = params.get("oauth_redirect_uri");
      setGoogleRedirectUriHint(redirectUri ?? "");
      setGoogleError(GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed. Please try again.");
      window.history.replaceState({}, "", "/organizer");
    } else if (params.get("require_mobile") === "1") {
      setNeedsMobile(true);
      window.history.replaceState({}, "", "/organizer");
    }
  }, []);

  useEffect(() => {
    if (checking || organizer) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") !== "signup") return;
    const next = params.get("next");
    window.history.replaceState(
      {},
      "",
      next ? `/organizer?next=${encodeURIComponent(next)}` : "/organizer",
    );
  }, [checking, organizer]);

  useEffect(() => {
    void refresh().then((loggedIn) => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("google_ok") === "1") {
        window.history.replaceState({}, "", "/organizer");
        if (!loggedIn) {
          setGoogleError(
            "Google sign-in succeeded but your browser did not save the session. Clear cookies for this site and try again.",
          );
        }
      }
      // If already logged in and there's a ?next= param, navigate only when access is confirmed.
      // Blind redirects to /tournament/:id caused an infinite loop with OrganizerGuard.
      if (loggedIn) {
        const next = new URLSearchParams(window.location.search).get("next") ?? "";
        if (next && next.startsWith("/")) {
          void (async () => {
            const tournamentMatch = next.match(/^\/tournament\/(\d+)(?:\/|$)/);
            if (tournamentMatch) {
              const tid = parseInt(tournamentMatch[1], 10);
              const canAccess = await checkOrganizerAuth(tid);
              if (canAccess) {
                navigate(next);
              }
              return;
            }
            navigate(next);
          })();
        }
      }
    });
  }, []);

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

  const handleInactivityTimeout = useCallback(() => {
    setOrganizer(null);
    setTournaments([]);
    setNeedsMobile(false);
  }, []);

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: !!organizer,
    onTimeout: handleInactivityTimeout,
  });

  function handleAuthSuccess(org: OrganizerInfo, tours: Tournament[]) {
    setOrganizer(org);
    setTournaments(tours);
    setNeedsMobile(!!org.needsMobile);
    // Navigation to nextParam is handled by finishAccountSession in AuthForm
    // to avoid double-navigate. Only navigate here if no nextParam (stay on /organizer,
    // show dashboard).
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
            <AuthForm onSuccess={handleAuthSuccess} initialError={googleError} initialRedirectUriHint={googleRedirectUriHint} next={nextParam} initialView={authInitialView} />
          </motion.div>
        )}
      </AnimatePresence>

      {warningVisible && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}
    </FullscreenLayout>
  );
}
