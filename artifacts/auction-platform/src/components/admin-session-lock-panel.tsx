import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SessionLockSettings = {
  lockMinutes: number;
  warningSeconds: number;
};

export function AdminSessionLockPanel() {
  const [settings, setSettings] = useState<SessionLockSettings>({ lockMinutes: 10, warningSeconds: 90 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/admin/settings/session-lock", { credentials: "include" })
      .then((r) => r.json())
      .then((d: SessionLockSettings) => { setSettings(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const r = await fetch("/api/auth/admin/settings/session-lock", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockMinutes: settings.lockMinutes }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      const d = await r.json() as SessionLockSettings;
      setSettings(d);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading session lock settings...</div>;
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h3 className="mb-0.5 flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4 text-amber-400" />
          Auto Sign Out
        </h3>
        <p className="text-xs text-muted-foreground">
          Super Admin signs out after idle time. A {settings.warningSeconds}-second countdown appears before sign out — click Continue to extend.
        </p>
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="lock-minutes">Sign out after inactivity (minutes)</Label>
        <Input
          id="lock-minutes"
          type="number"
          min={10}
          max={120}
          value={settings.lockMinutes}
          onChange={(e) => setSettings((s) => ({ ...s, lockMinutes: Number(e.target.value) }))}
        />
        <p className="text-xs text-muted-foreground">Between 10 and 120 minutes. Default: 10 minutes.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-400">Saved — applies on next page load.</p>}

      <Button onClick={() => void handleSave()} disabled={saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
