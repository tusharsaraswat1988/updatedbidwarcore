import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { SportsPanel } from "@/components/admin/sports-panel";

export default function AdminSportsPage() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell title="Sports & Specs Catalog" eyebrow="Tournament & Organisers">
      <div className="overflow-hidden rounded-xl border border-border bg-card/70 h-[calc(100dvh-9.5rem)] min-h-[580px] flex flex-col shadow-sm">
        <SportsPanel />
      </div>
    </AdminShell>
  );
}
