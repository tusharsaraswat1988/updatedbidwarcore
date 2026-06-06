import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Building2, MessageSquare, Radio, Trophy, Users, Wallet } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AdminOrganizerRow,
  AdminTournamentRow,
  listAdminOrganizers,
  listAdminTournaments,
} from "@/lib/auth";
import { useAdminAuth } from "@/hooks/use-auth";

function getOrganiserId(pathname: string) {
  const match = pathname.match(/\/admin\/organisers\/(\d+)/);
  return match ? Number(match[1]) : null;
}

export default function AdminOrganiserDetailPage() {
  const [location, navigate] = useLocation();
  const { isLoggedIn, isLoading } = useAdminAuth();
  const organiserId = getOrganiserId(location);
  const [organisers, setOrganisers] = useState<AdminOrganizerRow[]>([]);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) navigate("/admin/login");
  }, [isLoading, isLoggedIn, navigate]);

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listAdminOrganizers(), listAdminTournaments()])
      .then(([organiserRows, tournamentRows]) => {
        if (cancelled) return;
        setOrganisers(organiserRows);
        setTournaments(tournamentRows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const organiser = organisers.find((o) => o.id === organiserId) || null;
  const linkedTournaments = useMemo(
    () => tournaments.filter((t) => t.organizerId === organiserId),
    [organiserId, tournaments],
  );
  const liveCount = linkedTournaments.filter((t) => t.licenseStatus === "active" && !t.adminLocked).length;

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title={organiser?.name || "Organiser Detail"}
      eyebrow="Tournament & Organisers › Organisers"
      actions={
        organiser && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin/settings/communication")}>
              <MessageSquare className="mr-2 h-4 w-4" /> Send Message
            </Button>
            <Button onClick={() => navigate("/admin/organisers")}>All Organisers</Button>
          </div>
        )
      }
    >
      {loading || !organiser ? (
        <div className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
          {loading ? "Loading organiser detail..." : "Organiser not found."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/70 p-4">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 font-display text-lg font-black text-primary">
                {organiser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-xl font-black text-white">{organiser.name}</h2>
                  <Badge className={organiser.licenseStatus === "active" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-300"}>
                    {organiser.licenseStatus}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {organiser.mobile || "No mobile"} · {organiser.email || "No email"} · Member since {new Date(organiser.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div className="rounded-xl border border-border bg-card/70 p-4"><Trophy className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-black text-white">{linkedTournaments.length}</div><div className="text-xs text-muted-foreground">Tournaments</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><Radio className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-black text-white">{liveCount}</div><div className="text-xs text-muted-foreground">Live now</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><Users className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-black text-white">--</div><div className="text-xs text-muted-foreground">Players managed</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><Wallet className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-black text-white">--</div><div className="text-xs text-muted-foreground">Revenue</div></div>
            <div className="rounded-xl border border-border bg-card/70 p-4"><Building2 className="h-4 w-4 text-primary" /><div className="mt-2 text-2xl font-black text-white">{organiser.maxTournaments}</div><div className="text-xs text-muted-foreground">Tournament limit</div></div>
          </div>

          <div className="grid grid-cols-[1fr_340px] gap-4">
            <div className="rounded-xl border border-border bg-card/70">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display font-black text-white">Tournaments</h2>
              </div>
              <div className="divide-y divide-border">
                {linkedTournaments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => navigate(`/admin/tournaments/${t.id}`)}
                    className="grid w-full grid-cols-[1fr_120px_120px_120px] gap-4 px-4 py-3 text-left text-sm hover:bg-accent/50"
                  >
                    <span className="font-semibold text-white">{t.name}</span>
                    <span className="text-muted-foreground">{t.sport}</span>
                    <span>{t.licenseStatus}</span>
                    <span className="text-right text-primary">Open →</span>
                  </button>
                ))}
                {!linkedTournaments.length && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    No linked tournaments for this organiser.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card/70">
              <div className="border-b border-border px-4 py-3">
                <h2 className="font-display font-black text-white">Activity</h2>
              </div>
              <div className="space-y-2 p-4 text-sm text-muted-foreground">
                <div className="rounded-lg bg-muted/20 px-3 py-2">Profile reviewed in Super Admin</div>
                <div className="rounded-lg bg-muted/20 px-3 py-2">Tournament count: {organiser.tournamentCount}</div>
                <div className="rounded-lg bg-muted/20 px-3 py-2">Notes: {organiser.notes || "No notes"}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
