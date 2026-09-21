import { useState, useEffect } from "react";
import { useScorerPwa } from "@/contexts/scorer-pwa-context";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, X, CheckCircle2, Share } from "lucide-react";
import { cn } from "@/lib/utils";

export function ScorerPwaInstallBanner({ className }: { className?: string }) {
  const { canPromptInstall, isInstalled, promptInstall } = useScorerPwa();
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);
  }, []);

  if (isInstalled || dismissed) return null;

  // Show banner if native prompt is available OR if on iOS (where manual Add to Home Screen is needed)
  if (!canPromptInstall && !isIos) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent p-3 sm:p-4 text-foreground shadow-lg backdrop-blur relative overflow-hidden",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-primary/25 border border-primary/50 flex items-center justify-center text-primary shrink-0">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold leading-snug flex items-center gap-1.5">
              Install Scorer App (PWA)
              <span className="text-[10px] uppercase font-black tracking-wider bg-primary/25 text-primary px-1.5 py-0.5 rounded">
                Fast & Offline-Ready
              </span>
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Install on your phone for fullscreen scoring that stays logged in.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-white/10"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {canPromptInstall ? (
          <Button
            size="sm"
            onClick={async () => {
              await promptInstall();
            }}
            className="h-9 px-4 font-bold bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-[var(--shadow-glow)] gap-1.5 rounded-xl"
          >
            <Download className="w-3.5 h-3.5" />
            Install App Now
          </Button>
        ) : isIos ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowIosHelp((prev) => !prev)}
            className="h-9 px-3.5 font-semibold text-xs border-primary/40 text-primary hover:bg-primary/15 gap-1.5 rounded-xl"
          >
            <Share className="w-3.5 h-3.5" />
            How to Install on iPhone
          </Button>
        ) : null}

        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          1-Tap Launch from Home Screen
        </span>
      </div>

      {showIosHelp && isIos && (
        <div className="mt-3 p-3 rounded-xl bg-black/40 border border-white/10 text-xs space-y-1 text-white/80">
          <p className="font-semibold text-white">To install on iPhone / iPad:</p>
          <p>1. Tap the <strong>Share</strong> icon (square with arrow) at the bottom of Safari.</p>
          <p>2. Scroll down and tap <strong>&apos;Add to Home Screen&apos;</strong>.</p>
          <p>3. Tap <strong>&apos;Add&apos;</strong> in the top-right corner.</p>
        </div>
      )}
    </div>
  );
}
