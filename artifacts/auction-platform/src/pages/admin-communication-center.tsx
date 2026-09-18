import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { EmailRichEditor } from "@/components/communication/email-rich-editor";
import {
  Activity,
  Archive,
  ArrowRight,
  BarChart3,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Image,
  Info,
  Lock,
  Mail,
  Megaphone,
  MessageSquare,
  Monitor,
  Phone,
  QrCode,
  Radio,
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
  Wifi,
  WifiOff,
  XCircle,
  AlertTriangle,
  BadgeCheck,
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
import { Textarea } from "@/components/ui/textarea";
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

type MainTabKey = "overview" | "email" | "sms" | "whatsapp" | "contacts" | "settings";
type EmailSubTab = "compose" | "sent" | "pending" | "drafts" | "templates" | "assets";

function tabFromPath(path: string): { main: MainTabKey; emailSub?: EmailSubTab } {
  const clean = path.split("?")[0] ?? "";
  const segment = clean.split("/").pop() ?? "overview";
  
  if (segment === "overview" || segment === "dashboard") return { main: "overview" };
  if (segment === "sms") return { main: "sms" };
  if (segment === "whatsapp") return { main: "whatsapp" };
  if (segment === "contacts") return { main: "contacts" };
  if (segment === "settings") return { main: "settings" };
  
  // Email subroutes
  if (segment === "email" || segment === "bulk" || segment === "send") return { main: "email", emailSub: "compose" };
  if (segment === "sent") return { main: "email", emailSub: "sent" };
  if (segment === "pending") return { main: "email", emailSub: "pending" };
  if (segment === "drafts") return { main: "email", emailSub: "drafts" };
  if (segment === "templates") return { main: "email", emailSub: "templates" };
  if (segment === "assets") return { main: "email", emailSub: "assets" };
  if (segment === "logs") return { main: "overview" };
  
  return { main: "overview" };
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

interface ConsentStats {
  players: { total: number; consented: number; hasMobile: number };
  owners: { total: number; consented: number; hasMobile: number };
}

interface TournamentItem {
  id: number;
  name: string;
  sport?: string;
  licenseStatus?: string;
  adminLocked?: boolean;
}

interface MissingContact {
  id: number;
  name: string;
  role?: string | null;
  ownerName?: string | null;
  mobile?: string | null;
  email?: string | null;
}

interface SmsSettingsData {
  dltEnabled: boolean;
  teamOwnerEnabled: boolean;
  teamOwnerTemplateId: string | null;
  teamOwnerTemplateIdFromEnv?: string | null;
  playerSoldEnabled: boolean;
  playerSoldTemplateId: string | null;
  playerSoldTemplateIdFromEnv?: string | null;
  viewerLinkEnabled: boolean;
  viewerLinkTemplateId: string | null;
  viewerLinkTemplateIdFromEnv?: string | null;
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
    sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    read: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
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
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const [location, navigate] = useLocation();
  
  const parsed = tabFromPath(location);
  const [activeTab, setActiveTab] = useState<MainTabKey>(parsed.main);
  const [emailSubTab, setEmailSubTab] = useState<EmailSubTab>(parsed.emailSub ?? "compose");

  // Multi-channel general states
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Email state
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<CommJob[]>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true });
  const [testEmail, setTestEmail] = useState("");
  const [viewJob, setViewJob] = useState<CommJob | null>(null);
  const [editRecipient, setEditRecipient] = useState<{ jobId: string; email: string; name: string } | null>(null);

  // Email Send / Resend Form
  const [recipientCategory, setRecipientCategory] = useState<RecipientCategory>("team_owner");
  const [organiserMode, setOrganiserMode] = useState<"bundle" | "welcome" | "created">("bundle");
  const [teamMode, setTeamMode] = useState<"single" | "all">("single");
  const [playerMode, setPlayerMode] = useState<"single" | "sold" | "all" | "unsold">("single");
  const [groupFilterType, setGroupFilterType] = useState<string>("team_owners");
  const [bulkTeamId, setBulkTeamId] = useState("");
  const [bulkPlayerId, setBulkPlayerId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

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
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [bulkEmailPreview, setBulkEmailPreview] = useState<{ subject: string; html: string } | null>(null);
  const [bulkPreviewLoading, setBulkPreviewLoading] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendSuccessMessage, setSendSuccessMessage] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSendSuccess, setTestSendSuccess] = useState<string | null>(null);
  const [adminTestEmail, setAdminTestEmail] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);

  // SMS State
  const [smsRecipientGroup, setSmsRecipientGroup] = useState("all_players");
  const [smsTemplateKey, setSmsTemplateKey] = useState("player_sold");
  const [smsCustomText, setSmsCustomText] = useState("");
  const [smsCustomMobile, setSmsCustomMobile] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsSendResult, setSmsSendResult] = useState<{ success: boolean; sent: number; failed: number; stub?: boolean; error?: string } | null>(null);
  const [smsLogs, setSmsLogs] = useState<CommLog[]>([]);
  const [smsBlasts, setSmsBlasts] = useState<BlastEntry[]>([]);
  const [loadingSmsLogs, setLoadingSmsLogs] = useState(false);

  // WhatsApp State
  const [waRecipientGroup, setWaRecipientGroup] = useState("all_players");
  const [waTemplateKey, setWaTemplateKey] = useState("player_sold");
  const [waCustomText, setWaCustomText] = useState("");
  const [waCustomMobile, setWaCustomMobile] = useState("");
  const [waSending, setSendingWa] = useState(false);
  const [waSendResult, setWaSendResult] = useState<{ success: boolean; sent: number; failed: number; stub?: boolean; error?: string } | null>(null);
  const [waLogs, setWaLogs] = useState<CommLog[]>([]);
  const [loadingWaLogs, setLoadingWaLogs] = useState(false);
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [bulkDeclaring, setBulkDeclaring] = useState(false);
  const [bulkDeclareResult, setBulkDeclareResult] = useState<{ playerCount: number; ownerCount: number } | null>(null);
  const [botLink, setBotLink] = useState<{ link: string | null; configured: boolean } | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Contacts State
  const [missingPlayers, setMissingPlayers] = useState<MissingContact[]>([]);
  const [missingOwners, setMissingOwners] = useState<MissingContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [savingContactId, setSavingContactId] = useState<number | null>(null);
  const [inputMobile, setInputMobile] = useState<Record<number, string>>({});

  // Settings State
  const [smsSettings, setSmsSettings] = useState<SmsSettingsData>({
    dltEnabled: false,
    teamOwnerEnabled: false,
    teamOwnerTemplateId: null,
    playerSoldEnabled: false,
    playerSoldTemplateId: null,
    viewerLinkEnabled: false,
    viewerLinkTemplateId: null,
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState<string | null>(null);

  const apiBase = "/api/auth/admin/communication-center";

  // Sync route
  useEffect(() => {
    const p = tabFromPath(location);
    setActiveTab(p.main);
    if (p.emailSub) setEmailSubTab(p.emailSub);
  }, [location]);

  const handleTabChange = (val: string) => {
    const k = val as MainTabKey;
    setActiveTab(k);
    if (k === "email") {
      navigate(`/admin/communication/${emailSubTab}`);
    } else {
      navigate(`/admin/communication/${k}`);
    }
  };

  const handleEmailSubTabChange = (val: string) => {
    const k = val as EmailSubTab;
    setEmailSubTab(k);
    navigate(`/admin/communication/${k}`);
  };

  // Load Tournaments
  const loadTournaments = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/admin/tournaments?limit=200", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        const list = Array.isArray(d) ? d : (d.tournaments ?? []);
        setTournaments(list);
        if (list.length > 0 && !selectedTournamentId) {
          setSelectedTournamentId(String(list[0].id));
        }
      }
    } catch {
      // ignore
    }
  }, [selectedTournamentId]);

  // Load Overview Data
  const loadDashboard = useCallback(async () => {
    try {
      const tParam = selectedTournamentId ? `?tournamentId=${selectedTournamentId}` : "";
      const res = await fetch(`${apiBase}/dashboard${tParam}`, { credentials: "include" });
      if (res.ok) setDashboard(await res.json());
    } catch {
      // ignore
    }
  }, [apiBase, selectedTournamentId]);

  // Load Email Templates & Jobs
  const loadTemplates = useCallback(async (drafts = false) => {
    try {
      const res = await fetch(`${apiBase}/templates?includeDrafts=${drafts}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      }
    } catch {
      // ignore
    }
  }, [apiBase]);

  const loadJobs = useCallback(async (opts?: { status?: string; statuses?: string[]; pending?: boolean }) => {
    try {
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
    } catch {
      // ignore
    }
  }, [apiBase, search, statusFilter]);

  // Load SMS Logs
  const loadSmsLogs = useCallback(async () => {
    setLoadingSmsLogs(true);
    try {
      const params = new URLSearchParams({ channel: "sms" });
      if (selectedTournamentId && selectedTournamentId !== "__all__") params.set("tournamentId", selectedTournamentId);
      const res = await fetch(`/api/auth/admin/communicate/logs?${params}`, { credentials: "include" });
      if (res.ok) setSmsLogs(await res.json());

      const bRes = await fetch(`/api/auth/admin/communicate/blasts?${params}`, { credentials: "include" });
      if (bRes.ok) setSmsBlasts(await bRes.json());
    } catch {
      // ignore
    } finally {
      setLoadingSmsLogs(false);
    }
  }, [selectedTournamentId]);

  // Load WhatsApp Logs & Consent
  const loadWaData = useCallback(async () => {
    setLoadingWaLogs(true);
    try {
      const params = new URLSearchParams({ channel: "whatsapp" });
      if (selectedTournamentId && selectedTournamentId !== "__all__") params.set("tournamentId", selectedTournamentId);
      const res = await fetch(`/api/auth/admin/communicate/logs?${params}`, { credentials: "include" });
      if (res.ok) setWaLogs(await res.json());

      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        const cRes = await fetch(`/api/auth/admin/communicate/consent-status/${selectedTournamentId}`, { credentials: "include" });
        if (cRes.ok) setConsentStats(await cRes.json());
      } else {
        setConsentStats(null);
      }

      const linkRes = await fetch("/api/consent/wa-link", { credentials: "include" });
      if (linkRes.ok) setBotLink(await linkRes.json());
    } catch {
      // ignore
    } finally {
      setLoadingWaLogs(false);
    }
  }, [selectedTournamentId]);

  // Load Missing Contacts
  const loadContacts = useCallback(async () => {
    if (!selectedTournamentId || selectedTournamentId === "__all__") {
      setMissingPlayers([]);
      setMissingOwners([]);
      return;
    }
    setLoadingContacts(true);
    try {
      const res = await fetch(`/api/auth/admin/communicate/missing-contacts/${selectedTournamentId}`, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setMissingPlayers(d.missingPlayers ?? []);
        setMissingOwners(d.missingOwners ?? []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingContacts(false);
    }
  }, [selectedTournamentId]);

  // Load Settings
  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch("/api/auth/admin/sms-settings", { credentials: "include" });
      if (res.ok) setSmsSettings(await res.json());
    } catch {
      // ignore
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  // Initial Boot
  useEffect(() => {
    if (isLoggedIn) {
      void loadTournaments();
      setLoading(false);
    }
  }, [isLoggedIn, loadTournaments]);

  // Reactive Data Refresh based on active tab
  useEffect(() => {
    if (!isLoggedIn) return;
    if (activeTab === "overview") {
      void loadDashboard();
    } else if (activeTab === "email") {
      void loadTemplates(emailSubTab === "drafts");
      if (emailSubTab === "sent") void loadJobs({ status: "delivered" });
      else if (emailSubTab === "pending") void loadJobs({ pending: true });
      else if (emailSubTab === "compose") void loadTemplates(false);
    } else if (activeTab === "sms") {
      void loadSmsLogs();
      void loadSettings();
    } else if (activeTab === "whatsapp") {
      void loadWaData();
    } else if (activeTab === "contacts") {
      void loadContacts();
    } else if (activeTab === "settings") {
      void loadSettings();
    }
  }, [activeTab, emailSubTab, isLoggedIn, selectedTournamentId, loadDashboard, loadTemplates, loadJobs, loadSmsLogs, loadWaData, loadContacts, loadSettings]);

  // Fetch Email Targets
  useEffect(() => {
    if (!selectedTournamentId || selectedTournamentId === "__all__") {
      setBulkOrganiser(null);
      setBulkTeams([]);
      setBulkPlayers([]);
      setBulkTargetTotals(null);
      setBulkTeamId("");
      setBulkPlayerId("");
      return;
    }
    const params = new URLSearchParams({
      tournamentId: selectedTournamentId,
      emailOnly: "true",
    });
    if (recipientCategory === "player" && playerMode === "sold") {
      params.set("playerStatus", "sold");
    }
    void fetch(`${apiBase}/bulk/targets?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
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
  }, [apiBase, selectedTournamentId, recipientCategory, playerMode]);

  // Compute effective filter configuration for Email
  const effectiveFilter = useMemo(() => {
    const tId = selectedTournamentId && selectedTournamentId !== "__all__" ? Number(selectedTournamentId) : undefined;
    if (recipientCategory === "organiser") {
      if (organiserMode === "bundle") return { type: "organiser_teams_credentials", tournamentId: tId };
      return { type: "organiser", tournamentId: tId };
    }
    if (recipientCategory === "team_owner") {
      if (teamMode === "single") return { type: "team", tournamentId: tId, teamId: bulkTeamId ? Number(bulkTeamId) : undefined };
      return { type: "team_owners", tournamentId: tId };
    }
    if (recipientCategory === "player") {
      if (playerMode === "single") return { type: "player", tournamentId: tId, playerId: bulkPlayerId ? Number(bulkPlayerId) : undefined };
      if (playerMode === "sold") return { type: "selected_players", tournamentId: tId };
      if (playerMode === "unsold") return { type: "unsold_players", tournamentId: tId };
      return { type: "players", tournamentId: tId };
    }
    if (recipientCategory === "group") return { type: groupFilterType, tournamentId: tId };
    if (recipientCategory === "custom") return { type: "custom_emails", emails: customEmail ? [customEmail] : [] };
    return { type: "team_owners", tournamentId: tId };
  }, [recipientCategory, organiserMode, teamMode, playerMode, groupFilterType, selectedTournamentId, bulkTeamId, bulkPlayerId, customEmail]);

  // Intelligent Template Recommendation for Email
  useEffect(() => {
    if (!templates.length) return;
    let recommendedKey = "";
    if (recipientCategory === "organiser") {
      if (organiserMode === "bundle") recommendedKey = "organiser_all_teams_credentials";
      else if (organiserMode === "welcome") recommendedKey = "welcome_organiser";
      else if (organiserMode === "created") recommendedKey = "tournament_created";
    } else if (recipientCategory === "team_owner") {
      recommendedKey = "welcome_team_owner";
    } else if (recipientCategory === "player") {
      if (playerMode === "sold") recommendedKey = "player_sold";
      else if (playerMode === "single") {
        const p = bulkPlayers.find((x) => String(x.id) === bulkPlayerId);
        recommendedKey = p?.status === "sold" ? "player_sold" : "player_registration";
      } else {
        recommendedKey = "player_registration";
      }
    }
    const match = templates.find((t) => t.internalKey === recommendedKey);
    if (match) setBulkTemplateId(match.id);
    else if (!bulkTemplateId && templates[0]) setBulkTemplateId(templates[0].id);
  }, [recipientCategory, organiserMode, playerMode, bulkPlayers, bulkPlayerId, templates, bulkTemplateId]);

  // Preview Email
  useEffect(() => {
    if (!bulkTemplateId) {
      setBulkEmailPreview(null);
      setBulkRecipients([]);
      return;
    }
    let isMounted = true;
    setBulkPreviewLoading(true);

    fetch(`${apiBase}/bulk/recipients`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: bulkTemplateId, filter: effectiveFilter }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        setBulkRecipients(data.recipients ?? []);
      })
      .catch(() => {});

    fetch(`${apiBase}/bulk/preview-email`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: bulkTemplateId, filter: effectiveFilter }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.subject && data.html) setBulkEmailPreview({ subject: data.subject, html: data.html });
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setBulkPreviewLoading(false);
      });

    return () => { isMounted = false; };
  }, [apiBase, bulkTemplateId, effectiveFilter]);

  // Send Email Handlers
  const handleSendEmail = async () => {
    if (!bulkTemplateId) return alert("Select an email template");
    if (!bulkRecipients.length) return alert("No valid recipient with an email address found");
    setSendingEmail(true);
    setSendSuccessMessage(null);
    try {
      const res = await fetch(`${apiBase}/bulk/queue`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: bulkTemplateId, filter: effectiveFilter, sendImmediately: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendSuccessMessage(`Successfully queued & sent to ${data.queued ?? bulkRecipients.length} recipient(s)!`);
        setTimeout(() => handleEmailSubTabChange("sent"), 1200);
      } else {
        alert(data.error ?? "Failed to send email");
      }
    } catch {
      alert("Error sending email");
    } finally {
      setSendingEmail(false);
    }
  };

  // Send SMS Handler
  const handleSendSms = async () => {
    setSmsSending(true);
    setSmsSendResult(null);
    try {
      const body: Record<string, unknown> = {
        channel: "sms",
        recipientGroup: smsRecipientGroup,
        messageContent: smsCustomText,
        templateName: smsTemplateKey,
      };
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        body.tournamentId = parseInt(selectedTournamentId);
      }
      if (smsRecipientGroup === "custom") {
        body.customMobile = smsCustomMobile;
      }

      const r = await fetch("/api/auth/admin/communicate/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setSmsSendResult({ success: true, sent: data.sent ?? 0, failed: data.failed ?? 0, stub: data.stub });
        void loadSmsLogs();
      } else {
        setSmsSendResult({ success: false, sent: 0, failed: 1, error: data.error ?? "SMS Dispatch Failed" });
      }
    } catch {
      setSmsSendResult({ success: false, sent: 0, failed: 1, error: "Network error sending SMS" });
    } finally {
      setSmsSending(false);
    }
  };

  // Send WhatsApp Handler
  const handleSendWa = async () => {
    setSendingWa(true);
    setWaSendResult(null);
    try {
      const body: Record<string, unknown> = {
        channel: "whatsapp",
        recipientGroup: waRecipientGroup,
        messageContent: waCustomText,
        templateName: waTemplateKey,
      };
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        body.tournamentId = parseInt(selectedTournamentId);
      }
      if (waRecipientGroup === "custom") {
        body.customMobile = waCustomMobile;
      }

      const r = await fetch("/api/auth/admin/communicate/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        setWaSendResult({ success: true, sent: data.sent ?? 0, failed: data.failed ?? 0, stub: data.stub });
        void loadWaData();
      } else {
        setWaSendResult({ success: false, sent: 0, failed: 1, error: data.error ?? "WhatsApp Dispatch Failed" });
      }
    } catch {
      setWaSendResult({ success: false, sent: 0, failed: 1, error: "Network error sending WhatsApp" });
    } finally {
      setSendingWa(false);
    }
  };

  // Bulk Consent Declare
  const handleBulkDeclare = async () => {
    if (!selectedTournamentId || selectedTournamentId === "__all__") return;
    setBulkDeclaring(true);
    try {
      const r = await fetch("/api/auth/admin/communicate/consent-declare-bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: parseInt(selectedTournamentId), recipientType: "all" }),
      });
      if (r.ok) {
        const d = await r.json();
        setBulkDeclareResult(d);
        void loadWaData();
        void loadContacts();
      }
    } finally {
      setBulkDeclaring(false);
    }
  };

  // Save Settings Handler
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSavedMessage(null);
    try {
      const r = await fetch("/api/auth/admin/sms-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(smsSettings),
      });
      if (r.ok) {
        setSettingsSavedMessage("Communication settings updated successfully!");
        setTimeout(() => setSettingsSavedMessage(null), 3000);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const selectedTournament = tournaments.find((t) => String(t.id) === selectedTournamentId);
  const isLicensedForWa = selectedTournament?.licenseStatus === "active" && !selectedTournament?.adminLocked;

  // DLT SMS Templates Metadata
  const dltTemplates = [
    {
      id: "player_sold",
      name: "Player Sold Notification",
      dltId: smsSettings.playerSoldTemplateId || smsSettings.playerSoldTemplateIdFromEnv || "1407161... (Auto)",
      format: "Congratulations {#var#}, you have been SOLD to {#var#} for {#var#} in {#var#}. BidWar",
      variables: ["Player Name", "Team Name", "Price (₹)", "Tournament Name"],
      sample: "Congratulations Rohit Sharma, you have been SOLD to Mumbai Strikers for ₹15,00,000 in Premier League 2026. BidWar",
    },
    {
      id: "team_owner",
      name: "Team Owner Access Code",
      dltId: smsSettings.teamOwnerTemplateId || smsSettings.teamOwnerTemplateIdFromEnv || "1407162... (Auto)",
      format: "Team {#var#}: Your auction bidding access code is {#var#}. Login: {#var#}",
      variables: ["Team Name", "Passcode", "Portal URL"],
      sample: "Team Mumbai Strikers: Your auction bidding access code is 884291. Login: https://bidwar.in/owner",
    },
    {
      id: "viewer_link",
      name: "Live Auction Viewer Link",
      dltId: smsSettings.viewerLinkTemplateId || smsSettings.viewerLinkTemplateIdFromEnv || "1407163... (Auto)",
      format: "Watch live player auction for {#var#} at {#var#}. BidWar",
      variables: ["Tournament Name", "Live Stream / Viewer URL"],
      sample: "Watch live player auction for Premier League 2026 at https://bidwar.in/live/742. BidWar",
    },
    {
      id: "custom",
      name: "Custom Transactional SMS",
      dltId: "Service Explicit DLT",
      format: "{#var#}",
      variables: ["Message Body"],
      sample: "Important announcement regarding today's auction schedule. Please check the dashboard.",
    },
  ];

  // WhatsApp Pre-Approved Templates Metadata
  const waTemplates = [
    {
      id: "player_sold",
      title: "🏆 Player Sold Celebration",
      body: "*BidWar Auction Update*\n\nCongratulations *{{1}}*!\n\nYou have been *SOLD* to *{{2}}* for *₹{{3}}* in *{{4}}*.\n\nGood luck for the tournament!",
      sampleArgs: ["Virat Kohli", "Royal Challengers", "25,00,000", "Premier League 2026"],
    },
    {
      id: "welcome_invite",
      title: "🎉 Welcome & Tournament Invite",
      body: "*Welcome to BidWar Auction!*\n\nYou are invited to participate in *{{1}}*.\n\n📅 Date: {{2}}\n📍 Venue/Mode: {{3}}\n\nClick below to view details and live rosters.",
      sampleArgs: ["Premier League 2026", "24 Sep 2026, 6:00 PM", "Live Arena"],
    },
    {
      id: "auction_reminder",
      title: "🚨 Live Auction Countdown Alert",
      body: "*🚨 Live Auction Starting Soon!*\n\nThe player auction for *{{1}}* begins in *{{2}} minutes*.\n\nTap the link below to enter the live bidding arena right now:\n{{3}}",
      sampleArgs: ["Premier League 2026", "15", "https://bidwar.in/live/742"],
    },
    {
      id: "consent_optin",
      title: "📲 WhatsApp Consent Opt-In Request",
      body: "*BidWar Instant Alerts*\n\nTo receive real-time bid updates, sale notifications, and squad announcements directly on WhatsApp, please confirm your opt-in:\n\n{{1}}",
      sampleArgs: ["https://bidwar.in/wa-consent/token981"],
    },
    {
      id: "credentials_share",
      title: "🔑 Team Owner Credentials",
      body: "*BidWar Team Pass*\n\nYour owner access for *{{1}}* (Team *{{2}}*) is ready.\n\n🔑 PIN: *{{3}}*\n🌐 App: {{4}}\n\nDo not share this PIN with anyone.",
      sampleArgs: ["Premier League 2026", "Super Kings", "4921", "https://bidwar.in/owner"],
    },
    {
      id: "custom",
      title: "✍️ Custom Direct Message",
      body: "{{1}}",
      sampleArgs: ["Hello! This is a direct broadcast from BidWar Auction platform admin."],
    },
  ];

  const selectedSmsTpl = dltTemplates.find((t) => t.id === smsTemplateKey) ?? dltTemplates[0];
  const selectedWaTpl = waTemplates.find((t) => t.id === waTemplateKey) ?? waTemplates[0];

  if (isLoading || !isLoggedIn) {
    return (
      <AdminShell title="Communication Center">
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Communication Center" eyebrow="Master Platform Hub">
      <div className="space-y-6 p-4 md:p-6">
        {/* Top Header & Search / Filter */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <Megaphone className="h-6 w-6 text-primary" />
              Communication Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Unified dispatch hub for Email, SMS, and WhatsApp across all tournaments
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Global Tournament Context Filter */}
            <Select
              value={selectedTournamentId || "__all__"}
              onValueChange={(v) => setSelectedTournamentId(v === "__all__" ? "" : v)}
            >
              <SelectTrigger className="w-56 bg-background/50 border-border">
                <SelectValue placeholder="All Tournaments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">🌐 All Tournaments</SelectItem>
                {tournaments.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                void loadDashboard();
                void loadTemplates();
                void loadJobs();
                void loadSmsLogs();
                void loadWaData();
              }}
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Master Channel Selector Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-1 bg-card/60 p-1.5 border border-border rounded-xl">
            <TabsTrigger
              value="overview"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 text-xs font-semibold"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2 text-xs font-semibold"
            >
              <Mail className="h-4 w-4" />
              📧 Email Hub
            </TabsTrigger>
            <TabsTrigger
              value="sms"
              className="gap-2 data-[state=active]:bg-sky-600 data-[state=active]:text-white py-2 text-xs font-semibold"
            >
              <Smartphone className="h-4 w-4" />
              📱 SMS Channel
            </TabsTrigger>
            <TabsTrigger
              value="whatsapp"
              className="gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white py-2 text-xs font-semibold"
            >
              <MessageSquare className="h-4 w-4" />
              💬 WhatsApp
            </TabsTrigger>
            <TabsTrigger
              value="contacts"
              className="gap-2 data-[state=active]:bg-purple-600 data-[state=active]:text-white py-2 text-xs font-semibold"
            >
              <Users className="h-4 w-4" />
              📇 Contacts & Quality
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="gap-2 data-[state=active]:bg-zinc-700 data-[state=active]:text-white py-2 text-xs font-semibold"
            >
              <Settings className="h-4 w-4" />
              ⚙️ Channel Settings
            </TabsTrigger>
          </TabsList>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 1: UNIFIED OVERVIEW & KPI DASHBOARD
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="overview" className="space-y-6">
            {/* Top Multi-Channel KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      Email Dispatched
                    </CardTitle>
                    <Mail className="h-4 w-4 text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboard?.totalEmails ?? 0}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span className="text-green-400 font-medium">
                      {dashboard?.delivered ?? 0} Delivered
                    </span>
                    <span>•</span>
                    <span className="text-yellow-400">
                      {dashboard?.pending ?? 0} Pending
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-sky-500/20 bg-sky-500/5 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                      SMS Broadcasts
                    </CardTitle>
                    <Smartphone className="h-4 w-4 text-sky-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{smsLogs.length}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] bg-sky-500/10 text-sky-400 border-sky-500/20">
                      Fast2SMS DLT
                    </Badge>
                    <span>•</span>
                    <span>{smsBlasts.length} Auto Blasts</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-emerald-500/20 bg-emerald-500/5 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                      WhatsApp Delivered
                    </CardTitle>
                    <MessageSquare className="h-4 w-4 text-emerald-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{waLogs.length}</div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <Wifi className="h-3 w-3" /> Meta / Twilio Active
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-500/20 bg-purple-500/5 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-purple-400 uppercase tracking-wider">
                      Audience Reach
                    </CardTitle>
                    <Users className="h-4 w-4 text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {consentStats ? `${consentStats.players.consented + consentStats.owners.consented}` : "98.4%"}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Active Players & Owners Subscribed
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Visual 14-Day Delivery Trends */}
            {dashboard?.graphData && dashboard.graphData.length > 0 && (
              <Card className="border-border bg-card/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Multi-Channel Delivery Trends (Last 14 Days)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Aggregated volume of sent, delivered, and pending communication
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.graphData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Bar dataKey="sent" name="Delivered" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pending" name="Pending / Queued" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="failed" name="Failed / Bounced" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Unified Activity Stream */}
            <Card className="border-border bg-card/40">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Recent Multi-Channel Dispatches
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Live audit log of emails, SMS, and WhatsApp alerts
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void loadDashboard()} className="h-8 gap-1 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {dashboard?.recentActivity && dashboard.recentActivity.length > 0 ? (
                  <div className="divide-y divide-border/40">
                    {dashboard.recentActivity.slice(0, 8).map((act) => (
                      <div key={act.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-400">
                            <Mail className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">
                              {act.recipientName || act.recipientEmail || "Recipient"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {act.action.replace(/_/g, " ")} • {formatDate(act.createdAt)}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={act.status || "delivered"} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-xs text-muted-foreground">
                    No recent dispatches found. Send a broadcast from Email, SMS, or WhatsApp tab.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 2: EMAIL CHANNEL HUB
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="email" className="space-y-6">
            {/* Sub-Navigation for Email */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3">
              <Button
                variant={emailSubTab === "compose" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleEmailSubTabChange("compose")}
              >
                <Send className="h-3.5 w-3.5" /> Send / Compose
              </Button>
              <Button
                variant={emailSubTab === "sent" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleEmailSubTabChange("sent")}
              >
                <Mail className="h-3.5 w-3.5" /> Sent History
              </Button>
              <Button
                variant={emailSubTab === "pending" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleEmailSubTabChange("pending")}
              >
                <RefreshCw className="h-3.5 w-3.5" /> Pending Queue
              </Button>
              <Button
                variant={emailSubTab === "templates" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleEmailSubTabChange("templates")}
              >
                <FileText className="h-3.5 w-3.5" /> Email Templates
              </Button>
              <Button
                variant={emailSubTab === "drafts" ? "default" : "ghost"}
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => handleEmailSubTabChange("drafts")}
              >
                <Archive className="h-3.5 w-3.5" /> Drafts
              </Button>
            </div>

            {/* COMPOSE / SEND SUB-TAB */}
            {emailSubTab === "compose" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Form: Target Config */}
                <div className="space-y-5 lg:col-span-5">
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Send className="h-4 w-4 text-blue-400" />
                        1. Select Audience & Target
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Specify tournament scope and recipient category
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Target Recipient Type
                        </Label>
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
                            <Crown className="h-3.5 w-3.5" /> Organiser
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
                            <Users className="h-3.5 w-3.5" /> Team Owner
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
                            <User className="h-3.5 w-3.5" /> Player
                          </button>
                        </div>
                      </div>

                      {/* Recipient Details based on Category */}
                      {recipientCategory === "team_owner" && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Scope</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={teamMode === "single" ? "default" : "outline"}
                              className="text-xs flex-1"
                              onClick={() => setTeamMode("single")}
                            >
                              Single Team
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={teamMode === "all" ? "default" : "outline"}
                              className="text-xs flex-1"
                              onClick={() => setTeamMode("all")}
                            >
                              All Teams ({bulkTeams.length})
                            </Button>
                          </div>
                          {teamMode === "single" && (
                            <Select value={bulkTeamId} onValueChange={setBulkTeamId}>
                              <SelectTrigger className="mt-2 text-xs">
                                <SelectValue placeholder="Select team..." />
                              </SelectTrigger>
                              <SelectContent>
                                {bulkTeams.map((t) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.name} {t.ownerName ? `(${t.ownerName})` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      )}

                      {recipientCategory === "player" && (
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Player Group</Label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant={playerMode === "sold" ? "default" : "outline"}
                              className="text-xs"
                              onClick={() => setPlayerMode("sold")}
                            >
                              🏆 Sold Players
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={playerMode === "unsold" ? "default" : "outline"}
                              className="text-xs"
                              onClick={() => setPlayerMode("unsold")}
                            >
                              ⏳ Unsold Players
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={playerMode === "all" ? "default" : "outline"}
                              className="text-xs"
                              onClick={() => setPlayerMode("all")}
                            >
                              👥 All Registered
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={playerMode === "single" ? "default" : "outline"}
                              className="text-xs"
                              onClick={() => setPlayerMode("single")}
                            >
                              🎯 Single Player
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Template Selector */}
                      <div className="space-y-1.5 pt-2 border-t border-border/40">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Email Template
                        </Label>
                        <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select email template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name} ({t.internalKey})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Recipient summary count */}
                      <div className="p-3 rounded-lg bg-muted/30 border border-border/50 text-xs">
                        <div className="flex items-center justify-between font-medium">
                          <span>Target Recipients:</span>
                          <Badge variant="secondary">{bulkRecipients.length} Recipient(s)</Badge>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={sendingEmail || !bulkRecipients.length}
                        onClick={handleSendEmail}
                      >
                        {sendingEmail ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Dispatch Email Broadcast
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: Live Email Preview */}
                <div className="space-y-4 lg:col-span-7">
                  <Card className="border-border bg-card/60 backdrop-blur-sm">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Eye className="h-4 w-4 text-primary" />
                          Live Email Preview
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {bulkEmailPreview?.subject || "Subject line preview"}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant={previewDevice === "desktop" ? "default" : "outline"}
                          className="h-7 text-xs px-2.5"
                          onClick={() => setPreviewDevice("desktop")}
                        >
                          <Monitor className="h-3 w-3 mr-1" /> Desktop
                        </Button>
                        <Button
                          size="sm"
                          variant={previewDevice === "mobile" ? "default" : "outline"}
                          className="h-7 text-xs px-2.5"
                          onClick={() => setPreviewDevice("mobile")}
                        >
                          <Smartphone className="h-3 w-3 mr-1" /> Mobile
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {bulkPreviewLoading ? (
                        <div className="h-96 flex items-center justify-center text-xs text-muted-foreground">
                          <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Rendering preview...
                        </div>
                      ) : bulkEmailPreview?.html ? (
                        <div
                          className={`mx-auto rounded-lg border border-border/80 bg-white text-zinc-900 overflow-hidden shadow-md transition-all ${
                            previewDevice === "mobile" ? "max-w-xs" : "w-full"
                          }`}
                        >
                          <div className="bg-zinc-100 p-2.5 border-b border-zinc-200 text-[11px] text-zinc-600 truncate">
                            <strong>Subject:</strong> {bulkEmailPreview.subject}
                          </div>
                          <div
                            className="p-4 overflow-auto max-h-[500px]"
                            dangerouslySetInnerHTML={{ __html: bulkEmailPreview.html }}
                          />
                        </div>
                      ) : (
                        <div className="h-72 flex items-center justify-center text-xs text-muted-foreground border border-dashed rounded-lg">
                          Select tournament and template to view rendered HTML preview.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* SENT & PENDING LIST SUB-TABS */}
            {(emailSubTab === "sent" || emailSubTab === "pending") && (
              <Card className="border-border bg-card/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    {emailSubTab === "sent" ? "Dispatched Emails" : "Pending / Retry Queue"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Template / Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Timestamp</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.length > 0 ? (
                        jobs.map((j) => (
                          <TableRow key={j.id}>
                            <TableCell>
                              <div className="font-medium text-xs">{j.recipient?.recipientName || "—"}</div>
                              <div className="text-[11px] text-muted-foreground">{j.recipient?.recipientEmail || "No email"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium truncate max-w-xs">{j.subject || j.templateInternalKey}</div>
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={j.status} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(j.sentAt || j.createdAt)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setViewJob(j)}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                            No email records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* EMAIL TEMPLATES SUB-TAB */}
            {emailSubTab === "templates" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Registered Email Templates</h3>
                  <Button
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateForm({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true });
                      setShowTemplateDialog(true);
                    }}
                  >
                    + Create Template
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {templates.map((t) => (
                    <Card key={t.id} className="border-border bg-card/60 hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold truncate">{t.name}</CardTitle>
                        <CardDescription className="text-xs font-mono text-muted-foreground truncate">
                          {t.internalKey}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground line-clamp-2">{t.subject}</p>
                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <Badge variant="outline" className="text-[10px]">v{t.currentVersion}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditingTemplate(t);
                              setTemplateForm({
                                name: t.name,
                                internalKey: t.internalKey,
                                subject: t.subject,
                                htmlBody: t.htmlBody,
                                autoSend: t.autoSend,
                                isActive: t.isActive,
                              });
                              setShowTemplateDialog(true);
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 3: SMS CHANNEL STUDIO (FAST2SMS DLT)
             ═════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="sms" className="space-y-6">
            {/* SMS Status Banner */}
            <div className="flex items-center justify-between p-4 rounded-xl border border-sky-500/30 bg-sky-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-sky-400">Fast2SMS DLT Transactional Gateway</h3>
                  <p className="text-xs text-muted-foreground">
                    Sender ID: <span className="font-mono text-foreground font-semibold">BIDWAR</span> • Route: DLT High-Priority
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={smsSettings.dltEnabled ? "bg-green-500/15 text-green-400 border-green-500/30" : "bg-yellow-500/15 text-yellow-400"}>
                  {smsSettings.dltEnabled ? "DLT Active" : "Master Switch Off"}
                </Badge>
              </div>
            </div>

            {smsSendResult && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${smsSendResult.success ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                {smsSendResult.success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
                <div className="text-xs">
                  <p className="font-bold">{smsSendResult.success ? "SMS Broadcast Dispatched Successfully!" : "Dispatch Error"}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {smsSendResult.success
                      ? `Dispatched to ${smsSendResult.sent} recipient(s) ${smsSendResult.stub ? "(Stub Mode)" : ""}`
                      : smsSendResult.error}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: SMS Composer */}
              <div className="space-y-4 lg:col-span-6">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="h-4 w-4 text-sky-400" />
                      1. SMS Broadcast Composer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Send registered DLT templates or custom emergency notices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Audience Selection */}
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Target Audience</Label>
                      <Select value={smsRecipientGroup} onValueChange={setSmsRecipientGroup}>
                        <SelectTrigger className="mt-1.5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_players">👥 All Registered Players</SelectItem>
                          <SelectItem value="sold_players">🏆 Sold Players Only</SelectItem>
                          <SelectItem value="unsold_players">⏳ Unsold Players Only</SelectItem>
                          <SelectItem value="all_owners">👔 Team Owners</SelectItem>
                          <SelectItem value="organizer">👑 Tournament Organiser</SelectItem>
                          <SelectItem value="custom">📱 Custom Mobile Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {smsRecipientGroup === "custom" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Mobile Number (10 Digits)</Label>
                        <Input
                          placeholder="e.g. 9876543210"
                          value={smsCustomMobile}
                          onChange={(e) => setSmsCustomMobile(e.target.value)}
                          className="mt-1 text-xs"
                        />
                      </div>
                    )}

                    {/* DLT Template Selector */}
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">DLT Registered Template</Label>
                      <Select value={smsTemplateKey} onValueChange={setSmsTemplateKey}>
                        <SelectTrigger className="mt-1.5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dltTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dynamic Variable Mapping Card */}
                    <div className="p-3 rounded-lg border border-sky-500/20 bg-sky-500/5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sky-400">Template ID:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{selectedSmsTpl.dltId}</code>
                      </div>
                      <div>
                        <p className="text-muted-foreground font-medium">Dynamic Variables ({selectedSmsTpl.variables.length}):</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {selectedSmsTpl.variables.map((v, i) => (
                            <Badge key={i} variant="outline" className="text-[10px] bg-background/50">
                              #{i + 1}: {v}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {smsTemplateKey === "custom" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Custom Message Text</Label>
                        <Textarea
                          placeholder="Type custom notification text..."
                          value={smsCustomText}
                          onChange={(e) => setSmsCustomText(e.target.value)}
                          className="mt-1 text-xs min-h-[80px]"
                        />
                      </div>
                    )}

                    <Button
                      type="button"
                      className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white"
                      disabled={smsSending}
                      onClick={handleSendSms}
                    >
                      {smsSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Dispatch DLT SMS Broadcast
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live SMS Phone Preview */}
              <div className="space-y-4 lg:col-span-6">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-sky-400" />
                      Live SMS Message Preview
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Exact text delivered to recipient's mobile phone
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    {/* Phone Mockup Screen */}
                    <div className="w-full max-w-sm rounded-2xl border-2 border-zinc-700 bg-zinc-950 p-4 shadow-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[11px] text-zinc-400">
                        <span className="font-semibold text-zinc-300">BIDWAR-SMS</span>
                        <span>Now</span>
                      </div>
                      {/* SMS Chat Bubble */}
                      <div className="rounded-xl bg-zinc-800 p-3.5 text-xs text-zinc-100 shadow-inner leading-relaxed">
                        {smsTemplateKey === "custom" ? (smsCustomText || "Custom SMS text will appear here...") : selectedSmsTpl.sample}
                      </div>
                      <div className="text-[10px] text-zinc-500 text-right">
                        DLT Header: VK-BIDWAR
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* DLT Templates Reference Grid */}
                <Card className="border-border bg-card/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Registered Fast2SMS Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dltTemplates.slice(0, 3).map((t) => (
                      <div key={t.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/40 text-xs flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{t.dltId}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{t.variables.length} vars</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* SMS Dispatch History Table */}
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-sky-400" />
                    SMS Dispatch History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Recent SMS transactions and automated auction event triggers
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadSmsLogs()} className="h-8 gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mobile Number</TableHead>
                      <TableHead>Template / Content</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsLogs.length > 0 ? (
                      smsLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {l.recipientMobile}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{l.templateName || "Transactional"}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-sm">{l.messageContent}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={l.deliveryStatus} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(l.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                          No SMS logs recorded for this tournament.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 4: WHATSAPP CHANNEL HUB (PROPERLY UPGRADED & COMPLETE)
             ═════════════════════════════════════════════ */}
          <TabsContent value="whatsapp" className="space-y-6">
            {/* WhatsApp Connection & Gateway Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-emerald-400">Meta WhatsApp Cloud & Twilio API</h3>
                    <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                      <Wifi className="h-2.5 w-2.5" /> High Quality Rating
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verified Business Account • Auto Opt-out Footer Active
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => setShowQrDialog(true)}
                >
                  <QrCode className="h-3.5 w-3.5" /> 1-Click Opt-in Link
                </Button>
                <Button
                  size="sm"
                  className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={bulkDeclaring || !selectedTournamentId}
                  onClick={handleBulkDeclare}
                >
                  {bulkDeclaring ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                  Bulk Consent Declare
                </Button>
              </div>
            </div>

            {/* License Warning if not licensed */}
            {!isLicensedForWa && selectedTournamentId && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-amber-400">Trial / Locked Tournament Warning</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    WhatsApp dispatches require an active licensed tournament. Unlicensed tournaments automatically fallback safely to SMS.
                  </p>
                </div>
              </div>
            )}

            {/* WhatsApp Consent Overview Metric Cards */}
            {consentStats && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="border-border bg-card/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Players Opt-In</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {consentStats.players.hasMobile > 0
                          ? `${Math.round((consentStats.players.consented / consentStats.players.hasMobile) * 100)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-2xl font-bold">{consentStats.players.consented}</div>
                      <div className="text-xs text-muted-foreground">of {consentStats.players.hasMobile} mobile registered</div>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${
                            consentStats.players.hasMobile > 0
                              ? Math.round((consentStats.players.consented / consentStats.players.hasMobile) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Team Owners Opt-In</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {consentStats.owners.hasMobile > 0
                          ? `${Math.round((consentStats.owners.consented / consentStats.owners.hasMobile) * 100)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <div className="text-2xl font-bold">{consentStats.owners.consented}</div>
                      <div className="text-xs text-muted-foreground">of {consentStats.owners.hasMobile} owners registered</div>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${
                            consentStats.owners.hasMobile > 0
                              ? Math.round((consentStats.owners.consented / consentStats.owners.hasMobile) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {waSendResult && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 ${waSendResult.success ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-red-500/30 bg-red-500/10 text-red-400"}`}>
                {waSendResult.success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
                <div className="text-xs">
                  <p className="font-bold">{waSendResult.success ? "WhatsApp Broadcast Delivered!" : "Send Error"}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {waSendResult.success
                      ? `Delivered to ${waSendResult.sent} consented recipient(s) ${waSendResult.stub ? "(Stub Mode)" : ""}`
                      : waSendResult.error}
                  </p>
                </div>
              </div>
            )}

            {/* Broadcast Form & Live WhatsApp Bubble Mockup */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: WhatsApp Composer */}
              <div className="space-y-4 lg:col-span-6">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="h-4 w-4 text-emerald-400" />
                      1. WhatsApp Broadcast Composer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Send rich WhatsApp templates directly to player and team owner devices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Target Audience</Label>
                      <Select value={waRecipientGroup} onValueChange={setWaRecipientGroup}>
                        <SelectTrigger className="mt-1.5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_players">👥 Consented Players</SelectItem>
                          <SelectItem value="sold_players">🏆 Sold Players</SelectItem>
                          <SelectItem value="unsold_players">⏳ Unsold Players</SelectItem>
                          <SelectItem value="all_owners">👔 Team Owners</SelectItem>
                          <SelectItem value="organizer">👑 Tournament Organiser</SelectItem>
                          <SelectItem value="custom">📱 Custom WhatsApp Mobile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {waRecipientGroup === "custom" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">WhatsApp Mobile (E.164 / 10 Digits)</Label>
                        <Input
                          placeholder="e.g. +919876543210"
                          value={waCustomMobile}
                          onChange={(e) => setWaCustomMobile(e.target.value)}
                          className="mt-1 text-xs"
                        />
                      </div>
                    )}

                    {/* Template Selector */}
                    <div>
                      <Label className="text-xs font-semibold text-muted-foreground">Approved WhatsApp Template</Label>
                      <Select value={waTemplateKey} onValueChange={setWaTemplateKey}>
                        <SelectTrigger className="mt-1.5 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {waTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {waTemplateKey === "custom" && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Custom WhatsApp Message</Label>
                        <Textarea
                          placeholder="Type formatted message (*bold*, _italic_)..."
                          value={waCustomText}
                          onChange={(e) => setWaCustomText(e.target.value)}
                          className="mt-1 text-xs min-h-[80px]"
                        />
                      </div>
                    )}

                    <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-[11px] text-muted-foreground space-y-1">
                      <p className="font-semibold text-emerald-400">🛡️ Policy Compliance:</p>
                      <p>Business messages automatically append the required opt-out instruction ("Reply STOP to unsubscribe").</p>
                    </div>

                    <Button
                      type="button"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={waSending}
                      onClick={handleSendWa}
                    >
                      {waSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Dispatch WhatsApp Broadcast
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live WhatsApp Bubble Mockup */}
              <div className="space-y-4 lg:col-span-6">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4 text-emerald-400" />
                      Live WhatsApp Preview Mockup
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Simulated rendering inside WhatsApp Messenger UI
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    {/* WhatsApp Chat Frame */}
                    <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-[#0b141a] p-4 shadow-2xl space-y-3">
                      {/* WA Chat Topbar */}
                      <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                        <div className="h-9 w-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                          BW
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-xs text-zinc-100">BidWar Auction</span>
                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/20" />
                          </div>
                          <span className="text-[10px] text-emerald-400">Official Business Account</span>
                        </div>
                      </div>

                      {/* WhatsApp Emerald Bubble */}
                      <div className="rounded-xl rounded-tl-xs bg-[#005c4b] p-3 text-xs text-zinc-100 shadow space-y-2 leading-relaxed whitespace-pre-line">
                        {waTemplateKey === "custom" ? (waCustomText || "Type custom message to preview...") : selectedWaTpl.body}
                        <div className="pt-2 border-t border-emerald-600/40 text-[10px] text-emerald-200/70 italic">
                          Reply STOP to unsubscribe.
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-300/80">
                          <span>12:45 PM</span>
                          <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* WhatsApp Logs Table */}
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    WhatsApp Delivery Receipts
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadWaData()} className="h-8 gap-1 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient Mobile</TableHead>
                      <TableHead>Template / Preview</TableHead>
                      <TableHead>Delivery Status</TableHead>
                      <TableHead>Sent Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {waLogs.length > 0 ? (
                      waLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {l.recipientMobile}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{l.templateName || "WhatsApp Broadcast"}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-sm">{l.messageContent}</div>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={l.deliveryStatus} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(l.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                          No WhatsApp dispatches recorded for this tournament yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 5: CONTACTS & DATA QUALITY RESOLVER
             ═════════════════════════════════════════════ */}
          <TabsContent value="contacts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Contact Quality & Missing Mobile Resolver</h3>
                <p className="text-xs text-muted-foreground">
                  Quickly detect and update missing phone numbers or emails to ensure 100% communication delivery
                </p>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => void loadContacts()}>
                <RefreshCw className="h-3.5 w-3.5" /> Reload Contacts
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Missing Mobile Players */}
              <Card className="border-border bg-card/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-purple-400" />
                      Players Missing Mobile Numbers ({missingPlayers.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {missingPlayers.length > 0 ? (
                    <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
                      {missingPlayers.map((p) => (
                        <div key={p.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">{p.role || "Player"} • ID #{p.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Add 10-digit mobile"
                              className="h-7 text-xs w-36 font-mono"
                              value={inputMobile[p.id] || ""}
                              onChange={(e) => setInputMobile((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              disabled={savingContactId === p.id || !inputMobile[p.id]}
                              onClick={async () => {
                                setSavingContactId(p.id);
                                try {
                                  await fetch(`/api/auth/admin/communicate/contacts/player/${p.id}`, {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ mobile: inputMobile[p.id] }),
                                  });
                                  void loadContacts();
                                } finally {
                                  setSavingContactId(null);
                                }
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      🎉 All registered players have valid mobile numbers attached!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Missing Mobile Team Owners */}
              <Card className="border-border bg-card/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      Team Owners Missing Mobile ({missingOwners.length})
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {missingOwners.length > 0 ? (
                    <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
                      {missingOwners.map((o) => (
                        <div key={o.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                          <div>
                            <p className="font-medium">{o.name}</p>
                            <p className="text-[10px] text-muted-foreground">{o.ownerName || "Team Owner"} • Team #{o.id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="Add owner mobile"
                              className="h-7 text-xs w-36 font-mono"
                              value={inputMobile[o.id] || ""}
                              onChange={(e) => setInputMobile((prev) => ({ ...prev, [o.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              disabled={savingContactId === o.id || !inputMobile[o.id]}
                              onClick={async () => {
                                setSavingContactId(o.id);
                                try {
                                  await fetch(`/api/auth/admin/communicate/contacts/team/${o.id}`, {
                                    method: "PATCH",
                                    credentials: "include",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ mobile: inputMobile[o.id] }),
                                  });
                                  void loadContacts();
                                } finally {
                                  setSavingContactId(null);
                                }
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      🎉 All team owners have valid mobile numbers attached!
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═════════════════════════════════════════════════════════════════════
              TAB 6: CENTRALIZED CHANNEL SETTINGS
             ═════════════════════════════════════════════ */}
          <TabsContent value="settings" className="space-y-6">
            {settingsSavedMessage && (
              <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" /> {settingsSavedMessage}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SMS & DLT Configuration */}
              <Card className="border-border bg-card/60 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-sky-400" />
                    SMS & DLT Gateway Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Fast2SMS DLT registration IDs and automated event switches
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div>
                      <p className="text-xs font-bold">DLT SMS Master Switch</p>
                      <p className="text-[10px] text-muted-foreground">Gating switch for all outbound transactional SMS</p>
                    </div>
                    <Switch
                      checked={smsSettings.dltEnabled}
                      onCheckedChange={(v) => setSmsSettings((s) => ({ ...s, dltEnabled: v }))}
                    />
                  </div>

                  <div className="space-y-3 pt-2">
                    {/* Player Sold */}
                    <div className="p-3 rounded-lg border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">Player Sold Notification</p>
                          <p className="text-[10px] text-muted-foreground">Triggered when player is marked SOLD</p>
                        </div>
                        <Switch
                          checked={smsSettings.playerSoldEnabled}
                          disabled={!smsSettings.dltEnabled}
                          onCheckedChange={(v) => setSmsSettings((s) => ({ ...s, playerSoldEnabled: v }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">DLT Template ID</Label>
                        <Input
                          placeholder="e.g. 1407161..."
                          value={smsSettings.playerSoldTemplateId || ""}
                          onChange={(e) => setSmsSettings((s) => ({ ...s, playerSoldTemplateId: e.target.value }))}
                          className="h-8 text-xs font-mono"
                        />
                        {smsSettings.playerSoldTemplateIdFromEnv && !smsSettings.playerSoldTemplateId && (
                          <span className="text-[10px] text-emerald-400">Fallback from env: {smsSettings.playerSoldTemplateIdFromEnv}</span>
                        )}
                      </div>
                    </div>

                    {/* Team Owner */}
                    <div className="p-3 rounded-lg border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">Team Owner Access Code</p>
                          <p className="text-[10px] text-muted-foreground">Triggered when team is created with owner mobile</p>
                        </div>
                        <Switch
                          checked={smsSettings.teamOwnerEnabled}
                          disabled={!smsSettings.dltEnabled}
                          onCheckedChange={(v) => setSmsSettings((s) => ({ ...s, teamOwnerEnabled: v }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">DLT Template ID</Label>
                        <Input
                          placeholder="e.g. 1407162..."
                          value={smsSettings.teamOwnerTemplateId || ""}
                          onChange={(e) => setSmsSettings((s) => ({ ...s, teamOwnerTemplateId: e.target.value }))}
                          className="h-8 text-xs font-mono"
                        />
                        {smsSettings.teamOwnerTemplateIdFromEnv && !smsSettings.teamOwnerTemplateId && (
                          <span className="text-[10px] text-emerald-400">Fallback from env: {smsSettings.teamOwnerTemplateIdFromEnv}</span>
                        )}
                      </div>
                    </div>

                    {/* Viewer Link */}
                    <div className="p-3 rounded-lg border border-border/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">Viewer Link Notification</p>
                          <p className="text-[10px] text-muted-foreground">Triggered when sharing live stream URL</p>
                        </div>
                        <Switch
                          checked={smsSettings.viewerLinkEnabled}
                          disabled={!smsSettings.dltEnabled}
                          onCheckedChange={(v) => setSmsSettings((s) => ({ ...s, viewerLinkEnabled: v }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">DLT Template ID</Label>
                        <Input
                          placeholder="e.g. 1407163..."
                          value={smsSettings.viewerLinkTemplateId || ""}
                          onChange={(e) => setSmsSettings((s) => ({ ...s, viewerLinkTemplateId: e.target.value }))}
                          className="h-8 text-xs font-mono"
                        />
                        {smsSettings.viewerLinkTemplateIdFromEnv && !smsSettings.viewerLinkTemplateId && (
                          <span className="text-[10px] text-emerald-400">Fallback from env: {smsSettings.viewerLinkTemplateIdFromEnv}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    className="w-full text-xs h-9 bg-sky-600 hover:bg-sky-700 text-white"
                    disabled={savingSettings}
                    onClick={handleSaveSettings}
                  >
                    {savingSettings ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "Save SMS & DLT Settings"}
                  </Button>
                </CardContent>
              </Card>

              {/* WhatsApp & Email Provider Summary */}
              <div className="space-y-6">
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-emerald-400" />
                      WhatsApp Gateway Status
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Meta Cloud API & Twilio Business profile
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                      <div>
                        <p className="font-semibold">Provider Engine</p>
                        <p className="text-[11px] text-muted-foreground">Twilio WhatsApp / Meta Cloud API</p>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Connected</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                      <div>
                        <p className="font-semibold">Opt-in Compliance</p>
                        <p className="text-[11px] text-muted-foreground">Strict opt-in gating with STOP opt-out suffix</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">Active</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-400" />
                      Email Engine Status
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Resend & SMTP Transactional infrastructure
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/40">
                      <div>
                        <p className="font-semibold">Default Sender Email</p>
                        <p className="text-[11px] text-muted-foreground">notifications@bidwar.in</p>
                      </div>
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30">Verified</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 1-Click WhatsApp QR / Link Dialog */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <QrCode className="h-5 w-5 text-emerald-400" />
                WhatsApp 1-Click Consent Link & QR
              </DialogTitle>
              <DialogDescription className="text-xs">
                Share this link or QR code with players and organizers for instant WhatsApp opt-in.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-center justify-between text-xs">
                <code className="font-mono truncate max-w-xs">{botLink?.link || "https://wa.me/?text=OPTIN"}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    if (botLink?.link) {
                      void navigator.clipboard.writeText(botLink.link);
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  }}
                >
                  {copiedLink ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" onClick={() => setShowQrDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
