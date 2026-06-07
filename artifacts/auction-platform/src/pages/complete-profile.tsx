import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, ShieldCheck, RotateCcw } from "lucide-react";
import { apiFetch } from "@workspace/api-base";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";

async function postJson(path: string, body: unknown) {
  const r = await apiFetch(path, { method: "POST", json: body });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const RESEND_COOLDOWN = 30;

export default function CompleteProfile() {
  const [, setLocation] = useLocation();
  const nextParam = (() => {
    try { const p = new URLSearchParams(window.location.search).get("next"); return p && p.startsWith("/") ? p : ""; } catch { return ""; }
  })();
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpMaybeSent, setOtpMaybeSent] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOtpMaybeSent(false);
    const mobileResult = parseIndianMobile(mobile);
    if (!mobileResult.ok) {
      setError(mobileResult.error);
      return;
    }
    setLoading(true);
    const { ok, data } = await postJson("/auth/google/complete-profile", {
      mobile: mobileResult.normalized,
    });
    setLoading(false);
    if (!ok) {
      setError(data.error ?? "Failed to send OTP");
      setMobile(mobileResult.normalized);
      setOtpMaybeSent(true);
      return;
    }
    setMobile(mobileResult.normalized);
    setOtpMaybeSent(false);
    setStep("otp");
    startCooldown();
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data } = await postJson("/auth/google/complete-profile/verify", { otp });
    setLoading(false);
    if (!ok) {
      setError(data.error ?? "OTP verification failed");
      return;
    }
    setLocation(nextParam || "/organizer");
  }

  async function handleResend() {
    if (resendCooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    const { ok, data } = await postJson("/auth/google/complete-profile", { mobile });
    setResending(false);
    if (!ok) {
      setError(data.error ?? "Failed to resend OTP");
      return;
    }
    startCooldown();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Confirm your mobile</CardTitle>
          </div>
          <p className="text-[11px] text-muted-foreground">Step {step === "mobile" ? 1 : 2} of 2</p>
          <CardDescription>
            {step === "mobile"
              ? "Google sign-in done. Add your mobile so team owners and support can reach you."
              : `Enter the 6-digit OTP sent to ${mobile}.`}
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
                Send OTP
              </Button>
              {otpMaybeSent && (
                <p className="text-center text-sm text-muted-foreground">
                  OTP phone par aa gayi?{" "}
                  <button
                    type="button"
                    className="text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      setError(null);
                      setOtpMaybeSent(false);
                      setStep("otp");
                      startCooldown();
                    }}
                  >
                    Yahan enter karein
                  </button>
                </p>
              )}
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verify &amp; continue
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
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
