import { Button } from "@/components/ui/button";

type SettingsSaveBarProps = {
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

export function SettingsSaveBar({ isDirty, isSaving, onSave, onDiscard }: SettingsSaveBarProps) {
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

export const DEFAULT_SETTINGS_AUDIT_REASON = "Tournament settings updated by organizer";
