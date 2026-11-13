import { Link } from "wouter";
import {
  Activity,
  Bell,
  Building2,
  Crown,
  FileBarChart,
  Gauge,
  Gavel,
  GraduationCap,
  Image,
  LifeBuoy,
  Mail,
  Monitor,
  Radio,
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
  { label: "BPL Editions", href: "/admin/bpl", icon: Crown },
  { label: "Organisers", href: "/admin/organisers", icon: Building2 },
  { label: "Sports & Specs", href: "/admin/tournaments/sports", icon: Gavel },
];

const knowledgeCenterItems: NavItem[] = [
  { label: "Academy", href: "/admin/knowledge-center/academy", icon: GraduationCap },
];

const communicationItems: NavItem[] = [
  { label: "Communication Center", href: "/admin/communication", icon: Mail },
];

const settingItems: NavItem[] = [
  { label: "Reports", href: "/admin/settings/reports", icon: FileBarChart },
  { label: "Branding", href: "/admin/settings/branding", icon: Settings },
  { label: "Our Clients", href: "/admin/settings/system/clients", icon: Building2 },
  { label: "Admin Notifications", href: "/admin/settings/admin-notifications", icon: Bell },
  { label: "AI & Intelligence", href: "/admin/settings/intelligence", icon: Activity },
  { label: "System", href: "/admin/settings/system/diagnostics", icon: Monitor },
];

function isActive(location: string, href: string) {
  if (href === "/admin") return location === "/admin";
  if (href === "/admin/live/auctions") return location.startsWith("/admin/live");
  if (href === "/admin/tournaments") {
    // Exact tournaments list or /admin/tournaments/:id, NEVER match /admin/tournaments/sports
    return location === "/admin/tournaments" || /^\/admin\/tournaments\/\d+/.test(location);
  }
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
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-all ${
        active
          ? "bg-primary/15 text-primary font-bold shadow-xs border border-primary/30"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 flex-shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
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
      <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
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
  isMaster = false,
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
      <NavLink
        item={{ label: "Live Auctions", href: "/admin/live/auctions", icon: Radio }}
        location={location}
        onNavigate={onNavigate}
      />
      <NavLink
        item={{ label: "Events & Activities", href: "/admin/events-activities", icon: Activity }}
        location={location}
        onNavigate={onNavigate}
      />
      <NavSection label="Tournament & Organisers" items={tournamentItems} location={location} onNavigate={onNavigate} />
      <NavSection label="Knowledge Center" items={knowledgeCenterItems} location={location} onNavigate={onNavigate} />
      {isMaster && (
        <NavSection label="Platform" items={communicationItems} location={location} onNavigate={onNavigate} />
      )}
      <NavSection label="Platform Settings" items={settingItems} location={location} onNavigate={onNavigate} />
    </nav>
  );
}
