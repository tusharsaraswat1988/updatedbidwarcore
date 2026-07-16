import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { RefreshCw, Search } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import { organizerAccessLabel } from "@workspace/api-base/organizer-account";
import { AdminOrganizerRow, listAdminOrganizers } from "@/lib/auth";

export default function AdminOrganisersListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAdminOrganizers();
    setOrganisers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  const filtered = organisers.filter((o) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      o.name.toLowerCase().includes(q) ||
      (o.mobile ?? "").includes(q) ||
      (o.email || "").toLowerCase().includes(q)
    );
  });

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell title="Organisers" eyebrow="Tournament & Organisers">
      <div className="rounded-xl border border-border bg-card/70">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organisers..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={load} title="Refresh" aria-label="Refresh organisers">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {organisers.length} organiser{organisers.length !== 1 ? "s" : ""}
          {" · "}
          {organisers.filter((o) => organizerAccessLabel(o.licenseStatus) === "locked").length} locked
        </div>

        <AdminListHeader
          gridClassName="md:grid md:grid-cols-[1fr_130px_180px_100px_100px_90px]"
          columns={[
            { label: "Organiser" },
            { label: "Phone" },
            { label: "Email" },
            { label: "Status" },
            { label: "Tournaments" },
            { label: "Action", align: "right" },
          ]}
        />

        <AdminScrollPanel>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              {search ? "No organisers match your search." : "No organiser accounts yet."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/admin/organisers/${o.id}`)}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-accent/50 md:grid md:grid-cols-[1fr_130px_180px_100px_100px_90px] md:items-center md:gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{o.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(o.createdAt).toLocaleDateString("en-IN")}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground md:hidden">
                      {o.mobile || "No phone"}
                      {o.email ? ` · ${o.email}` : ""}
                    </div>
                  </div>
                  <span className="hidden truncate text-xs text-muted-foreground md:block">
                    {o.mobile || "—"}
                  </span>
                  <span className="hidden truncate text-xs text-muted-foreground md:block">
                    {o.email || "—"}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                    <Badge
                      className={
                        organizerAccessLabel(o.licenseStatus) === "active"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }
                    >
                      {organizerAccessLabel(o.licenseStatus) === "active" ? "Active" : "Locked"}
                    </Badge>
                    <span className="text-xs text-muted-foreground md:hidden">{o.tournamentCount} tournaments</span>
                  </div>
                  <span className="hidden md:block">{o.tournamentCount}</span>
                  <span className="mt-2 text-xs font-semibold text-primary md:mt-0 md:text-right">Open →</span>
                </button>
              ))}
            </div>
          )}
        </AdminScrollPanel>
      </div>
    </AdminShell>
  );
}
