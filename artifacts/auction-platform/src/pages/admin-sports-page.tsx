import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { SportsPanel } from "@/pages/admin";

export default function AdminSportsPage() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell title="Sports & Specs" eyebrow="Tournament & Organisers">
      <div className="overflow-hidden rounded-xl border border-border bg-card/70">
        <SportsPanel />
      </div>
    </AdminShell>
  );
}
