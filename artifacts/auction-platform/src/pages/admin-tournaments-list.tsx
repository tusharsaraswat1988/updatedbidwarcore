import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  BadgeCheck,
  Lock,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AdminTournamentRow,
  listAdminTournaments,
} from "@/lib/auth";
import {
  CreateTournamentModal,
  LicenseBadge,
  LockBadge,
  StatusBadge,
} from "@/pages/admin";

export default function AdminTournamentsListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    const data = await listAdminTournaments();
    setTournaments(data);
    setLoading(false);
  }

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn]);

  useEffect(() => {
    if (window.location.pathname === "/admin/tournaments/new") setCreateOpen(true);
  }, []);

  const filtered = tournaments.filter((t) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      String(t.id).includes(q) ||
      (t.organizerMobile && t.organizerMobile.toLowerCase().includes(q)) ||
      (t.organizerEmail && t.organizerEmail.toLowerCase().includes(q)) ||
      (t.organizerName && t.organizerName.toLowerCase().includes(q))
    );
  });

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Tournaments"
      eyebrow="Tournament & Organisers"
      actions={
        <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New Tournament
        </Button>
      }
    >
      <div className="rounded-xl border border-border bg-card/70">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tournaments..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={load} title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex items-center gap-4 border-b border-border px-4 py-2 text-xs text-muted-foreground">
          <span>{filtered.length} tournaments</span>
          <span className="flex items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5 text-green-400" />
            {tournaments.filter((t) => t.licenseStatus === "active").length} licensed
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            {tournaments.filter((t) => t.licenseStatus === "trial").length} trial
          </span>
          <span className="flex items-center gap-1">
            <Lock className="h-3.5 w-3.5 text-red-400" />
            {tournaments.filter((t) => t.adminLocked).length} locked
          </span>
        </div>

        <div className="hidden border-b border-border px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[1fr_120px_180px_140px_140px_100px]">
          <span>Tournament</span>
          <span>Status</span>
          <span>Organiser</span>
          <span>License</span>
          <span>Auction</span>
          <span className="text-right">Action</span>
        </div>

        <AdminScrollPanel>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
              <span>{search ? "No tournaments match your search." : "No tournaments yet."}</span>
              {!search && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Create tournament
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                  className="block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-accent/50 md:grid md:grid-cols-[1fr_120px_180px_140px_140px_100px] md:items-center md:gap-4 md:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{t.id} · {t.sport}
                      {t.organizerId ? (
                        <Badge className="ml-2 h-4 bg-green-500/15 px-1 text-[9px] text-green-400">
                          <UserCheck className="mr-0.5 inline h-2.5 w-2.5" /> Linked
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 md:mt-0">
                    <StatusBadge status={t.status} />
                    <LicenseBadge status={t.licenseStatus} />
                    {t.adminLocked && <LockBadge locked />}
                  </div>
                  <span className="mt-1 block truncate text-xs text-muted-foreground md:mt-0">
                    {t.organizerName || "Unlinked"}
                  </span>
                  <span className="mt-1 hidden text-xs text-muted-foreground md:block">{t.auctionDate || "Not set"}</span>
                  <span className="mt-2 text-xs font-semibold text-primary md:mt-0 md:text-right">Open →</span>
                </button>
              ))}
            </div>
          )}
        </AdminScrollPanel>
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateTournamentModal
            onClose={() => {
              setCreateOpen(false);
              if (window.location.pathname === "/admin/tournaments/new") navigate("/admin/tournaments");
            }}
            onCreated={load}
          />
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
