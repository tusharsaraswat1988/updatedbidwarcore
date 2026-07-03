import { useState } from "react";
import { Smartphone, X } from "lucide-react";
import { dismissAdminInstallHint, shouldShowAdminInstallHint } from "@/lib/admin-pwa";

export function AdminPwaInstallHint() {
  const [visible, setVisible] = useState(() => shouldShowAdminInstallHint());

  if (!visible) return null;

  function handleDismiss() {
    dismissAdminInstallHint();
    setVisible(false);
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-foreground"
    >
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium text-amber-100">Install on Android</p>
        <p className="text-muted-foreground">
          Chrome menu (⋮) → <span className="text-foreground">Add to Home screen</span> or{" "}
          <span className="text-foreground">Install app</span> for quick admin access.
        </p>
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
