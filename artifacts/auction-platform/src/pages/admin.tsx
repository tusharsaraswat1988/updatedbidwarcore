import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import { listAdminTournaments, setOrganizerPassword, logoutAdmin } from "@/lib/auth";
import { FullscreenLayout } from "@/components/layout";
import { motion } from "framer-motion";
import { ShieldCheck, Trophy, LogOut, KeyRound, Check, X, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TRow = { id: number; name: string; sport: string; status: string; organizerName: string | null; hasPassword: boolean };

function PasswordCell({ tournamentId, hasPassword, onDone }: { tournamentId: number; hasPassword: boolean; onDone: () => void }) {
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function save() {
    if (!pw.trim()) return;
    setLoading(true);
    const r = await setOrganizerPassword(tournamentId, pw.trim());
    setLoading(false);
    if (r.success) { setSuccess(true); setPw(""); setEditing(false); onDone(); setTimeout(() => setSuccess(false), 2000); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="New password"
          className="h-8 text-sm w-40"
          autoFocus
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        />
        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-400" onClick={save} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(false)}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={hasPassword ? "default" : "secondary"} className={hasPassword ? "bg-green-500/20 text-green-400 border-green-500/20" : ""}>
        {hasPassword ? "Password set" : "No password"}
      </Badge>
      {success && <span className="text-green-400 text-xs">Saved</span>}
      <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEditing(true)}>
        <KeyRound className="w-3.5 h-3.5" />
        {hasPassword ? "Change" : "Set"}
      </Button>
    </div>
  );
}

export default function AdminDashboard() {
  const { isLoggedIn, isLoading: authLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<TRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await listAdminTournaments();
    setTournaments(data);
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate("/admin/login");
    if (!authLoading && isLoggedIn) load();
  }, [isLoggedIn, authLoading]);

  async function handleLogout() {
    await logout();
    navigate("/admin/login");
  }

  if (authLoading) {
    return (
      <FullscreenLayout>
        <div className="p-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </FullscreenLayout>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <FullscreenLayout>
      <div className="min-h-screen p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="font-display font-black text-2xl text-white">Super Admin</h1>
                <p className="text-xs text-muted-foreground">BidWar Platform Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/")}>
                <Trophy className="w-4 h-4" /> Tournaments
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </div>
          </div>

          {/* Tournaments Table */}
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-sm">All Tournaments</h2>
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={load}>
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </Button>
              </div>
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : tournaments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No tournaments yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {tournaments.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{t.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.sport}</Badge>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.status}</Badge>
                        </div>
                        {t.organizerName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t.organizerName}</p>
                        )}
                      </div>
                      <PasswordCell tournamentId={t.id} hasPassword={t.hasPassword} onDone={load} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => navigate(`/tournament/${t.id}`)}
                        title="Open tournament"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Set organizer passwords so tournament managers can login at{" "}
            <code className="text-primary">/tournament/:id/login</code>
          </p>
        </div>
      </div>
    </FullscreenLayout>
  );
}
