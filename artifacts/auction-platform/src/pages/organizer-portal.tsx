import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";
import { useOrganizerAccountAuth } from "@/hooks/use-auth";
import { useOrganizerInactivityLogout } from "@/hooks/use-organizer-inactivity-logout";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import { TournamentCreationWizard } from "@/components/tournament-creation/tournament-creation-wizard";
import {
  signupEmail,
  signupVerify,
  signupComplete,
  setOrganizerPassword,
  fetchAuthConfig,
  fetchLoginGuardStatus,
  loginOrganizerAccount,
  type LoginGuardStatus,
  checkOrganizerAuth,
  logoutOrganizerAccount,
  createOrganizerTournament,
  sendPhoneVerifyOtp,
  verifyPhoneOtp,
  sendOtp,
  resendOtp,
  verifyOtpAndReset,
} from "@/lib/auth";
import {
  clearOrganizerClientState,
  patchOrganizerAccountAuthOrganizer,
  setOrganizerAccountAuthData,
  syncOrganizerAccountAuth,
} from "@/lib/organizer-account-auth-cache";
import { cldUrl } from "@/lib/cloudinary";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut, Trophy, ExternalLink, RefreshCw, ShieldCheck, Search,
  Phone, Lock, User, Gavel, Plus, AlertTriangle, CheckCircle2,
  Eye, EyeOff, ArrowLeft, KeyRound, CheckCheck, RotateCcw, Settings, Clock, Mail, Info,
  Download, Loader2, Radio, MoreVertical, Calendar, MapPin, SlidersHorizontal, Share2, Tv, Zap, X,
  MessageCircle, MessageSquare, Copy, Check, Headphones,
} from "lucide-react";
import { SITE_CONTACT } from "@/lib/public-site-links";
import { useToast } from "@/hooks/use-toast";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { RequestTournamentLicenseModal } from "@/components/request-tournament-license-modal";
import { isOrganizerAccountLocked } from "@workspace/api-base/organizer-account";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { navigateAfterOrganizerAuth } from "@/lib/navigate-after-organizer-auth";
import { trackOrganizerSignupConversion } from "@/lib/google-ads-conversion";
import { formatDateRange } from "@/lib/public-tournament-utils";
import {
  getOrganizerAuctionStatusLabel,
  getOrganizerLicenseBadgeKind,
  isOrganizerTournamentActive,
  isOrganizerTournamentCompleted,
  resolveOrganizerAuctionCta,
  resolveOrganizerScoringCta,
  type OrganizerModuleCtaState,
} from "@/lib/organizer-tournament-display";
import { scoringAppHomePath } from "@workspace/api-base/scoring-urls";
import { auctionOverviewPath, resolveScoringEntryPath } from "@/lib/tournament-navigation";
import { sortOrganizerTournaments } from "@/lib/organizer-tournament-list";
import "@/styles/organizer-dashboard-premium.css";

const authLoginPreset = getBrandSurfacePreset("auth-login");
const organizerHeaderPreset = getBrandSurfacePreset("organizer-dashboard-header");

type OrganizerInfo = {
  id: number; name: string; email: string | null; mobile: string | null;
  photoUrl?: string | null; licenseStatus: string; maxTournaments: number; hasPassword?: boolean;
  needsMobile?: boolean; incompleteProfile?: boolean; phoneVerified?: boolean;
};
type Tournament = {
  id: number; name: string; sport: string; status: string;
  licenseStatus: string; city: string | null; venue: string | null; auctionDate: string | null; createdAt: string;
  auctionRulesPdfReady?: boolean;
  auctionRulesPdfBlockedReason?: string | null;
  auctionEnabled?: boolean;
  scoringEnabled?: boolean;
  logoUrl?: string | null;
  matchDates?: string | null;
};

function tournamentCardSportDecorClass(sport?: string | null): string {
  const s = (sport || "").toLowerCase();
  if (s.includes("badminton")) return "od-card-decor--badminton";
  if (s.includes("cricket")) return "od-card-decor--cricket";
  return "od-card-decor--generic";
}

function sportEmoji(sport?: string | null) {
  const s = (sport || "").toLowerCase();
  if (s.includes("cricket")) return "🏏";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("football") || s.includes("soccer")) return "⚽";
  if (s.includes("tennis")) return "🎾";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("kabaddi")) return "🤼";
  if (s.includes("pickleball")) return "🏓";
  if (s.includes("basketball")) return "🏀";
  return "🏆";
}

function formatTournamentLocation(t: Tournament) {
  const city = (t.city || "").trim();
  const venue = (t.venue || "").trim();
  if (venue && city) {
    if (venue.toLowerCase().includes(city.toLowerCase())) {
      return venue;
    }
    return `${venue}, ${city}`;
  }
  return venue || city || null;
}

function formatTournamentDate(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    }
  } catch {}
  return dateStr;
}

// ─── Tournament License Badge ─────────────────────────────────────────────────

