import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  LogOut,
  Menu,
  Search,
  UserCircle,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useIsMobile } from "@/hooks/use-media-query";
import { useInactivityLock } from "@/hooks/use-inactivity-lock";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const sidebarPreset = getBrandSurfacePreset("sidebar-compact");
import { AdminSidebarNav } from "@/components/admin/admin-sidebar-nav";
import { AdminPwaInstallHint } from "@/components/admin/admin-pwa-install-hint";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { AdminNotificationProvider } from "@/contexts/admin-notification-context";
import { AdminLockWarning } from "@/components/admin-lock-warning";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type AdminShellProps = {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
};

function ShellBrand({ loading, logos, brandName }: { loading: boolean; logos: { mini?: string | null }; brandName: string }) {
  const shellLogoSrc = getBrandLogoSrc(logos, sidebarPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);
  return (
    <div className="flex h-16 items-center gap-3 border-b border-border px-4">
      {!loading && (
        <img
          src={cldUrl(logos.mini, "headerLogo") || shellLogoSrc}
          alt={logoAlt}
          className={sidebarPreset.sizeClass}
        />
      )}
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Super Admin</div>
      </div>
    </div>
  );
}

export function AdminShell({ children, title, eyebrow, actions }: AdminShellProps) {
  const [location, navigate] = useLocation();
  const { logout, adminLevel, isMaster, isLoggedIn } = useAdminAuth();
  const { logos, brandName, loading } = useBranding();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [lockMinutes, setLockMinutes] = useState(10);
  const [warningSeconds, setWarningSeconds] = useState(90);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/auth/admin/settings/session-lock", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { lockMinutes?: number; warningSeconds?: number }) => {
        if (typeof d.lockMinutes === "number" && d.lockMinutes >= 10) {
          setLockMinutes(d.lockMinutes);
        }
        if (typeof d.warningSeconds === "number" && d.warningSeconds > 0) {
          setWarningSeconds(d.warningSeconds);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  const {
    locked,
    warningVisible,
    warningSecondsLeft,
    continueSession,
  } = useInactivityLock({
    enabled: isLoggedIn,
    timeoutMs: lockMinutes * 60 * 1000,
    warningMs: warningSeconds * 1000,
  });

  useEffect(() => {
    if (!locked) return;
    void (async () => {
      await logout();
      navigate("/admin/login");
    })();
  }, [locked, logout, navigate]);

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <AdminNotificationProvider enabled={isLoggedIn}>
    <div className="dark flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden w-60 flex-shrink-0 flex-col border-r border-border bg-card/80 md:flex">
        <ShellBrand loading={loading} logos={logos} brandName={brandName} />
        <AdminSidebarNav location={location} isMaster={isMaster} />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[min(100vw-2rem,280px)] p-0">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <ShellBrand loading={loading} logos={logos} brandName={brandName} />
          <AdminSidebarNav location={location} isMaster={isMaster} onNavigate={closeDrawer} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 sm:gap-4 sm:px-5">
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="relative min-w-0 flex-1 max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-lg border border-border bg-card/70 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
              placeholder={isMobile ? "Search..." : "Search tournaments, organisers, players..."}
            />
          </div>
          <div
            className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground sm:flex"
            title={adminLevel === "master" ? "Master admin — full platform access" : "Data entry admin — read-only live ops"}
          >
            <UserCircle className="h-5 w-5" />
            <span>{adminLevel === "master" ? "Master" : "Data Entry"}</span>
          </div>
          <AdminPwaInstallHint variant="compact" />
          <AdminNotificationBell />
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to sign out of Super Admin?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleLogout()}
              >
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex-1 overflow-auto">
          <div className="border-b border-border bg-card/30 px-4 py-3 sm:px-6 sm:py-4">
            {eyebrow && (
              <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="font-display text-xl font-black text-white sm:text-2xl">{title}</h1>
              {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            </div>
          </div>
          <div className="p-4 sm:p-6">{children}</div>
        </div>
      </main>

      {warningVisible && !locked && (
        <AdminLockWarning
          secondsLeft={warningSecondsLeft}
          lockMinutes={lockMinutes}
          onContinue={continueSession}
        />
      )}
    </div>
    </AdminNotificationProvider>
  );
}
