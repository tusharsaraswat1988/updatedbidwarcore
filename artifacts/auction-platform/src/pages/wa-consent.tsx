import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Languages,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CURRENT_CONSENT_NOTICE_VERSION,
  CONSENT_NOTICE_V1,
} from "@workspace/api-base";

interface TokenData {
  token: string;
  mobile: string;
  recipientType: string;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  waLink: string;
  used: boolean;
  expired: boolean;
  noticeVersion?: string;
}

export default function WaConsent() {
  const [, params] = useRoute("/wa-consent/:token");
  const token = params?.token ?? "";

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [lang, setLang] = useState<"en" | "hi">("en");

  const notice = CONSENT_NOTICE_V1.content[lang];

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const r = await fetch(`/api/consent/${token}`);
        if (!r.ok) {
          setError("Link not found or expired");
          return;
        }
        const data = (await r.json()) as TokenData;
        setTokenData(data);
        if (data.used) setConfirmed(true);
      } catch {
        setError("Failed to load consent link");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleWebConfirm() {
    setConfirming(true);
    try {
      const r = await fetch(`/api/consent/${token}/confirm`, { method: "POST" });
      if (r.ok) setConfirmed(true);
      else {
        const d = (await r.json()) as { error?: string };
        setError(d.error ?? "Confirmation failed");
      }
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Top Language Toggle */}
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 rounded-md transition-colors"
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "हिंदी में देखें" : "View in English"}</span>
            </button>
          </div>

          <div className="text-center mb-6">
            {tokenData?.tournamentLogoUrl ? (
              <img
                src={tokenData.tournamentLogoUrl}
                alt={tokenData.tournamentName}
                className="h-16 w-16 object-contain mx-auto mb-3 rounded-xl border border-border"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
            )}
            <h1 className="text-2xl font-display font-black text-white">
              {tokenData?.tournamentName || "BidWar"}
            </h1>
            <p className="text-muted-foreground text-xs mt-1">
              {lang === "hi" ? "व्हाट्सएप सूचनाएं और अपडेट्स" : "WhatsApp Notifications & Alerts"}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-6"
              >
                <div className="w-12 h-12 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <p className="text-destructive font-semibold text-sm">{error}</p>
                <p className="text-xs text-muted-foreground">
                  {lang === "hi"
                    ? "यह लिंक समाप्त हो सकता है। कृपया नया लिंक प्राप्त करने के लिए आयोजक से संपर्क करें।"
                    : "This link may have expired or was already used. Please request a new invite link."}
                </p>
              </motion.div>
            ) : confirmed ? (
              <motion.div
                key="confirmed"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4 rounded-2xl border border-green-500/30 bg-card/60 p-6"
              >
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-green-400">
                    {lang === "hi" ? "सफलतापूर्वक सब्सक्राइब किया गया!" : "Subscribed Successfully!"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {lang === "hi"
                      ? "आप BIDWAR व्हाट्सएप टूर्नामेंट अपडेट्स के लिए पंजीकृत हो गए हैं। आपको मैच शेड्यूल, स्कोर और नीलामी अलर्ट प्राप्त होंगे।"
                      : "You have subscribed to BIDWAR tournament updates on WhatsApp. You will receive real-time match schedules, scores, and auction alerts."}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-3 text-left space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>{lang === "hi" ? "सहमति रिकॉर्ड सुरक्षित" : "Consent Record Logged"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "hi"
                      ? "सहमति सूचना संस्करण: " + CURRENT_CONSENT_NOTICE_VERSION
                      : "Notice Version: " + CURRENT_CONSENT_NOTICE_VERSION}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {notice.withdrawalInstructions}
                  </p>
                </div>

                {tokenData?.waLink && (
                  <Button asChild className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white">
                    <a href={tokenData.waLink} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="w-4 h-4" />
                      {lang === "hi" ? "व्हाट्सएप चैट खोलें" : "Open WhatsApp Chat"}
                    </a>
                  </Button>
                )}
              </motion.div>
            ) : tokenData ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-border bg-card/60 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {CONSENT_NOTICE_V1.sender}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      v{CURRENT_CONSENT_NOTICE_VERSION}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-foreground">
                    {notice.title}
                  </h3>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {notice.body}
                  </p>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span>{lang === "hi" ? "पंजीकृत नंबर:" : "Registered Mobile:"}</span>
                      <span className="font-mono font-semibold text-foreground">{tokenData.mobile}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>{lang === "hi" ? "उद्देश्य:" : "Purpose:"}</span>
                      <span className="text-foreground">{lang === "hi" ? "टूर्नामेंट अलर्ट और सूचनाएं" : "Tournament Updates & Alerts"}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    {notice.withdrawalInstructions}
                  </p>
                </div>

                {/* Primary Action: Direct WhatsApp verification */}
                <Button
                  asChild
                  className="w-full h-12 gap-2 bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-sm shadow-md"
                >
                  <a href={tokenData.waLink} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="w-4 h-4" />
                    {lang === "hi" ? "व्हाट्सएप पर सहमति दें (अनुशंसित)" : "Confirm on WhatsApp (Recommended)"}
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                  </a>
                </Button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-muted-foreground uppercase">{lang === "hi" ? "या" : "or"}</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Secondary Action: 1-Click Web Confirmation */}
                <Button
                  variant="outline"
                  className="w-full h-11 text-xs font-medium"
                  onClick={handleWebConfirm}
                  disabled={confirming}
                >
                  {confirming ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : null}
                  {lang === "hi" ? "हाँ, वेब पर सहमति स्वीकार करें" : "Yes, I Accept WhatsApp Updates (Web)"}
                </Button>

                <div className="text-center text-[10px] text-muted-foreground space-y-1">
                  <p>
                    {lang === "hi"
                      ? "सहमति स्वैच्छिक है और टूर्नामेंट भागीदारी के लिए अनिवार्य नहीं है।"
                      : "Consent is optional and not required for tournament participation."}
                  </p>
                  <a
                    href={CONSENT_NOTICE_V1.privacyPolicyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground transition-colors"
                  >
                    {notice.privacyLinkText}
                  </a>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </FullscreenLayout>
  );
}
