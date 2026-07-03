import { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { dismissAdminInstallHint, shouldShowAdminInstallHint } from "@/lib/admin-pwa";
import { useAdminPwa } from "@/contexts/admin-pwa-context";
import { Button } from "@/components/ui/button";

type AdminPwaInstallHintProps = {
  variant?: "card" | "compact";
};

export function AdminPwaInstallHint({ variant = "card" }: AdminPwaInstallHintProps) {
  const { canPromptInstall, isInstalled, promptInstall } = useAdminPwa();
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);
  const showManualHint = shouldShowAdminInstallHint();

  const visible = !isInstalled && !sessionDismissed && (canPromptInstall || showManualHint);

  if (!visible) return null;

  async function handleInstall() {
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) return;
    } finally {
      setInstalling(false);
    }
  }

  function handleDismiss() {
    if (!canPromptInstall) dismissAdminInstallHint();
    setSessionDismissed(true);
  }

  if (variant === "compact" && canPromptInstall) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
        onClick={() => void handleInstall()}
        disabled={installing}
      >
        <Download className="h-4 w-4" />
        {installing ? "Installing..." : "Install app"}
      </Button>
    );
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-foreground"
    >
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium text-amber-100">Install Admin App</p>
        {canPromptInstall ? (
          <>
            <p className="text-muted-foreground">
              Install BidWar Admin on your home screen for full-screen access and quick launch.
            </p>
            <Button
              type="button"
              size="sm"
              className="gap-1.5 bg-amber-500 font-semibold text-black hover:bg-amber-400"
              onClick={() => void handleInstall()}
              disabled={installing}
            >
              <Download className="h-4 w-4" />
              {installing ? "Installing..." : "Install app"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            Chrome menu (⋮) → <span className="text-foreground">Add to Home screen</span> or{" "}
            <span className="text-foreground">Install app</span>. If you don&apos;t see it yet, interact
            with this page briefly — Chrome shows install after engagement.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Dismiss install hint"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
