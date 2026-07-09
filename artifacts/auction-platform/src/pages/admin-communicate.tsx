import { useState, useEffect, useCallback } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, RefreshCw, Search, Users, Phone,
  CheckCircle2, XCircle, AlertTriangle, Lock, BadgeCheck,
  ChevronRight, Clock, Filter, Download, Megaphone,
  Smartphone, Wifi, WifiOff, LogOut, ArrowLeft, Eye,
  FileText, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface Tournament {
  id: number;
  name: string;
  sport: string;
  auctionDate?: string | null;
  licenseStatus: string;
  adminLocked?: boolean;
  organizerName?: string | null;
}

interface ConsentStats {
  players: { total: number; consented: number; hasMobile: number };
  owners: { total: number; consented: number; hasMobile: number };
}

interface CommLog {
  id: number;
  tournamentId: number | null;
  recipientType: string;
  recipientMobile: string;
  channel: string;
  templateName: string | null;
  messageContent: string;
  sentByAdminId: string | null;
  blastId: string | null;
  deliveryStatus: string;
  sentAt: string;
  errorMessage: string | null;
  metaMessageId: string | null;
}

interface BlastEntry {
  id: number;
  tournamentId: number;
  mobile: string;
  blastDate: string;
  sentAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    sent: "bg-blue-500/20 text-blue-400",
    delivered: "bg-green-500/20 text-green-400",
    read: "bg-green-600/20 text-green-300",
    failed: "bg-red-500/20 text-red-400",
  };
  return <Badge className={`text-[10px] uppercase ${map[status] || "bg-muted/20 text-muted-foreground"}`}>{status}</Badge>;
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "whatsapp") return <Badge className="bg-green-600/20 text-green-300 text-[10px] gap-1"><Wifi className="w-2.5 h-2.5" />WhatsApp</Badge>;
  if (channel === "sms") return <Badge className="bg-blue-500/20 text-blue-400 text-[10px] gap-1"><Smartphone className="w-2.5 h-2.5" />SMS</Badge>;
  return <Badge className="bg-muted/20 text-muted-foreground text-[10px]">{channel}</Badge>;
}

function LicenseLock({ status, locked }: { status: string; locked?: boolean }) {
  if (locked) return <Badge className="bg-red-500/15 text-red-400 border-red-500/30 gap-1 text-[10px]"><Lock className="w-3 h-3" />Locked</Badge>;
  if (status === "active") return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 gap-1 text-[10px]"><BadgeCheck className="w-3 h-3" />Active</Badge>;
  return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-[10px]"><AlertTriangle className="w-3 h-3" />Trial</Badge>;
}

function tabFromPath(path: string) {
  if (path.endsWith("/logs")) return "logs";
  if (path.endsWith("/blasts")) return "blasts";
  if (path.endsWith("/contacts")) return "contacts";
  if (path.endsWith("/send")) return "send";
  return "send";
}

