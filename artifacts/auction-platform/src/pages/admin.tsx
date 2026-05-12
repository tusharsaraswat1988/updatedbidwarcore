import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-auth";
import {
  listAdminTournaments,
  setOrganizerPassword,
  logoutAdmin,
  fetchAdminTournamentDetail,
  updateAdminTournament,
} from "@/lib/auth";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Trophy, LogOut, KeyRound, Check, X, ExternalLink,
  RefreshCw, Search, ChevronRight, Users, Wallet, Gavel, Clock,
  Pencil, Building2, Phone, Mail, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

type TRow = {
  id: number; name: string; sport: string; status: string;
  organizerName: string | null; organizerMobile: string | null;
  organizerEmail: string | null; hasPassword: boolean; createdAt: string;
};

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
          className="h-8 text-sm w-36"
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

type DetailData = Awaited<ReturnType<typeof fetchAdminTournamentDetail>>;

function TournamentDetailModal({ tournamentId, onClose, onRefresh }: {
  tournamentId: number; onClose: () => void; onRefresh: () => void;
}) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<DetailData>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | number>>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetchAdminTournamentDetail(tournamentId);
    setData(d);
    if (d) {
      setEditForm({
        name: d.tournament.name,
        organizerName: d.tournament.organizerName || "",
        organizerMobile: d.tournament.organizerMobile || "",
        organizerEmail: d.tournament.organizerEmail || "",
        venue: d.tournament.venue || "",
        timerSeconds: d.tournament.timerSeconds,
        bidTimerSeconds: d.tournament.bidTimerSeconds,
        organizerPassword: "",
      });
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    const payload: Record<string, string | number> = {};
    if (editForm.name) payload.name = editForm.name as string;
    if (editForm.organizerName !== undefined) payload.organizerName = editForm.organizerName as string;
    if (editForm.organizerMobile !== undefined) payload.organizerMobile = editForm.organizerMobile as string;
    if (editForm.organizerEmail !== undefined) payload.organizerEmail = editForm.organizerEmail as string;
    if (editForm.venue !== undefined) payload.venue = editForm.venue as string;
    if (editForm.timerSeconds) payload.timerSeconds = Number(editForm.timerSeconds);
    if (editForm.bidTimerSeconds) payload.bidTimerSeconds = Number(editForm.bidTimerSeconds);
    if (editForm.organizerPassword) payload.organizerPassword = editForm.organizerPassword as string;
    const r = await updateAdminTournament(tournamentId, payload);
    setSaving(false);
    if (r.success) {
      setSaveMsg("Saved");
      setEditing(false);
      await load();
      onRefresh();
      setTimeout(() => setSaveMsg(""), 2000);
    } else {
      setSaveMsg(r.error || "Save failed");
    }
  }

  const statusColor: Record<string, string> = {
    setup: "bg-muted/30 text-muted-foreground",
    active: "bg-green-500/20 text-green-400",
    paused: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-blue-500/20 text-blue-400",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl dark max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="flex items-center gap-2">
              <Gavel className="w-5 h-5 text-primary" />
              {loading ? "Loading..." : data?.tournament.name}
            </span>
            {data && (
              <div className="flex items-center gap-2">
                <Badge className={statusColor[data.tournament.status] || ""}>
                  {data.tournament.status}
                </Badge>
                <Button
                  size="sm"
                  variant={editing ? "default" : "outline"}
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => { if (editing) handleSave(); else setEditing(true); }}
                  disabled={saving}
                >
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Pencil className="w-3 h-3" />}
                  {editing ? "Save" : "Edit"}
                </Button>
                {editing && (
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigate(`/tournament/${tournamentId}`)}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-1">
          {loading ? (
            <div className="space-y-3 p-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !data ? (
            <p className="text-center text-muted-foreground py-8">Failed to load data.</p>
          ) : (
            <div className="space-y-5 p-2">
              {saveMsg && (
                <p className={`text-sm ${saveMsg === "Saved" ? "text-green-400" : "text-destructive"}`}>{saveMsg}</p>
              )}

              {/* Info Grid */}
              {editing ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tournament Name</Label>
                    <Input className="h-8 text-sm" value={editForm.name as string || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Venue</Label>
                    <Input className="h-8 text-sm" value={editForm.venue as string || ""} onChange={e => setEditForm(f => ({ ...f, venue: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Organizer Name</Label>
                    <Input className="h-8 text-sm" value={editForm.organizerName as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Mobile</Label>
                    <Input className="h-8 text-sm" value={editForm.organizerMobile as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerMobile: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Organizer Email</Label>
                    <Input className="h-8 text-sm" value={editForm.organizerEmail as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerEmail: e.target.value }))} placeholder="Links to organizer account" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><KeyRound className="w-3 h-3" /> Organizer Password</Label>
                    <Input className="h-8 text-sm" type="password" value={editForm.organizerPassword as string || ""} onChange={e => setEditForm(f => ({ ...f, organizerPassword: e.target.value }))} placeholder="Leave blank to keep" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" /> First Bid Timer (sec)</Label>
                    <Input className="h-8 text-sm" type="number" value={editForm.timerSeconds as number || 30} onChange={e => setEditForm(f => ({ ...f, timerSeconds: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1"><Timer className="w-3 h-3" /> Subsequent Bid Timer (sec)</Label>
                    <Input className="h-8 text-sm" type="number" value={editForm.bidTimerSeconds as number || 15} onChange={e => setEditForm(f => ({ ...f, bidTimerSeconds: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  {[
                    ["Sport", data.tournament.sport.toUpperCase()],
                    ["Venue", data.tournament.venue || "—"],
                    ["Organizer", data.tournament.organizerName || "—"],
                    ["Mobile", data.tournament.organizerMobile || "—"],
                    ["Email", data.tournament.organizerEmail || "—"],
                    ["Base Purse", formatIndianRupee(data.tournament.basePurse)],
                    ["First Bid Timer", `${data.tournament.timerSeconds}s`],
                    ["Subsequent Timer", `${data.tournament.bidTimerSeconds}s`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-28 flex-shrink-0">{k}</span>
                      <span className="font-medium text-xs truncate">{v}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Player Counts */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Players</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    ["Total", data.playerCounts.total, "text-foreground"],
                    ["Available", data.playerCounts.available, "text-blue-400"],
                    ["Sold", data.playerCounts.sold, "text-green-400"],
                    ["Unsold", data.playerCounts.unsold, "text-destructive"],
                    ["Retained", data.playerCounts.retained, "text-purple-400"],
                  ].map(([label, count, color]) => (
                    <div key={label as string} className="text-center p-3 rounded-lg bg-muted/20 border border-border/50">
                      <p className={`text-xl font-display font-bold ${color}`}>{count}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teams */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Teams ({data.teams.length})
                </p>
                <div className="space-y-1.5">
                  {data.teams.map(team => (
                    <div key={team.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/10 border border-border/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: team.color || "#666" }} />
                        <span className="text-sm font-medium">{team.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{team.shortCode}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-mono text-muted-foreground">{formatShortIndianRupee(team.purseUsed)} / {formatShortIndianRupee(team.purse)}</p>
                      </div>
                    </div>
                  ))}
                  {data.teams.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No teams yet</p>}
                </div>
              </div>

              {/* Recent Bids */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Recent Bids
                </p>
                <div className="space-y-1">
                  {data.recentBids.map(bid => (
                    <div key={bid.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/10">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bid.teamColor || "#666" }} />
                        <span className="text-xs text-muted-foreground">{bid.playerName}</span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                        <span className="text-xs">{bid.teamName}</span>
                      </div>
                      <span className="text-xs font-mono text-primary">{formatShortIndianRupee(bid.amount)}</span>
                    </div>
                  ))}
                  {data.recentBids.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No bids yet</p>}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const { isLoggedIn, isLoading: authLoading, logout } = useAdminAuth();
  const [, navigate] = useLocation();
  const [tournaments, setTournaments] = useState<TRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState<number | null>(null);

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

  const filtered = tournaments.filter(t => {
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
        <div className="max-w-5xl mx-auto space-y-8">
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
              <div className="p-4 border-b border-border flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, ID, mobile, email..."
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{filtered.length} tournaments</span>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7" onClick={load}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>
              </div>
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {search ? "No tournaments match your search." : "No tournaments yet."}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((t, i) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">#{t.id}</span>
                          <span className="font-semibold text-sm">{t.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.sport}</Badge>
                          <Badge variant="outline" className="text-[10px] uppercase">{t.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {t.organizerName && <span className="text-xs text-muted-foreground">{t.organizerName}</span>}
                          {t.organizerMobile && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" />{t.organizerMobile}
                            </span>
                          )}
                          {t.organizerEmail && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" />{t.organizerEmail}
                            </span>
                          )}
                        </div>
                      </div>
                      <PasswordCell tournamentId={t.id} hasPassword={t.hasPassword} onDone={load} />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => setDetailId(t.id)}
                      >
                        <Wallet className="w-3.5 h-3.5" /> Details
                      </Button>
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
            {" · "}
            Organizer portal at <code className="text-primary">/organizer</code>
          </p>
        </div>
      </div>

      <AnimatePresence>
        {detailId !== null && (
          <TournamentDetailModal
            tournamentId={detailId}
            onClose={() => setDetailId(null)}
            onRefresh={load}
          />
        )}
      </AnimatePresence>
    </FullscreenLayout>
  );
}