function TournamentLicenseBadge({
  licenseStatus,
  auctionStatus,
}: {
  licenseStatus: string;
  auctionStatus: string;
}) {
  const kind = getOrganizerLicenseBadgeKind(licenseStatus, auctionStatus);
  if (kind === "live-ready") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold" title="Live auction is activated">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Ready
      </Badge>
    );
  }
  if (kind === "auction-done") {
    return (
      <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px] gap-1 font-semibold" title="Auction has finished">
        <CheckCheck className="w-2.5 h-2.5" /> Done
      </Badge>
    );
  }
  return <TrialLicenseBadge />;
}


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
  const [createdTournament, setCreatedTournament] = useState<{
    id: number;
    name: string;
    auctionCode?: string | null;
    auctionEnabled?: boolean;
    scoringEnabled?: boolean;
    sport?: string;
  } | null>(null);

  function handleClose() {
    setCreatedTournament(null);
    onClose();
  }

  const isAuction = createdTournament?.auctionEnabled ?? true;
  const isScoring = createdTournament?.scoringEnabled ?? false;
  const sportSlug = (createdTournament?.sport || "cricket").toLowerCase();
  const isCricket = sportSlug.includes("cricket");
  const isBadminton = sportSlug.includes("badminton");

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="flex max-h-[min(92dvh,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-xl flex-col gap-0 overflow-hidden p-4 sm:p-6 border border-white/10 shadow-2xl bg-card text-foreground backdrop-blur-xl">
        <DialogHeader className="shrink-0 space-y-1 pb-3 pr-8 text-left border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-display font-bold text-foreground">
            {createdTournament && !isAuction ? (
              <Trophy className="w-5 h-5 text-sky-400" />
            ) : (
              <Gavel className="w-5 h-5 text-primary" />
            )}
            <span>{createdTournament ? "Tournament Created" : "Create Tournament"}</span>
          </DialogTitle>
        </DialogHeader>

        {createdTournament ? (
          <div className="space-y-4 mt-2 text-center px-0.5">
            <CheckCheck className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {isScoring && !isAuction
                ? "Your tournament has been created successfully for Sports Scoring."
                : "Your tournament has been created successfully."}
            </p>

            {isAuction ? (
              <div className="flex flex-col items-center gap-1.5 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">LED Big Screen Code</span>
                <span className="font-mono text-2xl font-bold tracking-widest text-primary bg-primary/10 border border-primary/25 rounded-xl px-5 py-2">
                  {createdTournament.auctionCode}
                </span>
                <p className="text-xs text-muted-foreground mt-2 max-w-xs leading-relaxed">
                  Open the LED Big Screen on your projector laptop. When prompted for a code, enter this code.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3 px-4 rounded-xl border border-sky-500/25 bg-sky-500/5 my-1">
                <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
                  <span>{isCricket ? "🏏" : isBadminton ? "🏸" : "🏆"}</span>
                  <span className="capitalize">{createdTournament.sport || "Sports"} Scoring Workspace</span>
                </div>
                <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                  This tournament is configured for Sports Scoring only. You can now add participating teams, schedule matches, and run live scoring.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {isAuction ? (
              <>
                <Button
                  className="w-full h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  onClick={() => {
                    const id = createdTournament.id;
                    handleClose();
                    navigate(`/tournament/${id}/teams`);
                  }}
                >
                  Add Teams Now →
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-border/60 bg-muted/30 hover:bg-muted text-foreground"
                  onClick={handleClose}
                >
                  Back to My Tournaments
                </Button>
              </>
            ) : (
              <>
                {isCricket ? (
                  <>
                    <Button
                      className="w-full h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                      onClick={() => {
                        const id = createdTournament.id;
                        handleClose();
                        navigate(`/tournament/${id}/score/teams`);
                      }}
                    >
                      Add Teams Now →
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 rounded-xl border-sky-500/30 text-sky-400 hover:bg-sky-500/10 font-medium"
                      onClick={() => {
                        const id = createdTournament.id;
                        handleClose();
                        navigate(`/tournament/${id}/score`);
                      }}
                    >
                      Open Cricket Scoring Hub
                    </Button>
                  </>
                ) : isBadminton ? (
                  <>
                    <Button
                      className="w-full h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                      onClick={() => {
                        const id = createdTournament.id;
                        handleClose();
                        navigate(`/tournament/${id}/badminton`);
                      }}
                    >
                      Open Badminton Scoring →
                    </Button>
                  </>
                ) : (
                  <Button
                    className="w-full h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                    onClick={() => {
                      const id = createdTournament.id;
                      handleClose();
                      navigate(resolveScoringEntryPath(id, createdTournament.sport));
                    }}
                  >
                    Open Scoring Hub →
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={handleClose}
                >
                  Back to My Tournaments
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <TournamentCreationWizard
              mode="dialog"
              onCancel={handleClose}
              submit={async (payload) => {
                const r = await createOrganizerTournament(payload);
                if (!r.success) return { success: false as const, error: r.error || "Create failed" };
                return {
                  success: true as const,
                  tournament: {
                    id: r.tournament!.id,
                    name: r.tournament!.name,
                    auctionCode: r.tournament?.auctionCode ?? null,
                    auctionEnabled: r.tournament?.auctionEnabled ?? payload.auctionEnabled,
                    scoringEnabled: r.tournament?.scoringEnabled ?? payload.scoringEnabled,
                    sport: r.tournament?.sport ?? payload.sport,
                  },
                };
              }}
              onCreated={(tournament) => {
                setCreatedTournament(tournament);
                onCreated(tournament.id);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Complete Profile Form (legacy accounts missing verified phone) ───────────

function CompleteProfileForm({
  onComplete,
}: {
  onComplete: (org: OrganizerInfo) => void;
}) {
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  function startCooldown() {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) { setError(mobileResult.error); return; }
    setLoading(true);
    setError("");
    const r = await sendPhoneVerifyOtp(mobileResult.normalized);
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to send OTP."); return; }
    setMobile(mobileResult.normalized);
    setStep("otp");
    startCooldown();
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    setLoading(true);
    setError("");
    const r = await verifyPhoneOtp(mobile, otp);
    setLoading(false);
    if (!r.success) { setError(r.error || "Verification failed."); return; }
    if (r.organizer) onComplete(r.organizer);
  }

  async function handleResend() {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError("");
    const r = await sendPhoneVerifyOtp(mobile);
    setLoading(false);
    if (!r.success) { setError(r.error || "Failed to resend OTP."); return; }
    startCooldown();
  }

  return (
    <div className="lovable-home min-h-screen flex flex-col items-center justify-center px-6 text-foreground">
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
          <div className="scoreboard-tile w-14 h-14 mx-auto flex items-center justify-center">
            <Phone className="w-7 h-7 text-primary" />
          </div>
          <AuthStepIndicator step={step === "mobile" ? 1 : 2} total={2} />
          <h1 className="text-display-md">Complete your profile</h1>
          <p className="text-muted-foreground text-sm">
            Verify your mobile number with OTP to continue using BidWar.
          </p>
        </div>
        <Card className="panel border-none">
          <CardContent className="p-6">
            {step === "mobile" ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
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
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Phone className="w-4 h-4 mr-2" />}
                  Send OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Code sent to <span className="text-foreground font-medium">{mobile}</span>
                </p>
                <div className="space-y-2">
                  <Label className="text-sm">Verification code</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit OTP"
                    autoFocus
                  />
                </div>
                {error && (
                  <p className="text-destructive text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />{error}
                  </p>
                )}
                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Verify & Continue
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setStep("mobile"); setOtp(""); setError(""); }}>
                    Change number
                  </button>
                  <button
                    type="button"
                    className="text-primary disabled:opacity-50"
                    disabled={resendCooldown > 0 || loading}
                    onClick={() => void handleResend()}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Support Modal ────────────────────────────────────────────────────────────

function OrganizerSupportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(SITE_CONTACT.email);
    setCopied(true);
    toast({
      title: "Email copied",
      description: `${SITE_CONTACT.email} is copied to your clipboard.`,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const whatsappUrl = `https://wa.me/${SITE_CONTACT.phoneWhatsApp}?text=${encodeURIComponent(
    "Hi BidWar Team, I need assistance with the Organizer Portal (Login / Registration)."
  )}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md panel border-border/80 text-foreground">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Headphones className="w-4 h-4" />
            </span>
            BidWar Organizer Support
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Our tournament operations team is ready to assist you with login, mobile OTP verification, or setup.
          </p>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {/* WhatsApp Support - Primary for Indian Organizers */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  Chat on WhatsApp
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 font-medium">Instant</span>
                </p>
                <p className="text-xs text-muted-foreground">Direct chat with tournament coordinators</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>

          {/* Direct Phone Call */}
          <a
            href={`tel:${SITE_CONTACT.phoneDisplay.replace(/\s+/g, "")}`}
            className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Direct Call</p>
                <p className="text-xs text-muted-foreground">{SITE_CONTACT.phoneDisplay}</p>
              </div>
            </div>
            <span className="text-xs text-primary font-medium group-hover:underline">Call Now</span>
          </a>

          {/* Email Support with 1-Click Copy */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Email Support</p>
                <p className="text-xs text-muted-foreground truncate">{SITE_CONTACT.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyEmail}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy
                  </>
                )}
              </Button>
              <a
                href={`mailto:${SITE_CONTACT.email}?subject=Organizer%20Support%20Request`}
                className="inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs bg-muted/60 hover:bg-muted font-medium text-foreground transition-colors"
              >
                Open Mail
              </a>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
          <span>Need demo or tournament pricing?</span>
          <a href="/contact" className="text-primary hover:underline font-medium">
            Contact Page &rarr;
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Forgot Password Flow ─────────────────────────────────────────────────────

function ForgotPasswordFlow({ onBack, onSuccess, onNeedSupport }: { onBack: () => void; onSuccess: (o: OrganizerInfo, t: Tournament[]) => void; onNeedSupport?: () => void }) {
  const queryClient = useQueryClient();
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
    const me = await syncOrganizerAccountAuth(queryClient);
    if (me.loggedIn && me.organizer) onSuccess(me.organizer, me.tournaments ?? []);
  }

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
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
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
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
            className="text-xs text-muted-foreground hover:text-foreground w-full text-center transition-colors cursor-pointer"
          >
            Change mobile number
          </button>
        </form>
      )}
      {onNeedSupport && (
        <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/40">
          Still having trouble?{" "}
          <button
            type="button"
            onClick={onNeedSupport}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Contact Support
          </button>
        </div>
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
    <div className="space-y-2.5">
      <p className="text-xs text-center text-muted-foreground tracking-wide">
        Fastest way &mdash; use your Google account
      </p>
      <GoogleSignInButton next={next} prominent />
      <div
        role="note"
        className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
      >
        <Info className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Mobile OTP verification is required after Google sign-in to secure your account.
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

export function AuthForm({ onSuccess, initialError, initialRedirectUriHint, next, initialView = "login" }: { onSuccess: (o: OrganizerInfo, t: Tournament[]) => void; initialError?: string; initialRedirectUriHint?: string; next?: string; initialView?: "login" | "signup" }) {
  const queryClient = useQueryClient();
  const search = useSearch();
  const [pathname, navigate] = useLocation();

  const urlTab = useMemo(() => {
    try {
      const tab = new URLSearchParams(search).get("tab");
      return tab === "signup" ? "signup" : tab === "forgot" ? "forgot" : tab === "login" ? "login" : null;
    } catch {
      return null;
    }
  }, [search]);

  const [localView, setLocalView] = useState<"login" | "signup" | "forgot" | null>(null);

  useEffect(() => {
    setLocalView(null);
  }, [search]);

  const view = urlTab ?? localView ?? initialView;

  const setView = useCallback((newView: "login" | "signup" | "forgot") => {
    setLocalView(newView);
    try {
      const params = new URLSearchParams(search);
      if (newView === "login") {
        params.delete("tab");
      } else {
        params.set("tab", newView);
      }
      const qs = params.toString();
      navigate(`${pathname}${qs ? `?${qs}` : ""}`);
    } catch {
      // fallback
    }
  }, [pathname, search, navigate]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [redirectUriHint] = useState(initialRedirectUriHint ?? "");
  const [showPw, setShowPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);
  const { logos, brandName } = useBranding();
  const logoSrc = getBrandLogoSrc(logos, authLoginPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);

  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "", email: "", mobile: "", password: "", confirmPassword: "", otp: "",
  });
  const [signupStep, setSignupStep] = useState<"details" | "otp" | "password">("details");
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);
  const signupCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [loginGuard, setLoginGuard] = useState<LoginGuardStatus | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [cooldownSec, setCooldownSec] = useState(0);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    fetchAuthConfig().then(cfg => {
      setTurnstileSiteKey(cfg.turnstileSiteKey);
    });
  }, []);

  useEffect(() => () => {
    if (signupCooldownRef.current) clearInterval(signupCooldownRef.current);
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
    const me = await syncOrganizerAccountAuth(queryClient);
    if (me.loggedIn && me.organizer) {
      onSuccess(me.organizer, me.tournaments ?? []);
      if (next && next.startsWith("/")) navigateAfterOrganizerAuth(next, navigate);
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
        if (next && next.startsWith("/")) navigateAfterOrganizerAuth(next, navigate);
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
    if (loading) return;
    const { name, email, mobile } = signupForm;
    if (!name || !email || !mobile) { setError("Name, email, and mobile are required."); return; }
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) { setError(mobileResult.error); return; }
    setLoading(true); setError("");
    try {
      const r = await signupEmail({ name, email, mobile: mobileResult.normalized });
      if (!r.success) { setError(r.error || "Signup failed"); return; }
      setSignupForm(f => ({ ...f, mobile: mobileResult.normalized }));
      setSignupStep("otp");
      setSignupResendCooldown(30);
      if (signupCooldownRef.current) clearInterval(signupCooldownRef.current);
      signupCooldownRef.current = setInterval(() => {
        setSignupResendCooldown((prev) => {
          if (prev <= 1) {
            if (signupCooldownRef.current) clearInterval(signupCooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (signupForm.otp.length !== 6) { setError("Enter the 6-digit OTP."); return; }
    setLoading(true); setError("");
    try {
      const r = await signupVerify(signupForm.mobile, signupForm.otp);
      if (!r.success) { setError(r.error || "Verification failed"); return; }
      setSignupStep("password");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupComplete(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    const { password, confirmPassword } = signupForm;
    if (!password || password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true); setError("");
    try {
      const r = await signupComplete(password);
      if (!r.success) { setError(r.error || "Could not create account"); return; }
      trackOrganizerSignupConversion();
      await finishAccountSession();
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupResendOtp() {
    if (signupResendCooldown > 0 || loading) return;
    setLoading(true); setError("");
    try {
      const r = await signupEmail({
        name: signupForm.name,
        email: signupForm.email,
        mobile: signupForm.mobile,
      });
      if (!r.success) { setError(r.error || "Failed to resend OTP"); return; }
      setSignupResendCooldown(30);
      if (signupCooldownRef.current) clearInterval(signupCooldownRef.current);
      signupCooldownRef.current = setInterval(() => {
        setSignupResendCooldown((prev) => {
          if (prev <= 1) {
            if (signupCooldownRef.current) clearInterval(signupCooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lovable-home min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-6 sm:py-8 text-foreground">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/8 rounded-full blur-[100px]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-sm space-y-4 sm:space-y-5"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-xs sm:text-sm cursor-pointer mb-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </button>

        <div className="text-center space-y-1.5">
          <img src={logoSrc} alt={logoAlt} className={authLoginPreset.sizeClass} />
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Organizer Portal &bull; Live Sports Auctions
          </p>
        </div>

        {view !== "forgot" && (
          <div className="flex rounded-md bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => { setView("login"); setError(""); setSignupStep("details"); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all normal-case tracking-normal cursor-pointer ${view === "login" ? "gold-button" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setView("signup"); setError(""); setSignupStep("details"); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all normal-case tracking-normal cursor-pointer ${view === "signup" ? "gold-button" : "text-muted-foreground hover:text-foreground"}`}
            >
              Create Account
            </button>
          </div>
        )}

        {next && view !== "forgot" && (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Please log in to continue.
          </div>
        )}

        <Card className="panel border-none shadow-xl">
          <CardContent className="p-5 sm:p-6">
            <AnimatePresence mode="wait">
              {view === "forgot" ? (
                <motion.div key="forgot" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <ForgotPasswordFlow
                    onBack={() => { setView("login"); setError(""); }}
                    onSuccess={onSuccess}
                    onNeedSupport={() => setSupportOpen(true)}
                  />
                </motion.div>
              ) : view === "login" ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleLogin}
                  className="space-y-3.5"
                >
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile or Email
                    </Label>
                    <Input
                      value={loginForm.identifier}
                      onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                      placeholder="+91 98765 43210 or email"
                      autoComplete="username"
                      inputMode="tel"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-sm font-medium">
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                      </Label>
                      <button
                        type="button"
                        onClick={() => { setView("forgot"); setError(""); }}
                        className="text-xs text-primary hover:underline font-medium cursor-pointer"
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
                        className="h-10 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
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
                        className="h-10"
                      />
                    </div>
                  )}
                  {cooldownSec > 0 && (
                    <p className="text-amber-400 text-xs flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      Too many failed attempts. Try again in {cooldownSec}s.
                    </p>
                  )}
                  {error && <p className="text-destructive text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}</p>}
                  {redirectUriHint ? (
                    <p className="text-xs text-muted-foreground break-all rounded-md border border-border/50 bg-muted/30 px-3 py-2 font-mono">
                      {redirectUriHint}
                    </p>
                  ) : null}
                  <Button type="submit" className="w-full h-10" disabled={signInDisabled}>
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
                  <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/70" /></div>
                    <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">or</span></div>
                  </div>
                  <GoogleSignInButton next={next} />
                  <p className="text-center text-xs text-muted-foreground pt-1">
                    Need help?{" "}
                    <button
                      type="button"
                      onClick={() => setSupportOpen(true)}
                      className="text-primary hover:underline underline-offset-2 font-medium cursor-pointer"
                    >
                      Contact Support
                    </button>
                  </p>
                </motion.form>
              ) : (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-3.5"
                >
                  {/* Google — visually prominent path */}
                  <GoogleSignupBlock next={next} />

                  <div className="relative py-0.5">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/80" />
                    </div>
                    <div className="relative flex justify-center text-xs text-muted-foreground">
                      <span className="bg-card px-3 font-medium">or register with mobile &amp; email</span>
                    </div>
                  </div>

                  {/* Email + mobile OTP signup */}
                  {signupStep === "details" && (
                  <form onSubmit={handleSignupEmail} className="space-y-3">
                    <div className="space-y-1.5">
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
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
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
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-mobile" className="flex items-center gap-2 text-sm font-medium">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" /> Mobile Number
                      </Label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 flex items-center pointer-events-none text-xs font-semibold text-muted-foreground border-r border-border/60 pr-2">
                          +91
                        </div>
                        <Input
                          id="signup-mobile"
                          type="tel"
                          value={signupForm.mobile}
                          onChange={e => setSignupForm(f => ({ ...f, mobile: sanitizeMobileInput(e.target.value) }))}
                          placeholder="10-digit mobile"
                          inputMode="numeric"
                          maxLength={10}
                          required
                          className="h-10 pl-14"
                        />
                      </div>
                    </div>

                    {error ? (
                      <p className="text-destructive text-xs flex items-start gap-1.5 pt-0.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </p>
                    ) : null}

                    <div className="pt-1 space-y-2">
                      <Button type="submit" className="w-full h-10" disabled={loading}>
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                        Send OTP
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                        We&apos;ll verify your mobile before you create a password.
                      </p>
                      <p className="text-center text-xs text-muted-foreground pt-1">
                        Need help?{" "}
                        <button
                          type="button"
                          onClick={() => setSupportOpen(true)}
                          className="text-primary hover:underline underline-offset-2 font-medium cursor-pointer"
                        >
                          Contact Support
                        </button>
                      </p>
                    </div>
                  </form>
                  )}

                  {signupStep === "otp" && (
                  <form onSubmit={handleSignupVerifyOtp} className="space-y-3.5">
                    <AuthStepIndicator step={2} total={3} />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Enter the code sent to <span className="text-foreground font-medium">{signupForm.mobile}</span>
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="signup-otp" className="text-sm font-medium">Verification code</Label>
                      <Input
                        id="signup-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={signupForm.otp}
                        onChange={e => setSignupForm(f => ({ ...f, otp: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                        placeholder="6-digit OTP"
                        autoFocus
                        className="h-10 tracking-widest text-center text-base"
                        required
                      />
                    </div>
                    {error ? (
                      <p className="text-destructive text-xs flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </p>
                    ) : null}
                    <Button type="submit" className="w-full h-10" disabled={loading || signupForm.otp.length !== 6}>
                      {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                      Verify OTP
                    </Button>
                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        onClick={() => { setSignupStep("details"); setError(""); setSignupForm(f => ({ ...f, otp: "" })); }}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="text-primary disabled:opacity-50 cursor-pointer font-medium"
                        disabled={signupResendCooldown > 0 || loading}
                        onClick={() => void handleSignupResendOtp()}
                      >
                        {signupResendCooldown > 0 ? `Resend in ${signupResendCooldown}s` : "Resend OTP"}
                      </button>
                    </div>
                    <div className="pt-2 text-center text-xs text-muted-foreground border-t border-border/40">
                      Didn&apos;t receive OTP?{" "}
                      <button
                        type="button"
                        onClick={() => setSupportOpen(true)}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        Get Help on WhatsApp
                      </button>
                    </div>
                  </form>
                  )}

                  {signupStep === "password" && (
                  <form onSubmit={handleSignupComplete} className="space-y-3">
                    <AuthStepIndicator step={3} total={3} />
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Mobile verified. Create your password to finish.
                    </p>
                    <div className="space-y-1.5">
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
                          className="h-10 pr-10"
                          required
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={showSignupPw ? "Hide password" : "Show password"}
                        >
                          {showSignupPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
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
                          className="h-10 pr-10"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignupConfirm(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={showSignupConfirm ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showSignupConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {error ? (
                      <p className="text-destructive text-xs flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </p>
                    ) : null}
                    <div className="pt-1 space-y-2">
                      <Button type="submit" className="w-full h-10" disabled={loading}>
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
                      <p className="text-center text-xs text-muted-foreground pt-1">
                        Need help?{" "}
                        <button
                          type="button"
                          onClick={() => setSupportOpen(true)}
                          className="text-primary hover:underline underline-offset-2 font-medium cursor-pointer"
                        >
                          Contact Support
                        </button>
                      </p>
                    </div>
                  </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>

      <OrganizerSupportModal open={supportOpen} onOpenChange={setSupportOpen} />
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
        className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-3 py-1.5 bg-slate-900/50 hover:bg-slate-800/60 border border-sky-500/20 hover:border-sky-400/30 transition-all cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        aria-label="Account menu"
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt={organizer.name} className="w-8 h-8 rounded-lg object-cover border border-primary/30" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/30 flex items-center justify-center text-xs font-black text-primary shadow-inner">
            {initials}
          </div>
        )}
        <div className="text-left hidden sm:block min-w-0">
          <p className="text-xs font-bold text-foreground leading-tight max-w-[130px] truncate">{organizer.name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Organizer
          </p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/60 bg-card shadow-2xl z-50 overflow-hidden backdrop-blur-xl">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
            <p className="text-sm font-bold text-foreground truncate">{organizer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{organizer.email ?? organizer.mobile ?? ""}</p>
          </div>
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); navigate("/organizer/profile"); }}
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors text-left"
            >
              <span className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-emerald-500" /> WhatsApp Alerts
              </span>
              <span className="text-[10px] text-muted-foreground">Manage</span>
            </button>
            <button
              onClick={() => { setOpen(false); navigate("/organizer/profile"); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors text-left"
            >
              <Settings className="w-4 h-4 text-muted-foreground" /> Account Settings
            </button>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors text-left"
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

function TournamentModuleCta({
  kind,
  state,
  locked,
  onClick,
}: {
  kind: "auction" | "scoring";
  state: OrganizerModuleCtaState;
  locked: boolean;
  onClick: () => void;
}) {
  const label = kind === "auction" ? "Enter Auction" : "Enter Scoring";
  const Icon = kind === "auction" ? Gavel : Radio;
  const statement =
    state === "coming-soon" ? "Coming Soon" : state === "not-selected" ? "Not selected" : null;
  const title =
    state === "coming-soon"
      ? "Match scoring for this sport is coming soon"
      : state === "not-selected"
        ? kind === "auction"
          ? "Auction was not selected for this tournament"
          : "Scoring was not selected for this tournament"
        : label;

  if (state !== "active") {
    return (
      <button
        type="button"
        disabled
        className="flex-1 min-h-10 h-10 px-2 rounded-lg border border-dashed border-slate-600/50 bg-slate-900/30 text-slate-300 opacity-80 flex flex-col items-center justify-center cursor-not-allowed select-none"
        title={title}
        aria-label={`${label}. ${statement}`}
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold leading-none">
          <Icon className="h-3 w-3 opacity-60 shrink-0" aria-hidden />
          {label}
        </span>
        <span className="text-[9px] font-bold text-amber-400/90 uppercase tracking-widest leading-none mt-1">
          {statement}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center flex-1 min-h-10 h-10 gap-1.5 px-3 text-xs font-bold rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${
        kind === "auction"
          ? "od-btn-enter-auction focus-visible:ring-amber-300"
          : "od-btn-match-scoring focus-visible:ring-cyan-200"
      }`}
      disabled={locked}
      title={title}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

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
  const { toast } = useToast();
  const { logos, brandName, miniBrandText, poweredByText } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");
  const [sportFilter, setSportFilter] = useState<string>("all");
  const [downloadingRulesTid, setDownloadingRulesTid] = useState<number | null>(null);

  const [licenseModalOpen, setLicenseModalOpen] = useState(false);
  const [selectedTournamentForLicense, setSelectedTournamentForLicense] = useState<Tournament | null>(null);
  const [pendingLicenseRequests, setPendingLicenseRequests] = useState<Record<number, boolean>>({});

  const fetchPendingLicenseRequests = useCallback(async () => {
    if (!tournaments || tournaments.length === 0) return;
    const trialTournaments = tournaments.filter((t) => t.licenseStatus !== "active");
    if (trialTournaments.length === 0) return;

    try {
      const results = await Promise.all(
        trialTournaments.map(async (t) => {
          try {
            const res = await fetch(`/api/tournaments/${t.id}/license-request`, { credentials: "include" });
            if (!res.ok) return null;
            const data = (await res.json()) as { request?: { status?: string } | null };
            return data?.request?.status === "pending" ? t.id : null;
          } catch {
            return null;
          }
        }),
      );
      const map: Record<number, boolean> = {};
      results.forEach((id) => {
        if (id) map[id] = true;
      });
      setPendingLicenseRequests(map);
    } catch {
      // non-critical
    }
  }, [tournaments]);

  useEffect(() => {
    void fetchPendingLicenseRequests();
  }, [fetchPendingLicenseRequests]);

  function handleOpenLicenseRequest(t: Tournament) {
    setSelectedTournamentForLicense(t);
    setLicenseModalOpen(true);
  }

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

  async function handleDownloadAuctionRules(tournament: Tournament) {
    if (!tournament.auctionRulesPdfReady) {
      toast({
        title: "Auction rules incomplete",
        description: tournament.auctionRulesPdfBlockedReason
          || "Complete Auction Rules in Settings first",
        variant: "destructive",
      });
      return;
    }
    setDownloadingRulesTid(tournament.id);
    try {
      const r = await fetch(`/api/tournaments/${tournament.id}/auction-rules.pdf`, {
        credentials: "include",
      });
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          throw new Error("Sign in again to download auction rules.");
        }
        const err = await r.json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error || `Couldn't download PDF (${r.status})`);
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      const filename = m?.[1] || `${tournament.name.replace(/[^a-zA-Z0-9]+/g, "_")}_Auction_Rules.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Download failed",
        description: e instanceof Error ? e.message : "Couldn't download PDF",
        variant: "destructive",
      });
    } finally {
      setDownloadingRulesTid(null);
    }
  }

  const isLocked = isOrganizerAccountLocked(organizer.licenseStatus);
  const safeTournaments = Array.isArray(tournaments) ? tournaments : [];
  const activeTournaments = safeTournaments.filter(isOrganizerTournamentActive);
  const completedTournaments = safeTournaments.filter(isOrganizerTournamentCompleted);

  const sportsList = useMemo(() => {
    return Array.from(new Set(safeTournaments.map(t => t.sport).filter(Boolean)));
  }, [safeTournaments]);

  const sortedSportsList = useMemo(
    () => [...sportsList].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [sportsList],
  );

  const filteredTournaments = useMemo(() => {
    const filtered = safeTournaments.filter(t => {
      if (statusFilter === "active" && !isOrganizerTournamentActive(t)) return false;
      if (statusFilter === "completed" && !isOrganizerTournamentCompleted(t)) return false;
      if (sportFilter !== "all" && t.sport?.toLowerCase() !== sportFilter.toLowerCase()) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.sport.toLowerCase().includes(q) ||
        (t.city || "").toLowerCase().includes(q) ||
        (t.venue || "").toLowerCase().includes(q)
      );
    });
    return sortOrganizerTournaments(filtered);
  }, [safeTournaments, statusFilter, sportFilter, search]);

  const reduceMotion = useReducedMotion();

  return (
    <div className="organizer-dashboard-premium lovable-theme min-h-screen text-foreground dark">
      <div className="organizer-dashboard-bg" aria-hidden />
      <div className="organizer-dashboard-content">
      {/* ── Enhanced Header ── */}
      <div className="organizer-dash-header sticky top-0 backdrop-blur-xl z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[4.25rem] sm:h-[4.5rem] flex items-center justify-between gap-3">
          {/* Brand & Portal Title */}
          <div className="flex items-center gap-3 min-w-0">
            {/* BidWar brand mark */}
            {(() => {
              const headerLogoSrc = getBrandLogoSrc(logos, organizerHeaderPreset.logoOrder);
              return headerLogoSrc ? (
                <img src={headerLogoSrc} alt={logoAlt} className={organizerHeaderPreset.sizeClass} />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 border border-primary/30 flex items-center justify-center font-display font-black text-xs text-primary flex-shrink-0 shadow-sm shadow-primary/10">
                  {miniBrandText}
                </div>
              );
            })()}
            
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm tracking-tight text-foreground leading-none">BIDWAR</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/35 text-[10px] font-bold text-amber-300 tracking-wider uppercase leading-none hidden sm:inline-block">
                  Organizer Hub
                </span>
              </div>
              <span className="text-[11px] text-slate-400 truncate leading-tight mt-0.5 hidden sm:block">
                Sports Auction &amp; Event Management
              </span>
            </div>
          </div>

          {/* Right Area: Profile Menu */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <OrganizerAvatarMenu organizer={organizer} onLogout={onLogout} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 overflow-x-hidden">
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

        {/* Page header — title + primary create action */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display font-black text-xl sm:text-2xl text-white tracking-tight">
              My Tournaments
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
              Open auction or match scoring for each event
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="od-btn-gold gap-1.5 h-10 sm:h-11 text-sm px-4 w-full sm:w-auto shrink-0 focus-visible:ring-2 focus-visible:ring-amber-300"
            disabled={isLocked}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" aria-hidden />
            New Tournament
          </Button>
        </div>

        {/* Status filters — summary cards (sole status control) */}
        <div
          className="grid grid-cols-3 gap-1.5 sm:gap-2 od-status-filter-grid"
          role="group"
          aria-label="Filter tournaments by status"
        >
          <button
            type="button"
            aria-pressed={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            className={`od-stat-card od-stat-card--gold od-stat-card--compact relative overflow-hidden rounded-lg p-2 sm:p-2.5 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
              statusFilter === "all"
                ? "od-stat-card--selected ring-1 ring-amber-400/55 shadow-[0_0_20px_-8px_rgba(245,184,0,0.35)]"
                : "hover:border-slate-500/30 opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">Total Tournaments</span>
              <div className="w-6 h-6 rounded-md bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
                <Trophy className="w-3 h-3" aria-hidden />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-display font-black text-white mt-0.5 tabular-nums">{safeTournaments.length}</p>
          </button>

          <button
            type="button"
            aria-pressed={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
            className={`od-stat-card od-stat-card--green od-stat-card--compact relative overflow-hidden rounded-lg p-2 sm:p-2.5 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
              statusFilter === "active"
                ? "od-stat-card--selected ring-1 ring-emerald-400/55 shadow-[0_0_20px_-8px_rgba(52,211,153,0.28)]"
                : "hover:border-slate-500/30 opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">Active &amp; Live</span>
              <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                <Zap className="w-3 h-3" aria-hidden />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-display font-black text-emerald-400 mt-0.5 tabular-nums">{activeTournaments.length}</p>
          </button>

          <button
            type="button"
            aria-pressed={statusFilter === "completed"}
            onClick={() => setStatusFilter("completed")}
            className={`od-stat-card od-stat-card--cyan od-stat-card--compact relative overflow-hidden rounded-lg p-2 sm:p-2.5 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 ${
              statusFilter === "completed"
                ? "od-stat-card--selected ring-1 ring-cyan-400/55 shadow-[0_0_20px_-8px_rgba(34,211,238,0.25)]"
                : "hover:border-slate-500/30 opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">Completed</span>
              <div className="w-6 h-6 rounded-md bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3 h-3" aria-hidden />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-display font-black text-cyan-400 mt-0.5 tabular-nums">{completedTournaments.length}</p>
          </button>
        </div>

        {/* ── Tournaments Section ── */}
        <div className="space-y-2.5">
          <div className="od-discovery-toolbar flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
            {safeTournaments.length > 0 && (
              <div className="od-sport-filter-row flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSportFilter("all")}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
                    sportFilter === "all"
                      ? "bg-cyan-500/20 border-cyan-400/45 text-cyan-100 font-semibold"
                      : "bg-slate-900/35 border-slate-600/40 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All Sports
                </button>
                {sortedSportsList.map((sport: string) => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setSportFilter(s => (s.toLowerCase() === sport.toLowerCase() ? "all" : sport))}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium capitalize transition-all cursor-pointer border shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
                      sportFilter.toLowerCase() === sport.toLowerCase()
                        ? "bg-cyan-500/20 border-cyan-400/45 text-cyan-100 font-semibold"
                        : "bg-slate-900/35 border-slate-600/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span aria-hidden>{sportEmoji(sport)}</span> {sport}
                  </button>
                ))}
              </div>
            )}
            <div className="relative w-full sm:max-w-xs md:max-w-sm sm:ml-auto min-w-0 shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" aria-hidden />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search tournaments..."
                aria-label="Search tournaments"
                className="od-search-input pl-9 pr-8 h-9 text-sm text-slate-100 placeholder:text-slate-500 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {safeTournaments.length === 0 ? (
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
              <CardContent className="py-12 text-center space-y-2">
                <p className="text-muted-foreground text-sm font-medium">No tournaments match your filter or search.</p>
                <button
                  type="button"
                  onClick={() => { setStatusFilter("all"); setSportFilter("all"); setSearch(""); }}
                  className="text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-3.5 od-tournament-grid">
              {filteredTournaments.map((t: Tournament, i: number) => {
                const isAuction = t.auctionEnabled !== false;
                const isActive = isOrganizerTournamentActive(t);
                const isCompleted = isOrganizerTournamentCompleted(t);
                const locationStr = formatTournamentLocation(t);
                const auctionDateStr = isAuction ? formatTournamentDate(t.auctionDate) : null;
                const tournamentDateStr = formatDateRange(t.matchDates);
                const logo = t.logoUrl ? cldUrl(t.logoUrl, "thumbnail") || t.logoUrl : null;
                const auctionCta = resolveOrganizerAuctionCta({ auctionEnabled: t.auctionEnabled });
                const scoringCta = resolveOrganizerScoringCta({
                  sport: t.sport,
                  scoringEnabled: t.scoringEnabled,
                });

                return (
                <motion.div
                  key={t.id}
                  className="motion-safe-hover"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: i * 0.04 }}
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                >
                  <Card
                    aria-disabled={isLocked}
                    className={`od-tournament-card group relative overflow-hidden rounded-2xl transition-all duration-200 ${
                      isLocked ? "opacity-60" : ""
                    }`}
                  >
                    <div
                      className={`od-card-decor ${tournamentCardSportDecorClass(t.sport)}`}
                      aria-hidden
                    />
                    <CardContent className="relative z-10 p-3 sm:p-3.5 flex flex-col gap-2 h-full pointer-events-auto">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="shrink-0">
                          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-slate-950/40 border border-sky-500/20 p-1 flex items-center justify-center">
                            {logo ? (
                              <img
                                src={logo}
                                alt={t.name}
                                className="w-full h-full object-contain rounded-lg"
                              />
                            ) : (
                              <span className="text-2xl select-none" aria-hidden>
                                {sportEmoji(t.sport)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex flex-wrap items-center gap-1.5 pr-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-800/80 border border-slate-600/50 text-slate-300">
                              {t.sport}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                                isActive
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
                                  : isCompleted
                                    ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/35"
                                    : "bg-amber-500/15 text-amber-300 border-amber-500/35"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isActive ? "bg-emerald-400 animate-pulse" : isCompleted ? "bg-cyan-400" : "bg-amber-400"
                                }`}
                                aria-hidden
                              />
                              {isAuction
                                ? getOrganizerAuctionStatusLabel(t.status)
                                : t.status === "active"
                                  ? "Live"
                                  : t.status === "completed"
                                    ? "Completed"
                                    : "Getting Ready"}
                            </span>

                            {isAuction && t.licenseStatus !== "active" && !isCompleted && (
                              pendingLicenseRequests[t.id] ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-2.5 h-2.5" aria-hidden />
                                  License Requested
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenLicenseRequest(t);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-amber-300 border border-amber-500/40 hover:bg-amber-500/15 transition-colors cursor-pointer"
                                  title="Upgrade tournament from Trial to Live license"
                                >
                                  <Zap className="w-2.5 h-2.5 text-amber-400" aria-hidden />
                                  Need License
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        <div className="od-card-actions relative z-20 shrink-0 self-start -mr-0.5">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground/70 hover:text-foreground hover:bg-white/10 shrink-0 pointer-events-auto"
                              disabled={isLocked}
                              aria-label={`Actions for ${t.name}`}
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 dark z-[100]">
                            {isAuction && t.licenseStatus !== "active" && !isCompleted && (
                              <DropdownMenuItem
                                disabled={isLocked}
                                onClick={() => handleOpenLicenseRequest(t)}
                                className="gap-2 cursor-pointer text-amber-300 font-semibold"
                              >
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                {pendingLicenseRequests[t.id] ? "License Under Review" : "Request Live License"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => navigate(`/tournament/${t.id}/settings`)} className="gap-2 cursor-pointer">
                              <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" /> Settings
                            </DropdownMenuItem>
                            {isAuction && (
                              <DropdownMenuItem onClick={() => navigate(`/tournament/${t.id}/liveviewer`)} className="gap-2 cursor-pointer">
                                <Tv className="w-3.5 h-3.5 text-sky-400" /> LED Big Screen
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(
                                  isAuction
                                    ? `/tournament/${t.id}/links`
                                    : `/tournament/${t.id}/settings`,
                                )
                              }
                              className="gap-2 cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5 text-amber-400" />{" "}
                              {isAuction ? "Share Links" : "Tournament Settings"}
                            </DropdownMenuItem>
                            {isAuction && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={isLocked || !t.auctionRulesPdfReady || downloadingRulesTid === t.id}
                                  onClick={() => { void handleDownloadAuctionRules(t); }}
                                  className="gap-2 cursor-pointer"
                                >
                                  {downloadingRulesTid === t.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                  ) : (
                                    <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                  )}
                                  Download Rules PDF
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </div>

                      <h3
                        className="font-display font-bold text-base sm:text-[1.05rem] leading-snug text-white line-clamp-2 pr-1"
                        title={t.name}
                      >
                        {t.name}
                      </h3>

                      <div className="space-y-1.5 pt-1 border-t border-sky-500/15 text-[11px] sm:text-xs flex-1 min-h-0">
                        {locationStr ? (
                          <div className="flex items-start gap-1 text-muted-foreground/90">
                            <MapPin className="w-3 h-3 text-primary/80 shrink-0 mt-0.5" aria-hidden />
                            <span className="font-medium text-foreground/90 leading-tight line-clamp-2">{locationStr}</span>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-0.5 text-white">
                          {auctionDateStr && (
                            <p className="leading-tight">
                              <span>Auction Date</span>
                              <span className="px-1">:</span>
                              <span className="font-semibold">{auctionDateStr}</span>
                            </p>
                          )}

                          {tournamentDateStr ? (
                            <p className="leading-tight">
                              <span>Tournament Date</span>
                              <span className="px-1">:</span>
                              <span className="font-semibold">{tournamentDateStr}</span>
                            </p>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                              <Calendar className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                              <span>Created {new Date(t.createdAt).toLocaleDateString("en-IN")}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1.5 mt-auto">
                        <TournamentModuleCta
                          kind="auction"
                          state={auctionCta}
                          locked={isLocked}
                          onClick={() => navigate(auctionOverviewPath(t.id))}
                        />
                        <TournamentModuleCta
                          kind="scoring"
                          state={scoringCta}
                          locked={isLocked}
                          onClick={() => navigate(resolveScoringEntryPath(t.id, t.sport))}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
                );
              })}
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

      <RequestTournamentLicenseModal
        open={licenseModalOpen}
        onClose={() => {
          setLicenseModalOpen(false);
          setSelectedTournamentForLicense(null);
        }}
        tournament={selectedTournamentForLicense}
        initialMobile={organizer.mobile}
        onSuccess={() => {
          void fetchPendingLicenseRequests();
          onRefresh();
        }}
      />
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function OrganizerPortal() {
  const queryClient = useQueryClient();
  const {
    organizer,
    tournaments,
    isLoggedIn,
    isLoading,
    refresh,
  } = useOrganizerAccountAuth();
  const [forceNeedsMobile, setForceNeedsMobile] = useState(false);
  const search = useSearch();
  const [, navigate] = useLocation();
  const bootHandledRef = useRef(false);

  const nextParam = useMemo(() => {
    try { return new URLSearchParams(search).get("next") ?? ""; } catch { return ""; }
  }, [search]);

  const needsMobile =
    forceNeedsMobile || !!(organizer?.needsMobile || organizer?.incompleteProfile);

  const [googleError, setGoogleError] = useState("");
  const [googleRedirectUriHint, setGoogleRedirectUriHint] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const err = params.get("error");
    if (err) {
      const redirectUri = params.get("oauth_redirect_uri");
      setGoogleRedirectUriHint(redirectUri ?? "");
      setGoogleError(GOOGLE_ERROR_MESSAGES[err] ?? "Google sign-in failed. Please try again.");
    } else if (params.get("require_mobile") === "1") {
      setForceNeedsMobile(true);
    }
  }, [search]);

  useEffect(() => {
    if (isLoading || bootHandledRef.current) return;
    bootHandledRef.current = true;

    const params = new URLSearchParams(search);
    const next = params.get("next") ?? "";
    if (params.get("google_ok") === "1") {
      if (!isLoggedIn) {
        setGoogleError(
          "Google sign-in succeeded but your browser did not save the session. Clear cookies for this site and try again.",
        );
      }
    }
    // If already logged in and there's a ?next= param, navigate only when access is confirmed.
    // Blind redirects to /tournament/:id caused an infinite loop with OrganizerGuard.
    // Cross-app paths (/mobile, /owner-app, /scoring-app) must use a full page load.
    if (isLoggedIn && next.startsWith("/")) {
      void (async () => {
        const tournamentMatch = next.match(
          /^(?:\/scoring-app)?\/tournament\/(\d+)(?:\/|$)/,
        );
        if (tournamentMatch) {
          const tid = parseInt(tournamentMatch[1], 10);
          const canAccess = await checkOrganizerAuth(tid);
          if (canAccess) {
            navigateAfterOrganizerAuth(next, navigate);
          }
          return;
        }
        navigateAfterOrganizerAuth(next, navigate);
      })();
    }
  }, [isLoading, isLoggedIn, navigate]);

  async function handleLogout() {
    await logoutOrganizerAccount();
    clearOrganizerClientState(queryClient);
    setForceNeedsMobile(false);
  }

  const {
    warningVisible,
    warningSecondsLeft,
    continueSession,
    lockMinutes,
  } = useOrganizerInactivityLogout({
    enabled: isLoggedIn,
  });

  function handleAuthSuccess(org: OrganizerInfo, tours: Tournament[]) {
    setOrganizerAccountAuthData(queryClient, { organizer: org, tournaments: tours });
    setForceNeedsMobile(!!(org.needsMobile || org.incompleteProfile));
    // Navigation to nextParam is handled by finishAccountSession in AuthForm
    // to avoid double-navigate. Only navigate here if no nextParam (stay on /organizer,
    // show dashboard).
  }

  function handleProfileComplete(org: OrganizerInfo) {
    patchOrganizerAccountAuthOrganizer(queryClient, org);
    setForceNeedsMobile(false);
  }

  function handlePasswordSet(org: OrganizerInfo) {
    patchOrganizerAccountAuthOrganizer(queryClient, org);
  }

  if (isLoading) {
    return (
      <FullscreenLayout>
        <div className="lovable-home min-h-screen flex items-center justify-center">
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
              onRefresh={() => { void refresh(); }}
              onPasswordSet={handlePasswordSet}
            />
          </motion.div>
        ) : (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AuthForm onSuccess={handleAuthSuccess} initialError={googleError} initialRedirectUriHint={googleRedirectUriHint} next={nextParam} />
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