export default function AdminCommunicate() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const [location, navigate] = useLocation();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [selectedTid, setSelectedTid] = useState<string>("");
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [blasts, setBlasts] = useState<BlastEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedLog, setSelectedLog] = useState<CommLog | null>(null);
  const [tab, setTab] = useState(() => tabFromPath(location));

  // Contacts tab
  interface MissingContact { id: number; name: string; role?: string | null; ownerName?: string | null }
  const [missingPlayers, setMissingPlayers] = useState<MissingContact[]>([]);
  const [missingOwners, setMissingOwners] = useState<MissingContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [bulkDeclaring, setBulkDeclaring] = useState(false);
  const [bulkDeclareResult, setBulkDeclareResult] = useState<{ playerCount: number; ownerCount: number } | null>(null);

  // Send form
  const [recipientGroup, setRecipientGroup] = useState("all_players");
  const [channel, setChannel] = useState("sms");
  const [messageContent, setMessageContent] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; sent: number; failed: number; stub?: boolean; blastId?: string } | null>(null);
  const [sendError, setSendError] = useState("");

  const isPlayerSoldTemplate = templateName === "player_sold";

  // Log filter
  const [logChannel, setLogChannel] = useState("");
  const [logStatus, setLogStatus] = useState("");
  const [logSearch, setLogSearch] = useState("");

  const selectedTournament = tournaments.find(t => String(t.id) === selectedTid);
  const isLicensedForWa = selectedTournament?.licenseStatus === "active" && !selectedTournament?.adminLocked;

  function handleTemplateChange(value: string) {
    const next = value === "__none__" ? "" : value;
    setTemplateName(next);
    setSendError("");
    setSendResult(null);
    if (next === "player_sold") {
      setRecipientGroup("sold_players");
      setMessageContent("");
    }
  }

  const loadTournaments = useCallback(async () => {
    setLoadingTournaments(true);
    try {
      const r = await fetch("/api/auth/admin/tournaments?limit=200", { credentials: "include" });
      if (r.ok) {
        // API returns a raw array; guard against both shapes
        const data = await r.json();
        setTournaments(Array.isArray(data) ? data : (data.tournaments ?? []));
      }
    } finally {
      setLoadingTournaments(false);
    }
  }, []);

  useEffect(() => {
    setTab(tabFromPath(location));
  }, [location]);

  useEffect(() => {
    if (isLoggedIn) void loadTournaments();
  }, [isLoggedIn, loadTournaments]);

  useEffect(() => {
    if (!selectedTid) { setConsentStats(null); return; }
    void (async () => {
      const r = await fetch(`/api/auth/admin/communicate/consent-status/${selectedTid}`, { credentials: "include" });
      if (r.ok) setConsentStats(await r.json() as ConsentStats);
    })();
  }, [selectedTid]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams();
      if (selectedTid) params.set("tournamentId", selectedTid);
      if (logChannel) params.set("channel", logChannel);
      if (logStatus) params.set("status", logStatus);
      const r = await fetch(`/api/auth/admin/communicate/logs?${params}`, { credentials: "include" });
      if (r.ok) setLogs(await r.json() as CommLog[]);
    } finally { setLoadingLogs(false); }
  }, [selectedTid, logChannel, logStatus]);

  const loadBlasts = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedTid) params.set("tournamentId", selectedTid);
    const r = await fetch(`/api/auth/admin/communicate/blasts?${params}`, { credentials: "include" });
    if (r.ok) setBlasts(await r.json() as BlastEntry[]);
  }, [selectedTid]);

  const loadContacts = useCallback(async () => {
    if (!selectedTid) { setMissingPlayers([]); setMissingOwners([]); return; }
    setLoadingContacts(true);
    try {
      const r = await fetch(`/api/auth/admin/communicate/missing-contacts/${selectedTid}`, { credentials: "include" });
      if (r.ok) {
        const d = await r.json() as { missingPlayers: MissingContact[]; missingOwners: MissingContact[] };
        setMissingPlayers(d.missingPlayers);
        setMissingOwners(d.missingOwners);
      }
    } finally { setLoadingContacts(false); }
  }, [selectedTid]);

  useEffect(() => {
    if (tab === "logs") void loadLogs();
    if (tab === "blasts") void loadBlasts();
    if (tab === "contacts") void loadContacts();
  }, [tab, loadLogs, loadBlasts, loadContacts]);

  async function handleBulkDeclare(type: "all") {
    if (!selectedTid) return;
    setBulkDeclaring(true);
    setBulkDeclareResult(null);
    try {
      const r = await fetch("/api/auth/admin/communicate/consent-declare-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: parseInt(selectedTid), recipientType: type }),
      });
      if (r.ok) {
        const d = await r.json() as { playerCount: number; ownerCount: number };
        setBulkDeclareResult(d);
        void loadContacts();
        if (consentStats) {
          const r2 = await fetch(`/api/auth/admin/communicate/consent-status/${selectedTid}`, { credentials: "include" });
          if (r2.ok) setConsentStats(await r2.json() as ConsentStats);
        }
      }
    } finally { setBulkDeclaring(false); }
  }

  async function handleSend() {
    if (isPlayerSoldTemplate) {
      if (!selectedTid) {
        setSendError("Select a tournament to send the Player Sold template");
        return;
      }
    } else if (!messageContent.trim()) {
      setSendError("Message content is required");
      return;
    }

    setSending(true);
    setSendError("");
    setSendResult(null);
    try {
      const body: Record<string, unknown> = {
        recipientGroup: isPlayerSoldTemplate ? "sold_players" : recipientGroup,
        channel,
        messageContent: isPlayerSoldTemplate ? "" : messageContent,
      };
      if (selectedTid) body.tournamentId = parseInt(selectedTid);
      if (templateName.trim()) body.templateName = templateName.trim();

      const r = await fetch("/api/auth/admin/communicate/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json() as { success?: boolean; sent?: number; failed?: number; stub?: boolean; blastId?: string; error?: string };
      if (r.ok && data.success) {
        setSendResult({ success: true, sent: data.sent ?? 0, failed: data.failed ?? 0, stub: data.stub, blastId: data.blastId });
      } else {
        setSendError(data.error ?? "Send failed");
      }
    } catch { setSendError("Network error"); }
    finally { setSending(false); }
  }

  const filteredLogs = logs.filter(l => {
    if (logSearch && !l.recipientMobile.includes(logSearch) && !(l.messageContent ?? "").toLowerCase().includes(logSearch.toLowerCase())) return false;
    return true;
  });

  if (isLoading || !isLoggedIn) return null;

  const handleTabChange = (value: string) => {
    setTab(value);
    const suffix = value === "send" ? "" : `/${value}`;
    navigate(`/admin/settings/communication${suffix}`);
  };

  return (
    <AdminShell
      title="Communication"
      eyebrow="Platform Settings"
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/admin/settings/communication/logs")}>
          <FileText className="w-4 h-4" /> Full Log
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
          {/* Tournament Selector */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tournament</Label>
            <div className="flex items-center gap-3">
              <Select value={selectedTid || "__all__"} onValueChange={v => setSelectedTid(v === "__all__" ? "" : v)}>
                <SelectTrigger className="max-w-sm">
                  <SelectValue placeholder="Select tournament (optional)" />
                </SelectTrigger>
                <SelectContent className="dark">
                  <SelectItem value="__all__">All Tournaments</SelectItem>
                  {tournaments.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTournament && (
                <LicenseLock status={selectedTournament.licenseStatus} locked={selectedTournament.adminLocked} />
              )}
            </div>
          </div>

          {/* Consent Stats */}
          {consentStats && (
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border bg-card/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Players</p>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl">{consentStats.players.consented}</p>
                      <p className="text-[10px] text-green-400">WA consented</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl text-muted-foreground">{consentStats.players.hasMobile}</p>
                      <p className="text-[10px] text-muted-foreground">has mobile</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl text-muted-foreground">{consentStats.players.total}</p>
                      <p className="text-[10px] text-muted-foreground">total</p>
                    </div>
                  </div>
                  {consentStats.players.hasMobile > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((consentStats.players.consented / consentStats.players.hasMobile) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{Math.round((consentStats.players.consented / consentStats.players.hasMobile) * 100)}% consent rate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border bg-card/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Team Owners</p>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl">{consentStats.owners.consented}</p>
                      <p className="text-[10px] text-green-400">WA consented</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl text-muted-foreground">{consentStats.owners.hasMobile}</p>
                      <p className="text-[10px] text-muted-foreground">has mobile</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-2xl text-muted-foreground">{consentStats.owners.total}</p>
                      <p className="text-[10px] text-muted-foreground">total</p>
                    </div>
                  </div>
                  {consentStats.owners.hasMobile > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${Math.round((consentStats.owners.consented / consentStats.owners.hasMobile) * 100)}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{Math.round((consentStats.owners.consented / consentStats.owners.hasMobile) * 100)}% consent rate</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="bg-card/50 border border-border">
              <TabsTrigger value="send" className="gap-2"><Send className="w-3.5 h-3.5" />Send</TabsTrigger>
              <TabsTrigger value="logs" className="gap-2"><Activity className="w-3.5 h-3.5" />Logs</TabsTrigger>
              <TabsTrigger value="blasts" className="gap-2"><Clock className="w-3.5 h-3.5" />Auto Blasts</TabsTrigger>
              <TabsTrigger value="contacts" className="gap-2"><Phone className="w-3.5 h-3.5" />Contacts</TabsTrigger>
            </TabsList>

            {/* ── Send ────────────────────────────────────── */}
            <TabsContent value="send" className="mt-4">
              <Card className="border-border bg-card/40">
                <CardContent className="p-6 space-y-4">
                  {!isLicensedForWa && selectedTid && (
                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/8">
                      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-400">WhatsApp disabled — trial / locked tournament</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Only SMS available. Upgrade license to enable WhatsApp.</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Recipients</Label>
                      <Select
                        value={isPlayerSoldTemplate ? "sold_players" : recipientGroup}
                        onValueChange={setRecipientGroup}
                        disabled={isPlayerSoldTemplate}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          <SelectItem value="all_players">All Players</SelectItem>
                          <SelectItem value="sold_players">Sold Players</SelectItem>
                          <SelectItem value="unsold_players">Unsold Players</SelectItem>
                          <SelectItem value="all_owners">All Team Owners</SelectItem>
                          <SelectItem value="organizer">Tournament Organizer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Channel</Label>
                      <Select value={channel} onValueChange={setChannel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent className="dark">
                          <SelectItem value="sms">SMS (no consent needed)</SelectItem>
                          <SelectItem value="whatsapp" disabled={!isLicensedForWa && !!selectedTid}>
                            WhatsApp {!isLicensedForWa && selectedTid ? "(license required)" : "(consented only)"}
                          </SelectItem>
                          <SelectItem value="both" disabled={!isLicensedForWa && !!selectedTid}>
                            Both {!isLicensedForWa && selectedTid ? "(license required for WA)" : ""}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Template</Label>
                    <Select value={templateName || "__none__"} onValueChange={handleTemplateChange}>
                      <SelectTrigger><SelectValue placeholder="None (custom message)" /></SelectTrigger>
                      <SelectContent className="dark">
                        <SelectItem value="__none__">None (custom message)</SelectItem>
                        <SelectItem value="player_sold">Player Sold (DLT SMS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isPlayerSoldTemplate ? (
                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-2">
                      <p className="text-xs font-medium text-foreground">Player Sold template</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Sends the approved DLT SMS to every sold player in the selected tournament.
                        Each message is personalized with player name, team, sold amount, and app URL
                        (same variables as the automatic auction notification).
                      </p>
                      {!selectedTid && (
                        <p className="text-[11px] text-amber-400">Select a tournament above before sending.</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Message</Label>
                      <Textarea
                        value={messageContent}
                        onChange={e => setMessageContent(e.target.value)}
                        placeholder="Type your message here..."
                        className="min-h-[120px] text-sm resize-none"
                        maxLength={4096}
                      />
                      <p className="text-[11px] text-muted-foreground text-right">{messageContent.length}/4096</p>
                    </div>
                  )}

                  {sendError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{sendError}</p>
                  )}

                  {sendResult && (
                    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${sendResult.success ? "border-green-500/25 bg-green-500/8" : "border-red-500/25 bg-red-500/8"}`}>
                      {sendResult.success ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5" />}
                      <div>
                        <p className="text-xs font-bold text-green-400">
                          Sent {sendResult.sent} messages{sendResult.failed > 0 ? `, ${sendResult.failed} failed` : ""}{sendResult.stub ? " (stub mode — SMS/WhatsApp credentials not fully configured)" : ""}
                        </p>
                        {sendResult.blastId && <p className="text-[10px] text-muted-foreground mt-0.5">Blast ID: {sendResult.blastId}</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSend}
                      disabled={
                        sending
                        || (isPlayerSoldTemplate ? !selectedTid : !messageContent.trim())
                      }
                      className="gap-2"
                    >
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {isPlayerSoldTemplate ? "Send Player Sold" : "Send Messages"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Logs ─────────────────────────────────────── */}
            <TabsContent value="logs" className="mt-4">
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    className="max-w-48 h-8 text-sm"
                    placeholder="Search mobile / message"
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                  />
                  <Select value={logChannel || "all"} onValueChange={v => setLogChannel(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Channel" /></SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value="all">All channels</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={logStatus || "all"} onValueChange={v => setLogStatus(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent className="dark">
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="read">Read</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void loadLogs()}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>

                {loadingLogs ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No messages logged yet</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredLogs.map(log => (
                      <button
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/30 text-sm hover:bg-card/60 transition-colors text-left cursor-pointer"
                      >
                        <ChannelBadge channel={log.channel} />
                        <span className="font-mono text-xs text-muted-foreground w-28 flex-shrink-0">{log.recipientMobile}</span>
                        <span className="text-xs text-muted-foreground w-20 flex-shrink-0 capitalize">{log.recipientType.replace("_", " ")}</span>
                        <span className="flex-1 truncate text-xs text-foreground/80">{log.messageContent}</span>
                        <StatusBadge status={log.deliveryStatus} />
                        {log.metaMessageId && (
                          <span
                            className="hidden lg:flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 flex-shrink-0 max-w-40 truncate"
                            title={`${log.channel === "sms" ? "Message ID" : "Message SID"}: ${log.metaMessageId}`}
                          >
                            <span className="not-italic text-muted-foreground/40">{log.channel === "sms" ? "Message ID:" : "Message SID:"}</span>
                            {log.metaMessageId.length > 10 ? `${log.metaMessageId.slice(0, 10)}\u2026` : log.metaMessageId}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(log.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Auto Blasts ───────────────────────────────── */}
            <TabsContent value="blasts" className="mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Automated 24-hour pre-tournament consent blasts. Runs hourly for live-licensed tournaments with auction tomorrow.</p>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void loadBlasts()}>
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </Button>
                </div>

                {blasts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No automated blasts sent yet</p>
                    <p className="text-xs mt-1">Blasts run automatically 24 hours before licensed tournament auctions</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {blasts.map(b => (
                      <div key={b.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/30 text-sm">
                        <Megaphone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground w-28 flex-shrink-0">{b.mobile}</span>
                        <span className="text-xs text-muted-foreground">Blast date: {b.blastDate}</span>
                        <span className="flex-1" />
                        <span className="text-[10px] text-muted-foreground">{new Date(b.sentAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            {/* ── Contacts ──────────────────────────────────── */}
            <TabsContent value="contacts" className="mt-4">
              <div className="space-y-4">
                {!selectedTid ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Phone className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Select a tournament to view missing contacts</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-semibold">Missing Mobile Numbers</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Participants without a mobile number cannot receive SMS or WhatsApp communications.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => void loadContacts()}>
                          <RefreshCw className="w-3.5 h-3.5" /> Refresh
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 gap-1.5"
                          disabled={bulkDeclaring || (!missingPlayers.length && !missingOwners.length && !consentStats?.players.hasMobile && !consentStats?.owners.hasMobile)}
                          onClick={() => void handleBulkDeclare("all")}
                        >
                          {bulkDeclaring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Declare In-Person Consent (All)
                        </Button>
                      </div>
                    </div>

                    {bulkDeclareResult && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-500/25 bg-green-500/8 text-xs text-green-400">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        In-person consent recorded: {bulkDeclareResult.playerCount} player(s), {bulkDeclareResult.ownerCount} owner(s) updated.
                      </div>
                    )}

                    {loadingContacts ? (
                      <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : (
                      <div className="space-y-4">
                        {missingPlayers.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Players without mobile ({missingPlayers.length})</p>
                            <div className="space-y-1">
                              {missingPlayers.map(p => (
                                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card/30 text-sm">
                                  <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="flex-1 font-medium">{p.name}</span>
                                  {p.role && <Badge variant="outline" className="text-[10px] capitalize">{p.role}</Badge>}
                                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">No mobile</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {missingOwners.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Team owners without mobile ({missingOwners.length})</p>
                            <div className="space-y-1">
                              {missingOwners.map(o => (
                                <div key={o.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card/30 text-sm">
                                  <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="flex-1 font-medium">{o.name}</span>
                                  {o.ownerName && <span className="text-xs text-muted-foreground">{o.ownerName}</span>}
                                  <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">No mobile</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {missingPlayers.length === 0 && missingOwners.length === 0 && (
                          <div className="text-center py-12 text-muted-foreground">
                            <CheckCircle2 className="w-8 h-8 mx-auto mb-3 opacity-30 text-green-400" />
                            <p className="text-sm">All participants have mobile numbers on file.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

      {/* ── Log Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!selectedLog} onOpenChange={open => { if (!open) setSelectedLog(null); }}>
        <DialogContent className="dark max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="w-4 h-4 text-primary" />
              Message Details
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <ChannelBadge channel={selectedLog.channel} />
                <StatusBadge status={selectedLog.deliveryStatus} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recipient</p>
                  <p className="font-mono text-xs">{selectedLog.recipientMobile}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{selectedLog.recipientType.replace("_", " ")}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sent at</p>
                  <p className="text-xs">{new Date(selectedLog.sentAt).toLocaleString("en-IN")}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Message</p>
                <div className="max-h-32 overflow-y-auto overscroll-y-contain rounded border border-border/50 bg-muted/10 p-2.5">
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{selectedLog.messageContent}</p>
                </div>
              </div>

              {selectedLog.metaMessageId && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {selectedLog.channel === "sms" ? "Message ID" : "Message SID"}
                  </p>
                  <p className="font-mono text-xs break-all text-foreground/80 rounded border border-border/50 bg-muted/10 px-2.5 py-1.5">
                    {selectedLog.metaMessageId}
                  </p>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-wider text-red-400 font-semibold">Error</p>
                  <p className="text-xs text-red-300 break-all">{selectedLog.errorMessage}</p>
                </div>
              )}

              {selectedLog.templateName && (
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Template</p>
                  <p className="text-xs text-foreground/70">{selectedLog.templateName}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
