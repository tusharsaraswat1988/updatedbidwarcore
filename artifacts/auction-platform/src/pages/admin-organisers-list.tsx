import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BadgeCheck, Building2, Phone, RefreshCw, Search, ShieldCheck, Trophy, UserCheck, X } from "lucide-react";
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

function phoneStatusOf(o: AdminOrganizerRow): "verified" | "missing_phone" | "incomplete_profile" {
  if (o.phoneStatus) return o.phoneStatus;
  if (!o.mobile) return "missing_phone";
  if (o.phoneVerified) return "verified";
  return "incomplete_profile";
}

function phoneDisplay(o: AdminOrganizerRow): string {
  if (!o.mobile) return "Phone Missing";
  return o.mobile;
}

function PhoneStatusBadge({ status }: { status: ReturnType<typeof phoneStatusOf> }) {
  if (status === "verified") {
    return <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold">Verified</Badge>;
  }
  if (status === "missing_phone") {
    return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-semibold">Phone Missing</Badge>;
  }
  return <Badge className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-[10px] font-semibold">Incomplete Profile</Badge>;
}

type ExtendedFilter = "all" | "verified" | "missing_phone" | "incomplete_profile" | "locked";

const GRID_COLS = "md:grid md:grid-cols-[minmax(220px,1.8fr)_minmax(140px,1.2fr)_minmax(180px,1.6fr)_120px_100px_100px_90px] md:items-center md:gap-4";

export default function AdminOrganisersListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ExtendedFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await listAdminOrganizers();
    // Sort latest registered first by default
    const sorted = [...data].sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      if (tb !== ta) return tb - ta;
      return b.id - a.id;
    });
    setOrganisers(sorted);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  const counts = useMemo(() => {
    let verified = 0;
    let missing = 0;
    let incomplete = 0;
    let locked = 0;
    for (const o of organisers) {
      if (organizerAccessLabel(o.licenseStatus) === "locked") locked += 1;
      const s = phoneStatusOf(o);
      if (s === "verified") verified += 1;
      else if (s === "missing_phone") missing += 1;
      else incomplete += 1;
    }
    return { verified, missing, incomplete, locked };
  }, [organisers]);

  const filtered = useMemo(() => {
    return organisers.filter((o) => {
      const status = phoneStatusOf(o);
      const isLocked = organizerAccessLabel(o.licenseStatus) === "locked";

      if (filter === "locked" && !isLocked) return false;
      if (filter === "verified" && status !== "verified") return false;
      if (filter === "missing_phone" && status !== "missing_phone") return false;
      if (filter === "incomplete_profile" && status !== "incomplete_profile") return false;

      const q = search.trim().toLowerCase();
      return (
        !q ||
        o.name.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        (o.mobile ?? "").includes(q) ||
        (o.email || "").toLowerCase().includes(q)
      );
    });
  }, [organisers, search, filter]);

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell title="Organisers" eyebrow="Tournament & Organisers">
      <div className="rounded-xl border border-border bg-card/70 shadow-sm overflow-hidden">
        {/* Top Search & Refresh Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border p-3 gap-3 bg-card/50">
          {/* Left: Compact Search */}
          <div className="relative w-full sm:w-72 flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search organiser, phone, email..."
              className="h-8.5 pl-8 pr-7 text-xs bg-background/70 border-border"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Right: Quick Stats & Refresh */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2.5 gap-1.5 text-xs"
              onClick={load}
              title="Refresh organisers"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>

        {/* Top Filters Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-border px-3 py-2 gap-2 bg-muted/20 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({organisers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("verified")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === "verified"
                  ? "bg-emerald-500 text-white shadow-xs"
                  : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              }`}
            >
              Verified ({counts.verified})
            </button>
            <button
              type="button"
              onClick={() => setFilter("missing_phone")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                filter === "missing_phone"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              }`}
            >
              Missing Phone ({counts.missing})
            </button>
            {counts.incomplete > 0 && (
              <button
                type="button"
                onClick={() => setFilter("incomplete_profile")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filter === "incomplete_profile"
                    ? "bg-orange-500 text-white shadow-xs"
                    : "bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
                }`}
              >
                Incomplete Profile ({counts.incomplete})
              </button>
            )}
            {counts.locked > 0 && (
              <button
                type="button"
                onClick={() => setFilter("locked")}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  filter === "locked"
                    ? "bg-red-500 text-white shadow-xs"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                }`}
              >
                Locked ({counts.locked})
              </button>
            )}
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            Showing <span className="text-foreground font-bold">{filtered.length}</span> of {organisers.length} organisers · Sorted latest first
          </div>
        </div>

        {/* Table Header with strictly matched grid columns */}
        <AdminListHeader
          gridClassName={GRID_COLS}
          columns={[
            { label: "Organiser" },
            { label: "Phone" },
            { label: "Email" },
            { label: "Phone status" },
            { label: "Status" },
            { label: "Tournaments" },
            { label: "Action", align: "right" },
          ]}
        />

        <AdminScrollPanel>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <span className="font-semibold text-foreground">
                {search || filter !== "all" ? "No organisers match your filters." : "No organiser accounts registered yet."}
              </span>
              {(search || filter !== "all") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className="mt-3 text-xs"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((o) => {
                const phoneStatus = phoneStatusOf(o);
                const isLocked = organizerAccessLabel(o.licenseStatus) === "locked";
                return (
                  <button
                    key={o.id}
                    onClick={() => navigate(`/admin/organisers/${o.id}`)}
                    className={`block w-full border-b border-border px-4 py-3 text-left text-sm hover:bg-accent/40 transition-colors ${GRID_COLS} md:border-b-0`}
                  >
                    {/* Col 1: Organiser Info */}
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {o.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-sm truncate hover:text-primary transition-colors">
                          {o.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Joined {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recently"}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Phone */}
                    <div className="min-w-0 mt-1 md:mt-0">
                      <span className={`block truncate text-xs ${!o.mobile ? "text-amber-400 font-medium" : "text-foreground font-mono"}`}>
                        {phoneDisplay(o)}
                      </span>
                    </div>

                    {/* Col 3: Email */}
                    <div className="min-w-0 mt-1 md:mt-0">
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.email || "—"}
                      </span>
                    </div>

                    {/* Col 4: Phone Status */}
                    <div className="mt-1.5 md:mt-0">
                      <PhoneStatusBadge status={phoneStatus} />
                    </div>

                    {/* Col 5: Account Status */}
                    <div className="mt-1.5 md:mt-0">
                      <Badge
                        className={`text-[10px] font-semibold ${
                          !isLocked
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {!isLocked ? "Active" : "Locked"}
                      </Badge>
                    </div>

                    {/* Col 6: Tournaments Count */}
                    <div className="mt-1.5 text-xs md:mt-0">
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted/30 px-2 py-0.5 font-bold text-foreground">
                        <Trophy className="h-3 w-3 text-amber-400" />
                        {o.tournamentCount}
                      </span>
                    </div>

                    {/* Col 7: Action */}
                    <div className="mt-2 text-xs font-bold text-primary md:mt-0 md:text-right">
                      <span className="rounded-md bg-primary/10 px-2 py-1 hover:bg-primary/20 transition-colors">
                        Open →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </AdminScrollPanel>
      </div>
    </AdminShell>
  );
}
