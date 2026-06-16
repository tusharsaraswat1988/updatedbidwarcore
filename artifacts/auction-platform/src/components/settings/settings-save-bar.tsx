import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import type { AutoSavePhase } from "@/hooks/use-debounced-auto-save";

type SettingsSaveBarProps = {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  autoSave?: boolean;
  autoSavePhase?: AutoSavePhase;
  blockReason?: string | null;
};

export function SettingsSaveBar({
  isDirty,
  isSaving,
  onSave,
  onDiscard,
  autoSave = false,
  autoSavePhase = "idle",
  blockReason = null,
}: SettingsSaveBarProps) {
  if (autoSave) {
    const showDiscard = isDirty && autoSavePhase !== "saving";
    const status = (() => {
      if (isSaving || autoSavePhase === "saving") {
        return { label: "Saving…", tone: "muted" as const, icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> };
      }
      if (autoSavePhase === "pending") {
        return { label: "Unsaved changes", tone: "amber" as const, icon: <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden /> };
      }
      if (autoSavePhase === "blocked" && blockReason) {
        return { label: blockReason, tone: "amber" as const, icon: <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden /> };
      }
      if (autoSavePhase === "error") {
        return { label: "Save failed — retrying on next edit", tone: "destructive" as const, icon: null };
      }
      if (autoSavePhase === "saved" || (!isDirty && autoSavePhase === "idle")) {
        return { label: "All changes saved", tone: "success" as const, icon: <Check className="w-3.5 h-3.5" /> };
      }
      return null;
    })();

    return (
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {status ? (
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs whitespace-nowrap ${
              status.tone === "amber"
                ? "text-amber-500"
                : status.tone === "success"
                  ? "text-emerald-500"
                  : status.tone === "destructive"
                    ? "text-destructive"
                    : "text-muted-foreground"
            }`}
          >
            {status.icon}
            {status.label}
          </div>
        ) : null}
        {showDiscard ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
            Discard
          </Button>
        ) : null}
        {(autoSavePhase === "pending" || autoSavePhase === "error") && isDirty ? (
          <Button type="button" size="sm" variant="outline" onClick={onSave} disabled={isSaving} className="min-w-[88px]">
            Save now
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
      {isDirty ? (
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-500 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden />
          Unsaved changes
        </div>
      ) : null}
      {isDirty ? (
        <Button type="button" variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
          Discard
        </Button>
      ) : null}
      <Button type="button" size="sm" onClick={onSave} disabled={isSaving || !isDirty} className="min-w-[120px]">
        {isSaving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}

type AutoSaveStatusPillProps = {
  phase: AutoSavePhase;
  isDirty: boolean;
  isSaving: boolean;
  blockReason?: string | null;
};

export function AutoSaveStatusPill({ phase, isDirty, isSaving, blockReason }: AutoSaveStatusPillProps) {
  const visible =
    isSaving
    || phase === "saving"
    || phase === "pending"
    || phase === "blocked"
    || phase === "error"
    || phase === "saved";

  if (!visible) return null;

  let label = "All changes saved";
  let tone: "default" | "amber" | "success" | "destructive" = "success";

  if (isSaving || phase === "saving") {
    label = "Saving…";
    tone = "default";
  } else if (phase === "pending") {
    label = "Saving soon…";
    tone = "amber";
  } else if (phase === "blocked" && blockReason) {
    label = blockReason;
    tone = "amber";
  } else if (phase === "error") {
    label = "Could not save";
    tone = "destructive";
  } else if (phase === "saved" && !isDirty) {
    label = "Saved";
    tone = "success";
  } else if (!isDirty) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 inset-x-0 flex justify-center pointer-events-none z-30 px-4 sm:hidden"
      role="status"
      aria-live="polite"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90 ${
          tone === "amber"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : tone === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : tone === "destructive"
                ? "border-destructive/40 bg-destructive/10 text-destructive"
                : "border-border bg-background/95 text-muted-foreground"
        }`}
      >
        {isSaving || phase === "saving" ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : tone === "success" ? (
          <Check className="w-3.5 h-3.5 shrink-0" />
        ) : tone === "amber" ? (
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden />
        ) : null}
        {label}
      </div>
    </div>
  );
}

export const DEFAULT_SETTINGS_AUDIT_REASON = "Tournament settings updated by organizer";
