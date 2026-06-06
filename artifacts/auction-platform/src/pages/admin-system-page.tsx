import { Link, useLocation } from "wouter";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import {
  BuildTriggerPanel,
  DisplayAuctionsPanel,
  InstallerSettingsPanel,
  ShowcasePanel,
  SmsSettingsPanel,
} from "@/pages/admin";

const systemTabs = [
  { id: "sms", label: "SMS Notifications", href: "/admin/settings/system/sms" },
  { id: "installer", label: "Local App Installer", href: "/admin/settings/system/installer" },
  { id: "builds", label: "Windows Build Pipeline", href: "/admin/settings/system/builds" },
  { id: "upcoming-display", label: "Upcoming Display", href: "/admin/settings/system/upcoming-display" },
  { id: "showcase", label: "Showcase Events", href: "/admin/settings/system/showcase" },
] as const;

function getSection(pathname: string) {
  if (pathname.includes("/installer")) return "installer";
  if (pathname.includes("/builds")) return "builds";
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
          {section === "sms" && <SmsSettingsPanel />}
          {section === "installer" && <InstallerSettingsPanel />}
          {section === "builds" && <BuildTriggerPanel />}
          {section === "upcoming-display" && <DisplayAuctionsPanel />}
          {section === "showcase" && <ShowcasePanel />}
        </div>
      </div>
    </AdminShell>
  );
}
