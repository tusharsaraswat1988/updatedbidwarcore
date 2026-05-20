import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Phone, ShieldCheck, SkipForward } from "lucide-react";

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export default function CompleteProfile() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBypass, setIsBypass] = useState(false);
  const [autoVerifyState, setAutoVerifyState] = useState<"pending" | "failed" | "done">("pending");
  const autoSubmitRef = useRef(false);

  // TODO: remove OTP bypass when Twilio is configured
  // When bypass is active, auto-verify with 000000 immediately after advancing to OTP step
  useEffect(() => {
    if (isBypass && step === "otp" && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      setOtp("000000");
      void (async () => {
        setLoading(true);
        const { ok, data } = await apiFetch("/api/auth/google/complete-profile/verify", {
          method: "POST",
          body: JSON.stringify({ otp: "000000" }),
        });
        setLoading(false);
        if (!ok) {
          setAutoVerifyState("failed");
          setError(data.error ?? "Auto-verification failed");
          return;
        }
        setAutoVerifyState("done");
        setLocation("/organizer");
      })();
    }
  }, [isBypass, step]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data } = await apiFetch("/api/auth/google/complete-profile", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
    setLoading(false);
    if (!ok) {
      setError(data.error ?? "Failed to send OTP");
      return;
    }
    // TODO: remove OTP bypass when Twilio is configured
    if (data.bypass) {
      setIsBypass(true);
    }
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { ok, data } = await apiFetch("/api/auth/google/complete-profile/verify", {
      method: "POST",
      body: JSON.stringify({ otp }),
    });
    setLoading(false);
    if (!ok) {
      setError(data.error ?? "OTP verification failed");
      return;
    }
    setLocation("/organizer");
  }

  // TODO: remove OTP bypass when Twilio is configured
  async function handleSkip() {
    setError(null);
    setSkipping(true);
    const { ok, data } = await apiFetch("/api/auth/google/complete-profile/skip", {
      method: "POST",
    });
    setSkipping(false);
    if (!ok) {
      setError(data.error ?? "Skip failed — please enter a mobile number");
      return;
    }
    setLocation("/organizer");
  }

  // Retry auto-verify after failure
  function handleRetryAutoVerify() {
    autoSubmitRef.current = false;
    setAutoVerifyState("pending");
    setError(null);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-xl">Complete your profile</CardTitle>
          </div>
          <CardDescription>
            {step === "mobile"
              ? "Enter your mobile number to verify your account."
              : isBypass
                ? "Verifying your account..."
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
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    maxLength={10}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading || mobile.length < 10}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
              {/* TODO: remove OTP bypass skip option when Twilio is configured */}
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-muted-foreground gap-1.5"
                disabled={skipping}
                onClick={handleSkip}
              >
                {skipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
                Skip for now — continue without mobile
              </Button>
            </form>
          ) : isBypass && autoVerifyState === "pending" ? (
            <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Setting up your account...</span>
            </div>
          ) : isBypass && autoVerifyState === "failed" ? (
            <div className="space-y-3">
              <Button className="w-full" onClick={handleRetryAutoVerify}>
                Retry
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => { setStep("mobile"); setError(null); autoSubmitRef.current = false; setAutoVerifyState("pending"); }}
              >
                Change mobile number
              </Button>
            </div>
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
                Verify and create account
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => { setStep("mobile"); setOtp(""); setError(null); }}
              >
                Change mobile number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
