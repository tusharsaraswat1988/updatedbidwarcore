import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Users,
  User,
  Briefcase,
  Crown,
  Radio,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  QrCode,
  RefreshCw,
  Copy,
  Check,
  Download,
  Share2,
  BadgeCheck,
  CheckCheck,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Phone,
  Filter,
  ExternalLink,
  ChevronRight,
  Info,
  Smartphone,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PlayerSoldPosterV2 } from "@/components/posters/player-sold-poster-v2";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export interface TournamentItem {
  id: number;
  name: string;
  organizerName?: string;
  organizerMobile?: string;
  auctionUnit?: string | null;
  licenseType?: string;
  sport?: string;
}

export interface CommLog {
  id: number;
  tournamentId?: number | null;
  recipientType?: string | null;
  recipientId?: number | null;
  recipientMobile: string;
  channel: string;
  templateName?: string | null;
  messageContent: string;
  sentByAdminId?: string | null;
  blastId?: string | null;
  deliveryStatus: "queued" | "sent" | "delivered" | "failed" | string;
  metaMessageId?: string | null;
  errorMessage?: string | null;
  sentAt: string;
}

export interface ConsentStats {
  players: { total: number; consented: number; hasMobile: number };
  owners: { total: number; consented: number; hasMobile: number };
}

export interface WaPlayer {
  id: number;
  name: string;
  mobileNumber?: string | null;
  photoUrl?: string | null;
  role?: string | null;
  primaryRole?: string | null;
  status?: string | null;
  soldPrice?: number | null;
  teamId?: number | null;
  whatsappConsent?: boolean;
}

export interface WaTeam {
  id: number;
  name: string;
  shortCode?: string | null;
  logoUrl?: string | null;
  color?: string | null;
  ownerName?: string | null;
  ownerMobile?: string | null;
  whatsappConsent?: boolean;
}

export interface WaRecentSale {
  id: number;
  playerName: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamName: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount: number;
  formattedAmount: string;
  tournamentName: string;
  tournamentSport?: string;
  teamId?: number;
}

export interface WaProviderStatus {
  configured: boolean;
  provider: string;
  displayName: string;
  status: "configured" | "mock" | "invalid_config" | "unconfigured";
  connectivityNote?: string;
  configErrors?: string[];
  deliveryHealth?: {
    totalLogged: number;
    deliveredCount: number;
    failedCount: number;
    lastDispatchedAt: string | null;
    lastDeliveryStatus: string | null;
  };
}

export interface WhatsAppDispatchHubProps {
  selectedTournamentId: string;
  onSelectTournament: (id: string) => void;
  tournaments: TournamentItem[];
  currentAuctionUnit: AuctionUnit;
}

