import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { useAdminAuth } from "@/hooks/use-auth";
import { useAdminNotificationsOptional } from "@/contexts/admin-notification-context";
import { Bell, Mail, Radio, Save, Smartphone, User, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminNotificationSettings } from "@/lib/admin-notifications";

export default function AdminAdminNotificationSettings() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const { isMaster } = useAdminAuth();
  const liveNotifications = useAdminNotificationsOptional();
  const [settings, setSettings] = useState<AdminNotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/auth/admin/settings/admin-notifications", { credentials: "include" })
      .then((r) => r.json())
      .then((d: AdminNotificationSettings) => {
        setSettings(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isLoggedIn]);

  async function handleSave() {
    if (!settings || !isMaster) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin/settings/admin-notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      const updated = (await res.json()) as AdminNotificationSettings;
      setSettings(updated);
      await liveNotifications?.refreshRecent();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Admin Notifications"
      eyebrow="Settings"
    >
      {loading || !settings ? (
        <p className="text-sm text-muted-foreground">Loading settings…</p>
      ) : (
        <div className="mx-auto max-w-2xl space-y-6">
          {!isMaster && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Only Master Admin can edit notification settings. You can view the current configuration.
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                Admin Contact
              </CardTitle>
              <CardDescription>
                These details are used for admin alert emails. No addresses are hardcoded — configure your admin inbox here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-name">Admin Name</Label>
                <Input
                  id="admin-name"
                  value={settings.adminName}
                  disabled={!isMaster}
                  onChange={(e) => setSettings((s) => s && { ...s, adminName: e.target.value })}
                  placeholder="Platform administrator"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Admin Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={settings.adminEmail}
                  disabled={!isMaster}
                  onChange={(e) => setSettings((s) => s && { ...s, adminEmail: e.target.value })}
                  placeholder="admin@yourdomain.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-mobile">Admin Mobile Number</Label>
                <Input
                  id="admin-mobile"
                  value={settings.adminMobile ?? ""}
                  disabled={!isMaster}
                  onChange={(e) =>
                    setSettings((s) => s && { ...s, adminMobile: e.target.value || null })
                  }
                  placeholder="+91 98765 43210"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" />
                Delivery Channels
              </CardTitle>
              <CardDescription>Choose how admin alerts are delivered when platform events occur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4 text-violet-400" />
                    Email Notifications
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Send responsive HTML emails for organiser signups, tournaments, and contact form submissions.
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotificationsEnabled}
                  disabled={!isMaster}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s && { ...s, emailNotificationsEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Smartphone className="h-4 w-4 text-blue-400" />
                    In-App Notifications
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Show alerts in the admin notification bell and notifications inbox.
                  </p>
                </div>
                <Switch
                  checked={settings.inAppNotificationsEnabled}
                  disabled={!isMaster}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s && { ...s, inAppNotificationsEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Radio className="h-4 w-4 text-green-400" />
                    Enable Live Notifications
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Push new alerts instantly via SSE — no page refresh or polling.
                  </p>
                </div>
                <Switch
                  checked={settings.liveNotificationsEnabled}
                  disabled={!isMaster}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s && { ...s, liveNotificationsEnabled: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Volume2 className="h-4 w-4 text-amber-400" />
                    Enable Notification Sound
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Play a short sound when a live notification arrives. Off by default.
                  </p>
                </div>
                <Switch
                  checked={settings.notificationSoundEnabled}
                  disabled={!isMaster}
                  onCheckedChange={(checked) =>
                    setSettings((s) => s && { ...s, notificationSoundEnabled: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {isMaster && (
            <div className="flex items-center gap-3">
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving…" : "Save Settings"}
              </Button>
              {saved && <span className="text-sm text-green-400">Settings saved</span>}
              {error && <span className="text-sm text-destructive">{error}</span>}
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
