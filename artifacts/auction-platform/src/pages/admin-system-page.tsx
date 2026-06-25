import { Link, useLocation } from "wouter";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { AdminSessionLockPanel } from "@/components/admin-session-lock-panel";
import {
  BuildTriggerPanel,
  DisplayAuctionsPanel,
  InstallerSettingsPanel,
  ShowcasePanel,
  SmsSettingsPanel,
} from "@/pages/admin";
import { SystemLogsPanel } from "@/components/admin/system-logs-panel";
import { DefaultAudioSettingsPanel } from "@/components/admin/default-audio-panel";

const systemTabs = [
  { id: "audit-logs", label: "Audit Logs", href: "/admin/settings/system/audit-logs" },
  { id: "sms", label: "SMS Notifications", href: "/admin/settings/system/sms" },
  { id: "session-lock", label: "Session Lock", href: "/admin/settings/system/session-lock" },
  { id: "installer", label: "Local App Installer", href: "/admin/settings/system/installer" },
  { id: "builds", label: "Windows Build Pipeline", href: "/admin/settings/system/builds" },
  { id: "default-audio", label: "Default Audio", href: "/admin/settings/system/default-audio" },
  { id: "upcoming-display", label: "Upcoming Display", href: "/admin/settings/system/upcoming-display" },
  { id: "showcase", label: "Showcase Events", href: "/admin/settings/system/showcase" },
] as const;

function getSection(pathname: string) {
  if (pathname.includes("/audit-logs")) return "audit-logs";
  if (pathname.includes("/session-lock")) return "session-lock";
  if (pathname.includes("/installer")) return "installer";
  if (pathname.includes("/builds")) return "builds";
  if (pathname.includes("/default-audio")) return "default-audio";
  if (pathname.includes("/upcoming-display")) return "upcoming-display";
  if (pathname.includes("/showcase")) return "showcase";
  return "sms";
}

export default function AdminSystemPage() {
  const [location] = useLocation();
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const section = getSection(location);

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell title="System Settings" eyebrow="Platform Settings">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {systemTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-lg border px-3 py-2 text-sm ${
                section === tab.id
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card/70">
          {section === "audit-logs" && <SystemLogsPanel />}
          {section === "sms" && <SmsSettingsPanel />}
          {section === "session-lock" && <AdminSessionLockPanel />}
          {section === "installer" && <InstallerSettingsPanel />}
          {section === "builds" && <BuildTriggerPanel />}
          {section === "default-audio" && <DefaultAudioSettingsPanel />}
          {section === "upcoming-display" && <DisplayAuctionsPanel />}
          {section === "showcase" && <ShowcasePanel />}
        </div>
      </div>
    </AdminShell>
  );
}
