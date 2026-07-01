import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, ShieldCheck, RotateCcw, ArrowLeft } from "lucide-react";
import { apiFetch } from "@workspace/api-base";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";

type SessionState =
  | { status: "loading" }
  | { status: "expired" }
  | { status: "ready"; email: string; step: "mobile" | "otp"; mobile: string | null };

function readApiError(data: unknown, status: number, context: "send" | "verify"): string {
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (status === 0) return "Unable to reach the server. Check your connection and try again.";
  if (status === 401) return "Your sign-in session expired. Please sign in with Google again.";
  if (status === 429) return "Too many OTP requests. Please wait a few minutes and try again.";
  if (status === 409) {
    return context === "verify"
      ? "This mobile or email is already registered. Sign in with your existing account instead."
      : "This mobile number is already registered to another account.";
  }
  if (status === 503) {
    return context === "verify"
      ? "Server is temporarily unavailable. Your code may already be verified — tap Verify again or use Resend."
      : "SMS service is temporarily unavailable. Please try again shortly.";
  }
  if (context === "verify") {
    if (status === 400) return "Invalid or expired verification code. Check the SMS or tap Resend.";
    return "Could not verify your code. Please try again.";
  }
  return "Unable to send the verification code. Please try again.";
}

async function postJson(path: string, body: unknown) {
  try {
    const r = await apiFetch(path, { method: "POST", json: body });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

const RESEND_COOLDOWN = 30;

function postAuthRedirect(next: string): string {
  if (!next || next === "/complete-profile" || next.startsWith("/complete-profile?") || next.startsWith("/api")) {
    return "/organizer";
  }
  return next;
}

export default function CompleteProfile() {
  const [, setLocation] = useLocation();
  const nextParam = (() => {
    try {
      const p = new URLSearchParams(window.location.search).get("next");
      return p && p.startsWith("/") ? postAuthRedirect(p) : "";
    } catch {
      return "";
    }
  })();

  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const googleSignInUrl = `/api/auth/google${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

  function startCooldown() {
    setResendCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch("/auth/google/complete-profile/status");
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!data.ready) {
          setSession({ status: "expired" });
          return;
        }
        setSession({
          status: "ready",
          email: data.email ?? "",
          step: data.step === "otp" ? "otp" : "mobile",
          mobile: typeof data.mobile === "string" ? data.mobile : null,
        });
        if (data.step === "otp" && typeof data.mobile === "string") {
          setMobile(data.mobile);
          setStep("otp");
          startCooldown();
        }
      } catch {
        if (!cancelled) setSession({ status: "expired" });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) {
      setError(mobileResult.error);
      return;
    }
    setLoading(true);
    const { ok, status, data } = await postJson("/auth/google/complete-profile", {
      mobile: mobileResult.normalized,
    });
    setLoading(false);
    if (!ok) {
      setError(readApiError(data, status, "send"));
      if (status === 401) setSession({ status: "expired" });
      return;
    }
    setMobile(mobileResult.normalized);
    setStep("otp");
    startCooldown();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, status, data } = await postJson("/auth/google/complete-profile/verify", { otp });
    setLoading(false);
    if (!ok) {
      setError(readApiError(data, status, "verify"));
      if (status === 401) setSession({ status: "expired" });
      return;
    }
    const dest = nextParam || "/organizer";
    const url = dest.includes("?") ? `${dest}&google_ok=1` : `${dest}?google_ok=1`;
    window.location.assign(url);
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    const { ok, status, data } = await postJson("/auth/google/complete-profile", { mobile });
    setResending(false);
    if (!ok) {
      setError(readApiError(data, status, "send"));
      if (status === 401) setSession({ status: "expired" });
      return;
    }
    startCooldown();
  }

  function handleBack() {
    if (step === "otp") {
      setStep("mobile");
      setOtp("");
      setError(null);
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      setResendCooldown(0);
      return;
    }
    setLocation("/organizer");
  }

  if (session.status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session.status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl">Sign in required</CardTitle>
            </div>
            <CardDescription>
              Your Google sign-in session has expired or is missing. Sign in again to verify your mobile number.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button className="w-full" asChild>
              <a href={googleSignInUrl}>Continue with Google</a>
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setLocation("/organizer")}>
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 px-6 pt-6 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step === "otp" ? "Back" : "Back to Sign In"}
        </button>
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Confirm your mobile</CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Step {step === "mobile" ? 1 : 2} of 2</p>
          <CardDescription>
            {step === "mobile"
              ? `Signed in as ${session.email}. Add your mobile number so team owners and support can reach you.`
              : `Enter the 6-digit code sent to ${mobile}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "mobile" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={mobile}
                    onChange={(e) => setMobile(sanitizeMobileInput(e.target.value))}
                    maxLength={10}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || !parseIndianMobile(mobile).ok}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Send verification code
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verify and continue
              </Button>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs text-muted-foreground"
                  onClick={() => { setStep("mobile"); setOtp(""); setError(null); }}
                >
                  Change mobile number
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  disabled={resendCooldown > 0 || resending}
                  onClick={handleResend}
                >
                  {resending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RotateCcw className="w-3.5 h-3.5" />}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