type ParticipantTab = "player" | "owner" | "organizer" | "broadcast";
type PlayerStatusFilter = "all" | "sold" | "available";
type LogStatusFilter = "all" | "delivered" | "sent" | "failed";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function WhatsAppDispatchHub({
  selectedTournamentId,
  onSelectTournament,
  tournaments,
  currentAuctionUnit,
}: WhatsAppDispatchHubProps) {
  const { toast } = useToast();

  // Data State
  const [loadingWaData, setLoadingWaData] = useState(false);
  const [waLogs, setWaLogs] = useState<CommLog[]>([]);
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [waTournamentPlayers, setWaTournamentPlayers] = useState<WaPlayer[]>([]);
  const [waTournamentTeams, setWaTournamentTeams] = useState<WaTeam[]>([]);
  const [recentSales, setRecentSales] = useState<WaRecentSale[]>([]);
  const [waProviderStatus, setWaProviderStatus] = useState<WaProviderStatus | null>(null);
  const [botLink, setBotLink] = useState<{ link: string | null; configured: boolean } | null>(null);

  // Workflow State: Step 1 Participant
  const [participantTab, setParticipantTab] = useState<ParticipantTab>("player");
  const [participantSearch, setParticipantSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState<PlayerStatusFilter>("all");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [broadcastAudience, setBroadcastAudience] = useState<string>("sold_players");
  const [customMobile, setCustomMobile] = useState<string>("");

  // Workflow State: Step 2 Template & Variables
  const [templateKey, setTemplateKey] = useState<string>("auction_player_sold");
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<string>("");

  // Workflow State: Dispatch & Results
  const [sendingWa, setSendingWa] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    success: boolean;
    sent: number;
    blocked?: number;
    failed: number;
    error?: string;
    stub?: boolean;
    results?: Array<{ mobile: string; success: boolean; error?: string; blocked?: boolean }>;
  } | null>(null);

  // Dialog State: Notify / QR modal
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyModalTab, setNotifyModalTab] = useState<"qr" | "pending">("qr");
  const [copiedLink, setCopiedLink] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<number | null>(null);

  // Side Section / History State
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<LogStatusFilter>("all");
  const [selectedLogDetail, setSelectedLogDetail] = useState<CommLog | null>(null);
  const [mobileView, setMobileView] = useState<"composer" | "history">("composer");

  const currentTournament = useMemo(() => {
    return tournaments.find((t) => String(t.id) === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  // Load WhatsApp Data for the selected tournament
  const loadData = useCallback(async () => {
    setLoadingWaData(true);
    try {
      // 1. Provider Status
      try {
        const pRes = await fetch("/api/auth/admin/communicate/provider-status", { credentials: "include" });
        if (pRes.ok) setWaProviderStatus(await pRes.json());
      } catch {
        // non-blocking
      }

      // 2. WhatsApp Delivery Logs
      const params = new URLSearchParams({ channel: "whatsapp" });
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        params.set("tournamentId", selectedTournamentId);
      }
      const logsRes = await fetch(`/api/auth/admin/communicate/logs?${params}`, { credentials: "include" });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setWaLogs(Array.isArray(logsData) ? logsData : []);
      }

      // 3. Bot Link
      const linkRes = await fetch("/api/consent/wa-link", { credentials: "include" });
      if (linkRes.ok) setBotLink(await linkRes.json());

      // 4. Tournament scoped data: Consent, Players, Teams, Sales
      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        const [cRes, pRes, tRes, sRes] = await Promise.all([
          fetch(`/api/auth/admin/communicate/consent-status/${selectedTournamentId}`, { credentials: "include" }),
          fetch(`/api/tournaments/${selectedTournamentId}/players`, { credentials: "include" }),
          fetch(`/api/tournaments/${selectedTournamentId}/teams`, { credentials: "include" }),
          fetch(`/api/auth/admin/communicate/recent-sales/${selectedTournamentId}`, { credentials: "include" }),
        ]);

        if (cRes.ok) setConsentStats(await cRes.json());

        let pList: WaPlayer[] = [];
        if (pRes.ok) {
          const pData = await pRes.json();
          pList = Array.isArray(pData) ? pData : (pData.players ?? []);
          setWaTournamentPlayers(pList);
        }

        let tList: WaTeam[] = [];
        if (tRes.ok) {
          const tData = await tRes.json();
          tList = Array.isArray(tData) ? tData : (tData.teams ?? []);
          setWaTournamentTeams(tList);
        }

        let salesList: WaRecentSale[] = [];
        if (sRes.ok) {
          const sData = await sRes.json();
          salesList = sData.sales ?? [];
          setRecentSales(salesList);
        }

        // Auto-select initial player
        if (pList.length > 0) {
          // Prefer first sold player
          const firstSold = pList.find((p) => p.status === "sold" || (p.soldPrice && p.soldPrice > 0)) || pList[0];
          setSelectedPlayerId(String(firstSold.id));
          if (firstSold.mobileNumber) setCustomMobile(firstSold.mobileNumber);

          const matchedTeam = tList.find((t) => t.id === firstSold.teamId);
          const isSold = firstSold.status === "sold" || (firstSold.soldPrice && firstSold.soldPrice > 0);

          if (isSold) {
            setTemplateKey("auction_player_sold");
            setTemplateVariables({
              "1": firstSold.name,
              "2": matchedTeam?.name || "Winning Team",
              "3": formatAuctionAmount(firstSold.soldPrice || 0, currentAuctionUnit),
              "4": currentTournament?.name || "Premier League",
            });
          } else {
            setTemplateKey("custom");
            setTemplateVariables({});
          }
        }
      } else {
        setConsentStats(null);
        setWaTournamentPlayers([]);
        setWaTournamentTeams([]);
        setRecentSales([]);
      }
    } catch {
      // non-fatal
    } finally {
      setLoadingWaData(false);
    }
  }, [selectedTournamentId, currentTournament, currentAuctionUnit]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // When Participant changes: intelligently auto-bind template & variables
  const handleSelectPlayer = (player: WaPlayer) => {
    setSelectedPlayerId(String(player.id));
    setCustomMobile(player.mobileNumber || "");

    const isSold = player.status === "sold" || (player.soldPrice && player.soldPrice > 0);
    const team = waTournamentTeams.find((t) => t.id === player.teamId);

    if (isSold) {
      setTemplateKey("auction_player_sold");
      setTemplateVariables({
        "1": player.name,
        "2": team?.name || "Winning Team",
        "3": formatAuctionAmount(player.soldPrice || 0, currentAuctionUnit),
        "4": currentTournament?.name || "Premier Tournament",
      });
    } else {
      setTemplateKey("custom");
      setTemplateVariables({});
    }
  };

  const handleSelectTeam = (team: WaTeam) => {
    setSelectedTeamId(String(team.id));
    setCustomMobile(team.ownerMobile || "");
    // Default to direct message or update for owners
    setTemplateKey("custom");
    setTemplateVariables({});
  };

  const handleSelectOrganiser = () => {
    setCustomMobile(currentTournament?.organizerMobile || "");
    setTemplateKey("organiser_onboarding_welcome");
    setTemplateVariables({
      "1": currentTournament?.organizerName || "Tournament Organiser",
    });
  };

  const handleSelectBroadcast = (group: string) => {
    setBroadcastAudience(group);
    if (group === "sold_players") {
      setTemplateKey("auction_player_sold");
      const sampleSale = recentSales[0];
      setTemplateVariables({
        "1": sampleSale?.playerName || "Player Name",
        "2": sampleSale?.teamName || "Winning Team",
        "3": sampleSale?.formattedAmount || formatAuctionAmount(2500000, currentAuctionUnit),
        "4": currentTournament?.name || "Premier Tournament",
      });
    } else {
      setTemplateKey("custom");
      setTemplateVariables({});
    }
  };

  // Selected Player & Team Objects
  const activePlayer = useMemo(() => {
    return waTournamentPlayers.find((p) => String(p.id) === selectedPlayerId) || null;
  }, [waTournamentPlayers, selectedPlayerId]);

  const activeTeam = useMemo(() => {
    if (participantTab === "owner") {
      return waTournamentTeams.find((t) => String(t.id) === selectedTeamId) || null;
    }
    if (activePlayer?.teamId) {
      return waTournamentTeams.find((t) => t.id === activePlayer.teamId) || null;
    }
    return null;
  }, [waTournamentTeams, selectedTeamId, activePlayer, participantTab]);

  // Filtered Players for Step 1
  const filteredPlayers = useMemo(() => {
    return waTournamentPlayers.filter((p) => {
      // Status filter
      const isSold = p.status === "sold" || (p.soldPrice && p.soldPrice > 0);
      if (playerStatusFilter === "sold" && !isSold) return false;
      if (playerStatusFilter === "available" && isSold) return false;

      // Search query
      if (participantSearch.trim()) {
        const q = participantSearch.toLowerCase().trim();
        const team = waTournamentTeams.find((t) => t.id === p.teamId);
        const nameMatch = p.name.toLowerCase().includes(q);
        const mobileMatch = p.mobileNumber?.toLowerCase().includes(q);
        const teamMatch = team?.name.toLowerCase().includes(q) || team?.shortCode?.toLowerCase().includes(q);
        const roleMatch = p.role?.toLowerCase().includes(q) || p.primaryRole?.toLowerCase().includes(q);
        return nameMatch || mobileMatch || teamMatch || roleMatch;
      }
      return true;
    });
  }, [waTournamentPlayers, waTournamentTeams, playerStatusFilter, participantSearch]);

  // Filtered Teams for Step 1
  const filteredTeams = useMemo(() => {
    if (!participantSearch.trim()) return waTournamentTeams;
    const q = participantSearch.toLowerCase().trim();
    return waTournamentTeams.filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortCode?.toLowerCase().includes(q) ||
        t.ownerName?.toLowerCase().includes(q) ||
        t.ownerMobile?.toLowerCase().includes(q)
      );
    });
  }, [waTournamentTeams, participantSearch]);

  // Un-opted participants list for "Notify Process"
  const pendingPlayers = useMemo(() => {
    return waTournamentPlayers.filter((p) => !p.whatsappConsent && p.mobileNumber);
  }, [waTournamentPlayers]);

  const pendingOwners = useMemo(() => {
    return waTournamentTeams.filter((t) => !t.whatsappConsent && t.ownerMobile);
  }, [waTournamentTeams]);

  // Filtered History Logs (Sorted latest first)
  const filteredLogs = useMemo(() => {
    const list = [...waLogs].sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
    return list.filter((l) => {
      // Status filter
      if (historyStatusFilter !== "all") {
        if (historyStatusFilter === "delivered" && l.deliveryStatus !== "delivered") return false;
        if (historyStatusFilter === "sent" && l.deliveryStatus !== "sent") return false;
        if (historyStatusFilter === "failed" && l.deliveryStatus !== "failed") return false;
      }
      // Search
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim();
        const mobileMatch = l.recipientMobile?.toLowerCase().includes(q);
        const msgMatch = l.messageContent?.toLowerCase().includes(q);
        const tplMatch = l.templateName?.toLowerCase().includes(q);
        return mobileMatch || msgMatch || tplMatch;
      }
      return true;
    });
  }, [waLogs, historyStatusFilter, historySearch]);

  // Text preview of WhatsApp message body
  const previewBody = useMemo(() => {
    if (templateKey === "auction_player_sold") {
      const v1 = templateVariables["1"] || activePlayer?.name || "Player Name";
      const v2 = templateVariables["2"] || activeTeam?.name || "Winning Team";
      const v3 = templateVariables["3"] || (activePlayer?.soldPrice ? formatAuctionAmount(activePlayer.soldPrice, currentAuctionUnit) : "25,00,000 Pt.");
      const v4 = templateVariables["4"] || currentTournament?.name || "Premier League";
      return `🏏 *PLAYER SOLD!*\n\nCongratulations, ${v1}! 🎉\n\nYou have been sold to *${v2}* for *${v3}* in the *${v4}* auction.\n\nWishing you and your team great success in the tournament!\n\nBIDWAR | From Auction to Champions`;
    }
    if (templateKey === "organiser_onboarding_welcome") {
      const v1 = templateVariables["1"] || currentTournament?.organizerName || "Tournament Organiser";
      return `🏏 *Welcome to BIDWAR, ${v1}!* \n\nThank you for joining BIDWAR as a Tournament Organiser.\n\nBIDWAR helps you manage your tournament activities, including team registration, fixtures, live scoring and player auctions — all in one place.\n\nWe're excited to be part of your sporting journey!\n\nNeed help getting started? Our team is here to assist you.\n\nBIDWAR | From Auction to Champions`;
    }
    return customText || "Type your custom message...";
  }, [templateKey, templateVariables, activePlayer, activeTeam, currentTournament, currentAuctionUnit, customText]);

  // Execute Dispatch Action
  const executeDispatch = async () => {
    setSendingWa(true);
    setDispatchResult(null);

    let effectiveGroup: string = "custom";
    let effectiveMobile = customMobile.trim();

    if (participantTab === "player" || participantTab === "owner") {
      effectiveGroup = "custom";
    } else if (participantTab === "organizer") {
      effectiveGroup = "organizer";
      if (currentTournament?.organizerMobile) {
        effectiveMobile = currentTournament.organizerMobile;
      }
    } else if (participantTab === "broadcast") {
      effectiveGroup = broadcastAudience;
    }

    try {
      const body: Record<string, unknown> = {
        channel: "whatsapp",
        recipientGroup: effectiveGroup,
        messageContent: templateKey === "custom" ? customText : "",
        templateName: templateKey,
        templateVariables,
      };

      if (selectedTournamentId && selectedTournamentId !== "__all__") {
        body.tournamentId = parseInt(selectedTournamentId);
      }
      if (effectiveGroup === "custom" || effectiveGroup === "organizer") {
        body.customMobile = effectiveMobile;
      }

      const isPlayerSold = templateKey === "auction_player_sold" || templateKey?.includes("player_sold");
      if (isPlayerSold) {
        if (activePlayer?.id) body.playerId = activePlayer.id;
        if (activeTeam?.id) body.teamId = activeTeam.id;
        if (activePlayer?.photoUrl) body.playerPhotoUrl = activePlayer.photoUrl;
        if (activePlayer?.primaryRole || activePlayer?.role) body.playerRole = activePlayer.primaryRole || activePlayer.role;
        if (activeTeam?.logoUrl) body.teamLogoUrl = activeTeam.logoUrl;
        if (activeTeam?.shortCode) body.teamShortCode = activeTeam.shortCode;
        if (activeTeam?.color) body.teamColor = activeTeam.color;
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
        setDispatchResult({
          success: true,
          sent: sentCount,
          blocked: data.blocked ?? 0,
          failed: failedCount,
          stub: data.stub,
          results: data.results,
        });
        toast({
          title: "WhatsApp Dispatched Successfully",
          description: `Delivered to ${sentCount} recipient${sentCount === 1 ? "" : "s"}.`,
        });
        setShowConfirmModal(false);
        void loadData();
      } else {
        const errMsg = data.error ?? "WhatsApp Dispatch Failed";
        setDispatchResult({
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
        setShowConfirmModal(false);
      }
    } catch {
      const errMsg = "Network error sending WhatsApp";
      setDispatchResult({ success: false, sent: 0, failed: 1, error: errMsg });
      toast({
        title: "Network Error",
        description: errMsg,
        variant: "destructive",
      });
      setShowConfirmModal(false);
    } finally {
      setSendingWa(false);
    }
  };

  // Trigger SMS Consent Invite for a pending participant
  const handleSendConsentInvite = async (
    recipientType: "player" | "team_owner",
    recipientId: number,
    mobile: string
  ) => {
    if (!selectedTournamentId || selectedTournamentId === "__all__") return;
    setSendingInviteId(recipientId);
    try {
      const res = await fetch("/consent/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientType,
          recipientId,
          mobile,
          tournamentId: parseInt(selectedTournamentId),
        }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({
          title: "Opt-In SMS Dispatched",
          description: `Consent invitation link sent to ${mobile}.`,
        });
      } else {
        toast({
          title: "Failed to Send SMS",
          description: d.error || "Could not dispatch SMS invite.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to dispatch consent invitation.",
        variant: "destructive",
      });
    } finally {
      setSendingInviteId(null);
    }
  };

  // High-Res Poster Download
  const handleDownloadPoster = () => {
    const pName = templateVariables["1"] || activePlayer?.name || "Player";
    const tName = templateVariables["2"] || activeTeam?.name || "Team";
    const amtStr = templateVariables["3"] || (activePlayer?.soldPrice ? formatAuctionAmount(activePlayer.soldPrice, currentAuctionUnit) : "0");
    const numPrice = parseInt(amtStr.replace(/[^0-9]/g, ""), 10) || activePlayer?.soldPrice || 0;
    const tourName = templateVariables["4"] || currentTournament?.name || "Premier Tournament";
    const role = activePlayer?.primaryRole || activePlayer?.role || "Player";
    const sport = currentTournament?.sport || "Cricket";
    const unit = currentTournament?.auctionUnit || "points";

    const params = new URLSearchParams({
      name: pName,
      team: tName,
      price: String(numPrice),
      tournament: tourName,
      role: role,
      sport: sport,
      unit: unit,
      t: String(Date.now()),
    });

    if (activePlayer?.id) params.set("playerId", String(activePlayer.id));
    if (activeTeam?.id) params.set("teamId", String(activeTeam.id));
    if (selectedTournamentId && selectedTournamentId !== "__all__") params.set("tournamentId", selectedTournamentId);
    if (activePlayer?.photoUrl) params.set("photoUrl", activePlayer.photoUrl);
    if (activeTeam?.logoUrl) params.set("logoUrl", activeTeam.logoUrl);
    if (activeTeam?.shortCode) params.set("shortCode", activeTeam.shortCode);
    if (activeTeam?.color) params.set("color", activeTeam.color);

    const downloadUrl = `/api/media/player-sold-poster/preview.png?${params.toString()}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${pName.replace(/[^a-zA-Z0-9]/g, "_")}_Sold_Poster.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compact Opt-in Stats derivation
  const playerConsented = consentStats?.players?.consented ?? 0;
  const playerTotal = consentStats?.players?.hasMobile || consentStats?.players?.total || 0;
  const playerPending = Math.max(0, playerTotal - playerConsented);

  const ownerConsented = consentStats?.owners?.consented ?? 0;
  const ownerTotal = consentStats?.owners?.hasMobile || consentStats?.owners?.total || 0;
  const ownerPending = Math.max(0, ownerTotal - ownerConsented);

  const allConsented = playerPending === 0 && ownerPending === 0 && (playerTotal > 0 || ownerTotal > 0);

  return (
    <div className="space-y-5">
      {/* ═════════════════════════════════════════════════════════════════════
          HEADER: TOURNAMENT SELECTOR + COMPACT OPT-IN PILL + NOTIFY PROCESS
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl border border-border bg-card/70 backdrop-blur-sm shadow-xs">
        {/* Left: Tournament Scope & Compact Opt-in Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tournament:</span>
          </div>

          <Select value={selectedTournamentId || "__all__"} onValueChange={onSelectTournament}>
            <SelectTrigger className="w-56 h-8 text-xs font-semibold bg-background/80 border-border">
              <SelectValue placeholder="Choose a Tournament" />
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

          {/* Small / Compact Opt-In Status Badge */}
          {selectedTournamentId && selectedTournamentId !== "__all__" && (
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                allConsented
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                  : playerPending > 0 || ownerPending > 0
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  : "bg-muted/40 text-muted-foreground border-border"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${allConsented ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
              <span>
                <strong>Opted In:</strong> {playerConsented}/{playerTotal} Players • {ownerConsented}/{ownerTotal} Owners
              </span>
              {(playerPending > 0 || ownerPending > 0) && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-400/40 bg-amber-400/10 text-amber-200">
                  {playerPending + ownerPending} Pending
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Right: Action Buttons (Notify Pending & Opt-in QR) */}
        <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => {
              setNotifyModalTab(playerPending > 0 || ownerPending > 0 ? "pending" : "qr");
              setShowNotifyModal(true);
            }}
          >
            <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
            <span>Notify Process & Opt-In QR</span>
            {(playerPending > 0 || ownerPending > 0) && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                {playerPending + ownerPending}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void loadData()}
            disabled={loadingWaData}
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingWaData ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Sync</span>
          </Button>
        </div>
      </div>

      {/* Mobile Switcher (< lg) */}
      <div className="lg:hidden flex rounded-lg p-1 bg-muted/40 border border-border">
        <button
          type="button"
          onClick={() => setMobileView("composer")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            mobileView === "composer"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Send className="h-3.5 w-3.5 text-emerald-400" />
          Linear Composer
        </button>
        <button
          type="button"
          onClick={() => setMobileView("history")}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
            mobileView === "history"
              ? "bg-background text-foreground shadow-xs border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-emerald-400" />
          Delivery History ({filteredLogs.length})
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MAIN WORKSPACE: 2-COLUMN SPLIT (LINEAR DISPATCH WORKFLOW + SIDE LOGS)
         ═════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── LEFT COLUMN: LINEAR DISPATCH WORKFLOW (7 Cols) ───────────── */}
        <div className={`space-y-5 lg:col-span-7 ${mobileView === "composer" ? "block" : "hidden lg:block"}`}>
          {/* Dispatch Result Banner */}
          {dispatchResult && (
            <Card className={`border ${dispatchResult.success ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"}`}>
              <CardContent className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  {dispatchResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-foreground">
                      {dispatchResult.success ? "WhatsApp Dispatched Successfully" : "Dispatch Blocked / Failed"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {dispatchResult.stub
                        ? "Simulated in Dev/Mock mode"
                        : dispatchResult.error || `Delivered: ${dispatchResult.sent} • Failed: ${dispatchResult.failed}`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDispatchResult(null)} className="h-7 text-[11px]">
                  Dismiss
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              STEP 1: CHOOSE PARTICIPANT (WITH SEARCH & CATEGORIES)
             ═══════════════════════════════════════════════════════════════ */}
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold">
                    1
                  </span>
                  Choose Participant
                </CardTitle>
                <span className="text-[11px] text-muted-foreground">Search and select recipient</span>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {/* Category Segmented Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-muted/40 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    setParticipantTab("player");
                    if (waTournamentPlayers.length > 0 && !selectedPlayerId) {
                      handleSelectPlayer(waTournamentPlayers[0]);
                    }
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    participantTab === "player"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Players ({waTournamentPlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParticipantTab("owner");
                    if (waTournamentTeams.length > 0 && !selectedTeamId) {
                      handleSelectTeam(waTournamentTeams[0]);
                    }
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    participantTab === "owner"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Owners ({waTournamentTeams.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParticipantTab("organizer");
                    handleSelectOrganiser();
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    participantTab === "organizer"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Crown className="h-3.5 w-3.5" />
                  Organiser
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setParticipantTab("broadcast");
                    handleSelectBroadcast("sold_players");
                  }}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    participantTab === "broadcast"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  Broadcast
                </button>
              </div>

              {/* Search Box (For Players & Owners) */}
              {(participantTab === "player" || participantTab === "owner") && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder={
                      participantTab === "player"
                        ? "Search participant by name, team, or mobile..."
                        : "Search team or owner name..."
                    }
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    className="h-8 pl-8 pr-7 text-xs bg-background/60"
                  />
                  {participantSearch && (
                    <button
                      type="button"
                      onClick={() => setParticipantSearch("")}
                      className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}

              {/* Sub-Filters for Players (All / Sold / Available) */}
              {participantTab === "player" && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setPlayerStatusFilter("all")}
                    className={`px-2 py-0.5 rounded-full border transition-all ${
                      playerStatusFilter === "all"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    All ({waTournamentPlayers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerStatusFilter("sold")}
                    className={`px-2 py-0.5 rounded-full border transition-all ${
                      playerStatusFilter === "sold"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    🏆 Sold ({waTournamentPlayers.filter((p) => p.status === "sold" || (p.soldPrice && p.soldPrice > 0)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlayerStatusFilter("available")}
                    className={`px-2 py-0.5 rounded-full border transition-all ${
                      playerStatusFilter === "available"
                        ? "bg-zinc-500/20 text-zinc-300 border-zinc-500/40 font-semibold"
                        : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    ⚪ Available ({waTournamentPlayers.filter((p) => p.status !== "sold" && (!p.soldPrice || p.soldPrice === 0)).length})
                  </button>
                </div>
              )}

              {/* List of Players */}
              {participantTab === "player" && (
                <div className="max-h-48 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/70 bg-background/50">
                  {filteredPlayers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No players matched your filter or search query.
                    </div>
                  ) : (
                    filteredPlayers.map((p) => {
                      const isSold = p.status === "sold" || (p.soldPrice && p.soldPrice > 0);
                      const team = waTournamentTeams.find((t) => t.id === p.teamId);
                      const isSelected = String(p.id) === selectedPlayerId;

                      return (
                        <div
                          key={p.id}
                          onClick={() => handleSelectPlayer(p)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-emerald-500/15 border-l-4 border-l-emerald-500"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold shrink-0 text-foreground">
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {p.role || p.primaryRole || "Player"} {team ? `• ${team.name}` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            {isSold ? (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/40 bg-amber-500/10 text-amber-300 font-semibold">
                                🏆 Sold {p.soldPrice ? `(${formatAuctionAmount(p.soldPrice, currentAuctionUnit)})` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-zinc-400 border-zinc-700">
                                ⚪ Available
                              </Badge>
                            )}

                            <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
                              {p.mobileNumber ? `📱 ${p.mobileNumber}` : "❌ No Phone"}
                            </span>

                            {p.whatsappConsent ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1 py-0">
                                Opted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-400/80 border-amber-500/30 text-[9px] px-1 py-0">
                                No Consent
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* List of Teams & Owners */}
              {participantTab === "owner" && (
                <div className="max-h-48 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/70 bg-background/50">
                  {filteredTeams.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No team owners found.
                    </div>
                  ) : (
                    filteredTeams.map((t) => {
                      const isSelected = String(t.id) === selectedTeamId;
                      return (
                        <div
                          key={t.id}
                          onClick={() => handleSelectTeam(t)}
                          className={`p-2.5 flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-emerald-500/15 border-l-4 border-l-emerald-500"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 text-white"
                              style={{ backgroundColor: t.color || "#10B981" }}
                            >
                              {t.shortCode || "TM"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{t.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                Owner: {t.ownerName || "Not assigned"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {t.ownerMobile ? `📱 ${t.ownerMobile}` : "❌ No Phone"}
                            </span>
                            {t.whatsappConsent ? (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1 py-0">
                                Opted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-400/80 border-amber-500/30 text-[9px] px-1 py-0">
                                No Consent
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Organiser View */}
              {participantTab === "organizer" && (
                <div className="p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Crown className="h-4 w-4 text-amber-400" />
                      Tournament Organiser
                    </span>
                    <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30">
                      Official Contact
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium text-foreground">{currentTournament?.organizerName || "Tournament Organiser"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mobile:</span>
                      <p className="font-mono font-medium text-foreground">{currentTournament?.organizerMobile || "Not registered"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Broadcast Group Audience View */}
              {participantTab === "broadcast" && (
                <div className="space-y-2 text-xs">
                  <Label className="text-xs font-semibold text-muted-foreground">Broadcast Audience</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: "sold_players", label: "🏆 All Sold Players", desc: "Delivers personalized sold posters" },
                      { key: "all_players", label: "👥 All Consented Players", desc: "General tournament announcements" },
                      { key: "unsold_players", label: "⏳ Unsold Players", desc: "Next round or re-auction notice" },
                      { key: "all_owners", label: "👔 All Team Owners", desc: "Owner credentials & schedule alerts" },
                    ].map((g) => (
                      <div
                        key={g.key}
                        onClick={() => handleSelectBroadcast(g.key)}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
                          broadcastAudience === g.key
                            ? "border-emerald-500/80 bg-emerald-500/10 shadow-xs"
                            : "border-border/70 bg-background/50 hover:bg-muted/30"
                        }`}
                      >
                        <p className="font-semibold text-foreground">{g.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{g.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Participant Phone Number Input (Editable override) */}
              <div className="p-3 rounded-lg border border-border/80 bg-background/70 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-emerald-400" />
                    Target WhatsApp Number
                  </span>
                  <span className="text-[10px] text-muted-foreground">(Editable direct dispatch number)</span>
                </div>
                <Input
                  placeholder="e.g. +919876543210"
                  value={customMobile}
                  onChange={(e) => setCustomMobile(e.target.value)}
                  className="h-8 text-xs font-mono bg-background"
                />
                {!customMobile && participantTab !== "broadcast" && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" /> No registered phone number found. Enter a mobile number above to dispatch.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════
              STEP 2: CHOOSE DEFINED MESSAGE / TEMPLATE
             ═══════════════════════════════════════════════════════════════ */}
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold">
                    2
                  </span>
                  Choose Defined Message
                </CardTitle>
                <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px] gap-1 py-0 font-semibold">
                  <BadgeCheck className="h-3 w-3" /> Meta Approved
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5">
              {/* Context Notice for Unsold Players */}
              {participantTab === "player" && activePlayer && activePlayer.status !== "sold" && (!activePlayer.soldPrice || activePlayer.soldPrice === 0) && (
                <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-xs text-sky-200 flex items-start gap-2">
                  <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    <strong>{activePlayer.name}</strong> is currently available/unsold. "Player Sold Celebration" requires auction sale details; switch to custom message below for player invites or schedule updates.
                  </p>
                </div>
              )}

              {/* Template Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Select Approved WhatsApp Template</Label>
                <Select value={templateKey} onValueChange={(val) => {
                  setTemplateKey(val);
                  if (val === "organiser_onboarding_welcome") {
                    setTemplateVariables({ "1": currentTournament?.organizerName || "Tournament Organiser" });
                  } else if (val === "auction_player_sold") {
                    setTemplateVariables({
                      "1": activePlayer?.name || "Player Name",
                      "2": activeTeam?.name || "Winning Team",
                      "3": activePlayer?.soldPrice ? formatAuctionAmount(activePlayer.soldPrice, currentAuctionUnit) : "25,00,000 Pt.",
                      "4": currentTournament?.name || "Premier Tournament",
                    });
                  }
                }}>
                  <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auction_player_sold">🏏 Player Sold Celebration (With 4:5 Poster Header)</SelectItem>
                    <SelectItem value="organiser_onboarding_welcome">🏏 Organiser Onboarding Welcome (Text Template)</SelectItem>
                    <SelectItem value="custom">✍️ Custom Direct WhatsApp Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dynamic Variables Inputs (if auction_player_sold) */}
              {templateKey === "auction_player_sold" && (
                <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-emerald-400">Template Dynamic Parameters</Label>
                    <span className="text-[10px] text-emerald-300/80 italic">Auto-resolved from profile</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Player Name {"({{1}})"}</Label>
                      <Input
                        value={templateVariables["1"] || ""}
                        onChange={(e) => setTemplateVariables((prev) => ({ ...prev, "1": e.target.value }))}
                        className="h-8 text-xs bg-background/60"
                        placeholder="Player Name"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Winning Team {"({{2}})"}</Label>
                      <Input
                        value={templateVariables["2"] || ""}
                        onChange={(e) => setTemplateVariables((prev) => ({ ...prev, "2": e.target.value }))}
                        className="h-8 text-xs bg-background/60"
                        placeholder="Winning Team"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Sold Amount {"({{3}})"} ({currentAuctionUnit === "points" ? "Points" : "₹"})
                      </Label>
                      <Input
                        value={templateVariables["3"] || ""}
                        onChange={(e) => setTemplateVariables((prev) => ({ ...prev, "3": e.target.value }))}
                        className="h-8 text-xs bg-background/60"
                        placeholder="e.g. 25,00,000 Pt."
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Tournament {"({{4}})"}</Label>
                      <Input
                        value={templateVariables["4"] || ""}
                        onChange={(e) => setTemplateVariables((prev) => ({ ...prev, "4": e.target.value }))}
                        className="h-8 text-xs bg-background/60"
                        placeholder="Tournament Name"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Variables Inputs (if organiser_onboarding_welcome) */}
              {templateKey === "organiser_onboarding_welcome" && (
                <div className="p-3 rounded-lg border border-emerald-500/25 bg-emerald-500/5 space-y-1.5">
                  <Label className="text-xs font-semibold text-emerald-400">Organiser Name {"({{1}})"}</Label>
                  <Input
                    value={templateVariables["1"] || ""}
                    onChange={(e) => setTemplateVariables((prev) => ({ ...prev, "1": e.target.value }))}
                    className="h-8 text-xs bg-background/60"
                    placeholder="e.g. Rajesh"
                  />
                </div>
              )}

              {/* Custom text */}
              {templateKey === "custom" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">Custom WhatsApp Message</Label>
                  <Textarea
                    placeholder="Type your message (*bold*, _italic_ supported)..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="text-xs min-h-[90px] bg-background"
                  />
                </div>
              )}

              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                <span className="text-emerald-400 font-semibold">🛡️ WABA Policy:</span>
                <span>Messages automatically append "Reply STOP to unsubscribe" per Meta guidelines.</span>
              </div>
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════
              STEP 3: RENDERING & LIVE PREVIEW (CONDITIONAL)
             ═══════════════════════════════════════════════════════════════ */}
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-extrabold">
                    3
                  </span>
                  Live Rendering Preview
                </CardTitle>
                {templateKey === "auction_player_sold" && (
                  <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10">
                    🖼️ 4:5 Poster Graphic
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* WhatsApp Simulated Phone Bubble */}
              <div className="w-full max-w-md mx-auto rounded-2xl border border-zinc-700 bg-[#0b141a] p-3.5 shadow-xl space-y-3">
                {/* Bubble Header */}
                <div className="flex items-center gap-2.5 border-b border-zinc-800 pb-2.5">
                  <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    BW
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-xs text-zinc-100 truncate">BidWar Auction</span>
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400/20 shrink-0" />
                    </div>
                    <span className="text-[10px] text-emerald-400">Official Business Account</span>
                  </div>
                </div>

                {/* WhatsApp Emerald Bubble */}
                <div className="overflow-hidden rounded-xl rounded-tl-xs bg-[#005c4b] text-xs text-zinc-100 shadow w-full">
                  {/* If Poster Rendering Needed */}
                  {templateKey === "auction_player_sold" && (
                    <div className="relative w-full aspect-[4/5] overflow-hidden border-b border-emerald-600/40">
                      <PlayerSoldPosterV2
                        playerName={templateVariables["1"] || activePlayer?.name || "Player Name"}
                        playerPhotoUrl={activePlayer?.photoUrl}
                        playerRole={activePlayer?.primaryRole || activePlayer?.role || "Player"}
                        teamName={templateVariables["2"] || activeTeam?.name || "Winning Team"}
                        teamLogoUrl={activeTeam?.logoUrl}
                        teamShortCode={activeTeam?.shortCode}
                        teamColor={activeTeam?.color}
                        amount={templateVariables["3"] || (activePlayer?.soldPrice ? formatAuctionAmount(activePlayer.soldPrice, currentAuctionUnit) : "25,00,000 Pt.")}
                        tournamentName={templateVariables["4"] || currentTournament?.name || "Premier Tournament"}
                        tournamentSport={currentTournament?.sport || "Cricket"}
                        auctionUnit={currentAuctionUnit}
                        isIllustrative={!activePlayer}
                        showDownloadButton={false}
                        className="w-full h-full"
                      />
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="p-3 space-y-2 leading-relaxed whitespace-pre-line text-[11px]">
                    {previewBody}
                    <div className="pt-2 border-t border-emerald-600/40 text-[9px] text-emerald-200/70 italic">
                      Reply STOP to unsubscribe.
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-300/80">
                      <span>12:45 PM</span>
                      <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 1-Click Social Media / Poster Download Button */}
              {templateKey === "auction_player_sold" && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPoster}
                    className="h-8 gap-2 border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Save High-Res Poster (1080×1350 PNG for Status & Social)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════
              STEP 4: SEND MESSAGE BUTTON
             ═══════════════════════════════════════════════════════════════ */}
          <div className="pt-1">
            <Button
              type="button"
              className="w-full h-11 gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-md hover:shadow-lg transition-all text-sm font-bold cursor-pointer"
              disabled={sendingWa}
              onClick={() => setShowConfirmModal(true)}
            >
              {sendingWa ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {participantTab === "broadcast"
                ? `Dispatch WhatsApp Broadcast to ${broadcastAudience.replace(/_/g, " ")}`
                : `Send WhatsApp Message to ${customMobile || "Selected Recipient"}`}
            </Button>
          </div>
        </div>

        {/* ─── RIGHT COLUMN: DISPATCH HISTORY SIDE SECTION (5 Cols) ─────── */}
        <div className={`space-y-4 lg:col-span-5 ${mobileView === "history" ? "block" : "hidden lg:block"}`}>
          <Card className="border-border bg-card/60 backdrop-blur-sm shadow-xs sticky top-4">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    Dispatch History
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Chronological audit log (latest first)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {filteredLogs.length} Total
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => void loadData()}
                    title="Refresh Logs"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingWaData ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3.5 space-y-3">
              {/* Search Bar for History */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by recipient phone, name, or text..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-8 pl-8 pr-7 text-xs bg-background/50"
                />
                {historySearch && (
                  <button
                    type="button"
                    onClick={() => setHistorySearch("")}
                    className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("all")}
                  className={`px-2 py-0.5 rounded-full border transition-all ${
                    historyStatusFilter === "all"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("delivered")}
                  className={`px-2 py-0.5 rounded-full border transition-all ${
                    historyStatusFilter === "delivered"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Delivered
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("sent")}
                  className={`px-2 py-0.5 rounded-full border transition-all ${
                    historyStatusFilter === "sent"
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Sent
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryStatusFilter("failed")}
                  className={`px-2 py-0.5 rounded-full border transition-all ${
                    historyStatusFilter === "failed"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-semibold"
                      : "bg-muted/30 text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  Failed
                </button>
              </div>

              {/* Chronological Message Logs List (Latest First) */}
              <div className="max-h-[620px] overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/70 bg-background/50">
                {filteredLogs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">No Dispatches Found</p>
                    <p className="text-[11px]">
                      {historySearch || historyStatusFilter !== "all"
                        ? "No logs match the current search or status filter."
                        : "No WhatsApp messages sent in this tournament yet."}
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    // Match participant name
                    const matchedPlayer = waTournamentPlayers.find((p) => p.mobileNumber && p.mobileNumber.includes(log.recipientMobile));
                    const matchedTeam = waTournamentTeams.find((t) => t.ownerMobile && t.ownerMobile.includes(log.recipientMobile));
                    const recipientLabel = matchedPlayer ? matchedPlayer.name : matchedTeam ? `${matchedTeam.name} (${matchedTeam.ownerName || "Owner"})` : null;

                    const isDelivered = log.deliveryStatus === "delivered";
                    const isFailed = log.deliveryStatus === "failed";
                    const isSent = log.deliveryStatus === "sent";

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLogDetail(log)}
                        className="p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-mono font-bold text-foreground truncate">
                              📱 {log.recipientMobile}
                            </span>
                            {recipientLabel && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 truncate max-w-[130px] border-border">
                                {recipientLabel}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isDelivered && (
                              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] px-1.5 py-0 font-medium">
                                Delivered
                              </Badge>
                            )}
                            {isSent && (
                              <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[9px] px-1.5 py-0 font-medium">
                                Sent
                              </Badge>
                            )}
                            {isFailed && (
                              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[9px] px-1.5 py-0 font-medium">
                                Failed
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Template and Message Snippet */}
                        <div className="space-y-0.5">
                          <span className="font-semibold text-[11px] text-emerald-400">
                            {log.templateName || "WhatsApp Broadcast"}
                          </span>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {log.messageContent}
                          </p>
                        </div>

                        {/* Error info if failed */}
                        {isFailed && log.errorMessage && (
                          <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300 font-mono flex items-start gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{log.errorMessage}</span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                          <span>{formatDate(log.sentAt)}</span>
                          <span className="text-zinc-500 flex items-center gap-0.5">
                            Details <ChevronRight className="h-2.5 w-2.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          COLLAPSIBLE DIAGNOSTICS: GATEWAY & BACKEND COMPLIANCE (Non-Intrusive)
         ═════════════════════════════════════════════════════════════════════ */}
      <details className="border border-border/50 rounded-xl bg-card/25 p-3 text-xs group transition-all">
        <summary className="flex items-center justify-between cursor-pointer list-none select-none text-muted-foreground hover:text-foreground">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-xs text-foreground/80">
              Active Gateway Status: {waProviderStatus?.displayName || "KV TechMedia"}
            </span>
            <Badge variant="outline" className="text-[9px] text-emerald-400 border-emerald-500/30">
              {waProviderStatus?.status === "configured" ? "Configured" : "Operational"}
            </Badge>
          </div>
          <span className="text-[10px] text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
        </summary>
        <div className="space-y-2 pt-3 mt-2 border-t border-border/50 text-[11px] text-muted-foreground">
          <p>
            {waProviderStatus?.connectivityNote ||
              "Managed via server environment (WHATSAPP_PROVIDER) • Live pings disabled to conserve provider quota."}
          </p>
          {waProviderStatus?.deliveryHealth && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-emerald-400 font-medium">
                {waProviderStatus.deliveryHealth.deliveredCount} delivered
              </span>
              {waProviderStatus.deliveryHealth.failedCount > 0 && (
                <span className="text-rose-400 font-medium">
                  {waProviderStatus.deliveryHealth.failedCount} failed
                </span>
              )}
              <span>({waProviderStatus.deliveryHealth.totalLogged} total logged)</span>
              {waProviderStatus.deliveryHealth.lastDispatchedAt && (
                <span>• Last: {formatDate(waProviderStatus.deliveryHealth.lastDispatchedAt)}</span>
              )}
            </div>
          )}
        </div>
      </details>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 1: NOTIFY PROCESS & OPT-IN QR CANVAS
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showNotifyModal} onOpenChange={setShowNotifyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-5 w-5 text-emerald-400" />
              WhatsApp Opt-In Process & QR
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manage participant opt-in invitations, scan live QR, or send SMS reminders.
            </DialogDescription>
          </DialogHeader>

          {/* Modal Tabs: QR vs Pending List */}
          <div className="flex rounded-lg p-1 bg-muted/40 border border-border text-xs font-semibold">
            <button
              type="button"
              onClick={() => setNotifyModalTab("qr")}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                notifyModalTab === "qr"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1-Click Link & QR
            </button>
            <button
              type="button"
              onClick={() => setNotifyModalTab("pending")}
              className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                notifyModalTab === "pending"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pending Participants ({pendingPlayers.length + pendingOwners.length})
            </button>
          </div>

          {notifyModalTab === "qr" && (
            <div className="space-y-4 py-2">
              {/* QR Code Canvas */}
              <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-muted/20">
                <div className="p-3 bg-white rounded-xl shadow-md">
                  <QRCodeSVG
                    value={botLink?.link || "https://wa.me/?text=hello"}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#0b141a"
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <p className="text-[11px] font-semibold text-foreground mt-3">Scan to Opt In on WhatsApp</p>
                <p className="text-[10px] text-muted-foreground text-center max-w-xs mt-0.5">
                  Sends instant "hello" to the official BidWar WhatsApp bot to record affirmative consent.
                </p>
              </div>

              {/* Direct Deep Link & Copy */}
              <div className="p-2.5 rounded-lg border border-border bg-muted/40 flex items-center justify-between text-xs font-mono">
                <code className="truncate max-w-[260px] text-emerald-300">
                  {botLink?.link || "https://wa.me/18382214175?text=hello"}
                </code>
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
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? "Copied" : "Copy"}
                </Button>
              </div>

              {/* Share on WhatsApp */}
              <Button
                variant="outline"
                className="w-full gap-2 text-xs border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                onClick={() => {
                  const shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Hi! To receive your live BidWar auction updates, sold celebration posters, and fixtures directly on WhatsApp, please tap this link to opt in: ${botLink?.link || "https://wa.me/?text=hello"}`
                  )}`;
                  window.open(shareUrl, "_blank");
                }}
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-400" />
                Share Opt-In Invite via WhatsApp
              </Button>
            </div>
          )}

          {notifyModalTab === "pending" && (
            <div className="space-y-3 py-2 max-h-72 overflow-y-auto">
              {pendingPlayers.length === 0 && pendingOwners.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-1" />
                  <p className="font-bold text-foreground">All Participants Opted In!</p>
                  <p className="text-[11px]">All mobile-registered players and owners in this tournament have verified consent.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Send an SMS invitation with a direct verification link to participants awaiting opt-in:
                  </p>
                  <div className="divide-y divide-border/40 rounded-lg border border-border/70 bg-background/50 text-xs">
                    {pendingPlayers.map((p) => (
                      <div key={p.id} className="p-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{p.name}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">📱 {p.mobileNumber}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-sky-500/40 text-sky-300 hover:bg-sky-500/10 shrink-0"
                          disabled={sendingInviteId === p.id}
                          onClick={() => handleSendConsentInvite("player", p.id, p.mobileNumber!)}
                        >
                          <Send className="h-3 w-3" />
                          {sendingInviteId === p.id ? "Sending..." : "SMS Invite"}
                        </Button>
                      </div>
                    ))}

                    {pendingOwners.map((t) => (
                      <div key={t.id} className="p-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {t.name} (Owner: {t.ownerName || "Owner"})
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">📱 {t.ownerMobile}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-sky-500/40 text-sky-300 hover:bg-sky-500/10 shrink-0"
                          disabled={sendingInviteId === t.id}
                          onClick={() => handleSendConsentInvite("team_owner", t.id, t.ownerMobile!)}
                        >
                          <Send className="h-3 w-3" />
                          {sendingInviteId === t.id ? "Sending..." : "SMS Invite"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setShowNotifyModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 2: PRE-DISPATCH EXPLICIT CONFIRMATION SAFEGUARD
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-emerald-400" /> Confirm WhatsApp Dispatch
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review recipient parameters and template before triggering live dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tournament:</span>
                <span className="font-bold text-foreground">{currentTournament?.name || "Premier Tournament"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Recipient:</span>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {participantTab === "player" && `👤 ${activePlayer?.name || "Player"} (${customMobile})`}
                  {participantTab === "owner" && `👔 ${activeTeam?.name || "Owner"} (${customMobile})`}
                  {participantTab === "organizer" && `👑 Organiser (${customMobile})`}
                  {participantTab === "broadcast" && `📢 Broadcast: ${broadcastAudience}`}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Selected Template:</span>
                <span className="font-semibold text-emerald-400">{templateKey}</span>
              </div>
            </div>

            {/* Variable parameter check */}
            {templateKey === "auction_player_sold" && (
              <div className="p-2.5 rounded-lg border border-border bg-muted/20 space-y-1 text-[11px]">
                <p className="font-semibold text-muted-foreground">Resolved Parameters:</p>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <span>Player: <strong>{templateVariables["1"] || "-"}</strong></span>
                  <span>Team: <strong>{templateVariables["2"] || "-"}</strong></span>
                  <span>Price: <strong>{templateVariables["3"] || "-"}</strong></span>
                  <span>Event: <strong>{templateVariables["4"] || "-"}</strong></span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
              disabled={sendingWa}
              onClick={executeDispatch}
            >
              {sendingWa ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Confirm & Dispatch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═════════════════════════════════════════════════════════════════════
          MODAL 3: DISPATCH LOG DETAIL VIEW
         ═════════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!selectedLogDetail} onOpenChange={(open) => !open && setSelectedLogDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-emerald-400" /> Dispatch Delivery Receipt
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detailed metadata and provider response for this WhatsApp dispatch.
            </DialogDescription>
          </DialogHeader>

          {selectedLogDetail && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recipient Mobile:</span>
                  <span className="font-mono font-bold text-foreground">{selectedLogDetail.recipientMobile}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Delivery Status:</span>
                  <Badge
                    className={
                      selectedLogDetail.deliveryStatus === "delivered"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : selectedLogDetail.deliveryStatus === "sent"
                        ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                    }
                  >
                    {selectedLogDetail.deliveryStatus.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sent Timestamp:</span>
                  <span>{formatDate(selectedLogDetail.sentAt)}</span>
                </div>
                {selectedLogDetail.metaMessageId && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provider Message ID:</span>
                    <span className="font-mono text-[10px] text-zinc-400">{selectedLogDetail.metaMessageId}</span>
                  </div>
                )}
              </div>

              {selectedLogDetail.errorMessage && (
                <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" /> Error Details
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed">{selectedLogDetail.errorMessage}</p>
                </div>
              )}

              <div className="space-y-1">
                <span className="font-semibold text-muted-foreground text-[11px]">Message Content:</span>
                <div className="p-3 rounded-lg border border-zinc-700 bg-[#005c4b] text-zinc-100 whitespace-pre-line text-[11px] leading-relaxed">
                  {selectedLogDetail.messageContent}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setSelectedLogDetail(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
