import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { EmailRichEditor } from "@/components/communication/email-rich-editor";
import {
  Activity,
  Archive,
  BarChart3,
  Check,
  CheckCircle2,
  Crown,
  Eye,
  FileText,
  Image,
  Info,
  Mail,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TabKey =
  | "dashboard"
  | "templates"
  | "pending"
  | "sent"
  | "drafts"
  | "logs"
  | "assets"
  | "settings"
  | "bulk";

function tabFromPath(path: string): TabKey {
  const clean = path.split("?")[0] ?? "";
  const segment = clean.split("/").pop() ?? "dashboard";
  if (segment === "send") return "bulk";
  const valid: TabKey[] = ["dashboard", "templates", "pending", "sent", "drafts", "logs", "assets", "settings", "bulk"];
  return valid.includes(segment as TabKey) ? (segment as TabKey) : "dashboard";
}

interface Template {
  id: string;
  name: string;
  internalKey: string;
  subject: string;
  htmlBody: string;
  footerHtml: string | null;
  signatureHtml: string | null;
  isActive: boolean;
  autoSend: boolean;
  isDraft: boolean;
  isArchived: boolean;
  eventType: string | null;
  currentVersion: number;
}

interface CommJob {
  id: string;
  status: string;
  pendingReason: string | null;
  subject: string | null;
  htmlBody: string | null;
  templateInternalKey: string | null;
  tournamentId: number | null;
  triggeredByEvent: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  sentBy: string;
  recipient: {
    recipientName: string | null;
    recipientEmail: string | null;
    recipientRole: string | null;
  } | null;
}

interface DashboardData {
  totalEmails: number;
  sentToday: number;
  pending: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  readyToSend: number;
  topTemplates: Array<{ templateKey: string; templateName: string; count: number }>;
  recentActivity: Array<{ id: string; action: string; recipientEmail: string | null; recipientName: string | null; status: string | null; createdAt: string }>;
  graphData: Array<{ date: string; sent: number; failed: number; pending: number }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    ready_to_send: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    queued: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    processing: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    delivered: "bg-green-500/15 text-green-400 border-green-500/30",
    opened: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    clicked: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    failed: "bg-red-500/15 text-red-400 border-red-500/30",
    cancelled: "bg-muted text-muted-foreground border-border",
    draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-medium uppercase tracking-wider ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

type RecipientCategory = "organiser" | "team_owner" | "player" | "group" | "custom";

export default function AdminCommunicationCenter() {
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<TabKey>(() => tabFromPath(location));

  useEffect(() => {
    if (!isLoading && isLoggedIn && !isMaster) {
      navigate("/admin");
    }
  }, [isLoading, isLoggedIn, isMaster, navigate]);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<CommJob[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true });
  const [testEmail, setTestEmail] = useState("");
  const [viewJob, setViewJob] = useState<CommJob | null>(null);
  const [editRecipient, setEditRecipient] = useState<{ jobId: string; email: string; name: string } | null>(null);

  // Send / Resend Hub State
  const [tournaments, setTournaments] = useState<Array<{ id: number; name: string }>>([]);
  const [bulkTournamentId, setBulkTournamentId] = useState("");
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>("team_owner");
  
  // Sub-modes
  const [organiserMode, setOrganiserMode] = useState<"bundle" | "welcome" | "created">("bundle");
  const [teamMode, setTeamMode] = useState<"single" | "all">("single");
  const [playerMode, setPlayerMode] = useState<"single" | "sold" | "all" | "unsold">("single");
  const [groupFilterType, setGroupFilterType] = useState<string>("team_owners");
  
  // Specific targets
  const [bulkTeamId, setBulkTeamId] = useState("");
  const [bulkPlayerId, setBulkPlayerId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  // Target data from server
  const [bulkOrganiser, setBulkOrganiser] = useState<{ id: number | null; name: string | null; email: string | null; mobile: string | null; hasEmail: boolean } | null>(null);
  const [bulkTeams, setBulkTeams] = useState<Array<{ id: number; name: string; ownerName: string | null; ownerEmail: string | null; hasEmail: boolean }>>([]);
  const [bulkPlayers, setBulkPlayers] = useState<Array<{ id: number; name: string; email: string | null; hasEmail: boolean; status: string | null }>>([]);
  const [bulkTargetTotals, setBulkTargetTotals] = useState<{
    teams: number;
    teamsWithEmail: number;
    players: number;
    playersWithEmail: number;
  } | null>(null);

  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkRecipients, setBulkRecipients] = useState<Array<{ name: string | null; email: string; role: string }>>([]);
  const [bulkOrganiserBundle, setBulkOrganiserBundle] = useState<{
    tournamentName: string;
    teamCount: number;
    ownerAppLink: string;
    organiserName: string | null;
    organiserEmail: string | null;
  } | null>(null);

  // Live Email Preview & Actions
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [bulkEmailPreview, setBulkEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSendSuccess, setTestSendSuccess] = useState<string | null>(null);
  const [adminTestEmail, setAdminTestEmail] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const apiBase = "/api/auth/admin/communication-center";

  // Parse initial query params (e.g. deep-link from tournament detail)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qTournamentId = params.get("tournamentId");
      const qTarget = params.get("target");
      const qTeamId = params.get("teamId");
      const qPlayerId = params.get("playerId");

      if (qTournamentId) setBulkTournamentId(qTournamentId);
      if (qTarget === "organiser" || qTarget === "team_owner" || qTarget === "player") {
        setRecipientCategory(qTarget as RecipientCategory);
      }
      if (qTeamId) {
        setRecipientCategory("team_owner");
        setTeamMode("single");
        setBulkTeamId(qTeamId);
      }
      if (qPlayerId) {
        setRecipientCategory("player");
        setPlayerMode("single");
        setBulkPlayerId(qPlayerId);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    const res = await fetch(`${apiBase}/dashboard`, { credentials: "include" });
    if (res.ok) setDashboard(await res.json());
  }, [apiBase]);

  const fetchTemplates = useCallback(async (drafts = false) => {
    const res = await fetch(`${apiBase}/templates?includeDrafts=${drafts}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
  }, [apiBase]);

  const fetchJobs = useCallback(async (opts?: { status?: string; statuses?: string[]; pending?: boolean }) => {
    const params = new URLSearchParams({ limit: "100" });
    if (opts?.status) params.set("status", opts.status);
    if (opts?.statuses) params.set("statuses", opts.statuses.join(","));
    if (opts?.pending) params.set("pendingReason", "email_missing");
    if (search) params.set("search", search);
    if (statusFilter !== "all" && !opts?.status && !opts?.statuses) params.set("status", statusFilter);

    const res = await fetch(`${apiBase}/jobs?${params}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
    }
  }, [apiBase, search, statusFilter]);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (search) params.set("search", search);
    const res = await fetch(`${apiBase}/logs?${params}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
    }
  }, [apiBase, search]);

  const fetchAssets = useCallback(async () => {
    const res = await fetch(`${apiBase}/assets`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setAssets(data.assets ?? []);
    }
  }, [apiBase]);

  const loadTab = useCallback(async (t: TabKey) => {
    setLoading(true);
    try {
      if (t === "dashboard") await fetchDashboard();
      else if (t === "templates") await fetchTemplates(false);
      else if (t === "drafts") await fetchTemplates(true);
      else if (t === "pending") await fetchJobs({ statuses: ["pending", "ready_to_send", "draft"] });
      else if (t === "sent") {
        if (statusFilter !== "all") {
          await fetchJobs({ status: statusFilter });
        } else {
          await fetchJobs({ statuses: ["delivered", "opened", "clicked", "failed", "queued", "processing"] });
        }
      }
      else if (t === "logs") await fetchLogs();
      else if (t === "assets") await fetchAssets();
      else if (t === "bulk") {
        await fetchTemplates(false);
        const tRes = await fetch("/api/tournaments", { credentials: "include" });
        if (tRes.ok) {
          const tData = await tRes.json();
          setTournaments(Array.isArray(tData) ? tData.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })) : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, fetchTemplates, fetchJobs, fetchLogs, fetchAssets, statusFilter]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadTab(tab);
  }, [isLoggedIn, tab, loadTab]);

  const changeTab = (t: TabKey) => {
    setTab(t);
    navigate(`/admin/communication/${t}`);
  };

  const sendJob = async (jobId: string) => {
    await fetch(`${apiBase}/jobs/${jobId}/send`, { method: "POST", credentials: "include" });
    void loadTab(tab);
  };

  const sendAllReady = async () => {
    await fetch(`${apiBase}/jobs/bulk-send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allReady: true }),
    });
    void loadTab(tab);
  };

  const retryFailed = async () => {
    await fetch(`${apiBase}/jobs/retry-failed`, { method: "POST", credentials: "include" });
    void loadTab(tab);
  };

  const saveTemplate = async () => {
    if (!editingTemplate && !templateForm.name) return;
    const url = editingTemplate
      ? `${apiBase}/templates/${editingTemplate.id}`
      : `${apiBase}/templates`;
    const method = editingTemplate ? "PUT" : "POST";
    await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...templateForm, isDraft: false }),
    });
    setEditingTemplate(null);
    setShowTemplateDialog(false);
    void loadTab("templates");
  };

  const sendTestEmail = async () => {
    if (!editingTemplate || !testEmail) return;
    await fetch(`${apiBase}/templates/${editingTemplate.id}/test`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });
  };

  // Fetch targets for selected tournament
  useEffect(() => {
    if (!bulkTournamentId) {
      setBulkOrganiser(null);
      setBulkTeams([]);
      setBulkPlayers([]);
      setBulkTargetTotals(null);
      setBulkTeamId("");
      setBulkPlayerId("");
      return;
    }
    const params = new URLSearchParams({
      tournamentId: bulkTournamentId,
      emailOnly: "true",
    });
    if (recipientCategory === "player" && playerMode === "sold") {
      params.set("playerStatus", "sold");
    }
    void fetch(`${apiBase}/bulk/targets?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d: {
        organiser?: typeof bulkOrganiser;
        teams?: typeof bulkTeams;
        players?: typeof bulkPlayers;
        totals?: typeof bulkTargetTotals;
      }) => {
        setBulkOrganiser(d.organiser ?? null);
        setBulkTeams(d.teams ?? []);
        setBulkPlayers(d.players ?? []);
        setBulkTargetTotals(d.totals ?? null);
      })
      .catch(() => {
        setBulkOrganiser(null);
        setBulkTeams([]);
        setBulkPlayers([]);
        setBulkTargetTotals(null);
      });
  }, [apiBase, bulkTournamentId, recipientCategory, playerMode]);

  // Compute effective filter configuration
  const effectiveFilter = useMemo(() => {
    const tId = bulkTournamentId ? Number(bulkTournamentId) : undefined;
    if (recipientCategory === "organiser") {
      if (organiserMode === "bundle") {
        return { type: "organiser_teams_credentials", tournamentId: tId };
      }
      return { type: "organiser", tournamentId: tId };
    }
    if (recipientCategory === "team_owner") {
      if (teamMode === "single") {
        return { type: "team", tournamentId: tId, teamId: bulkTeamId ? Number(bulkTeamId) : undefined };
      }
      return { type: "team_owners", tournamentId: tId };
    }
    if (recipientCategory === "player") {
      if (playerMode === "single") {
        return { type: "player", tournamentId: tId, playerId: bulkPlayerId ? Number(bulkPlayerId) : undefined };
      }
      if (playerMode === "sold") {
        return { type: "selected_players", tournamentId: tId };
      }
      if (playerMode === "unsold") {
        return { type: "unsold_players", tournamentId: tId };
      }
      return { type: "players", tournamentId: tId };
    }
    if (recipientCategory === "group") {
      return { type: groupFilterType, tournamentId: tId };
    }
    if (recipientCategory === "custom") {
      return { type: "custom_emails", emails: customEmail ? [customEmail] : [] };
    }
    return { type: "team_owners", tournamentId: tId };
  }, [recipientCategory, organiserMode, teamMode, playerMode, groupFilterType, bulkTournamentId, bulkTeamId, bulkPlayerId, customEmail]);

  // Intelligent Template Recommendation & Auto-selection
  useEffect(() => {
    if (!templates.length) return;
    const activeTemplates = templates.filter((t) => !t.isDraft && !t.isArchived && t.isActive);

    let recommendedKey = "";
    if (recipientCategory === "organiser") {
      if (organiserMode === "bundle") recommendedKey = "organiser_all_teams_credentials";
      else if (organiserMode === "welcome") recommendedKey = "welcome_organiser";
      else if (organiserMode === "created") recommendedKey = "tournament_created";
    } else if (recipientCategory === "team_owner") {
      recommendedKey = "welcome_team_owner";
    } else if (recipientCategory === "player") {
      if (playerMode === "sold") {
        recommendedKey = "player_sold";
      } else if (playerMode === "single") {
        const selectedPlayer = bulkPlayers.find((p) => String(p.id) === bulkPlayerId);
        recommendedKey = selectedPlayer?.status === "sold" ? "player_sold" : "player_registration";
      } else {
        recommendedKey = "player_registration";
      }
    }

    if (recommendedKey) {
      const match = activeTemplates.find((t) => t.internalKey === recommendedKey);
      if (match && match.id !== bulkTemplateId) {
        setBulkTemplateId(match.id);
      }
    } else if (!bulkTemplateId && activeTemplates[0]) {
      setBulkTemplateId(activeTemplates[0].id);
    }
  }, [recipientCategory, organiserMode, playerMode, bulkPlayerId, bulkPlayers, templates]);

  // Automatically refresh preview and recipients whenever configuration changes
  useEffect(() => {
    if (!bulkTemplateId) {
      setBulkEmailPreview(null);
      setBulkRecipients([]);
      return;
    }

    const isReady =
      (recipientCategory === "custom" && customEmail) ||
      (recipientCategory === "organiser" && bulkTournamentId) ||
      (recipientCategory === "team_owner" && (teamMode === "all" ? bulkTournamentId : (bulkTournamentId && bulkTeamId))) ||
      (recipientCategory === "player" && (playerMode !== "single" ? bulkTournamentId : (bulkTournamentId && bulkPlayerId))) ||
      (recipientCategory === "group" && bulkTournamentId);

    if (!isReady) {
      setBulkEmailPreview(null);
      setBulkRecipients([]);
      return;
    }

    let isMounted = true;
    setBulkPreviewLoading(true);

    // Fetch Preview Recipients
    fetch(`${apiBase}/bulk/preview-recipients`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(effectiveFilter),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        setBulkRecipients(data.recipients ?? []);
        setBulkOrganiserBundle(data.organiserBundle ?? null);
      })
      .catch(() => {});

    // Fetch Live Rendered Email Preview
    fetch(`${apiBase}/bulk/preview-email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: bulkTemplateId, filter: effectiveFilter }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.subject && data.html) {
          setBulkEmailPreview({ subject: data.subject, html: data.html });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setBulkPreviewLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [apiBase, bulkTemplateId, effectiveFilter, recipientCategory, teamMode, playerMode, bulkTournamentId, bulkTeamId, bulkPlayerId, customEmail]);

  const handleSendEmail = async () => {
    if (!bulkTemplateId) {
      alert("Please select an email template.");
      return;
    }
    if (!bulkRecipients.length) {
      alert("No valid recipient with an email address is selected.");
      return;
    }

    setSendingEmail(true);
    setSendSuccessMessage(null);
    try {
      const res = await fetch(`${apiBase}/bulk/queue`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: bulkTemplateId,
          filter: effectiveFilter,
          sendImmediately: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendSuccessMessage(`Successfully queued & sent to ${data.queued ?? bulkRecipients.length} recipient(s)!`);
        setTimeout(() => {
          changeTab("sent");
        }, 1200);
      } else {
        alert(data.error ?? "Failed to send email");
      }
    } catch {
      alert("An unexpected error occurred while sending email.");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendAdminTest = async () => {
    if (!bulkTemplateId || !adminTestEmail) {
      alert("Please enter a test email address.");
      return;
    }
    setTestSending(true);
    setTestSendSuccess(null);
    try {
      const res = await fetch(`${apiBase}/templates/${bulkTemplateId}/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminTestEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestSendSuccess(`Test email delivered to ${adminTestEmail}!`);
      } else {
        alert(data.error ?? "Failed to send test email");
      }
    } catch {
      alert("Error sending test email");
    } finally {
      setTestSending(false);
    }
  };

  const resendJob = async (jobId: string) => {
    setResendingId(jobId);
    try {
      const res = await fetch(`${apiBase}/jobs/${jobId}/resend`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert((data as { error?: string }).error ?? "Resend failed");
        return;
      }
      void loadTab("sent");
    } finally {
      setResendingId(null);
    }
  };

  if (isLoading || !isLoggedIn || !isMaster) {
    return (
      <AdminShell title="Communication Center">
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  const selectedTournament = tournaments.find((t) => String(t.id) === bulkTournamentId);
  const activeTemplateList = templates.filter((t) => !t.isDraft && !t.isArchived && t.isActive);

  return (
    <AdminShell title="Communication Center">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Communication Center</h1>
            <p className="text-sm text-muted-foreground">Deliver credentials, notifications, and auction updates directly to organizers, teams, and players</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipient, email, template..."
                className="w-64 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadTab(tab)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => void loadTab(tab)} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => changeTab(v as TabKey)}>
          <TabsList className="flex h-auto flex-wrap gap-1 bg-card/60 p-1 border border-border">
            <TabsTrigger value="bulk" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Send className="h-3.5 w-3.5" />Send / Resend
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5"><Mail className="h-3.5 w-3.5" />Sent History</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Pending</TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Templates</TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5"><Archive className="h-3.5 w-3.5" />Drafts</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Logs</TabsTrigger>
            <TabsTrigger value="assets" className="gap-1.5"><Image className="h-3.5 w-3.5" />Assets</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" />Settings</TabsTrigger>
          </TabsList>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: SEND / RESEND EMAIL (IMPROVISED UI/UX)
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="bulk" className="space-y-6">
            {sendSuccessMessage && (
              <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">{sendSuccessMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT COLUMN: GUIDED STEP-BY-STEP RECIPIENT CONFIGURATOR (5 COLS) */}
              <div className="space-y-5 lg:col-span-5">
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" />
                      1. Select Tournament & Recipient
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Pick tournament context and who will receive the email
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tournament Selection */}
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tournament</Label>
                      <Select
                        value={bulkTournamentId}
                        onValueChange={(v) => {
                          setBulkTournamentId(v);
                          setBulkTeamId("");
                          setBulkPlayerId("");
                        }}
                      >
                        <SelectTrigger className="mt-1 w-full bg-background/50">
                          <SelectValue placeholder="Select tournament..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tournaments.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTournament && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            ID #{selectedTournament.id}
                          </Badge>
                          {bulkTargetTotals && (
                            <>
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {bulkTargetTotals.teamsWithEmail}/{bulkTargetTotals.teams} Teams with Email
                              </Badge>
                              <Badge variant="outline" className="text-[10px] font-normal">
                                {bulkTargetTotals.playersWithEmail}/{bulkTargetTotals.players} Players with Email
                              </Badge>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Recipient Category Selector */}
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target Recipient Type</Label>
                      <div className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
                        <button
                          type="button"
                          onClick={() => setRecipientCategory("organiser")}
                          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all ${
                            recipientCategory === "organiser"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          }`}
                        >
                          <Crown className="h-3.5 w-3.5" />
                          Organiser
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientCategory("team_owner")}
                          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all ${
                            recipientCategory === "team_owner"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          }`}
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Team Owner
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientCategory("player")}
                          className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-xs font-medium transition-all ${
                            recipientCategory === "player"
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                          }`}
                        >
                          <User className="h-3.5 w-3.5" />
                          Player
                        </button>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRecipientCategory("group")}
                          className={`flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium transition-all ${
                            recipientCategory === "group"
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "bg-background/40 text-muted-foreground hover:bg-background/70"
                          }`}
                        >
                          <Users className="h-3.5 w-3.5" />
                          Target Group (Bulk)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientCategory("custom")}
                          className={`flex items-center justify-center gap-1.5 rounded-md border border-border py-1.5 text-xs font-medium transition-all ${
                            recipientCategory === "custom"
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "bg-background/40 text-muted-foreground hover:bg-background/70"
                          }`}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Direct Custom Email
                        </button>
                      </div>
                    </div>

                    {/* DYNAMIC SUB-SELECTOR BASED ON RECIPIENT TYPE */}
                    {recipientCategory === "organiser" && (
                      <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Organiser Email Mode</Label>
                          <span className="text-[11px] text-muted-foreground">Tournament Lead</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setOrganiserMode("bundle")}
                            className={`flex flex-col items-start rounded-md border p-2.5 text-left transition-all ${
                              organiserMode === "bundle"
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/50 hover:bg-accent"
                            }`}
                          >
                            <span className="text-xs font-semibold text-foreground">📦 All Teams Credentials Bundle</span>
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Sends full team roster, access codes, owner app links, and WhatsApp copy blocks to organiser
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrganiserMode("welcome")}
                            className={`flex flex-col items-start rounded-md border p-2.5 text-left transition-all ${
                              organiserMode === "welcome"
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/50 hover:bg-accent"
                            }`}
                          >
                            <span className="text-xs font-semibold text-foreground">👑 Welcome Organiser Account</span>
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Welcome email with organiser dashboard access & login link
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrganiserMode("created")}
                            className={`flex flex-col items-start rounded-md border p-2.5 text-left transition-all ${
                              organiserMode === "created"
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/50 hover:bg-accent"
                            }`}
                          >
                            <span className="text-xs font-semibold text-foreground">🏆 Tournament Created Confirmation</span>
                            <span className="text-[11px] text-muted-foreground mt-0.5">
                              Confirms tournament setup, venue, and auction date
                            </span>
                          </button>
                        </div>

                        {bulkOrganiser && (
                          <div className="mt-2 rounded-md border border-border/80 bg-background/80 p-2.5 text-xs">
                            <div className="flex items-center justify-between font-medium">
                              <span>{bulkOrganiser.name || "Tournament Organiser"}</span>
                              {bulkOrganiser.hasEmail ? (
                                <Badge className="bg-green-500/15 text-green-400 text-[10px]">Email Valid</Badge>
                              ) : (
                                <Badge className="bg-red-500/15 text-red-400 text-[10px]">No Email on File</Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mt-0.5">{bulkOrganiser.email || "No email available"}</p>
                            {bulkOrganiser.mobile && <p className="text-muted-foreground text-[11px]">📱 {bulkOrganiser.mobile}</p>}
                          </div>
                        )}
                      </div>
                    )}

                    {recipientCategory === "team_owner" && (
                      <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={teamMode === "single" ? "default" : "outline"}
                            className="flex-1 text-xs"
                            onClick={() => setTeamMode("single")}
                          >
                            Single Team Owner
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={teamMode === "all" ? "default" : "outline"}
                            className="flex-1 text-xs"
                            onClick={() => setTeamMode("all")}
                          >
                            All Team Owners ({bulkTeams.length})
                          </Button>
                        </div>

                        {teamMode === "single" && (
                          <div>
                            <Label className="text-xs font-semibold">Select Team (with email on file)</Label>
                            <Select value={bulkTeamId} onValueChange={(v) => setBulkTeamId(v)}>
                              <SelectTrigger className="mt-1 w-full bg-background/50">
                                <SelectValue placeholder={bulkTeams.length ? "Pick a team..." : "No teams with email"} />
                              </SelectTrigger>
                              <SelectContent>
                                {bulkTeams.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.name} — {t.ownerName ?? "Owner"} ({t.ownerEmail ?? "No email"})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {teamMode === "all" && (
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Sends individual welcome emails containing team login credentials & owner app links to all <strong className="text-foreground">{bulkTeams.length}</strong> team owners with email.
                          </p>
                        )}
                      </div>
                    )}

                    {recipientCategory === "player" && (
                      <div className="space-y-3 rounded-lg border border-border bg-card/60 p-3">
                        <div className="grid grid-cols-2 gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={playerMode === "single" ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => setPlayerMode("single")}
                          >
                            Single Player
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={playerMode === "sold" ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => setPlayerMode("sold")}
                          >
                            Sold Players Only
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={playerMode === "all" ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => setPlayerMode("all")}
                          >
                            All Players
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={playerMode === "unsold" ? "default" : "outline"}
                            className="text-xs"
                            onClick={() => setPlayerMode("unsold")}
                          >
                            Unsold Players
                          </Button>
                        </div>

                        {playerMode === "single" && (
                          <div>
                            <Label className="text-xs font-semibold">Select Player</Label>
                            <Select value={bulkPlayerId} onValueChange={(v) => setBulkPlayerId(v)}>
                              <SelectTrigger className="mt-1 w-full bg-background/50">
                                <SelectValue placeholder={bulkPlayers.length ? "Pick a player..." : "No players with email"} />
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {bulkPlayers.map((p) => (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.name} {p.status ? `[${p.status.toUpperCase()}]` : ""} — {p.email ?? "No email"}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {playerMode !== "single" && (
                          <p className="text-xs text-muted-foreground">
                            Target filter: <strong className="text-foreground">{playerMode.toUpperCase()} PLAYERS</strong> with valid email addresses.
                          </p>
                        )}
                      </div>
                    )}

                    {recipientCategory === "group" && (
                      <div className="space-y-2 rounded-lg border border-border bg-card/60 p-3">
                        <Label className="text-xs font-semibold">Select Group Filter</Label>
                        <Select value={groupFilterType} onValueChange={setGroupFilterType}>
                          <SelectTrigger className="w-full bg-background/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="team_owners">All Team Owners</SelectItem>
                            <SelectItem value="selected_players">Sold Players (with email)</SelectItem>
                            <SelectItem value="players">All Players (with email)</SelectItem>
                            <SelectItem value="unsold_players">Unsold Players (with email)</SelectItem>
                            <SelectItem value="men">Men Players (with email)</SelectItem>
                            <SelectItem value="women">Women Players (with email)</SelectItem>
                            <SelectItem value="organisers">All Organisers Platform-Wide</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {recipientCategory === "custom" && (
                      <div className="space-y-2.5 rounded-lg border border-border bg-card/60 p-3">
                        <div>
                          <Label className="text-xs">Recipient Name (Optional)</Label>
                          <Input
                            placeholder="John Doe"
                            className="mt-1 bg-background/50 text-xs"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Email Address *</Label>
                          <Input
                            placeholder="recipient@example.com"
                            className="mt-1 bg-background/50 text-xs"
                            value={customEmail}
                            onChange={(e) => setCustomEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* TEMPLATE SELECTION CARD */}
                <Card className="border-border bg-card/80 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      2. Select Email Template
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Template automatically matches recipient type, or choose a custom template
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
                        <SelectTrigger className="w-full bg-background/50 font-medium">
                          <SelectValue placeholder="Select template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {activeTemplateList.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name} <span className="font-mono text-[10px] text-muted-foreground">({t.internalKey})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Recipient summary badge */}
                    <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Resolved Recipients:</span>
                      <Badge variant={bulkRecipients.length > 0 ? "default" : "secondary"}>
                        {bulkRecipients.length} Recipient{bulkRecipients.length === 1 ? "" : "s"} Ready
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN: LIVE INTERACTIVE SAMPLE EMAIL PREVIEW & ACTIONS (7 COLS) */}
              <div className="space-y-5 lg:col-span-7">
                <Card className="border-border bg-card/80 backdrop-blur-sm flex flex-col h-full">
                  <CardHeader className="pb-3 border-b border-border/60">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Eye className="h-4 w-4 text-primary" />
                          Live Email Preview
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Exact sample email as it will appear in the recipient's inbox
                        </CardDescription>
                      </div>

                      {/* Desktop / Mobile Switcher */}
                      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2.5 text-xs gap-1.5 ${previewDevice === "desktop" ? "bg-background shadow-xs font-semibold text-foreground" : "text-muted-foreground"}`}
                          onClick={() => setPreviewDevice("desktop")}
                        >
                          <Monitor className="h-3.5 w-3.5" />
                          Desktop
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={`h-7 px-2.5 text-xs gap-1.5 ${previewDevice === "mobile" ? "bg-background shadow-xs font-semibold text-foreground" : "text-muted-foreground"}`}
                          onClick={() => setPreviewDevice("mobile")}
                        >
                          <Smartphone className="h-3.5 w-3.5" />
                          Mobile
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4 flex-1 flex flex-col">
                    {/* EMAIL ENVELOPE METADATA */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs">
                      <div className="flex gap-2">
                        <span className="w-16 font-semibold text-muted-foreground">From:</span>
                        <span className="text-foreground">BidWar Notifications &lt;notifications@bidwar.in&gt;</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-16 font-semibold text-muted-foreground">To:</span>
                        <span className="font-medium text-foreground">
                          {bulkRecipients.length === 1 ? (
                            `${bulkRecipients[0].name ? `${bulkRecipients[0].name} ` : ""}<${bulkRecipients[0].email}>`
                          ) : bulkRecipients.length > 1 ? (
                            `${bulkRecipients.length} recipients (${bulkRecipients[0].email}, ${bulkRecipients[1].email}...)`
                          ) : (
                            <span className="italic text-muted-foreground">No recipient selected</span>
                          )}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <span className="w-16 font-semibold text-muted-foreground">Subject:</span>
                        <span className="font-semibold text-foreground">
                          {bulkEmailPreview?.subject || <span className="text-muted-foreground italic">Subject will appear here...</span>}
                        </span>
                      </div>
                    </div>

                    {/* EMAIL HTML CONTAINER */}
                    <div className="flex-1 min-h-[420px] max-h-[580px] overflow-auto rounded-lg border border-border/80 bg-neutral-900/40 p-4 flex items-center justify-center">
                      {bulkPreviewLoading ? (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs">Generating realistic email sample...</span>
                        </div>
                      ) : bulkEmailPreview?.html ? (
                        <div
                          className={`transition-all duration-300 bg-white text-black shadow-lg overflow-auto ${
                            previewDevice === "mobile"
                              ? "w-[375px] max-w-full rounded-2xl border-4 border-neutral-800 p-3 my-2"
                              : "w-full rounded-lg p-6"
                          }`}
                          dangerouslySetInnerHTML={{ __html: bulkEmailPreview.html }}
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center text-muted-foreground max-w-sm">
                          <Mail className="h-8 w-8 text-muted-foreground/40" />
                          <p className="text-sm font-medium">No Preview Available</p>
                          <p className="text-xs">Select a tournament, recipient target, and template on the left to see the live rendered email sample.</p>
                        </div>
                      )}
                    </div>

                    {/* ACTIONS & TEST SEND DRAWER */}
                    <div className="border-t border-border/60 pt-4 space-y-3">
                      {testSendSuccess && (
                        <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/30 p-2.5 text-xs text-green-400">
                          <Check className="h-4 w-4 shrink-0" />
                          <span>{testSendSuccess}</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Inline Admin Test Email */}
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            placeholder="admin@yourdomain.com"
                            className="h-9 text-xs bg-background/50 max-w-xs"
                            value={adminTestEmail}
                            onChange={(e) => setAdminTestEmail(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs shrink-0"
                            disabled={testSending || !adminTestEmail || !bulkTemplateId}
                            onClick={() => void handleSendAdminTest()}
                          >
                            {testSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                            Send Test Email
                          </Button>
                        </div>

                        {/* Primary Send / Resend Email Button */}
                        <Button
                          type="button"
                          className="h-10 px-6 font-semibold shadow-md gap-2"
                          disabled={sendingEmail || !bulkTemplateId || bulkRecipients.length === 0}
                          onClick={() => void handleSendEmail()}
                        >
                          {sendingEmail ? (
                            <>
                              <RefreshCw className="h-4 w-4 animate-spin" />
                              Sending Email...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4" />
                              Send to {bulkRecipients.length || 0} Recipient{bulkRecipients.length === 1 ? "" : "s"}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: SENT HISTORY
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="sent" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48 bg-card"><SelectValue placeholder="Filter status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Delivered & Active</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="queued">Queued</SelectItem>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="clicked">Clicked</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void fetchJobs({ status: statusFilter === "all" ? undefined : statusFilter })}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
                </Button>
              </div>
            </div>
            <JobsTable
              jobs={jobs}
              onSend={sendJob}
              onView={setViewJob}
              onResend={resendJob}
              resendingId={resendingId}
              showSent
              onEditRecipient={(j) => setEditRecipient({
                jobId: j.id,
                email: j.recipient?.recipientEmail ?? "",
                name: j.recipient?.recipientName ?? "",
              })}
            />
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: PENDING
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="pending" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => void sendAllReady()}><Send className="mr-1 h-4 w-4" />Send All Ready</Button>
              <Button variant="outline" onClick={() => void retryFailed()}><RotateCcw className="mr-1 h-4 w-4" />Retry Failed</Button>
            </div>
            <JobsTable
              jobs={jobs}
              onSend={sendJob}
              onView={setViewJob}
              onResend={resendJob}
              resendingId={resendingId}
              onEditRecipient={(j) => setEditRecipient({
                jobId: j.id,
                email: j.recipient?.recipientEmail ?? "",
                name: j.recipient?.recipientName ?? "",
              })}
            />
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: TEMPLATES (CLEANED UP PRODUCTION TEMPLATES)
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold">Active Email Templates</h2>
                <p className="text-xs text-muted-foreground">Standard production templates used across platform events and resending.</p>
              </div>
              <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true }); setShowTemplateDialog(true); }}>
                New Template
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Internal Key</TableHead>
                      <TableHead>Auto Send</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.filter((t) => !t.isDraft && !t.isArchived).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs">{t.internalKey}</TableCell>
                        <TableCell>
                          <Badge variant={t.autoSend ? "default" : "secondary"} className="text-[10px]">
                            {t.autoSend ? "AUTO" : "MANUAL"}
                          </Badge>
                        </TableCell>
                        <TableCell>{t.isActive ? <Badge className="bg-green-500/15 text-green-400">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell>v{t.currentVersion}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTemplate(t); setTemplateForm({ name: t.name, internalKey: t.internalKey, subject: t.subject, htmlBody: t.htmlBody, autoSend: t.autoSend, isActive: t.isActive }); setShowTemplateDialog(true); }}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: DASHBOARD
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="dashboard" className="space-y-4">
            {loading || !dashboard ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total Emails", value: dashboard.totalEmails },
                    { label: "Sent Today", value: dashboard.sentToday },
                    { label: "Pending", value: dashboard.pending },
                    { label: "Ready to Send", value: dashboard.readyToSend },
                    { label: "Delivered", value: dashboard.delivered },
                    { label: "Failed", value: dashboard.failed },
                    { label: "Opened", value: dashboard.opened },
                    { label: "Bounced", value: dashboard.bounced },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{s.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Communication Graph (14 days)</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.graphData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="sent" fill="#22c55e" name="Sent" />
                          <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                          <Bar dataKey="pending" fill="#eab308" name="Pending" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Top Templates</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboard.topTemplates.map((t) => (
                          <div key={t.templateKey} className="flex justify-between text-sm">
                            <span>{t.templateName}</span>
                            <Badge variant="secondary">{t.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.recentActivity.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{a.action}</TableCell>
                            <TableCell className="text-xs">{a.recipientName ?? a.recipientEmail ?? "—"}</TableCell>
                            <TableCell>{a.status ? <StatusBadge status={a.status} /> : "—"}</TableCell>
                            <TableCell className="text-xs">{formatDate(a.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: DRAFTS
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="drafts">
            <JobsTable jobs={templates.filter((t) => t.isDraft).map((t) => ({
              id: t.id,
              status: "draft",
              pendingReason: null,
              subject: t.subject,
              htmlBody: t.htmlBody,
              templateInternalKey: t.internalKey,
              tournamentId: null,
              triggeredByEvent: null,
              retryCount: 0,
              sentAt: null,
              createdAt: "",
              sentBy: "admin",
              recipient: null,
            }))} onSend={() => {}} onView={() => {}} />
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: LOGS
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell className="text-xs">{String(l.action)}</TableCell>
                        <TableCell className="text-xs">{String(l.recipientEmail ?? l.recipientName ?? "—")}</TableCell>
                        <TableCell className="text-xs">{String(l.previousStatus ?? "")} → {String(l.newStatus ?? "")}</TableCell>
                        <TableCell className="text-xs">{String(l.createdBy ?? "—")}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(l.createdAt))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: ASSETS
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="assets">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Content</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={String(a.id)}>
                        <TableCell>{String(a.name)}</TableCell>
                        <TableCell className="font-mono text-xs">{String(a.assetKey)}</TableCell>
                        <TableCell>{String(a.assetType)}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">{String(a.content)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB: SETTINGS
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>Communication Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>Email delivery uses the queue worker with exponential retry (max 5 attempts).</p>
                <p>Configure <code>EMAIL_ENABLED</code>, <code>RESEND_API_KEY</code>, and <code>MAIL_FROM</code> in environment variables.</p>
                <p>Worker poll interval: <code>COMMUNICATION_WORKER_POLL_MS</code> (default 5000ms).</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* TEMPLATE EDITOR DIALOG */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Name</Label><Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Internal Key</Label><Input value={templateForm.internalKey} onChange={(e) => setTemplateForm((f) => ({ ...f, internalKey: e.target.value }))} disabled={!!editingTemplate} /></div>
            </div>
            <div><Label>Subject</Label><Input value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={templateForm.autoSend} onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, autoSend: v }))} /><Label>Auto Send</Label></div>
              <div className="flex items-center gap-2"><Switch checked={templateForm.isActive} onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
            </div>
            <EmailRichEditor value={templateForm.htmlBody} onChange={(html) => setTemplateForm((f) => ({ ...f, htmlBody: html }))} previewSubject={templateForm.subject} />
            {editingTemplate && (
              <div className="flex gap-2">
                <Input placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                <Button variant="outline" onClick={() => void sendTestEmail()}>Send Test</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTemplateDialog(false); setEditingTemplate(null); }}>Cancel</Button>
            <Button onClick={() => void saveTemplate()}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VIEW EMAIL MODAL WITH ONE-CLICK RESEND ACTION */}
      <Dialog open={!!viewJob} onOpenChange={() => setViewJob(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg">Email Job Details</DialogTitle>
              {viewJob && <StatusBadge status={viewJob.status} />}
            </div>
            <DialogDescription className="text-xs">
              Review sent email content, recipient metadata, and resend option
            </DialogDescription>
          </DialogHeader>
          {viewJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Recipient:</span>
                  <div className="font-semibold text-foreground">
                    {viewJob.recipient?.recipientName || "—"} ({viewJob.recipient?.recipientRole || "custom"})
                  </div>
                  <div className="text-muted-foreground">{viewJob.recipient?.recipientEmail || "No email"}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Template & Time:</span>
                  <div className="font-mono text-foreground">{viewJob.templateInternalKey || "Custom"}</div>
                  <div className="text-muted-foreground">{formatDate(viewJob.sentAt || viewJob.createdAt)}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Subject Line</Label>
                <div className="font-semibold text-sm mt-0.5">{viewJob.subject}</div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Rendered Content</Label>
                <div className="max-h-96 overflow-auto rounded-lg border bg-white p-4 text-black shadow-inner" dangerouslySetInnerHTML={{ __html: viewJob.htmlBody ?? "" }} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setViewJob(null)}>Close</Button>
            {viewJob && viewJob.recipient?.recipientEmail && (
              <Button
                disabled={resendingId === viewJob.id}
                onClick={async () => {
                  if (!viewJob) return;
                  await resendJob(viewJob.id);
                  setViewJob(null);
                }}
              >
                <RotateCcw className={`h-4 w-4 mr-1.5 ${resendingId === viewJob.id ? "animate-spin" : ""}`} />
                Resend Email to {viewJob.recipient.recipientName ?? "Recipient"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT RECIPIENT DIALOG */}
      <Dialog open={!!editRecipient} onOpenChange={() => setEditRecipient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Recipient</DialogTitle></DialogHeader>
          {editRecipient && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editRecipient.name} onChange={(e) => setEditRecipient((r) => r ? { ...r, name: e.target.value } : null)} /></div>
              <div><Label>Email</Label><Input value={editRecipient.email} onChange={(e) => setEditRecipient((r) => r ? { ...r, email: e.target.value } : null)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={async () => {
              if (!editRecipient) return;
              await fetch(`${apiBase}/jobs/${editRecipient.jobId}/recipient`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientEmail: editRecipient.email, recipientName: editRecipient.name }),
              });
              setEditRecipient(null);
              void loadTab(tab);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function JobsTable({
  jobs,
  onSend,
  onView,
  onEditRecipient,
  onResend,
  resendingId,
  showSent,
}: {
  jobs: CommJob[];
  onSend: (id: string) => void;
  onView: (job: CommJob) => void;
  onEditRecipient?: (job: CommJob) => void;
  onResend?: (id: string) => void;
  resendingId?: string | null;
  showSent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                  No communication records found.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell>
                    <div className="text-sm font-medium">{j.recipient?.recipientName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{j.recipient?.recipientEmail ?? "No email"}</div>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{j.recipient?.recipientRole?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{j.templateInternalKey ?? "—"}</TableCell>
                  <TableCell className="text-xs">{formatDate(j.createdAt)}</TableCell>
                  <TableCell className="text-xs">{j.pendingReason?.replace(/_/g, " ") ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={j.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!showSent && (j.status === "ready_to_send" || j.status === "pending") && (
                        <Button size="sm" variant="ghost" title="Send now" aria-label="Send now" onClick={() => onSend(j.id)}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => onView(j)} title="View Details">
                        View
                      </Button>
                      {showSent && onResend && j.recipient?.recipientEmail && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Resend email"
                          aria-label="Resend email"
                          disabled={resendingId === j.id}
                          onClick={() => onResend(j.id)}
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${resendingId === j.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      {onEditRecipient && (!showSent || j.status === "failed" || !j.recipient?.recipientEmail) && (
                        <Button size="sm" variant="ghost" title="Edit recipient" onClick={() => onEditRecipient(j)}>Edit</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Super Admin only — embed on platform admin profile pages, never in the organiser panel. */
export function CommunicationHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [history, setHistory] = useState<CommJob[]>([]);

  useEffect(() => {
    void fetch(`/api/auth/admin/communication-center/history/${entityType}/${entityId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []));
  }, [entityType, entityId]);

  if (!history.length) return <p className="text-sm text-muted-foreground">No communication history.</p>;

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <div>
            <div className="font-medium">{h.templateInternalKey ?? h.triggeredByEvent ?? "Email"}</div>
            <div className="text-xs text-muted-foreground">{formatDate(h.sentAt ?? h.createdAt)}</div>
          </div>
          <StatusBadge status={h.status} />
        </div>
      ))}
    </div>
  );
}
