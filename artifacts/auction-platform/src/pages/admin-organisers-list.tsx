import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Building2, Check, RefreshCw, Search, Trophy, X } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import { organizerAccessLabel } from "@workspace/api-base/organizer-account";
import { displayOrganizerMobile } from "@workspace/api-base/mobile";
import { AdminOrganizerRow, listAdminOrganizers } from "@/lib/auth";
import { cn } from "@/lib/utils";

function phoneStatusOf(o: AdminOrganizerRow): "verified" | "missing_phone" | "incomplete_profile" {
  if (o.phoneStatus) return o.phoneStatus;
  const clean = displayOrganizerMobile(o.mobile);
  if (!clean) return "missing_phone";
  if (o.phoneVerified) return "verified";
  return "incomplete_profile";
}

type ExtendedFilter = "all" | "verified" | "missing_phone" | "incomplete_profile" | "locked";

const GRID_COLS = "lg:grid lg:grid-cols-[minmax(220px,2fr)_minmax(150px,1.4fr)_minmax(180px,1.6fr)_100px_90px_80px] lg:items-center lg:gap-4";

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
      const cleanPhone = displayOrganizerMobile(o.mobile) || "";
      return (
        !q ||
        o.name.toLowerCase().includes(q) ||
        String(o.id).includes(q) ||
        cleanPhone.includes(q) ||
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
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border px-3 py-2 gap-2 bg-muted/20 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                filter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              All ({organisers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("verified")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                filter === "verified"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              Verified ({counts.verified})
            </button>
            <button
              type="button"
              onClick={() => setFilter("missing_phone")}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                filter === "missing_phone"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:text-foreground"
              )}
            >
              Missing Phone ({counts.missing})
            </button>
            {counts.incomplete > 0 && (
              <button
                type="button"
                onClick={() => setFilter("incomplete_profile")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  filter === "incomplete_profile"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                Incomplete Profile ({counts.incomplete})
              </button>
            )}
            {counts.locked > 0 && (
              <button
                type="button"
                onClick={() => setFilter("locked")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  filter === "locked"
                    ? "bg-destructive text-destructive-foreground shadow-xs"
                    : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                )}
              >
                Locked ({counts.locked})
              </button>
            )}
          </div>

          <div className="text-[11px] font-medium text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "organiser" : "organisers"} · Latest first
          </div>
        </div>

        {/* Table Header */}
        <AdminListHeader
          gridClassName={GRID_COLS}
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
                const isLocked = organizerAccessLabel(o.licenseStatus) === "locked";
                const cleanPhone = displayOrganizerMobile(o.mobile);

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => navigate(`/admin/organisers/${o.id}`)}
                    className={`block w-full border-b border-border p-3.5 text-left text-sm hover:bg-accent/40 transition-colors ${GRID_COLS} lg:border-b-0`}
                  >
                    {/* Col 1: Organiser Info */}
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {o.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-sm truncate hover:text-primary transition-colors">
                          {o.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Joined {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "Recently"}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Phone */}
                    <div className="min-w-0 mt-1.5 lg:mt-0 flex items-center gap-1.5">
                      {cleanPhone ? (
                        <>
                          <span className="font-mono text-xs text-foreground">{cleanPhone}</span>
                          {o.phoneVerified ? (
                            <span title="Verified mobile" className="inline-flex items-center text-emerald-400">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">(unverified)</span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No phone on file</span>
                      )}
                    </div>

                    {/* Col 3: Email */}
                    <div className="min-w-0 mt-1 lg:mt-0">
                      <span className="block truncate text-xs text-muted-foreground">
                        {o.email || "—"}
                      </span>
                    </div>

                    {/* Col 4: Account Status */}
                    <div className="mt-1.5 lg:mt-0">
                      <Badge
                        className={cn(
                          "text-[10px] font-semibold",
                          !isLocked
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : "bg-destructive/15 text-destructive border border-destructive/30"
                        )}
                      >
                        {!isLocked ? "Active" : "Locked"}
                      </Badge>
                    </div>

                    {/* Col 5: Tournaments Count */}
                    <div className="mt-1.5 text-xs lg:mt-0">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted/40 px-2.5 py-1 text-xs font-medium text-foreground">
                        <Trophy className="h-3 w-3 text-primary/70" />
                        {o.tournamentCount}
                      </span>
                    </div>

                    {/* Col 6: Action */}
                    <div className="mt-2.5 text-xs font-semibold text-primary lg:mt-0 lg:text-right">
                      <span className="inline-block rounded-md px-2.5 py-1 hover:bg-primary/10 transition-colors">
                        Manage →
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
