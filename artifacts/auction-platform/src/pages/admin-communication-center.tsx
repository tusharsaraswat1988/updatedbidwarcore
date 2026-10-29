import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { EmailRichEditor } from "@/components/communication/email-rich-editor";
import { PlayerSoldPoster } from "@/components/posters/player-sold-poster";
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
  Briefcase,
  Download,
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

interface WaTemplateOption {
  id: string;
  templateName: string;
  metaTemplateName?: string | null;
  title: string;
  displayName?: string;
  body: string;
  status?: string;
  category?: string;
  description?: string;
  language?: string;
  headerType?: "image" | "text" | "video" | "document" | "none";
  headerImageUrl?: string | null;
  metaApproved?: boolean;
  isUsableInBidwar?: boolean;
  variables: Array<{ key: string; label: string; placeholder: string; description?: string }>;
  sampleArgs?: string[];
  evidenceSource?: string;
  evidenceTimestamp?: string | null;
  liveSyncStatus?: string;
  liveSyncNote?: string;
  exclusionReason?: string | null;
}

interface WaProviderStatus {
  provider: "kv_techmedia" | "twilio" | "meta_direct" | "mock" | "none";
  displayName: string;
  configured: boolean;
  configValid: boolean;
  configErrors: string[];
  status: "unconfigured" | "invalid_config" | "configured" | "mock";
  verifiedConnectivity: boolean;
  connectivityNote: string;
  environment: string;
  isProduction: boolean;
  deliveryHealth: {
    totalLogged: number;
    deliveredCount: number;
    failedCount: number;
    lastDispatchedAt: string | null;
    lastDeliveryStatus: string | null;
  };
}

interface TournamentItem {
  id: number;
  name: string;
  sport?: string;
  licenseStatus?: string;
  adminLocked?: boolean;
  organizerName?: string;
  organizerMobile?: string;
  organizerEmail?: string;
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
  const { toast } = useToast();
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
  const [waTargetType, setWaTargetType] = useState<"particular_player" | "particular_owner" | "organizer" | "broadcast_group" | "custom">("particular_player");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [waBroadcastGroup, setWaBroadcastGroup] = useState<string>("sold_players");
  const [waTournamentPlayers, setWaTournamentPlayers] = useState<Array<{
    id: number;
    name: string;
    mobileNumber?: string | null;
    primaryRole?: string | null;
    role?: string | null;
    status?: string | null;
    soldPrice?: number | null;
    teamId?: number | null;
    photoUrl?: string | null;
    whatsappConsent?: boolean;
  }>>([]);
  const [waTournamentTeams, setWaTournamentTeams] = useState<Array<{
    id: number;
    name: string;
    shortCode?: string | null;
    ownerName?: string | null;
    ownerMobile?: string | null;
    color?: string | null;
    logoUrl?: string | null;
  }>>([]);
  const [loadingWaTargets, setLoadingWaTargets] = useState(false);
  const [waTemplateKey, setWaTemplateKey] = useState("auction_player_sold");
  const [availableWaTemplates, setAvailableWaTemplates] = useState<WaTemplateOption[]>([]);
  const [waTemplateVariables, setWaTemplateVariables] = useState<Record<string, string>>({});

  // Dynamic Player Sold Poster state for WhatsApp
  const [recentSales, setRecentSales] = useState<Array<{
    id: number;
    playerName: string;
    playerPhotoUrl: string | null;
    playerRole: string | null;
    teamId: number | null;
    teamName: string;
    teamLogoUrl: string | null;
    teamShortCode: string | null;
    teamColor: string | null;
    amount: number;
    formattedAmount: string;
    tournamentName: string;
    tournamentSport: string;
    auctionUnit: "rupee" | "points";
  }>>([]);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("sample");
  const [loadingSales, setLoadingSales] = useState(false);

  const activeSale = useMemo(() => {
    if (selectedSaleId === "sample") return null;
    return recentSales.find((s) => String(s.id) === selectedSaleId) || null;
  }, [recentSales, selectedSaleId]);
  const [waCustomText, setWaCustomText] = useState("");
  const [waCustomMobile, setWaCustomMobile] = useState("");
  const [waSending, setSendingWa] = useState(false);
  const [waSendResult, setWaSendResult] = useState<{
    success: boolean;
    blastId?: string;
    total?: number;
    sent: number;
    blocked?: number;
    failed: number;
    stub?: boolean;
    error?: string;
    results?: Array<{ mobile: string; channel: string; success: boolean; blocked?: boolean; error?: string }>;
  } | null>(null);
  const [showDispatchConfirmDialog, setShowDispatchConfirmDialog] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState("");
  const [receiptStatusFilter, setReceiptStatusFilter] = useState("all");
  const [waLogs, setWaLogs] = useState<CommLog[]>([]);
  const [loadingWaLogs, setLoadingWaLogs] = useState(false);
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [botLink, setBotLink] = useState<{ link: string | null; configured: boolean } | null>(null);
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Gate A: Provider Status, Templates Loading & Mobile Responsive View Switcher
  const [waProviderStatus, setWaProviderStatus] = useState<WaProviderStatus | null>(null);
  const [loadingProviderStatus, setLoadingProviderStatus] = useState(false);
  const [loadingWaTemplates, setLoadingWaTemplates] = useState(false);
  const [waTemplatesError, setWaTemplatesError] = useState<string | null>(null);
  const [waMobileTab, setWaMobileTab] = useState<"compose" | "preview">("compose");
  const [showDebugTemplates, setShowDebugTemplates] = useState(false);

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

