import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, CheckCircle2, XCircle, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TokenData {
  token: string;
  mobile: string;
  recipientType: string;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  waLink: string;
  used: boolean;
  expired: boolean;
}

export default function WaConsent() {
  const [, params] = useRoute("/wa-consent/:token");
  const token = params?.token ?? "";

  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const r = await fetch(`/api/consent/${token}`);
        if (!r.ok) { setError("Link not found or expired"); return; }
        const data = await r.json() as TokenData;
        setTokenData(data);
        if (data.used) setConfirmed(true);
      } catch { setError("Failed to load consent link"); }
      finally { setLoading(false); }
    })();
  }, [token]);

  async function handleWebConfirm() {
    setConfirming(true);
    try {
      const r = await fetch(`/api/consent/${token}/confirm`, { method: "POST" });
      if (r.ok) setConfirmed(true);
      else {
        const d = await r.json() as { error?: string };
        setError(d.error ?? "Confirmation failed");
      }
    } finally { setConfirming(false); }
  }

  if (loading) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            {tokenData?.tournamentLogoUrl ? (
              <img src={tokenData.tournamentLogoUrl} alt={tokenData.tournamentName} className="h-16 w-16 object-contain mx-auto mb-4 rounded-xl" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
            )}
            <h1 className="text-2xl font-display font-black text-white">{tokenData?.tournamentName || "BidWar"}</h1>
            <p className="text-muted-foreground text-sm mt-1">WhatsApp Notifications</p>
          </div>

          <AnimatePresence mode="wait">
            {error ? (
              <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <p className="text-destructive font-semibold">{error}</p>
                <p className="text-sm text-muted-foreground">This link may have expired. Please contact the organizer for a new link.</p>
              </motion.div>
            ) : confirmed ? (
              <motion.div key="confirmed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-green-400">Subscribed!</h2>
                  <p className="text-sm text-muted-foreground mt-2">Aap BidWar WhatsApp notifications ke liye subscribe ho gaye hain. Tournament updates milenge.</p>
                </div>
                <p className="text-xs text-muted-foreground">Better experience ke liye WhatsApp pe "hello" bhejein aur OTP se verify karein.</p>
                {tokenData?.waLink && (
                  <Button asChild className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white">
                    <a href={tokenData.waLink} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="w-4 h-4" /> WhatsApp pe Verify Karein
                    </a>
                  </Button>
                )}
              </motion.div>
            ) : tokenData ? (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground">Consent Request</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Kya aap <span className="font-semibold text-foreground">{tokenData.tournamentName}</span> se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Mobile: <span className="font-mono">{tokenData.mobile}</span>
                  </div>
                </div>

                {/* Primary: WhatsApp bot (strongest consent signal) */}
                <Button asChild className="w-full h-14 gap-3 bg-[#25D366] hover:bg-[#1da851] text-white font-bold text-base">
                  <a href={tokenData.waLink} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="w-5 h-5" /> WhatsApp pe Subscribe Karein
                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                  </a>
                </Button>

                <p className="text-center text-xs text-muted-foreground">Recommended: WhatsApp pe subscribe karna zyada secure hai</p>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">ya</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Fallback: web confirm (weaker, but still captured) */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleWebConfirm}
                  disabled={confirming}
                >
                  {confirming ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  Haan, subscribe karein (web)
                </Button>

                <p className="text-[11px] text-muted-foreground text-center">
                  Aap kisi bhi samay STOP reply kar ke unsubscribe kar sakte hain.
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </FullscreenLayout>
  );
}
