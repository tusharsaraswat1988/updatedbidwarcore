import { Link } from "wouter";
import {
  Activity,
  Bell,
  Building2,
  Gauge,
  Gavel,
  LifeBuoy,
  Monitor,
  Settings,
  Trophy,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: typeof Settings;
  badge?: string;
};

const tournamentItems: NavItem[] = [
  { label: "Tournaments", href: "/admin/tournaments", icon: Trophy },
  { label: "Organisers", href: "/admin/organisers", icon: Building2 },
  { label: "Sports & Specs", href: "/admin/tournaments/sports", icon: Gavel },
];

const settingItems: NavItem[] = [
  { label: "Branding", href: "/admin/settings/branding", icon: Settings },
  { label: "AI & Intelligence", href: "/admin/settings/intelligence", icon: Activity },
  { label: "Communication", href: "/admin/settings/communication", icon: LifeBuoy },
  { label: "Notifications", href: "/admin/settings/notifications", icon: Bell },
  { label: "System", href: "/admin/settings/system/sms", icon: Monitor },
];

function isActive(location: string, href: string) {
  if (href === "/admin") return location === "/admin";
  return location === href || location.startsWith(`${href}/`);
}

function NavLink({
  item,
  location,
  onNavigate,
}: {
  item: NavItem;
  location: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isActive(location, item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function NavSection({
  label,
  items,
  location,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  location: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 pb-1 pt-5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </div>
      {items.map((item) => (
        <NavLink key={item.href} item={item} location={location} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

export function AdminSidebarNav({
  location,
  onNavigate,
}: {
  location: string;
  onNavigate?: () => void;
  isMaster?: boolean;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <NavLink
        item={{ label: "Dashboard", href: "/admin", icon: Gauge }}
        location={location}
        onNavigate={onNavigate}
      />
      <NavSection label="Tournament & Organisers" items={tournamentItems} location={location} onNavigate={onNavigate} />
      <NavSection label="Platform Settings" items={settingItems} location={location} onNavigate={onNavigate} />
    </nav>
  );
}