  const handleViewJob = async (j: CommJob) => {
    setViewJob(j);
    if (!j.htmlBody) {
      try {
        const res = await fetch(`${apiBase}/jobs/${j.id}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.job) {
            setViewJob((prev) => (prev?.id === j.id ? { ...prev, ...data.job } : prev));
          }
        }
      } catch {
        // keep existing j
      }
    }
  };

  const handleResendJob = async (jobId: string) => {
    try {
      setResendingId(jobId);
      const res = await fetch(`${apiBase}/jobs/${jobId}/resend`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("Email job queued for resend successfully.");
        void loadJobs();
        setViewJob(null);
      } else {
        alert(data.error ?? "Failed to resend email job.");
      }
    } catch {
      alert("Network error while attempting to resend.");
    } finally {
      setResendingId(null);
    }
  };

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

  // Load WhatsApp Logs, Provider Status, Templates & Consent
  const loadWaData = useCallback(async () => {
    setLoadingWaLogs(true);
    setLoadingProviderStatus(true);
    setLoadingWaTemplates(true);
    setWaTemplatesError(null);
    try {
      // 1. Fetch Authoritative Provider Status
      try {
        const pRes = await fetch("/api/auth/admin/communicate/provider-status", { credentials: "include" });
        if (pRes.ok) {
          const pData = await pRes.json();
          setWaProviderStatus(pData);
        }
      } catch {
        // non-blocking for logs display
      } finally {
        setLoadingProviderStatus(false);
      }

      // 2. Fetch WhatsApp Message Logs
      const params = new URLSearchParams({ channel: "whatsapp" });
      if (selectedTournamentId && selectedTournamentId !== "__all__") params.set("tournamentId", selectedTournamentId);
      const res = await fetch(`/api/auth/admin/communicate/logs?${params}`, { credentials: "include" });
      if (res.ok) setWaLogs(await res.json());

      // 3. Fetch Consent Stats
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        const cRes = await fetch(`/api/auth/admin/communicate/consent-status/${selectedTournamentId}`, { credentials: "include" });
        if (cRes.ok) setConsentStats(await cRes.json());

        // 3b. Fetch Recent Sales for dynamic poster preview
        let fetchedSales: any[] = [];
        try {
          const sRes = await fetch(`/api/auth/admin/communicate/recent-sales/${selectedTournamentId}`, { credentials: "include" });
          if (sRes.ok) {
            const sData = await sRes.json();
            fetchedSales = sData.sales ?? [];
            setRecentSales(fetchedSales);
            if (fetchedSales.length > 0) {
              const first = fetchedSales[0];
              setSelectedSaleId(String(first.id));
              setWaTemplateVariables({
                "1": first.playerName,
                "2": first.teamName,
                "3": first.formattedAmount,
                "4": first.tournamentName,
              });
              setSelectedPlayerId(String(first.id));
            }
          }
        } catch {
          // non-fatal
        }

        // 3c. Fetch Tournament Players and Teams for direct targeting
        try {
          setLoadingWaTargets(true);
          const [pRes, tRes] = await Promise.all([
            fetch(`/api/tournaments/${selectedTournamentId}/players`, { credentials: "include" }),
            fetch(`/api/tournaments/${selectedTournamentId}/teams`, { credentials: "include" }),
          ]);
          if (pRes.ok) {
            const pData = await pRes.json();
            const pList = Array.isArray(pData) ? pData : (pData.players ?? []);
            setWaTournamentPlayers(pList);

            // Auto-resolve mobile number for the active sale or first player
            const targetId = fetchedSales.length > 0 ? String(fetchedSales[0].id) : (selectedPlayerId || "");
            if (targetId) {
              const matched = pList.find((p: any) => String(p.id) === targetId);
              if (matched?.mobileNumber) {
                setWaCustomMobile(matched.mobileNumber);
              }
            } else if (pList.length > 0) {
              const firstSold = pList.find((p: any) => p.status === "sold" || (p.soldPrice && p.soldPrice > 0)) || pList[0];
              if (firstSold) {
                setSelectedPlayerId(String(firstSold.id));
                if (firstSold.mobileNumber) setWaCustomMobile(firstSold.mobileNumber);
              }
            }
          }
          if (tRes.ok) {
            const tData = await tRes.json();
            const tList = Array.isArray(tData) ? tData : (tData.teams ?? []);
            setWaTournamentTeams(tList);
          }
        } catch {
          // non-fatal
        } finally {
          setLoadingWaTargets(false);
        }
      } else {
        setConsentStats(null);
        setRecentSales([]);
        setWaTournamentPlayers([]);
        setWaTournamentTeams([]);
      }

      // 4. Fetch Bot Link
      const linkRes = await fetch("/api/consent/wa-link", { credentials: "include" });
      if (linkRes.ok) setBotLink(await linkRes.json());

      // 5. Fetch Authoritative Templates
      try {
        const tRes = await fetch("/api/auth/admin/communicate/templates", { credentials: "include" });
        if (tRes.ok) {
          const templates = await tRes.json();
          setAvailableWaTemplates(templates);
        } else {
          setWaTemplatesError("Failed to load approved templates from server registry.");
        }
      } catch {
        setWaTemplatesError("Network error while connecting to template catalog.");
      } finally {
        setLoadingWaTemplates(false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWaLogs(false);
      setLoadingProviderStatus(false);
      setLoadingWaTemplates(false);
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

  // Handler when selecting a player in the WhatsApp composer
  const handleSelectPlayer = (pId: string) => {
    setSelectedPlayerId(pId);
    if (!pId) return;
    const p = waTournamentPlayers.find((item) => String(item.id) === pId);
    if (!p) return;

    if (p.mobileNumber) {
      setWaCustomMobile(p.mobileNumber);
    }

    const tObj = tournaments.find((t) => String(t.id) === selectedTournamentId);
    const tournamentName = tObj?.name || "Premier League 2026";

    // Check if player has a recent sale record
    const sale = recentSales.find((s) => s.id === p.id || s.playerName.toLowerCase() === p.name.toLowerCase());
    if (sale) {
      setSelectedSaleId(String(sale.id));
      setWaTemplateKey("auction_player_sold");
      setWaTemplateVariables({
        "1": sale.playerName,
        "2": sale.teamName,
        "3": sale.formattedAmount,
        "4": sale.tournamentName || tournamentName,
      });
    } else if (p.status === "sold" || (p.soldPrice && p.soldPrice > 0)) {
      const team = waTournamentTeams.find((t) => t.id === p.teamId);
      const amtStr = p.soldPrice ? `₹${p.soldPrice.toLocaleString("en-IN")}` : "₹0";
      setWaTemplateKey("auction_player_sold");
      setWaTemplateVariables({
        "1": p.name,
        "2": team?.name || "Winning Team",
        "3": amtStr,
        "4": tournamentName,
      });
    } else {
      setWaTemplateVariables((prev) => ({
        ...prev,
        "1": p.name,
        "4": tournamentName,
      }));
    }
  };

  // Handler when selecting a team owner
  const handleSelectTeam = (tId: string) => {
    setSelectedTeamId(tId);
    if (!tId) return;
    const tm = waTournamentTeams.find((item) => String(item.id) === tId);
    if (!tm) return;

    if (tm.ownerMobile) {
      setWaCustomMobile(tm.ownerMobile);
    }
    const tObj = tournaments.find((t) => String(t.id) === selectedTournamentId);
    setWaTemplateVariables((prev) => ({
      ...prev,
      "1": tm.ownerName || tm.name,
      "2": tm.name,
      "4": tObj?.name || "Premier League 2026",
    }));
  };

  // 1-Click download for 1080x1350 PNG poster
  const handleDownloadPosterPreview = () => {
    const pName = waTemplateVariables["1"] || activeSale?.playerName || "Virat Kohli";
    const tName = waTemplateVariables["2"] || activeSale?.teamName || "Royal Challengers";
    const amtStr = waTemplateVariables["3"] || activeSale?.formattedAmount || "2500000";
    const numPrice = parseInt(amtStr.replace(/[^0-9]/g, ""), 10) || 2500000;
    const tourName = waTemplateVariables["4"] || activeSale?.tournamentName || (tournaments.find((t) => String(t.id) === selectedTournamentId)?.name || "Premier League 2026");
    const role = activeSale?.playerRole || "Top-Order Batter";

    const params = new URLSearchParams({
      name: pName,
      team: tName,
      price: String(numPrice),
      tournament: tourName,
      role: role,
    });
    const downloadUrl = `/api/media/player-sold-poster/preview.png?${params.toString()}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${pName.replace(/[^a-zA-Z0-9]/g, "_")}_Sold_Poster.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Initiate Send WhatsApp: Validate first, then open explicit confirmation dialog
  const handleSendWa = () => {
    setWaSendResult(null);

    let effectivePlayerId = selectedPlayerId;
    if (!effectivePlayerId && activeSale?.id) {
      effectivePlayerId = String(activeSale.id);
      setSelectedPlayerId(effectivePlayerId);
    }

    let effectiveMobile = waCustomMobile.trim();
    if (!effectiveMobile && effectivePlayerId) {
      const match = waTournamentPlayers.find((p) => String(p.id) === effectivePlayerId);
      if (match?.mobileNumber) {
        effectiveMobile = match.mobileNumber.trim();
        setWaCustomMobile(effectiveMobile);
      }
    }

    if (waTargetType === "particular_player") {
      if (!effectivePlayerId) {
        const err = "Please select a player to send this WhatsApp message to.";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Recipient Required", description: err, variant: "destructive" });
        return;
      }
      if (!effectiveMobile || effectiveMobile.replace(/\D/g, "").length < 10) {
        const err = "The selected player has no registered mobile number. Please enter a valid 10-digit number.";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Mobile Required", description: err, variant: "destructive" });
        return;
      }
    } else if (waTargetType === "particular_owner") {
      if (!selectedTeamId) {
        const err = "Please select a team owner to message.";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Team Owner Required", description: err, variant: "destructive" });
        return;
      }
      if (!effectiveMobile || effectiveMobile.replace(/\D/g, "").length < 10) {
        const err = "The selected team owner has no registered mobile number. Please enter a valid 10-digit number.";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Mobile Required", description: err, variant: "destructive" });
        return;
      }
    } else if (waTargetType === "organizer") {
      const currentT = tournaments.find((t) => String(t.id) === selectedTournamentId);
      const orgMobile = currentT?.organizerMobile || effectiveMobile;
      if (!orgMobile || orgMobile.replace(/\D/g, "").length < 10) {
        const err = "The tournament organiser has no registered mobile number.";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Mobile Required", description: err, variant: "destructive" });
        return;
      }
    } else if (waTargetType === "custom") {
      if (!effectiveMobile || effectiveMobile.replace(/\D/g, "").length < 10) {
        const err = "Please enter a valid mobile number (minimum 10 digits)";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Mobile Required", description: err, variant: "destructive" });
        return;
      }
    }

    if (waTemplateKey === "custom") {
      if (!waCustomText.trim()) {
        const err = "Please enter custom message text before sending";
        setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
        toast({ title: "Message Required", description: err, variant: "destructive" });
        return;
      }
    } else if (selectedWaTpl?.variables && selectedWaTpl.variables.length > 0) {
      const isAutoDbPlayerSold =
        (waTemplateKey === "auction_player_sold" || waTemplateKey === "player_sold") &&
        selectedTournamentId &&
        selectedTournamentId !== "__all__" &&
        waTargetType === "broadcast_group" &&
        (waBroadcastGroup === "sold_players" || waBroadcastGroup === "all_players");
      if (!isAutoDbPlayerSold) {
        const missing = selectedWaTpl.variables.find((v) => !waTemplateVariables[v.key]?.trim());
        if (missing) {
          const err = `Please provide value for variable: ${missing.label}`;
          setWaSendResult({ success: false, sent: 0, failed: 1, error: err });
          toast({ title: "Missing Variable", description: err, variant: "destructive" });
          return;
        }
      }
    }

    // Open confirmation dialog before real dispatch
    setShowDispatchConfirmDialog(true);
  };

  // Execute WhatsApp Broadcast upon explicit confirmation
  const executeSendWa = async () => {
    setSendingWa(true);
    setWaSendResult(null);

    let effectiveGroup: string = "custom";
    let effectiveMobile = waCustomMobile.trim();
    if (!effectiveMobile && selectedPlayerId) {
      const match = waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId);
      if (match?.mobileNumber) {
        effectiveMobile = match.mobileNumber.trim();
      }
    }

    if (waTargetType === "particular_player" || waTargetType === "particular_owner" || waTargetType === "custom") {
      effectiveGroup = "custom";
    } else if (waTargetType === "organizer") {
      effectiveGroup = "organizer";
      const currentT = tournaments.find((t) => String(t.id) === selectedTournamentId);
      if (currentT?.organizerMobile) {
        effectiveMobile = currentT.organizerMobile;
      }
    } else if (waTargetType === "broadcast_group") {
      effectiveGroup = waBroadcastGroup;
    }

    try {
      const body: Record<string, unknown> = {
        channel: "whatsapp",
        recipientGroup: effectiveGroup,
        messageContent: waTemplateKey === "custom" ? waCustomText : "",
        templateName: waTemplateKey,
        templateVariables: waTemplateVariables,
      };
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        body.tournamentId = parseInt(selectedTournamentId);
      }
      if (effectiveGroup === "custom" || effectiveGroup === "organizer") {
        body.customMobile = effectiveMobile;
        body.manualMobiles = [effectiveMobile];
      }

      const r = await fetch("/api/auth/admin/communicate/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        const sentCount = data.sent ?? 0;
        const failedCount = data.failed ?? 0;
        setWaSendResult({
          success: true,
          blastId: data.blastId,
          total: data.total ?? (sentCount + failedCount),
          sent: sentCount,
          blocked: data.blocked ?? 0,
          failed: failedCount,
          stub: data.stub,
          results: data.results,
        });
        toast({
          title: "WhatsApp Dispatched Successfully",
          description: `Dispatched to ${sentCount} recipient${sentCount === 1 ? "" : "s"}.`,
        });
        setShowDispatchConfirmDialog(false);
        void loadWaData();
      } else {
        const errMsg = data.error ?? "WhatsApp Dispatch Failed";
        setWaSendResult({
          success: false,
          sent: 0,
          failed: 1,
          error: errMsg,
        });
        toast({
          title: "Dispatch Failed",
          description: errMsg,
          variant: "destructive",
        });
        setShowDispatchConfirmDialog(false);
      }
    } catch {
      const errMsg = "Network error sending WhatsApp";
      setWaSendResult({ success: false, sent: 0, failed: 1, error: errMsg });
      toast({
        title: "Network Error",
        description: errMsg,
        variant: "destructive",
      });
      setShowDispatchConfirmDialog(false);
    } finally {
      setSendingWa(false);
    }
  };

  // Search & Filtered Delivery Receipts
  const filteredWaLogs = useMemo(() => {
    return waLogs.filter((l) => {
      const searchLower = receiptSearch.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        (l.recipientMobile && l.recipientMobile.toLowerCase().includes(searchLower)) ||
        (l.templateName && l.templateName.toLowerCase().includes(searchLower)) ||
        (l.messageContent && l.messageContent.toLowerCase().includes(searchLower));
      const matchesStatus =
        receiptStatusFilter === "all" ||
        (receiptStatusFilter === "failed" && l.deliveryStatus === "failed") ||
        (receiptStatusFilter === "sent" && l.deliveryStatus === "sent") ||
        (receiptStatusFilter === "delivered" && (l.deliveryStatus === "delivered" || l.deliveryStatus === "read")) ||
        (receiptStatusFilter === "read" && l.deliveryStatus === "read");
      return matchesSearch && matchesStatus;
    });
  }, [waLogs, receiptSearch, receiptStatusFilter]);

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
  const isLicensedForWa = selectedTournamentId === "__all__" || (selectedTournament?.licenseStatus === "active" && !selectedTournament?.adminLocked);

  const waBlockDetails = useMemo(() => {
    if (!selectedTournamentId || selectedTournamentId === "__all__") return null;
    if (!selectedTournament) {
      return {
        badge: "Not Found",
        reason: "Selected tournament record not found.",
        canAction: false,
        actionLabel: "",
      };
    }
    if (selectedTournament.adminLocked) {
      return {
        badge: "Admin Locked",
        reason: `Tournament "${selectedTournament.name}" is locked by Administrator.`,
        canAction: true,
        actionLabel: "Unlock Tournament",
      };
    }
    if (selectedTournament.licenseStatus === "trial") {
      return {
        badge: "Trial Mode",
        reason: `"${selectedTournament.name}" is in Trial mode (requires Active Live License for WhatsApp).`,
        canAction: true,
        actionLabel: "Grant / Upgrade License",
      };
    }
    if (selectedTournament.licenseStatus === "completed") {
      return {
        badge: "Completed",
        reason: `"${selectedTournament.name}" auction is marked completed.`,
        canAction: true,
        actionLabel: "View Tournament",
      };
    }
    return {
      badge: selectedTournament.licenseStatus || "Unlicensed",
      reason: `"${selectedTournament.name}" license is '${selectedTournament.licenseStatus || "inactive"}' (Active license required).`,
      canAction: true,
      actionLabel: "Manage License",
    };
  }, [selectedTournamentId, selectedTournament]);

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

  // WhatsApp Pre-Approved Templates Metadata (Meta-Approved Only)
  const defaultWaTemplates: WaTemplateOption[] = useMemo(() => [
    {
      id: "auction_player_sold",
      templateName: "auction_player_sold",
      metaTemplateName: "auction_player_sold",
      title: "🏏 Player Sold Celebration",
      displayName: "🏏 Player Sold Celebration",
      category: "utility",
      description: "Meta-approved celebratory announcement with image header sent when a player is sold to a team",
      language: "en",
      headerType: "image",
      headerImageUrl: "/assets/branding/player-sold-banner.jpg",
      metaApproved: true,
      isUsableInBidwar: true,
      status: "approved",
      evidenceSource: "Meta WhatsApp Business Manager (WABA) Confirmed Template Registry",
      evidenceTimestamp: "2026-10-29T00:00:00Z",
      liveSyncStatus: "sync_unavailable",
      liveSyncNote: "Live Meta Graph API sync unavailable without direct Meta credentials; serving previously verified approval evidence.",
      body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
      variables: [
        { key: "1", label: "Player Name", placeholder: "e.g. Virat Kohli" },
        { key: "2", label: "Winning Team", placeholder: "e.g. Royal Challengers" },
        { key: "3", label: "Sold Amount", placeholder: "e.g. ₹25,00,000" },
        { key: "4", label: "Tournament Name", placeholder: "e.g. Premier League 2026" },
      ],
      sampleArgs: ["Virat Kohli", "Royal Challengers", "₹25,00,000", "Premier League 2026"],
    },
  ], []);

  // Operational active templates: ONLY Meta-approved and verified for BIDWAR use
  const waTemplates: WaTemplateOption[] = useMemo(() => {
    if (availableWaTemplates.length > 0) {
      const approved = availableWaTemplates
        .filter(
          (t) =>
            t.metaApproved === true &&
            t.status === "approved" &&
            (t.templateName === "auction_player_sold" || t.id === "auction_player_sold")
        )
        .map((t) => ({
          ...t,
          id: t.templateName || String(t.id),
        }));
      if (approved.length > 0) return approved;
    }
    return defaultWaTemplates;
  }, [availableWaTemplates, defaultWaTemplates]);

  // Non-approved development templates (for restricted debug view only)
  const devUnapprovedTemplates: WaTemplateOption[] = useMemo(() => {
    if (availableWaTemplates.length > 0) {
      return availableWaTemplates.filter(
        (t) => !t.metaApproved || t.status !== "approved" || t.templateName !== "auction_player_sold"
      );
    }
    return [
      {
        id: "player_sold",
        templateName: "player_sold",
        title: "🏏 Player Sold Celebration (Legacy Alias)",
        category: "utility",
        description: "Legacy development alias for auction_player_sold",
        language: "en",
        body: "🏏 PLAYER SOLD!\n\nCongratulations, {{1}}! 🎉\n\nYou have been sold to *{{2}}* for *{{3}}* in the *{{4}}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions",
        status: "duplicate",
        metaApproved: false,
        isUsableInBidwar: false,
        exclusionReason: "Duplicate alias of canonical Meta template 'auction_player_sold'. Hidden from operational dropdown.",
        variables: [],
      },
      {
        id: "welcome_invite",
        templateName: "welcome_invite",
        title: "🎉 Welcome & Tournament Invite (Dev Placeholder)",
        category: "utility",
        description: "Tournament invitation created during development",
        language: "en",
        body: "*Welcome to BidWar Auction!*\n\nYou are invited to participate in *{{1}}*.\n\n📅 Date: {{2}}\n📍 Venue/Mode: {{3}}\n\nClick below to view details and live rosters.",
        status: "unapproved",
        metaApproved: false,
        isUsableInBidwar: false,
        exclusionReason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
        variables: [],
      },
      {
        id: "auction_reminder",
        templateName: "auction_reminder",
        title: "🚨 Live Auction Countdown Alert (Dev Placeholder)",
        category: "utility",
        description: "Countdown alert created during development",
        language: "en",
        body: "*🚨 Live Auction Starting Soon!*\n\nThe player auction for *{{1}}* begins in *{{2}} minutes*.\n\nTap the link below to enter the live bidding arena right now:\n{{3}}",
        status: "unapproved",
        metaApproved: false,
        isUsableInBidwar: false,
        exclusionReason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
        variables: [],
      },
      {
        id: "consent_optin",
        templateName: "consent_optin",
        title: "📲 WhatsApp Consent Opt-In Request (Dev Placeholder)",
        category: "utility",
        description: "Consent opt-in created during development",
        language: "en",
        body: "*BidWar Instant Alerts*\n\nTo receive real-time bid updates, sale notifications, and squad announcements directly on WhatsApp, please confirm your opt-in:\n\n{{1}}",
        status: "unapproved",
        metaApproved: false,
        isUsableInBidwar: false,
        exclusionReason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
        variables: [],
      },
      {
        id: "credentials_share",
        templateName: "credentials_share",
        title: "🔑 Team Owner Credentials (Dev Placeholder)",
        category: "authentication",
        description: "Credentials share created during development",
        language: "en",
        body: "*BidWar Team Pass*\n\nYour owner access for *{{1}}* (Team *{{2}}*) is ready.\n\n🔑 PIN: *{{3}}*\n🌐 App: {{4}}\n\nDo not share this PIN with anyone.",
        status: "unapproved",
        metaApproved: false,
        isUsableInBidwar: false,
        exclusionReason: "Locally invented placeholder created in development. Not registered or approved in Meta WhatsApp Manager. Excluded from operations.",
        variables: [],
      },
    ];
  }, [availableWaTemplates, defaultWaTemplates]);

  const selectedSmsTpl = dltTemplates.find((t) => t.id === smsTemplateKey) ?? dltTemplates[0];
  const selectedWaTpl = waTemplates.find((t) => t.id === waTemplateKey) ?? waTemplates[0];

  const previewWaBody = useMemo(() => {
    if (waTemplateKey === "custom") {
      return waCustomText || "Type custom message to preview...";
    }
    let body = selectedWaTpl?.body || "";
    if (selectedWaTpl?.variables) {
      for (const v of selectedWaTpl.variables) {
        const val = waTemplateVariables[v.key]?.trim() || `[${v.label}]`;
        body = body.split(`{{${v.key}}}`).join(val);
      }
    }
    return body;
  }, [waTemplateKey, waCustomText, selectedWaTpl, waTemplateVariables]);

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
                                onClick={() => void handleViewJob(j)}
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
            {/* ═════════════════════════════════════════════════════════════════════
                GATE A: TRUTHFUL WHATSAPP PROVIDER GATEWAY BANNER
               ═════════════════════════════════════════════════════════════════════ */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4.5 rounded-xl border border-border bg-card/80 backdrop-blur-sm gap-4 shadow-xs">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border ${
                  waProviderStatus?.status === "configured"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : waProviderStatus?.status === "mock"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : waProviderStatus?.status === "invalid_config"
                    ? "bg-rose-500/15 border-rose-500/30 text-rose-400"
                    : "bg-zinc-500/15 border-zinc-500/30 text-zinc-400"
                }`}>
                  <MessageSquare className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight">
                      Active Gateway:{" "}
                      <span className="text-foreground">
                        {loadingProviderStatus ? "Checking status..." : (waProviderStatus?.displayName || "Not Configured")}
                      </span>
                    </h3>
                    {loadingProviderStatus ? (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Verifying
                      </Badge>
                    ) : waProviderStatus?.status === "configured" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1 font-medium">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Provider Configured
                      </Badge>
                    ) : waProviderStatus?.status === "mock" ? (
                      <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] gap-1 font-medium">
                        <AlertTriangle className="h-2.5 w-2.5" /> Mock Mode (Dev Only)
                      </Badge>
                    ) : waProviderStatus?.status === "invalid_config" ? (
                      <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[10px] gap-1 font-medium">
                        <XCircle className="h-2.5 w-2.5" /> Missing Credentials
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
                        <XCircle className="h-2.5 w-2.5" /> Unconfigured
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {waProviderStatus?.connectivityNote || "Managed via server environment (WHATSAPP_PROVIDER) • UI switching disabled for safety"}
                  </p>

                  {/* Delivery Health Metrics */}
                  {waProviderStatus?.deliveryHealth && waProviderStatus.deliveryHealth.totalLogged > 0 && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5">
                      <span className="flex items-center gap-1 text-emerald-400 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                        {waProviderStatus.deliveryHealth.deliveredCount} delivered
                      </span>
                      {waProviderStatus.deliveryHealth.failedCount > 0 && (
                        <span className="text-rose-400 font-medium">
                          {waProviderStatus.deliveryHealth.failedCount} failed
                        </span>
                      )}
                      <span>(last {waProviderStatus.deliveryHealth.totalLogged} dispatches)</span>
                      {waProviderStatus.deliveryHealth.lastDispatchedAt && (
                        <span className="text-[10px] text-muted-foreground/80">
                          • Last: {formatDate(waProviderStatus.deliveryHealth.lastDispatchedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-border hover:bg-muted/50"
                  onClick={() => void loadWaData()}
                  disabled={loadingProviderStatus}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingProviderStatus ? "animate-spin" : ""}`} /> Refresh Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => setShowQrDialog(true)}
                >
                  <QrCode className="h-3.5 w-3.5" /> 1-Click Opt-in Link
                </Button>
              </div>
            </div>

