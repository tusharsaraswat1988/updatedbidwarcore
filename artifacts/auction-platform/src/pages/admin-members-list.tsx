import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  User,
  Search,
  RefreshCw,
  Phone,
  Mail,
  Check,
  AlertTriangle,
  Crown,
  Trophy,
  Shield,
  Activity,
  Filter,
  ExternalLink,
  Save,
  MessageCircle,
  Building2,
  Calendar,
  Tag,
  X,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AssociatedTeam {
  teamId: number;
  teamName: string;
  teamShortCode: string | null;
  tournamentId: number;
  tournamentName: string;
  roleInTeam: string;
  soldPrice: number | null;
  status: string | null;
  jerseyNumber: string | null;
}

interface SportProfile {
  sportSlug: string;
  primaryRole: string | null;
  secondaryRole: string | null;
  handedness: string | null;
}

interface MemberRoleItem {
  role: string;
  scope: string;
  tournamentId: number | null;
  tournamentName: string | null;
  teamId: number | null;
  teamName: string | null;
}

interface MemberListItem {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  primaryMobile: string | null;
  isMobileVerified: boolean;
  primaryEmail: string | null;
  isEmailVerified: boolean;
  city: string | null;
  avatarUrl: string | null;
  accountStatus: string;
  createdAt: string;
  roles: MemberRoleItem[];
  roleTypes: string[];
  teams: AssociatedTeam[];
  sportProfiles: SportProfile[];
  tournamentsCount: number;
  teamsCount: number;
  whatsappConsent: boolean;
}

interface MemberKpis {
  totalMembers: number;
  activePlayers: number;
  franchiseOwners: number;
  scorersAndOfficials: number;
  missingPhone: number;
}