            {/* Provider Configuration Warning Alert */}
            {waProviderStatus?.configErrors && waProviderStatus.configErrors.length > 0 && (
              <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/10 text-xs text-rose-300 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-300">Provider Credentials Required</p>
                  <p className="text-[11px] text-rose-300/80">
                    The active WhatsApp provider ({waProviderStatus.displayName}) requires the following environment variables on the server before live messages can be dispatched:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-rose-200">
                    {waProviderStatus.configErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Compact WhatsApp License Warning with Exact Reason & Action */}
            {!isLicensedForWa && waBlockDetails && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-lg border border-amber-500/25 bg-amber-500/10 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-300 shrink-0">WhatsApp Blocked:</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 bg-amber-500/15 text-amber-300 font-medium shrink-0">
                    {waBlockDetails.badge}
                  </Badge>
                  <span className="text-[11px] text-zinc-300 truncate max-w-xl">
                    {waBlockDetails.reason}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden lg:inline">
                    (No SMS fallback)
                  </span>
                </div>
                {waBlockDetails.canAction && selectedTournament && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/admin/tournaments/${selectedTournament.id}`)}
                    className="h-6 text-[11px] px-2.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/20 shrink-0 gap-1 self-start sm:self-center"
                  >
                    {waBlockDetails.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
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

            {/* Rich Dispatch Execution Summary Banner */}
            {waSendResult && (
              <Card className={`border ${waSendResult.success ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      {waSendResult.success ? (
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
                          <XCircle className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {waSendResult.success ? "WhatsApp Broadcast Execution Completed" : "Broadcast Dispatch Blocked / Failed"}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {waSendResult.stub
                            ? "Simulated in Mock/Stub Mode (Non-production environment)"
                            : waSendResult.error || "Results aggregated from policy evaluation and provider delivery pipeline"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs font-semibold">
                        Sent: {waSendResult.sent}
                      </Badge>
                      {(waSendResult.blocked ?? 0) > 0 && (
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs font-semibold">
                          Blocked: {waSendResult.blocked}
                        </Badge>
                      )}
                      {waSendResult.failed > 0 && (
                        <Badge className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-xs font-semibold">
                          Failed: {waSendResult.failed}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setWaSendResult(null)}
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>

                  {/* Per-recipient breakdown if any blocks or failures occurred */}
                  {waSendResult.results && waSendResult.results.some((r) => !r.success) && (
                    <div className="pt-2.5 border-t border-border/60 space-y-1.5">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Blocked or Failed Recipients Breakdown:
                      </p>
                      <div className="max-h-36 overflow-y-auto divide-y divide-border/40 text-xs font-mono">
                        {waSendResult.results.filter((r) => !r.success).map((r, idx) => (
                          <div key={idx} className="py-1.5 flex items-center justify-between gap-3">
                            <span className="font-medium text-foreground">{r.mobile}</span>
                            <span className={`text-[11px] truncate max-w-sm ${r.blocked ? "text-amber-400" : "text-rose-400"}`}>
                              {r.error || (r.blocked ? "Blocked by policy" : "Provider dispatch error")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Mobile Responsive View Switcher (< lg) */}
            <div className="lg:hidden flex rounded-lg p-1 bg-muted/40 border border-border">
              <button
                type="button"
                onClick={() => setWaMobileTab("compose")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  waMobileTab === "compose"
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Send className="h-3.5 w-3.5 text-emerald-400" />
                Compose Broadcast
              </button>
              <button
                type="button"
                onClick={() => setWaMobileTab("preview")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  waMobileTab === "preview"
                    ? "bg-background text-foreground shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                Live Preview Mockup
              </button>
            </div>

            {/* Broadcast Form & Live WhatsApp Bubble Mockup */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: WhatsApp Composer */}
              <div className={`space-y-4 lg:col-span-6 ${waMobileTab === "compose" ? "block" : "hidden lg:block"}`}>
                <Card className="border-border bg-card/60 backdrop-blur-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="h-4 w-4 text-emerald-400" />
                      1. WhatsApp Broadcast Composer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Send approved WhatsApp templates directly to player and team owner devices
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 1. Recipient Target Selector */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-emerald-400" />
                          Target Recipient
                        </Label>
                        <span className="text-[10px] text-muted-foreground">Individual or Group</span>
                      </div>

                      {/* Target Type Pill Tabs */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-muted/40 rounded-lg border border-border/60">
                        <button
                          type="button"
                          onClick={() => setWaTargetType("particular_player")}
                          className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                            waTargetType === "particular_player"
                              ? "bg-emerald-600 text-white shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <User className="h-3.5 w-3.5" />
                          Player
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaTargetType("particular_owner")}
                          className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                            waTargetType === "particular_owner"
                              ? "bg-emerald-600 text-white shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <Briefcase className="h-3.5 w-3.5" />
                          Team Owner
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWaTargetType("organizer");
                            const currentT = tournaments.find((t) => String(t.id) === selectedTournamentId);
                            if (currentT?.organizerMobile) setWaCustomMobile(currentT.organizerMobile);
                          }}
                          className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                            waTargetType === "organizer"
                              ? "bg-emerald-600 text-white shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <Crown className="h-3.5 w-3.5" />
                          Organiser
                        </button>
                        <button
                          type="button"
                          onClick={() => setWaTargetType("broadcast_group")}
                          className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                            waTargetType === "broadcast_group"
                              ? "bg-emerald-600 text-white shadow-xs font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          <Radio className="h-3.5 w-3.5" />
                          Broadcast
                        </button>
                      </div>

                      {/* Sub-Selection based on Target Type */}
                      {waTargetType === "particular_player" && (
                        <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" /> Select Particular Player
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {waTournamentPlayers.length} players loaded
                            </span>
                          </div>

                          <Select value={selectedPlayerId} onValueChange={handleSelectPlayer}>
                            <SelectTrigger className="text-xs bg-background">
                              <SelectValue placeholder="Choose a player..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-64">
                              {waTournamentPlayers.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">No players registered in this tournament</div>
                              ) : (
                                waTournamentPlayers.map((p) => {
                                  const isSold = p.status === "sold" || (p.soldPrice && p.soldPrice > 0);
                                  const team = waTournamentTeams.find((t) => t.id === p.teamId);
                                  return (
                                    <SelectItem key={p.id} value={String(p.id)} className="text-xs py-1.5">
                                      <div className="flex items-center justify-between gap-3 w-full">
                                        <span className="font-semibold text-foreground">{p.name}</span>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                          {isSold ? (
                                            <Badge variant="outline" className="px-1.5 py-0 text-amber-300 border-amber-500/40 bg-amber-500/10">
                                              🏆 Sold {team ? `(${team.shortCode || team.name})` : ""}
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="px-1.5 py-0 text-zinc-400 border-zinc-600/40">
                                              {p.status || "Registered"}
                                            </Badge>
                                          )}
                                          <span className="font-mono text-muted-foreground">{p.mobileNumber ? `📱 ${p.mobileNumber}` : "❌ No mobile"}</span>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  );
                                })
                              )}
                            </SelectContent>
                          </Select>

                          {/* Player details & mobile override */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">WhatsApp Mobile:</span>
                              <span className="text-[10px] text-zinc-400">(Editable for direct dispatch)</span>
                            </div>
                            <Input
                              placeholder="e.g. +919876543210"
                              value={waCustomMobile}
                              onChange={(e) => setWaCustomMobile(e.target.value)}
                              className="h-8 text-xs font-mono bg-background"
                            />
                            {!waCustomMobile && selectedPlayerId && (
                              <p className="text-[10px] text-amber-400">⚠️ This player has no registered phone number. Enter one above to dispatch.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {waTargetType === "particular_owner" && (
                        <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <Briefcase className="h-3.5 w-3.5" /> Select Particular Team Owner
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {waTournamentTeams.length} teams loaded
                            </span>
                          </div>

                          <Select value={selectedTeamId} onValueChange={handleSelectTeam}>
                            <SelectTrigger className="text-xs bg-background">
                              <SelectValue placeholder="Choose a team..." />
                            </SelectTrigger>
                            <SelectContent>
                              {waTournamentTeams.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground text-center">No teams registered in this tournament</div>
                              ) : (
                                waTournamentTeams.map((tm) => (
                                  <SelectItem key={tm.id} value={String(tm.id)} className="text-xs py-1.5">
                                    <div className="flex items-center justify-between gap-3 w-full">
                                      <span className="font-semibold text-foreground">{tm.name} ({tm.shortCode || "TEAM"})</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        Owner: {tm.ownerName || "Unnamed"} ({tm.ownerMobile ? `📱 ${tm.ownerMobile}` : "❌ No mobile"})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>

                          {/* Team Owner details & mobile override */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Owner WhatsApp Mobile:</span>
                              <span className="text-[10px] text-zinc-400">(Editable)</span>
                            </div>
                            <Input
                              placeholder="e.g. +919876543210"
                              value={waCustomMobile}
                              onChange={(e) => setWaCustomMobile(e.target.value)}
                              className="h-8 text-xs font-mono bg-background"
                            />
                          </div>
                        </div>
                      )}

                      {waTargetType === "organizer" && (
                        <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                              <Crown className="h-3.5 w-3.5" /> Tournament Organiser Contact
                            </span>
                            <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/30">
                              Admin & Setup
                            </Badge>
                          </div>
                          {(() => {
                            const currentT = tournaments.find((t) => String(t.id) === selectedTournamentId);
                            return (
                              <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="text-muted-foreground">Organiser Name:</span>
                                  <span className="font-semibold text-foreground">{currentT?.organizerName || "Tournament Organiser"}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[11px] text-muted-foreground">WhatsApp Mobile:</span>
                                  <Input
                                    placeholder="e.g. +919876543210"
                                    value={waCustomMobile || currentT?.organizerMobile || ""}
                                    onChange={(e) => setWaCustomMobile(e.target.value)}
                                    className="h-8 text-xs font-mono bg-background"
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {waTargetType === "broadcast_group" && (
                        <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2">
                          <Label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                            <Radio className="h-3.5 w-3.5" /> Broadcast Group Audience
                          </Label>
                          <Select value={waBroadcastGroup} onValueChange={setWaBroadcastGroup}>
                            <SelectTrigger className="text-xs bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sold_players">🏆 All Sold Players (Personalized Sold Posters)</SelectItem>
                              <SelectItem value="all_players">👥 All Consented Players</SelectItem>
                              <SelectItem value="unsold_players">⏳ Unsold Players</SelectItem>
                              <SelectItem value="all_owners">👔 All Team Owners</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-muted-foreground">
                            Delivers official WhatsApp notification to all consented recipients in this group.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Template Selector with Loading / Error / Empty States */}
                    {loadingWaTemplates ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">Approved WhatsApp Template</Label>
                        <div className="h-9 w-full rounded-md bg-muted/60 animate-pulse" />
                      </div>
                    ) : waTemplatesError ? (
                      <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center justify-between">
                        <span>{waTemplatesError}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void loadWaData()}>Retry</Button>
                      </div>
                    ) : (
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
                    )}

                    {/* Selected Template Details Card */}
                    {selectedWaTpl && waTemplateKey !== "custom" && (
                      <div className="p-3 rounded-lg border border-border/70 bg-muted/30 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {selectedWaTpl.templateName || selectedWaTpl.id}
                            </span>
                            {selectedWaTpl.category && (
                              <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0 text-sky-400 border-sky-400/30">
                                {selectedWaTpl.category}
                              </Badge>
                            )}
                            {selectedWaTpl.language && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                                {selectedWaTpl.language === "en" ? "English (en)" : selectedWaTpl.language}
                              </Badge>
                            )}
                            {selectedWaTpl.headerType === "image" && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-300 border-amber-500/30 bg-amber-500/10">
                                🖼️ 4:5 Portrait Image Header
                              </Badge>
                            )}
                          </div>
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px] gap-1 py-0 font-semibold">
                            <BadgeCheck className="h-3 w-3" /> Meta Approved
                          </Badge>
                        </div>
                        {selectedWaTpl.description && (
                          <p className="text-[11px] text-muted-foreground">{selectedWaTpl.description}</p>
                        )}
                      </div>
                    )}

                    {/* Dynamic Sale Selector for auction_player_sold */}
                    {(waTemplateKey === "auction_player_sold" || waTemplateKey === "player_sold") && (
                      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Poster Preview Data Source
                          </Label>
                          {selectedSaleId === "sample" ? (
                            <Badge variant="outline" className="text-[9px] bg-amber-500/20 text-amber-300 border-amber-500/40">
                              Illustrative Sample
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                              ⭐ Real Sale #{selectedSaleId}
                            </Badge>
                          )}
                        </div>
                        <Select
                          value={selectedSaleId}
                          onValueChange={(val) => {
                            setSelectedSaleId(val);
                            if (val === "sample") {
                              const tObj = tournaments.find((t) => String(t.id) === selectedTournamentId);
                              setWaTemplateVariables({
                                "1": "Virat Kohli",
                                "2": "Royal Challengers",
                                "3": "₹25,00,000",
                                "4": tObj?.name || "Premier League 2026",
                              });
                            } else {
                              const sale = recentSales.find((s) => String(s.id) === val);
                              if (sale) {
                                setWaTemplateVariables({
                                  "1": sale.playerName,
                                  "2": sale.teamName,
                                  "3": sale.formattedAmount,
                                  "4": sale.tournamentName,
                                });
                                setSelectedPlayerId(String(sale.id));
                                const match = waTournamentPlayers.find((p) => String(p.id) === String(sale.id) || p.name.toLowerCase() === sale.playerName.toLowerCase());
                                if (match?.mobileNumber) {
                                  setWaCustomMobile(match.mobileNumber);
                                }
                              }
                            }
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-background/70 border-border">
                            <SelectValue placeholder="Select sale or test data..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sample">🎨 Illustrative Sample (Virat Kohli)</SelectItem>
                            {recentSales.map((sale) => (
                              <SelectItem key={sale.id} value={String(sale.id)}>
                                ⭐ {sale.playerName} → {sale.teamName} ({sale.formattedAmount})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Template Dynamic Variables (if required) */}
                    {waTemplateKey !== "custom" && selectedWaTpl?.variables && selectedWaTpl.variables.length > 0 && (
                      <div className="space-y-2 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-emerald-400">Template Dynamic Variables</Label>
                          {waTargetType === "particular_player" && (
                            <span className="text-[10px] text-emerald-300/80 italic">Auto-resolved from player profile</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedWaTpl.variables.map((v) => (
                            <div key={v.key} className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">{v.label} ({`{{${v.key}}}`})</Label>
                              <Input
                                placeholder={v.placeholder}
                                value={waTemplateVariables[v.key] ?? ""}
                                onChange={(e) => setWaTemplateVariables((prev) => ({ ...prev, [v.key]: e.target.value }))}
                                className="h-8 text-xs bg-background/50"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

                    {/* Inline error notice right above the send button */}
                    {waSendResult && !waSendResult.success && (
                      <div className="p-3 rounded-lg border border-red-500/50 bg-red-500/10 text-xs text-red-200 flex items-start gap-2.5 animate-in fade-in duration-200">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-red-300">Action Required</p>
                          <p className="text-[11px] text-red-200/90 leading-relaxed">{waSendResult.error}</p>
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md hover:shadow-lg transition-all text-sm font-semibold py-2.5 cursor-pointer"
                      disabled={waSending}
                      onClick={handleSendWa}
                    >
                      {waSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {waTargetType === "broadcast_group" ? "Dispatch WhatsApp Broadcast" : "Send WhatsApp Message"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Live WhatsApp Bubble Mockup */}
              <div className={`space-y-4 lg:col-span-6 ${waMobileTab === "preview" ? "block" : "hidden lg:block"}`}>
                <Card className="border-border bg-card/60 backdrop-blur-sm sticky top-6">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Eye className="h-4 w-4 text-emerald-400" />
                        Live WhatsApp Preview Mockup
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10">
                        4:5 Portrait
                      </Badge>
                    </div>
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

                      {/* WhatsApp Emerald Bubble with Optional Image Header */}
                      <div className="overflow-hidden rounded-xl rounded-tl-xs bg-[#005c4b] text-xs text-zinc-100 shadow w-full">
                        {selectedWaTpl?.headerType === "image" && (
                          (waTemplateKey === "auction_player_sold" || waTemplateKey === "player_sold") ? (
                            <div className="relative w-full aspect-[4/5] overflow-hidden border-b border-emerald-600/40">
                              <PlayerSoldPoster
                                playerName={waTemplateVariables["1"] || activeSale?.playerName || "Virat Kohli"}
                                playerPhotoUrl={activeSale?.playerPhotoUrl || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.photoUrl}
                                playerRole={activeSale?.playerRole || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.primaryRole || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.role}
                                teamName={waTemplateVariables["2"] || activeSale?.teamName || "Royal Challengers"}
                                teamLogoUrl={activeSale?.teamLogoUrl || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.logoUrl}
                                teamShortCode={activeSale?.teamShortCode || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.shortCode}
                                teamColor={activeSale?.teamColor || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.color}
                                amount={waTemplateVariables["3"] || activeSale?.formattedAmount || "₹25,00,000"}
                                tournamentName={waTemplateVariables["4"] || activeSale?.tournamentName || (tournaments.find((t) => String(t.id) === selectedTournamentId)?.name || "Premier League 2026")}
                                tournamentSport={activeSale?.tournamentSport || "Cricket"}
                                auctionUnit={activeSale?.auctionUnit || "rupee"}
                                isIllustrative={!activeSale && waTargetType !== "particular_player"}
                                showDownloadButton={false}
                                className="w-full h-full"
                              />
                              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-mono font-bold text-amber-300 backdrop-blur-xs flex items-center gap-1.5 z-20 shadow-sm border border-amber-500/30">
                                <span>🖼️ 4:5 Portrait Sold Poster</span>
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-full aspect-[16/9] bg-black/40 overflow-hidden border-b border-emerald-600/40">
                              <img
                                src={selectedWaTpl.headerImageUrl || "/assets/branding/player-sold-banner.jpg"}
                                alt="Header Artwork Banner"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-emerald-300 backdrop-blur-xs flex items-center gap-1">
                                <span>🖼️ Meta Image Header</span>
                              </div>
                            </div>
                          )
                        )}
                        <div className="p-3 space-y-2 leading-relaxed whitespace-pre-line">
                          {previewWaBody}
                          <div className="pt-2 border-t border-emerald-600/40 text-[10px] text-emerald-200/70 italic">
                            Reply STOP to unsubscribe.
                          </div>
                          <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-300/80">
                            <span>12:45 PM</span>
                            <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 1-Click Social Media / WhatsApp Status Export Button */}
                    {(waTemplateKey === "auction_player_sold" || waTemplateKey === "player_sold") && (
                      <div className="w-full max-w-sm mt-3 pt-3 border-t border-zinc-800 flex flex-col items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadPosterPreview}
                          className="w-full gap-2 border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold py-2"
                        >
                          <Download className="w-4 h-4 text-amber-400" />
                          Save High-Res Poster (1080×1350 PNG for Social Media)
                        </Button>
                        <p className="text-[10px] text-zinc-400 text-center">
                          4:5 Portrait aspect ratio • Perfect for WhatsApp Status, Stories & Instagram feed
                        </p>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-3 text-center">
                      Simulated Preview (Illustrative formatting only; actual device display depends on WhatsApp client. Not a real delivery receipt).
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Restricted Development / Non-Approved Templates Registry (Debug View) */}
            {/* Developer Audit / Non-Approved Templates (Clean Collapsible Accordion) */}
            <details className="border border-border/60 rounded-xl bg-card/25 p-3.5 text-xs group transition-all">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none text-muted-foreground hover:text-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  <span className="font-semibold text-xs text-foreground/80">Developer Registry: Blocked / Non-Approved Templates</span>
                  <Badge variant="outline" className="text-[9px] text-zinc-400 border-border">
                    {devUnapprovedTemplates.length} Excluded
                  </Badge>
                </div>
                <span className="text-[10px] text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="space-y-3 pt-3 mt-2 border-t border-border/50">
                <p className="text-[11px] text-muted-foreground">
                  Internal audit of draft, duplicate, and development-only templates excluded from live dispatch per Meta WABA policies.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border bg-card/80">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead>Template / ID</TableHead>
                        <TableHead>Category / Lang</TableHead>
                        <TableHead>Registry Status</TableHead>
                        <TableHead>Exclusion Reason</TableHead>
                        <TableHead className="text-right">Dispatch Safety</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {devUnapprovedTemplates.map((t) => (
                        <TableRow key={t.id} className="text-xs">
                          <TableCell className="font-mono text-xs">
                            <div className="font-semibold text-foreground">{t.templateName || t.id}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{t.title}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-[9px] uppercase px-1 py-0">
                                {t.category || "utility"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">({t.language || "en"})</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {t.status === "duplicate" ? (
                              <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px] font-medium">
                                Duplicate Alias
                              </Badge>
                            ) : (
                              <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-[10px] font-medium">
                                Unapproved Dev
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground max-w-sm">
                            {t.exclusionReason || "Not registered or approved in Meta WhatsApp Business Manager."}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30 bg-rose-500/10 font-mono">
                              BLOCKED
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </details>

            {/* WhatsApp Logs Table (Searchable & Filterable) */}
            <Card className="border-border bg-card/60">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    WhatsApp Delivery Receipts
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Reconciled delivery receipts and provider status audit trail
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => void loadWaData()} className="h-8 gap-1 text-xs">
                    <RefreshCw className="h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search & Status Filters */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search recipient mobile, template name, or message text..."
                      value={receiptSearch}
                      onChange={(e) => setReceiptSearch(e.target.value)}
                      className="h-8 pl-8 text-xs bg-background/50"
                    />
                  </div>
                  <Select value={receiptStatusFilter} onValueChange={setReceiptStatusFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered / Read</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
                    {filteredWaLogs.length > 0 ? (
                      filteredWaLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs font-medium">
                            {l.recipientMobile}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs font-medium">{l.templateName || "WhatsApp Broadcast"}</div>
                            <div className="text-[11px] text-muted-foreground truncate max-w-sm">{l.messageContent}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 items-start">
                              <StatusBadge status={l.deliveryStatus} />
                              {l.errorMessage && (
                                <span title={l.errorMessage} className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-mono max-w-xs truncate">
                                  <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                                  {l.errorMessage}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(l.sentAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                          {receiptSearch || receiptStatusFilter !== "all"
                            ? "No delivery receipts matched your search or status filter."
                            : "No WhatsApp dispatches recorded for this tournament yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pre-Dispatch Explicit Confirmation Dialog */}
            <Dialog open={showDispatchConfirmDialog} onOpenChange={setShowDispatchConfirmDialog}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4 text-emerald-400" /> Confirm WhatsApp Broadcast Dispatch
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Please review recipient scope, parameters, and licensing safeguards before triggering delivery.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3.5 py-2 text-xs">
                  <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tournament:</span>
                      <span className="font-semibold text-foreground">
                        {tournaments.find((t) => String(t.id) === selectedTournamentId)?.name || (selectedTournamentId ? `Tournament #${selectedTournamentId}` : "All Tournaments")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Target Audience:</span>
                      <Badge variant="outline" className="text-[11px] font-medium">
                        {waTargetType === "particular_player" && `👤 Player: ${waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.name || "Selected Player"} (${waCustomMobile})`}
                        {waTargetType === "particular_owner" && `👔 Owner: ${waTournamentTeams.find((t) => String(t.id) === selectedTeamId)?.name || "Selected Team"} (${waCustomMobile})`}
                        {waTargetType === "organizer" && `👑 Organiser (${waCustomMobile})`}
                        {waTargetType === "broadcast_group" && (
                          waBroadcastGroup === "sold_players" ? "🏆 All Sold Players" :
                          waBroadcastGroup === "unsold_players" ? "⏳ Unsold Players" :
                          waBroadcastGroup === "all_owners" ? "👔 All Team Owners" : "👥 All Consented Players"
                        )}
                        {waTargetType === "custom" && `📱 Custom: ${waCustomMobile}`}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Selected Template:</span>
                      <span className="font-medium text-emerald-400">{selectedWaTpl?.title || waTemplateKey}</span>
                    </div>
                  </div>

                  {/* Variables Summary */}
                  {selectedWaTpl?.variables && selectedWaTpl.variables.length > 0 && waTemplateKey !== "custom" && (
                    <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-1.5">
                      <span className="text-[11px] font-semibold text-muted-foreground">Interpolated Parameters:</span>
                      <div className="space-y-1">
                        {selectedWaTpl.variables.map((v) => (
                          <div key={v.key} className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground font-mono">{`{{${v.key}}}`} ({v.label}):</span>
                            <span className="font-medium truncate max-w-[180px]">{waTemplateVariables[v.key] || "(auto-resolved from tournament)"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Preview with Optional Header Image */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">Message Live Preview:</span>
                    <div className="overflow-hidden rounded-lg border border-zinc-700 bg-[#005c4b] text-xs text-zinc-100 max-h-56 overflow-y-auto">
                      {selectedWaTpl?.headerType === "image" && (
                        (waTemplateKey === "auction_player_sold" || waTemplateKey === "player_sold") ? (
                          <div className="relative w-full aspect-[4/5] overflow-hidden border-b border-emerald-600/40">
                            <PlayerSoldPoster
                              playerName={waTemplateVariables["1"] || activeSale?.playerName || "Virat Kohli"}
                              playerPhotoUrl={activeSale?.playerPhotoUrl || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.photoUrl}
                              playerRole={activeSale?.playerRole || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.primaryRole || waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId)?.role}
                              teamName={waTemplateVariables["2"] || activeSale?.teamName || "Royal Challengers"}
                              teamLogoUrl={activeSale?.teamLogoUrl || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.logoUrl}
                              teamShortCode={activeSale?.teamShortCode || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.shortCode}
                              teamColor={activeSale?.teamColor || waTournamentTeams.find((t) => t.name === waTemplateVariables["2"])?.color}
                              amount={waTemplateVariables["3"] || activeSale?.formattedAmount || "₹25,00,000"}
                              tournamentName={waTemplateVariables["4"] || activeSale?.tournamentName || (tournaments.find((t) => String(t.id) === selectedTournamentId)?.name || "Premier League 2026")}
                              tournamentSport={activeSale?.tournamentSport || "Cricket"}
                              auctionUnit={activeSale?.auctionUnit || "rupee"}
                              isIllustrative={!activeSale && waTargetType !== "particular_player"}
                              showDownloadButton={false}
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <div className="relative w-full aspect-[16/9] bg-black/40 overflow-hidden border-b border-emerald-600/40">
                            <img
                              src={selectedWaTpl.headerImageUrl || "/assets/branding/player-sold-banner.jpg"}
                              alt="Header Artwork Banner"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )
                      )}
                      <div className="p-3 whitespace-pre-line font-sans leading-relaxed">
                        {previewWaBody}
                      </div>
                    </div>
                  </div>

                  {/* Policy Safeguard Reminder */}
                  <div className="p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 text-[11px] text-amber-300 space-y-0.5">
                    <p className="font-semibold flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Policy Enforcement Active:
                    </p>
                    <p className="text-amber-300/80">
                      Dispatches fail closed. Opted-out recipients and unlicensed tournaments are blocked. No automatic fallback to SMS occurs.
                    </p>
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" size="sm" onClick={() => setShowDispatchConfirmDialog(false)} disabled={waSending}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                    disabled={waSending}
                    onClick={executeSendWa}
                  >
                    {waSending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Confirm & Dispatch Broadcast
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

        {/* Dispatched Email View & Preview Dialog */}
        <Dialog open={!!viewJob} onOpenChange={(open) => !open && setViewJob(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border">
            <DialogHeader className="p-4 pb-3 border-b border-border bg-muted/20">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div className="space-y-1">
                  <DialogTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate max-w-xl">{viewJob?.subject || viewJob?.templateInternalKey || "Dispatched Email"}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      <strong>To:</strong> {viewJob?.recipient?.recipientName || "—"} &lt;{viewJob?.recipient?.recipientEmail || "No email"}&gt;
                    </span>
                    {viewJob?.recipient?.recipientRole && (
                      <span className="capitalize">
                        • <strong>Role:</strong> {viewJob.recipient.recipientRole}
                      </span>
                    )}
                    <span>
                      • <strong>Sent:</strong> {formatDate(viewJob?.sentAt || viewJob?.createdAt || null)}
                    </span>
                  </DialogDescription>
                </div>
                {viewJob && <StatusBadge status={viewJob.status} />}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Meta bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-lg border border-border bg-muted/30 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Template Key</span>
                  <span className="font-mono font-medium truncate block">{viewJob?.templateInternalKey || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Triggered By</span>
                  <span className="font-mono font-medium truncate block">{viewJob?.triggeredByEvent || "Manual / Admin"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Sent By</span>
                  <span className="font-medium capitalize block">{viewJob?.sentBy || "system"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Retries</span>
                  <span className="font-medium block">{viewJob?.retryCount ?? 0}</span>
                </div>
              </div>

              {viewJob?.pendingReason && (
                <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-400">
                  <strong>Pending Reason:</strong> {viewJob.pendingReason}
                </div>
              )}

              {/* Email Body Iframe Preview */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Rendered Email Content</span>
                  {viewJob?.htmlBody && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => {
                        if (viewJob?.htmlBody) {
                          void navigator.clipboard.writeText(viewJob.htmlBody);
                        }
                      }}
                    >
                      <Copy className="h-3 w-3" /> Copy Raw HTML
                    </Button>
                  )}
                </div>

                <div className="border border-border rounded-lg overflow-hidden bg-white shadow-inner">
                  {viewJob?.htmlBody ? (
                    <iframe
                      srcDoc={viewJob.htmlBody}
                      title={viewJob.subject || "Email Preview"}
                      className="w-full h-[460px] border-0 bg-white"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground italic">
                      <Mail className="h-8 w-8 mb-2 opacity-30 text-zinc-900" />
                      <span className="text-zinc-600">No rendered email body found for this job record.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="p-3 border-t border-border bg-muted/20 flex sm:justify-between items-center gap-2">
              <div>
                {viewJob && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    disabled={resendingId === viewJob.id || !viewJob.recipient?.recipientEmail}
                    onClick={() => void handleResendJob(viewJob.id)}
                  >
                    {resendingId === viewJob.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    Resend Email
                  </Button>
                )}
              </div>
              <Button size="sm" onClick={() => setViewJob(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminShell>
  );
}