export default function AdminMembersListPage() {
  const { isLoggedIn } = useAdminPageGuard();
  const { toast } = useToast();

  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [kpis, setKpis] = useState<MemberKpis>({
    totalMembers: 0,
    activePlayers: 0,
    franchiseOwners: 0,
    scorersAndOfficials: 0,
    missingPhone: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [contactStatus, setContactStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Inline mobile editing state: { [memberId]: "9876543210" }
  const [inlineMobile, setInlineMobile] = useState<Record<string, string>>({});
  const [savingMobileId, setSavingMobileId] = useState<string | null>(null);

  // Drawer detail state
  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCity, setEditCity] = useState("");
  const [savingDrawer, setSavingDrawer] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedRole !== "all") params.set("role", selectedRole);
      if (selectedSport !== "all") params.set("sport", selectedSport);
      if (contactStatus !== "all") params.set("contactStatus", contactStatus);
      params.set("page", String(page));
      params.set("limit", "30");

      const res = await fetch(`/api/auth/admin/members?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        if (data.kpis) setKpis(data.kpis);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedRole, selectedSport, contactStatus, page]);

  useEffect(() => {
    if (isLoggedIn) {
      void loadData();
    }
  }, [isLoggedIn, loadData]);

  // Trigger manual reconciliation sync across legacy tables
  const handleReconcileSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/auth/admin/members/sync", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast({
          title: "Members Reconciled",
          description: "Canonical identity sync completed successfully across all tournaments.",
        });
        void loadData();
      } else {
        toast({
          title: "Sync Failed",
          description: "Could not reconcile legacy identities.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Sync Error",
        description: "Network or server error during identity reconciliation.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Quick save missing mobile number directly from table row
  const handleInlineMobileSave = async (memberId: string) => {
    const mobileToSave = inlineMobile[memberId];
    if (!mobileToSave) return;
    setSavingMobileId(memberId);
    try {
      const res = await fetch(`/api/auth/admin/members/${memberId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryMobile: mobileToSave }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Contact Updated",
          description: `Mobile number updated to ${data.member?.primaryMobile} and cascaded across linked records.`,
        });
        setInlineMobile((prev) => {
          const next = { ...prev };
          delete next[memberId];
          return next;
        });
        void loadData();
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Please enter a valid 10-digit Indian mobile number.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update phone number.",
        variant: "destructive",
      });
    } finally {
      setSavingMobileId(null);
    }
  };

  // Open Deep-Dive Profile Drawer
  const handleOpenDrawer = (member: MemberListItem) => {
    setSelectedMember(member);
    setEditName(member.displayName || "");
    setEditMobile(member.primaryMobile || "");
    setEditEmail(member.primaryEmail || "");
    setEditCity(member.city || "");
    setDrawerOpen(true);
  };

  // Save changes from drawer
  const handleSaveDrawer = async () => {
    if (!selectedMember) return;
    setSavingDrawer(true);
    try {
      const res = await fetch(`/api/auth/admin/members/${selectedMember.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editName,
          primaryMobile: editMobile,
          primaryEmail: editEmail,
          city: editCity,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Profile Saved",
          description: "Member details updated and cascaded.",
        });
        setSelectedMember(data.member);
        void loadData();
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Could not save member details.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save profile changes.",
        variant: "destructive",
      });
    } finally {
      setSavingDrawer(false);
    }
  };

  const rolePill = (role: string) => {
    switch (role.toLowerCase()) {
      case "player":
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-sky-500/40 bg-sky-950/40 text-sky-400 font-semibold gap-1 text-[11px] py-0.5"
          >
            <Trophy className="h-3 w-3" /> Player
          </Badge>
        );
      case "team_owner":
      case "owner":
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-purple-500/40 bg-purple-950/40 text-purple-300 font-semibold gap-1 text-[11px] py-0.5"
          >
            <Crown className="h-3 w-3 text-purple-400" /> Team Owner
          </Badge>
        );
      case "organizer":
      case "organiser":
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-amber-500/40 bg-amber-950/40 text-amber-300 font-semibold gap-1 text-[11px] py-0.5"
          >
            <Building2 className="h-3 w-3 text-amber-400" /> Organiser
          </Badge>
        );
      case "scorer":
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-emerald-500/40 bg-emerald-950/40 text-emerald-300 font-semibold gap-1 text-[11px] py-0.5"
          >
            <Shield className="h-3 w-3 text-emerald-400" /> Scorer
          </Badge>
        );
      case "umpire":
      case "referee":
      case "match_official":
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-teal-500/40 bg-teal-950/40 text-teal-300 font-semibold gap-1 text-[11px] py-0.5"
          >
            <Activity className="h-3 w-3" /> Official
          </Badge>
        );
      default:
        return (
          <Badge
            key={role}
            variant="outline"
            className="border-slate-700 bg-slate-900/60 text-slate-300 font-medium text-[11px] py-0.5"
          >
            {role}
          </Badge>
        );
    }
  };

  return (
    <AdminShell title="Members Directory" eyebrow="Super Admin Platform Hub">
      <div className="space-y-6 pb-12">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Members Directory
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                    {totalCount} Total
                  </Badge>
                </h1>
                <p className="text-xs text-slate-400">
                  Global directory of platform humans, capabilities, cross-tournament team associations, and contact resolution
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={syncing}
              onClick={handleReconcileSync}
              className="h-8 gap-1.5 text-xs border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin text-amber-400")} />
              {syncing ? "Reconciling..." : "Reconcile Identities"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadData()}
              className="h-8 gap-1.5 text-xs border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload
            </Button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <Card
            onClick={() => {
              setSelectedRole("all");
              setContactStatus("all");
              setPage(1);
            }}
            className={cn(
              "border-slate-800/80 bg-slate-950/60 backdrop-blur-sm p-3.5 cursor-pointer hover:border-slate-700 transition-all",
              selectedRole === "all" && contactStatus === "all" && "ring-1 ring-amber-500/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Members
              </span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-white">{kpis.totalMembers.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">All registered human entities</p>
          </Card>

          <Card
            onClick={() => {
              setSelectedRole("player");
              setPage(1);
            }}
            className={cn(
              "border-slate-800/80 bg-slate-950/60 backdrop-blur-sm p-3.5 cursor-pointer hover:border-sky-500/40 transition-all",
              selectedRole === "player" && "ring-1 ring-sky-500/50 bg-sky-950/20"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">
                Active Players
              </span>
              <Trophy className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-sky-400">{kpis.activePlayers.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Auction & tournament roster</p>
          </Card>

          <Card
            onClick={() => {
              setSelectedRole("team_owner");
              setPage(1);
            }}
            className={cn(
              "border-slate-800/80 bg-slate-950/60 backdrop-blur-sm p-3.5 cursor-pointer hover:border-purple-500/40 transition-all",
              selectedRole === "team_owner" && "ring-1 ring-purple-500/50 bg-purple-950/20"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                Team Owners
              </span>
              <Crown className="h-4 w-4 text-purple-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-purple-400">{kpis.franchiseOwners.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Franchise leaders across teams</p>
          </Card>

          <Card
            onClick={() => {
              setSelectedRole("scorer");
              setPage(1);
            }}
            className={cn(
              "border-slate-800/80 bg-slate-950/60 backdrop-blur-sm p-3.5 cursor-pointer hover:border-emerald-500/40 transition-all",
              selectedRole === "scorer" && "ring-1 ring-emerald-500/50 bg-emerald-950/20"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                Scorers & Umpires
              </span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-400">{kpis.scorersAndOfficials.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Match officials & scorers</p>
          </Card>

          <Card
            onClick={() => {
              setContactStatus("missing_phone");
              setPage(1);
            }}
            className={cn(
              "border-slate-800/80 bg-slate-950/60 backdrop-blur-sm p-3.5 cursor-pointer hover:border-amber-500/40 transition-all",
              kpis.missingPhone > 0 && "border-amber-500/30 bg-amber-950/15",
              contactStatus === "missing_phone" && "ring-1 ring-amber-500/50 bg-amber-950/30"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                Missing Mobile
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="mt-2 text-2xl font-black text-amber-400">{kpis.missingPhone.toLocaleString()}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Action needed for WhatsApp/SMS</p>
          </Card>
        </div>

        {/* Filter and Search Bar */}
        <Card className="border-slate-800 bg-slate-950/80 p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-center gap-3">
              {/* Search input */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <Input
                  placeholder="Search members by name, 10-digit mobile, email, or mem_* ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 h-9 text-xs bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-amber-500"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sport Selector */}
              <div className="w-full md:w-44">
                <Select
                  value={selectedSport}
                  onValueChange={(val) => {
                    setSelectedSport(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-slate-900 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Sport: All" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="all">All Sports</SelectItem>
                    <SelectItem value="cricket">Cricket</SelectItem>
                    <SelectItem value="badminton">Badminton</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Contact Status Selector */}
              <div className="w-full md:w-48">
                <Select
                  value={contactStatus}
                  onValueChange={(val) => {
                    setContactStatus(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-slate-900 border-slate-700 text-slate-200">
                    <SelectValue placeholder="Contact Quality" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                    <SelectItem value="all">All Contact Statuses</SelectItem>
                    <SelectItem value="missing_phone">⚠️ Missing Mobile Only</SelectItem>
                    <SelectItem value="verified">✅ Verified Mobile</SelectItem>
                    <SelectItem value="with_phone">📞 Has Phone Number</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Role Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60">
              <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                <Filter className="h-3 w-3 text-slate-500" /> Roles:
              </span>
              {[
                { label: "All Roles", value: "all" },
                { label: "Players", value: "player", count: kpis.activePlayers },
                { label: "Team Owners", value: "team_owner", count: kpis.franchiseOwners },
                { label: "Organisers", value: "organizer" },
                { label: "Scorers", value: "scorer" },
                { label: "Multi-Role (2+ Roles)", value: "multi_role" },
              ].map((r) => {
                const active = selectedRole === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => {
                      setSelectedRole(r.value);
                      setPage(1);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border flex items-center gap-1.5",
                      active
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                        : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    {r.label}
                    {r.count !== undefined && (
                      <span className="text-[10px] px-1 py-0.2 bg-black/40 rounded text-slate-300">
                        {r.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Members Table */}
        <Card className="border-slate-800 bg-slate-950 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4">Roles</th>
                  <th className="py-3 px-4">Associated Teams & Tournaments</th>
                  <th className="py-3 px-4">Sports Profile</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-xs">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><Skeleton className="h-5 w-40 bg-slate-800" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-5 w-32 bg-slate-800" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-5 w-24 bg-slate-800" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-5 w-48 bg-slate-800" /></td>
                      <td className="py-4 px-4"><Skeleton className="h-5 w-24 bg-slate-800" /></td>
                      <td className="py-4 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto bg-slate-800" /></td>
                    </tr>
                  ))
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Users className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-60" />
                      <p className="font-semibold text-slate-300 text-sm">No members found</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Try adjusting your search query, role filter, or contact quality filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  members.map((m) => {
                    const hasMobile = Boolean(m.primaryMobile && m.primaryMobile.trim());
                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-900/40 transition-colors group"
                      >
                        {/* Member Identity */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700/60 flex items-center justify-center font-bold text-slate-300 text-xs overflow-hidden shrink-0">
                              {m.avatarUrl ? (
                                <img
                                  src={m.avatarUrl}
                                  alt={m.displayName}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span>{m.displayName ? m.displayName.slice(0, 2).toUpperCase() : "??"}</span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-100 text-sm hover:text-amber-400 transition-colors cursor-pointer" onClick={() => handleOpenDrawer(m)}>
                                  {m.displayName}
                                </span>
                                {m.accountStatus === "active" && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Active Account" />
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                <span className="font-mono text-slate-400">{m.id}</span>
                                {m.city && <span>• {m.city}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact Details & Inline Resolver */}
                        <td className="py-3.5 px-4">
                          {hasMobile ? (
                            <div>
                              <div className="flex items-center gap-2 font-mono text-slate-200">
                                <Phone className="h-3 w-3 text-slate-400" />
                                <span>+91 {m.primaryMobile}</span>
                                <a
                                  href={`https://wa.me/91${m.primaryMobile}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                                  title="Open WhatsApp chat"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </div>
                              {m.primaryEmail && (
                                <p className="text-[11px] text-slate-400 truncate max-w-[160px] flex items-center gap-1 mt-0.5">
                                  <Mail className="h-2.5 w-2.5 text-slate-500" /> {m.primaryEmail}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <Badge
                                variant="outline"
                                className="border-amber-500/40 bg-amber-950/30 text-amber-400 text-[10px] gap-1 py-0"
                              >
                                <AlertTriangle className="h-2.5 w-2.5" /> Missing Phone
                              </Badge>
                              {/* Inline Quick-Add Mobile Input */}
                              <div className="flex items-center gap-1">
                                <Input
                                  placeholder="10-digit mobile"
                                  className="h-6 text-[11px] w-28 px-1.5 bg-slate-900 border-amber-500/40 text-amber-200 font-mono"
                                  value={inlineMobile[m.id] || ""}
                                  onChange={(e) =>
                                    setInlineMobile((prev) => ({ ...prev, [m.id]: e.target.value }))
                                  }
                                />
                                <Button
                                  size="sm"
                                  className="h-6 text-[10px] px-2 bg-amber-500 hover:bg-amber-400 text-black font-bold"
                                  disabled={savingMobileId === m.id || !inlineMobile[m.id]}
                                  onClick={() => handleInlineMobileSave(m.id)}
                                >
                                  <Save className="h-2.5 w-2.5 mr-0.5" /> Save
                                </Button>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* Roles */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {m.roleTypes.map((r) => rolePill(r))}
                          </div>
                        </td>

                        {/* Associated Teams & Tournaments */}
                        <td className="py-3.5 px-4">
                          {m.teams.length > 0 ? (
                            <div className="space-y-1">
                              {m.teams.slice(0, 2).map((t) => (
                                <div
                                  key={`${t.tournamentId}-${t.teamId}-${t.roleInTeam}`}
                                  className="text-[11px] flex items-center gap-1.5 text-slate-300"
                                >
                                  <span className="font-semibold text-white">{t.teamName}</span>
                                  {t.roleInTeam === "team_owner" ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] px-1 py-0 border-purple-500/50 text-purple-300 bg-purple-950/40"
                                    >
                                      Owner
                                    </Badge>
                                  ) : (
                                    <span className="text-[10px] text-slate-500">({t.tournamentName})</span>
                                  )}
                                  {t.soldPrice && (
                                    <span className="text-[10px] text-amber-400 font-mono">
                                      ₹{t.soldPrice.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {m.teams.length > 2 && (
                                <button
                                  onClick={() => handleOpenDrawer(m)}
                                  className="text-[10px] text-amber-400 hover:underline font-semibold"
                                >
                                  +{m.teams.length - 2} more team{m.teams.length - 2 > 1 ? "s" : ""}
                                </button>
                              )}
                            </div>
                          ) : m.roleTypes.includes("organizer") ? (
                            <div className="flex items-center gap-1 text-[11px] text-amber-400/90">
                              <Building2 className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Tournament Organiser</span>
                            </div>
                          ) : m.roleTypes.includes("scorer") ? (
                            <div className="flex items-center gap-1 text-[11px] text-emerald-400/90">
                              <Shield className="h-3 w-3 text-emerald-400 shrink-0" />
                              <span>Match Official / Scorer</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No team assigned yet</span>
                          )}
                        </td>

                        {/* Sports Profile */}
                        <td className="py-3.5 px-4">
                          {m.sportProfiles.length > 0 ? (
                            <div className="space-y-0.5">
                              {m.sportProfiles.map((sp) => (
                                <div key={sp.sportSlug} className="text-[11px]">
                                  <span className="capitalize font-semibold text-slate-300">
                                    {sp.sportSlug}:
                                  </span>{" "}
                                  <span className="text-slate-400">{sp.primaryRole || "Participant"}</span>
                                  {sp.handedness && (
                                    <span className="text-[10px] text-slate-500 ml-1">({sp.handedness})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">General Member</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenDrawer(m)}
                            className="h-7 text-xs px-2.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> View 360° Profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
              <span>
                Page {page} of {totalPages} ({totalCount} total members)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 text-xs border-slate-700 bg-slate-900"
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 text-xs border-slate-700 bg-slate-900"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          MEMBER 360° DEEP-DIVE SLIDE-OVER DRAWER (SHEET)
         ═════════════════════════════════════════════════════════════════════ */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl bg-slate-950 border-slate-800 text-slate-200 overflow-y-auto p-6"
        >
          {selectedMember && (
            <div className="space-y-6">
              {/* Drawer Header */}
              <SheetHeader className="text-left space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px]">
                    CANONICAL MEMBER
                  </Badge>
                  <SheetClose className="text-slate-400 hover:text-white">
                    <X className="h-4 w-4" />
                  </SheetClose>
                </div>
                <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 pt-1">
                  {selectedMember.displayName}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-slate-400">
                  {selectedMember.id}
                </SheetDescription>
              </SheetHeader>

              {/* Quick Profile Summary Card */}
              <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-sm overflow-hidden">
                    {selectedMember.avatarUrl ? (
                      <img
                        src={selectedMember.avatarUrl}
                        alt={selectedMember.displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>{selectedMember.displayName.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-sm">{selectedMember.displayName}</h4>
                    <p className="text-xs text-slate-400">
                      Member since {new Date(selectedMember.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {selectedMember.roleTypes.map((r) => rolePill(r))}
                    </div>
                  </div>
                </div>

                {/* Edit Contact Form */}
                <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Display Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">10-Digit Mobile</label>
                    <Input
                      placeholder="e.g. 9876543210"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Email Address</label>
                    <Input
                      placeholder="e.g. user@example.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">City / Location</label>
                    <Input
                      placeholder="e.g. Mumbai, Maharashtra"
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="h-8 text-xs bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-amber-500 hover:bg-amber-400 text-black font-bold gap-1"
                    disabled={savingDrawer}
                    onClick={handleSaveDrawer}
                  >
                    <Save className="h-3 w-3" /> {savingDrawer ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>

              {/* Drawer Tabs */}
              <Tabs defaultValue="teams" className="w-full">
                <TabsList className="w-full grid grid-cols-3 bg-slate-900 border border-slate-800 text-xs">
                  <TabsTrigger value="teams">Teams & Roles</TabsTrigger>
                  <TabsTrigger value="sports">Sports Specs</TabsTrigger>
                  <TabsTrigger value="comms">Audit & Comms</TabsTrigger>
                </TabsList>

                {/* TAB 1: TEAMS & PARTICIPATIONS */}
                <TabsContent value="teams" className="space-y-3 pt-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Associated Teams ({selectedMember.teams.length})
                  </h4>
                  {selectedMember.teams.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded border border-slate-800/80">
                      No team assignments found across tournaments.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedMember.teams.map((t) => (
                        <div
                          key={`${t.tournamentId}-${t.teamId}`}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">{t.teamName}</span>
                              {t.teamShortCode && (
                                <Badge variant="outline" className="text-[10px] py-0 border-slate-700">
                                  {t.teamShortCode}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Tournament: <span className="text-slate-300 font-medium">{t.tournamentName}</span>
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Role in Team: <span className="capitalize text-slate-300 font-medium">{t.roleInTeam}</span>
                              {t.jerseyNumber && ` • Jersey #${t.jerseyNumber}`}
                            </p>
                          </div>
                          <div className="text-right">
                            {t.soldPrice ? (
                              <p className="font-bold text-amber-400 text-sm font-mono">
                                ₹{t.soldPrice.toLocaleString()}
                              </p>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-slate-400">
                                {t.status || "Registered"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-3">
                    Assigned Roles Across Scope ({selectedMember.roles.length})
                  </h4>
                  <div className="space-y-1.5">
                    {selectedMember.roles.map((r, i) => (
                      <div
                        key={i}
                        className="py-1.5 px-3 rounded bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          {rolePill(r.role)}
                          <span className="text-slate-400">Scope: {r.scope}</span>
                        </div>
                        <span className="text-slate-400">
                          {r.tournamentName || r.teamName || "Global Platform"}
                        </span>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* TAB 2: SPORT PROFILES */}
                <TabsContent value="sports" className="space-y-3 pt-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Sports Profiles ({selectedMember.sportProfiles.length})
                  </h4>
                  {selectedMember.sportProfiles.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded border border-slate-800/80">
                      No sport-specific profile attached yet.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedMember.sportProfiles.map((sp) => (
                        <div
                          key={sp.sportSlug}
                          className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-400 capitalize text-sm">
                              {sp.sportSlug} Profile
                            </span>
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-300">
                              Primary
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-300 pt-1">
                            <div>
                              <span className="text-slate-500 text-[10px] block">Primary Role</span>
                              <span className="font-medium">{sp.primaryRole || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Secondary Role</span>
                              <span className="font-medium">{sp.secondaryRole || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 text-[10px] block">Handedness / Style</span>
                              <span className="font-medium">{sp.handedness || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* TAB 3: AUDIT & COMMS */}
                <TabsContent value="comms" className="space-y-3 pt-3">
                  <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
                    <h5 className="font-bold text-white text-xs uppercase tracking-wider">
                      Communication Delivery Status
                    </h5>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Mobile Verification:</span>
                      <span className={cn("font-medium", selectedMember.isMobileVerified ? "text-emerald-400" : "text-amber-400")}>
                        {selectedMember.isMobileVerified ? "✅ Verified" : "⚠️ Unverified"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">Email Verification:</span>
                      <span className={cn("font-medium", selectedMember.isEmailVerified ? "text-emerald-400" : "text-slate-500")}>
                        {selectedMember.isEmailVerified ? "✅ Verified" : "Not Verified"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                      <span className="text-slate-400">WhatsApp Marketing Consent:</span>
                      <span className={cn("font-medium", selectedMember.whatsappConsent ? "text-emerald-400" : "text-slate-500")}>
                        {selectedMember.whatsappConsent ? "Opted In" : "Pending Opt-In"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-400">Account Status:</span>
                      <span className="capitalize font-semibold text-white">
                        {selectedMember.accountStatus}
                      </span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
