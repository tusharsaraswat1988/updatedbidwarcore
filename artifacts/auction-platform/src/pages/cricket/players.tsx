/**
 * Cricket Sports Players — scoring-relevant fields only (not Auction purse/bid data).
 * Editable roster with search + filters; team names highlighted by team color.
 * Route: /tournament/:id/score/players
 */
import { useCallback, useDeferredValue, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetTournamentQueryKey,
  getListCategoriesQueryKey,
  getListPlayersQueryKey,
  getListTeamsQueryKey,
  useCreatePlayer,
  useGetTournament,
  useListCategories,
  useListPlayers,
  useListTeams,
  useUpdatePlayer,
  type Player,
  type PlayerUpdate,
  type Team,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  DarkSelect,
  EmptyState,
  FormActions,
  FormError,
  FormField,
  FormModal,
  PageHeader,
  SearchInput,
  btnCompactClass,
  btnSecondaryClass,
  hubCardClass,
  hubPanelClass,
  inputClass,
} from "@/components/scoring/cricket-page-chrome";
import { formatPlayerGender } from "@/components/player-gender-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { handoffAuctionParticipantsToSports } from "@/lib/scoring-api";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import {
  JERSEY_SIZE_VALUES,
  normalizeJerseySize,
  type JerseySize,
} from "@workspace/api-base/jersey-size";
import { playerRegistrationShareUrl } from "@workspace/api-base/registration-url";
import {
  isScoringPlayerRegistration,
  parseRegistrationCategoryMode,
  shouldShowOrganizerCategoryControls,
} from "@workspace/api-base/player-registration-mode";
import { PlayerCategorySelect } from "@/components/player-category-select";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  CalendarX,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  LayoutList,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  Settings,
  Trash2,
  Upload,
  User,
  UserMinus,
  UserRound,
  X,
} from "lucide-react";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import {
  PLAYER_PHOTO_ASPECT,
  PLAYER_PHOTO_EXPORT_MAX_MB,
  PLAYER_PHOTO_WIDTH,
} from "@/lib/player-photo";
import { cldUrl } from "@/lib/cloudinary";
import { mapStoredGenderToPortrait } from "@workspace/api-base/player-gender";
import {
  exportCricketRosterToExcel,
  exportCricketRosterToPdf,
  type ExportRosterScope,
} from "@/lib/export-cricket-roster";
import { RosterImportModal } from "@/components/cricket/roster-import-modal";
import { cn } from "@/lib/utils";

const FALLBACK_ROLES = [
  "Batsman",
  "Bowler",
  "All Rounder",
  "Wicket Keeper",
] as const;

const BATTING_STYLES = ["Right-hand bat", "Left-hand bat"] as const;
const BOWLING_STYLES = [
  "Right-arm fast",
  "Right-arm medium",
  "Right-arm spin",
  "Left-arm fast",
  "Left-arm medium",
  "Left-arm spin",
] as const;

const UNASSIGNED_KEY = "unassigned";

type SportsPlayerForm = {
  serialNo: string;
  name: string;
  mobile: string;
  role: string;
  teamId: string;
  jerseyNumber: string;
  jerseySize: JerseySize | "";
  city: string;
  gender: string;
  battingStyle: string;
  bowlingStyle: string;
  categoryId: string;
  photoUrl: string;
  photoPublicId: string;
};

const EMPTY_FORM: SportsPlayerForm = {
  serialNo: "",
  name: "",
  mobile: "",
  role: FALLBACK_ROLES[0],
  teamId: "",
  jerseyNumber: "",
  jerseySize: "",
  city: "",
  gender: "",
  battingStyle: "",
  bowlingStyle: "",
  categoryId: "",
  photoUrl: "",
  photoPublicId: "",
};

function formFromPlayer(player: Player): SportsPlayerForm {
  return {
    serialNo: player.serialNo != null ? String(player.serialNo) : "",
    name: player.name || "",
    mobile: player.mobileNumber ? sanitizeMobileInput(player.mobileNumber) : "",
    role: player.role || FALLBACK_ROLES[0],
    teamId: player.teamId != null ? String(player.teamId) : "",
    jerseyNumber: player.jerseyNumber || "",
    jerseySize: normalizeJerseySize(player.jerseySize) ?? "",
    city: player.city || "",
    gender: player.gender || "",
    battingStyle: player.battingStyle || "",
    bowlingStyle: player.bowlingStyle || "",
    categoryId: player.categoryId != null ? String(player.categoryId) : "",
    photoUrl: player.photoUrl && !player.photoUrl.startsWith("data:") ? player.photoUrl : "",
    photoPublicId: (player as { photoPublicId?: string | null }).photoPublicId || "",
  };
}

function PlayerPhoto({
  photoUrl,
  name,
  gender,
  size = "sm",
}: {
  photoUrl?: string | null;
  name: string;
  gender?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "w-14 h-14" : size === "md" ? "w-10 h-10" : "w-8 h-8";
  const iconDim = size === "lg" ? "w-6 h-6" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const portraitGender = mapStoredGenderToPortrait(gender);
  return (
    <div
      className={`${dim} rounded-full bg-muted/20 border border-border/30 flex items-center justify-center overflow-hidden shrink-0`}
    >
      {photoUrl ? (
        <img
          src={cldUrl(photoUrl, "thumbnail")}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : portraitGender === "female" ? (
        <UserRound className={`${iconDim} text-muted-foreground/35`} aria-hidden />
      ) : (
        <User className={`${iconDim} text-muted-foreground/35`} aria-hidden />
      )}
    </div>
  );
}

function normalizeTeamColor(color?: string | null): string {
  const raw = color?.trim();
  if (!raw) return "#64748b";
  return raw.startsWith("#") ? raw : `#${raw}`;
}

function teamChipStyle(color?: string | null): CSSProperties {
  const c = normalizeTeamColor(color);
  return {
    color: c,
    backgroundColor: `${c}1F`,
    borderColor: `${c}66`,
  };
}

function playerSearchHaystack(player: Player, team: Team | undefined): string {
  return [
    String(player.serialNo ?? player.id),
    player.name,
    player.mobileNumber,
    player.role,
    player.jerseyNumber,
    player.jerseySize,
    player.city,
    player.gender,
    player.battingStyle,
    player.bowlingStyle,
    team?.name,
    team?.shortCode,
    team?.ownerName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesSearch(player: Player, team: Team | undefined, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  if (/^\d+$/.test(query)) {
    if (String(player.serialNo ?? player.id) === query) return true;
    if (player.jerseyNumber && String(player.jerseyNumber) === query) return true;
    if (query.length >= 4 && (player.mobileNumber || "").includes(query)) return true;
    if (player.jerseyNumber?.includes(query)) return true;
    return false;
  }

  return playerSearchHaystack(player, team).includes(query);
}

export default function CricketPlayersPage() {
  const [, params] = useRoute("/tournament/:id/score/players");
  const tournamentId = parseInt(params?.id || "0");
  const { toast } = useToast();
  const qc = useQueryClient();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();

  const [formOpen, setFormOpen] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [form, setForm] = useState<SportsPlayerForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [sportRoles, setSportRoles] = useState<string[]>([...FALLBACK_ROLES]);
  const [assignPlayer, setAssignPlayer] = useState<Player | null>(null);
  const [assignTeamId, setAssignTeamId] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [unassignBusy, setUnassignBusy] = useState(false);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [teamFilter, setTeamFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [battingFilter, setBattingFilter] = useState("all");
  const [bowlingFilter, setBowlingFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [regSettingsOpen, setRegSettingsOpen] = useState(false);
  const [regCopied, setRegCopied] = useState(false);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const enabled = scoringActive && !!tournamentId;
  const scoringMode = isScoringPlayerRegistration(tournament?.playerRegistrationMode);
  const categoryMode = parseRegistrationCategoryMode(tournament?.registrationCategoryMode);
  const showCategoryControls = shouldShowOrganizerCategoryControls(categoryMode);

  const regUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = tournament?.auctionCode;
    if (!code) return "";
    return playerRegistrationShareUrl(window.location.origin, code);
  }, [tournament?.auctionCode]);

  const { data: regStatus } = useQuery({
    queryKey: ["registration-status", tournamentId],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${tournamentId}/registration-status`);
      if (!res.ok) return null;
      return res.json() as Promise<{
        open: boolean;
        reason?: string | null;
        currentCount: number;
        limit?: number | null;
      }>;
    },
    enabled: !!tournamentId,
  });

  const handleCopyLink = useCallback(async () => {
    if (!regUrl) return;
    try {
      await navigator.clipboard.writeText(regUrl);
      setRegCopied(true);
      toast({ title: "Link copied to clipboard" });
      setTimeout(() => setRegCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy link", variant: "destructive" });
    }
  }, [regUrl, toast]);

  const { data: players = [], isLoading: playersLoading } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled },
  });
  const { data: teams = [] } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled },
  });
  const { data: categories = [] } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: enabled && showCategoryControls },
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sports/by-slug/cricket/roles", { credentials: "include" });
        if (!res.ok) return;
        const data: unknown = await res.json();
        const roles = Array.isArray(data)
          ? data
              .map((item) =>
                item && typeof item === "object" && typeof (item as { roleName?: unknown }).roleName === "string"
                  ? (item as { roleName: string }).roleName
                  : null,
              )
              .filter((r): r is string => !!r)
          : [];
        if (!cancelled && roles.length > 0) setSportRoles(roles);
      } catch {
        /* keep fallback roles */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const teamById = useMemo(() => {
    const map = new Map<number, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>([...sportRoles, ...FALLBACK_ROLES]);
    for (const p of players) {
      if (p.role?.trim()) set.add(p.role.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [players, sportRoles]);

  const battingOptions = useMemo(() => {
    const set = new Set<string>([...BATTING_STYLES]);
    for (const p of players) {
      if (p.battingStyle?.trim()) set.add(p.battingStyle.trim());
    }
    return [...set];
  }, [players]);

  const bowlingOptions = useMemo(() => {
    const set = new Set<string>([...BOWLING_STYLES]);
    for (const p of players) {
      if (p.bowlingStyle?.trim()) set.add(p.bowlingStyle.trim());
    }
    return [...set];
  }, [players]);

  const filtersActive =
    deferredSearch.trim().length > 0 ||
    teamFilter !== "all" ||
    roleFilter !== "all" ||
    genderFilter !== "all" ||
    battingFilter !== "all" ||
    bowlingFilter !== "all";

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const team = p.teamId != null ? teamById.get(p.teamId) : undefined;

      if (!matchesSearch(p, team, deferredSearch)) return false;

      if (teamFilter === UNASSIGNED_KEY) {
        if (p.teamId != null) return false;
      } else if (teamFilter !== "all" && String(p.teamId) !== teamFilter) {
        return false;
      }

      if (roleFilter === "unset") {
        if (p.role?.trim()) return false;
      } else if (roleFilter !== "all" && (p.role || "") !== roleFilter) {
        return false;
      }

      if (genderFilter === "unspecified") {
        if (p.gender) return false;
      } else if (genderFilter !== "all" && p.gender !== genderFilter) {
        return false;
      }

      if (battingFilter === "unset") {
        if (p.battingStyle?.trim()) return false;
      } else if (battingFilter !== "all" && (p.battingStyle || "") !== battingFilter) {
        return false;
      }

      if (bowlingFilter === "unset") {
        if (p.bowlingStyle?.trim()) return false;
      } else if (bowlingFilter !== "all" && (p.bowlingStyle || "") !== bowlingFilter) {
        return false;
      }

      return true;
    });
  }, [
    players,
    teamById,
    deferredSearch,
    teamFilter,
    roleFilter,
    genderFilter,
    battingFilter,
    bowlingFilter,
  ]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, Player[]>();
    for (const p of filtered) {
      const key = p.teamId != null ? String(p.teamId) : UNASSIGNED_KEY;
      const list = buckets.get(key) ?? [];
      list.push(p);
      buckets.set(key, list);
    }
    for (const list of buckets.values()) {
      list.sort((a, b) => (a.serialNo ?? a.id) - (b.serialNo ?? b.id));
    }
    return [...buckets.entries()].sort(([a], [b]) => {
      if (a === UNASSIGNED_KEY) return 1;
      if (b === UNASSIGNED_KEY) return -1;
      const an = teamById.get(Number(a))?.name ?? a;
      const bn = teamById.get(Number(b))?.name ?? b;
      return an.localeCompare(bn);
    });
  }, [filtered, teamById]);

  const playersWithoutTeam = players.filter((p) => p.teamId == null).length;
  const searchStale = search !== deferredSearch;

  function clearFilters() {
    setSearch("");
    setTeamFilter("all");
    setRoleFilter("all");
    setGenderFilter("all");
    setBattingFilter("all");
    setBowlingFilter("all");
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, role: sportRoles[0] || FALLBACK_ROLES[0] });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(player: Player) {
    setEditing(player);
    setForm(formFromPlayer(player));
    setFormError("");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setFormError("");
  }

  function openAssignTeam(player: Player) {
    if (teams.length === 0) return;
    setAssignError("");
    setAssignPlayer(player);
    setAssignTeamId(
      player.teamId != null
        ? String(player.teamId)
        : String(teams[0]?.id ?? ""),
    );
  }

  function closeAssignTeam() {
    if (assignBusy) return;
    setAssignPlayer(null);
    setAssignTeamId("");
    setAssignError("");
  }

  async function handleAssignTeam() {
    if (!assignPlayer || !assignTeamId) {
      setAssignError("Select a team");
      return;
    }
    const nextTeamId = Number(assignTeamId);
    if (!Number.isFinite(nextTeamId)) {
      setAssignError("Select a team");
      return;
    }
    if (assignPlayer.teamId === nextTeamId) {
      closeAssignTeam();
      return;
    }

    setAssignBusy(true);
    setAssignError("");
    try {
      await updatePlayer.mutateAsync({
        tournamentId,
        playerId: assignPlayer.id,
        data: { teamId: nextTeamId },
      });
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      toast({
        title: assignPlayer.teamId != null ? "Team re-assigned" : "Team assigned",
        description: assignPlayer.name,
      });
      setAssignPlayer(null);
      setAssignTeamId("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not update team");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleUnassignTeam() {
    if (!assignPlayer) return;
    setAssignBusy(true);
    setAssignError("");
    try {
      await updatePlayer.mutateAsync({
        tournamentId,
        playerId: assignPlayer.id,
        data: { teamId: null, status: "available" },
      });
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      toast({
        title: "Removed from squad",
        description: `${assignPlayer.name} moved to unassigned pool.`,
      });
      setAssignPlayer(null);
      setAssignTeamId("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not unassign team");
    } finally {
      setAssignBusy(false);
    }
  }

  async function handleDeletePlayer(player: Player) {
    setDeleteBusy(true);
    try {
      const res = await fetch(
        `/api/tournaments/${tournamentId}/players/${player.id}?context=scoring`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Could not delete player");
      }
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      toast({
        title: "Player deleted",
        description: `${player.name} was removed from the roster.`,
      });
      setPlayerToDelete(null);
      if (editing?.id === player.id) {
        closeForm();
      }
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Could not delete player",
        variant: "destructive",
      });
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleImport() {
    setImportBusy(true);
    try {
      const result = await handoffAuctionParticipantsToSports(tournamentId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) }),
        qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) }),
      ]);
      toast({
        title: "Imported from Auction",
        description: result.message || `${result.playersReady} players ready for Sports.`,
      });
    } catch (err) {
      toast({
        title: "Import failed",
        description: err instanceof Error ? err.message : "Could not import players",
        variant: "destructive",
      });
    } finally {
      setImportBusy(false);
    }
  }

  async function handleExport(format: "excel" | "pdf", scope: ExportRosterScope) {
    if (players.length === 0) return;
    setExporting(format);
    try {
      const targetPlayers = filtersActive && scope === "all" ? filtered : players;
      if (format === "excel") {
        await exportCricketRosterToExcel({
          tournamentName: tournament?.name || "Cricket Tournament",
          players: targetPlayers,
          teams,
          categories,
          scope,
        });
        toast({
          title: "Excel downloaded",
          description:
            typeof scope === "number"
              ? `${teams.find((t) => t.id === scope)?.name ?? "Team"} roster exported.`
              : scope === "multi-sheet"
              ? "All teams exported as multi-sheet workbook."
              : "Full tournament roster exported.",
        });
      } else {
        await exportCricketRosterToPdf({
          tournamentName: tournament?.name || "Cricket Tournament",
          players: targetPlayers,
          teams,
          categories,
          scope,
        });
        toast({
          title: "PDF downloaded",
          description:
            typeof scope === "number"
              ? `${teams.find((t) => t.id === scope)?.name ?? "Team"} roster PDF saved.`
              : "Tournament roster PDF saved.",
        });
      }
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Could not export roster",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  }

  async function handleSave() {
    setFormError("");
    const parsedMobile = parseIndianMobile(form.mobile);
    if (!form.name.trim()) {
      setFormError("Player name is required");
      return;
    }
    if (!parsedMobile.ok) {
      setFormError(parsedMobile.error);
      return;
    }

    let parsedSerialNo: number | undefined;
    if (form.serialNo.trim()) {
      const parsed = parseInt(form.serialNo.trim(), 10);
      if (isNaN(parsed) || parsed <= 0) {
        setFormError("Serial number must be a valid positive number");
        return;
      }
      parsedSerialNo = parsed;
    }

    const assignedTeamId = form.teamId ? Number(form.teamId) : null;
    const initialPhotoUrl = editing?.photoUrl ?? "";
    const photoChanged = (form.photoUrl || "") !== initialPhotoUrl || !!form.photoPublicId;

    const jerseySize = normalizeJerseySize(form.jerseySize);
    const sportsPayload = {
      ...(parsedSerialNo !== undefined ? { serialNo: parsedSerialNo } : {}),
      name: form.name.trim(),
      mobileNumber: parsedMobile.normalized,
      role: form.role || undefined,
      jerseyNumber: form.jerseyNumber.trim() || undefined,
      ...(editing
        ? { jerseySize: (jerseySize ?? null) as PlayerUpdate["jerseySize"] }
        : jerseySize
          ? { jerseySize }
          : {}),
      city: form.city.trim() || undefined,
      gender: (form.gender || undefined) as "M" | "F" | undefined,
      battingStyle: form.battingStyle || undefined,
      bowlingStyle: form.bowlingStyle && form.bowlingStyle !== "None" ? form.bowlingStyle : undefined,
      teamId: assignedTeamId,
      ...(photoChanged
        ? {
            photoUrl: form.photoUrl || (editing ? "" : undefined),
            photoPublicId: form.photoPublicId || (editing ? "" : undefined),
          }
        : {}),
      ...(editing ? {} : { status: "available" as const }),
      ...(showCategoryControls
        ? { categoryId: form.categoryId ? Number(form.categoryId) : undefined }
        : {}),
    };

    try {
      if (editing) {
        await updatePlayer.mutateAsync({
          tournamentId,
          playerId: editing.id,
          data: sportsPayload,
        });
        toast({ title: "Player updated" });
      } else {
        await createPlayer.mutateAsync({
          tournamentId,
          data: sportsPayload,
        });
        toast({ title: "Player added" });
      }
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not save player");
    }
  }

  const saving = createPlayer.isPending || updatePlayer.isPending;

  if (tournament?.sport && tournament.sport !== "cricket") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Setup"
        title="Players"
        subtitle="Sports roster — search, filter, and edit scoring fields"
        actions={
          <div className="flex flex-wrap gap-2">
            <BtnSecondary
              disabled={!scoringActive || !tournament?.auctionCode}
              onClick={() => setRegSettingsOpen(true)}
            >
              <Link2 className="w-4 h-4" />
              Registration Link
            </BtnSecondary>
            <BtnSecondary disabled={!scoringActive || importBusy} onClick={() => void handleImport()}>
              <Upload className="w-4 h-4" />
              {importBusy ? "Importing…" : "Import from Auction"}
            </BtnSecondary>
            <BtnSecondary disabled={!scoringActive} onClick={() => setExcelImportOpen(true)}>
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Import Excel Roster
            </BtnSecondary>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(btnSecondaryClass, "gap-2 cursor-pointer")}
                  disabled={!scoringActive || players.length === 0 || exporting !== null}
                >
                  {exporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{exporting ? "Exporting…" : "Download"}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Excel Export (.xlsx)
                </div>
                <DropdownMenuItem onSelect={() => void handleExport("excel", "all")} onClick={() => void handleExport("excel", "all")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                  <span>Overall Roster (All Players)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleExport("excel", "multi-sheet")} onClick={() => void handleExport("excel", "multi-sheet")}>
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                  <span>All Teams (Multi-sheet)</span>
                </DropdownMenuItem>
                {teams.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-500" />
                      <span>Single Team Excel</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {teams
                        .toSorted((a, b) => a.name.localeCompare(b.name))
                        .map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onSelect={() => void handleExport("excel", t.id)}
                            onClick={() => void handleExport("excel", t.id)}
                          >
                            <span className="truncate">{t.name}</span>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}

                <DropdownMenuSeparator />

                <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  PDF Export (.pdf)
                </div>
                <DropdownMenuItem onSelect={() => void handleExport("pdf", "all")} onClick={() => void handleExport("pdf", "all")}>
                  <FileText className="w-4 h-4 mr-2 text-rose-500" />
                  <span>Overall Roster (.pdf)</span>
                </DropdownMenuItem>
                {teams.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FileText className="w-4 h-4 mr-2 text-rose-500" />
                      <span>Single Team PDF</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-56">
                      {teams
                        .toSorted((a, b) => a.name.localeCompare(b.name))
                        .map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onSelect={() => void handleExport("pdf", t.id)}
                            onClick={() => void handleExport("pdf", t.id)}
                          >
                            <span className="truncate">{t.name}</span>
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            <BtnPrimary disabled={!scoringActive} onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add Player
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-5">
        {tournamentLoading || (scoringActive && playersLoading) ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : !scoringActive ? (
          <EmptyState
            icon={UserRound}
            title="Scoring not Activated"
            desc="Contact BIDWAR for enabling sport scoring module."
          />
        ) : players.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="No players yet"
            desc="Import from Auction, or add scoring players manually (name, role, team, jersey)."
            action={{ label: "Add Player", onClick: openCreate }}
          />
        ) : (
          <>
            <div className={cn(hubPanelClass, "px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3")}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Total</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">{players.length}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">In teams</span>{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {players.length - playersWithoutTeam}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Without team</span>{" "}
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      playersWithoutTeam > 0 ? "text-amber-300" : "text-foreground",
                    )}
                  >
                    {playersWithoutTeam}
                  </span>
                </p>
                {filtersActive ? (
                  <p>
                    <span className="text-muted-foreground">Showing</span>{" "}
                    <span
                      className={cn(
                        "font-semibold tabular-nums text-foreground",
                        searchStale && "opacity-70",
                      )}
                    >
                      {filtered.length}
                    </span>
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background/40 p-0.5 shrink-0 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Table view"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    viewMode === "cards"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title="Card view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search name, team, role, jersey, city, mobile…"
                  className="flex-1 min-w-0"
                />
                {filtersActive ? (
                  <BtnSecondary type="button" onClick={clearFilters} className="shrink-0">
                    <X className="w-4 h-4" />
                    Clear filters
                  </BtnSecondary>
                ) : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <FormField label="Team">
                  <DarkSelect
                    value={teamFilter}
                    onValueChange={setTeamFilter}
                    options={[
                      { value: "all", label: "All teams" },
                      { value: UNASSIGNED_KEY, label: "No team assigned" },
                      ...teams
                        .toSorted((a, b) => a.name.localeCompare(b.name))
                        .map((t) => ({ value: String(t.id), label: `${t.name} (${t.shortCode})` })),
                    ]}
                  />
                </FormField>
                <FormField label="Role">
                  <DarkSelect
                    value={roleFilter}
                    onValueChange={setRoleFilter}
                    options={[
                      { value: "all", label: "All roles" },
                      { value: "unset", label: "No role set" },
                      ...roleOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
                <FormField label="Gender">
                  <DarkSelect
                    value={genderFilter}
                    onValueChange={setGenderFilter}
                    options={[
                      { value: "all", label: "All genders" },
                      { value: "M", label: "Male" },
                      { value: "F", label: "Female" },
                      { value: "unspecified", label: "Not specified" },
                    ]}
                  />
                </FormField>
                <FormField label="Batting">
                  <DarkSelect
                    value={battingFilter}
                    onValueChange={setBattingFilter}
                    options={[
                      { value: "all", label: "All batting" },
                      { value: "unset", label: "Not set" },
                      ...battingOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
                <FormField label="Bowling">
                  <DarkSelect
                    value={bowlingFilter}
                    onValueChange={setBowlingFilter}
                    options={[
                      { value: "all", label: "All bowling" },
                      { value: "unset", label: "Not set" },
                      ...bowlingOptions.map((r) => ({ value: r, label: r })),
                    ]}
                  />
                </FormField>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title="No players match"
                desc="Try clearing search or changing team / role / gender filters."
                action={{ label: "Clear filters", onClick: clearFilters }}
              />
            ) : (
              <div className={cn("space-y-7", searchStale && "opacity-80 transition-opacity")}>
                {grouped.map(([key, list]) => {
                  const isUnassigned = key === UNASSIGNED_KEY;
                  const team = !isUnassigned ? teamById.get(Number(key)) : undefined;
                  const teamColor = normalizeTeamColor(team?.color);
                  const heading = isUnassigned
                    ? "Players without team"
                    : team?.name ?? `Team #${key}`;

                  return (
                    <section key={key} className="space-y-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="h-8 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: isUnassigned ? "#64748b" : teamColor }}
                          aria-hidden
                        />
                        {!isUnassigned && team ? (
                          <span
                            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase shrink-0"
                            style={teamChipStyle(team.color)}
                          >
                            {team.shortCode}
                          </span>
                        ) : null}
                        <h2
                          className="text-base font-semibold tracking-tight truncate"
                          style={isUnassigned ? undefined : { color: teamColor }}
                        >
                          {heading}
                        </h2>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {list.length} {list.length === 1 ? "player" : "players"}
                        </span>
                        {!isUnassigned && team && list.length > 0 ? (
                          <div className="ml-auto flex items-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  disabled={exporting !== null}
                                  className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card/60 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                                  title={`Export ${team.name} roster`}
                                >
                                  <Download className="w-3 h-3" />
                                  <span className="hidden sm:inline">Export</span>
                                  <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  onSelect={() => void handleExport("excel", team.id)}
                                  onClick={() => void handleExport("excel", team.id)}
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                                  <span>Excel (.xlsx)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => void handleExport("pdf", team.id)}
                                  onClick={() => void handleExport("pdf", team.id)}
                                >
                                  <FileText className="w-3.5 h-3.5 mr-2 text-rose-500" />
                                  <span>PDF (.pdf)</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ) : null}
                      </div>

                      {viewMode === "table" ? (
                        <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/40 backdrop-blur-sm shadow-sm">
                          <table className="w-full text-left text-sm border-collapse min-w-[760px]">
                            <thead>
                              <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                <th className="py-2.5 px-3 w-14 text-center">#</th>
                                <th className="py-2.5 px-3 min-w-[170px]">Player</th>
                                <th className="py-2.5 px-3 min-w-[120px]">Role</th>
                                <th className="py-2.5 px-3 min-w-[110px]">Batting</th>
                                <th className="py-2.5 px-3 min-w-[130px]">Bowling</th>
                                <th className="py-2.5 px-3 min-w-[110px]">Mobile</th>
                                {showCategoryControls ? (
                                  <th className="py-2.5 px-3 min-w-[130px]">Category</th>
                                ) : null}
                                <th className="py-2.5 px-3 text-right min-w-[210px]">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {list.map((p) => {
                                const cardTeam = p.teamId != null ? teamById.get(p.teamId) : undefined;
                                const accent = normalizeTeamColor(cardTeam?.color);
                                const subtitle = [
                                  p.city,
                                  p.gender ? formatPlayerGender(p.gender) : null,
                                ].filter(Boolean).join(" · ");

                                return (
                                  <tr
                                    key={p.id}
                                    className="group hover:bg-muted/30 transition-colors"
                                  >
                                    <td className="py-2 px-3 text-center">
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono bg-muted/80 text-foreground border border-border/60">
                                        #{p.serialNo ?? p.id}
                                      </span>
                                    </td>
                                    <td className="py-2 px-3">
                                      <div className="flex items-center gap-2.5">
                                        <PlayerPhoto photoUrl={p.photoUrl} name={p.name} gender={p.gender} size="sm" />
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <button
                                              type="button"
                                              onClick={() => openEdit(p)}
                                              className="font-medium text-foreground hover:text-primary transition-colors truncate text-left"
                                            >
                                              {p.name}
                                            </button>
                                            {p.jerseyNumber ? (
                                              <span
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 shrink-0"
                                                title={`Jersey #${p.jerseyNumber}`}
                                              >
                                                #{p.jerseyNumber}
                                              </span>
                                            ) : null}
                                            {p.jerseySize ? (
                                              <span
                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-muted/80 text-foreground border border-border/60 shrink-0"
                                                title={`Jersey size ${p.jerseySize}`}
                                              >
                                                {p.jerseySize}
                                              </span>
                                            ) : null}
                                          </div>
                                          {subtitle ? (
                                            <span className="text-[11px] text-muted-foreground truncate block">
                                              {subtitle}
                                            </span>
                                          ) : null}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2 px-3 text-xs">
                                      {p.role ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                                          {p.role}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground/50">—</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 text-xs text-muted-foreground">
                                      {p.battingStyle || <span className="opacity-40">—</span>}
                                    </td>
                                    <td className="py-2 px-3 text-xs text-muted-foreground">
                                      {p.bowlingStyle || <span className="opacity-40">—</span>}
                                    </td>
                                    <td className="py-2 px-3 text-xs font-mono text-muted-foreground">
                                      {p.mobileNumber || <span className="opacity-40">—</span>}
                                    </td>
                                    {showCategoryControls ? (
                                      <td className="py-2 px-3">
                                        <div onClick={(e) => e.stopPropagation()}>
                                          <PlayerCategorySelect
                                            tournamentId={tournamentId}
                                            playerId={p.id}
                                            categoryId={p.categoryId}
                                            categories={categories}
                                            noneLabel="No category"
                                            triggerClassName="h-7 text-xs w-[130px]"
                                          />
                                        </div>
                                      </td>
                                    ) : null}
                                    <td className="py-2 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <BtnSecondary
                                          className={cn(btnCompactClass, "h-7 px-2.5 text-xs inline-flex items-center gap-1")}
                                          onClick={() => openEdit(p)}
                                          title="Edit Player"
                                        >
                                          <Pencil className="w-3 h-3" />
                                          <span>Edit</span>
                                        </BtnSecondary>
                                        {teams.length > 0 ? (
                                          <BtnSecondary
                                            className={cn(btnCompactClass, "h-7 px-2.5 text-xs whitespace-nowrap")}
                                            onClick={() => openAssignTeam(p)}
                                            title={p.teamId != null ? "Re-assign Team" : "Assign Team"}
                                          >
                                            {p.teamId != null ? "Re-assign" : "Assign"}
                                          </BtnSecondary>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => setPlayerToDelete(p)}
                                          className="h-7 px-2.5 flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 text-xs font-medium text-destructive hover:bg-destructive/20 hover:border-destructive/50 transition-colors"
                                          title="Delete Player"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Delete</span>
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {list.map((p) => {
                            const cardTeam = p.teamId != null ? teamById.get(p.teamId) : undefined;
                            const accent = normalizeTeamColor(cardTeam?.color);
                            const meta = [
                              p.role,
                              p.jerseyNumber ? `Jersey #${p.jerseyNumber}` : null,
                              p.jerseySize ? `Size ${p.jerseySize}` : null,
                              p.gender ? formatPlayerGender(p.gender) : null,
                            ].filter(Boolean);

                            return (
                              <div
                                key={p.id}
                                role="button"
                                tabIndex={0}
                                className={cn(
                                  hubCardClass,
                                  "relative overflow-hidden p-3 pl-3.5 space-y-1.5 text-left cursor-pointer transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                )}
                                onClick={() => openEdit(p)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openEdit(p);
                                  }
                                }}
                              >
                                <span
                                  className="absolute inset-y-0 left-0 w-1"
                                  style={{ backgroundColor: cardTeam ? accent : "transparent" }}
                                  aria-hidden
                                />
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <PlayerPhoto photoUrl={p.photoUrl} name={p.name} gender={p.gender} size="md" />
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="font-mono text-xs font-bold text-muted-foreground/70 shrink-0">
                                          #{p.serialNo ?? p.id}
                                        </span>
                                        <p className="font-medium text-foreground truncate">{p.name}</p>
                                      </div>
                                      {cardTeam ? (
                                        <span
                                          className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold truncate"
                                          style={teamChipStyle(cardTeam.color)}
                                          title={cardTeam.name}
                                        >
                                          <span
                                            className="h-1.5 w-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: accent }}
                                          />
                                          <span className="truncate">{cardTeam.name}</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                          No team
                                        </span>
                                      )}
                                      <p className="text-xs text-muted-foreground">
                                        {meta.length > 0 ? meta.join(" · ") : "No role set"}
                                      </p>
                                      {showCategoryControls ? (
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => e.stopPropagation()}
                                        >
                                          <PlayerCategorySelect
                                            tournamentId={tournamentId}
                                            playerId={p.id}
                                            categoryId={p.categoryId}
                                            categories={categories}
                                            noneLabel="No category"
                                            triggerClassName="max-w-full w-full"
                                          />
                                        </div>
                                      ) : null}
                                      {p.mobileNumber ? (
                                        <p className="text-xs text-muted-foreground font-mono">{p.mobileNumber}</p>
                                      ) : null}
                                      {p.battingStyle || p.bowlingStyle ? (
                                        <p className="text-[11px] text-muted-foreground/80 truncate">
                                          {[p.battingStyle, p.bowlingStyle].filter(Boolean).join(" · ")}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div
                                    className="flex flex-col items-stretch gap-1.5 shrink-0 w-[7.75rem]"
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => e.stopPropagation()}
                                  >
                                    <BtnSecondary
                                      className={cn(btnCompactClass, "h-8 min-h-8 w-full justify-center")}
                                      onClick={() => openEdit(p)}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                      Edit
                                    </BtnSecondary>
                                    {teams.length === 0 ? (
                                      <button
                                        type="button"
                                        disabled
                                        className="rounded-md border border-border/50 bg-muted/40 px-1.5 py-1 text-[10px] leading-tight text-muted-foreground cursor-not-allowed"
                                      >
                                        no teams are defined
                                      </button>
                                    ) : (
                                      <BtnSecondary
                                        className={cn(
                                          btnCompactClass,
                                          "h-auto min-h-8 w-full justify-center px-1.5 py-1 text-[10px] leading-tight whitespace-normal text-center",
                                        )}
                                        onClick={() => openAssignTeam(p)}
                                      >
                                        {p.teamId != null
                                          ? "Re-assign team"
                                          : "Assign team"}
                                      </BtnSecondary>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setPlayerToDelete(p)}
                                      className="h-7 w-full flex items-center justify-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 text-[10px] font-medium text-destructive hover:bg-destructive/20 hover:border-destructive/50 transition-colors"
                                      title="Delete Player"
                                    >
                                      <Trash2 className="w-3 h-3 shrink-0" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {formOpen ? (
        <FormModal
          title={editing ? "Edit Player" : "Add Player"}
          subtitle={editing ? `Player #${editing.serialNo ?? editing.id} · Sports scoring fields only` : "Sports scoring fields only"}
          onClose={closeForm}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full gap-3">
              {editing ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setPlayerToDelete(editing);
                  }}
                  className="gap-1.5 text-xs h-9"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Player
                </Button>
              ) : <div />}
              <FormActions
                onCancel={closeForm}
                onSubmit={() => void handleSave()}
                submitLabel={saving ? "Saving…" : editing ? "Update player" : "Save player"}
                saving={saving}
                disabled={saving}
              />
            </div>
          }
        >
          <div className="space-y-3">
            <FormField label="Player Photo">
              <div className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-full border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {form.photoUrl ? (
                    <img
                      src={form.photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <User className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <BtnSecondary
                    type="button"
                    onClick={() => setPhotoEditorOpen(true)}
                    className="gap-1.5 text-xs h-8"
                  >
                    {form.photoUrl ? (
                      <>
                        <Pencil className="w-3.5 h-3.5" /> Change Photo
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" /> Upload Photo
                      </>
                    )}
                  </BtnSecondary>
                  {form.photoUrl ? (
                    <BtnSecondary
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, photoUrl: "", photoPublicId: "" }));
                      }}
                      className="gap-1.5 text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remove
                    </BtnSecondary>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Upload or change player photo for scoreboard, match picker & broadcast overlays.
              </p>
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Tournament Serial No (S.No)">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={form.serialNo}
                  onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value.replace(/\D/g, "") }))}
                  placeholder={editing ? String(editing.serialNo ?? "") : "Auto-assigned (optional)"}
                />
              </FormField>
              <FormField label="Jersey number (Kit #)">
                <input
                  className={inputClass}
                  value={form.jerseyNumber}
                  onChange={(e) => setForm((f) => ({ ...f, jerseyNumber: e.target.value }))}
                  placeholder="e.g. 18"
                />
              </FormField>
              <FormField label="Jersey size">
                <DarkSelect
                  value={form.jerseySize || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      jerseySize: v === "none" ? "" : (v as JerseySize),
                    }))
                  }
                  options={[
                    { value: "none", label: "Not set" },
                    ...JERSEY_SIZE_VALUES.map((size) => ({ value: size, label: size })),
                  ]}
                />
              </FormField>
            </div>
            <FormField label="Name" required>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Player name"
                autoFocus
              />
            </FormField>
            <FormField label="Mobile" required>
              <input
                className={inputClass}
                inputMode="numeric"
                maxLength={10}
                value={form.mobile}
                onChange={(e) => setForm((f) => ({ ...f, mobile: sanitizeMobileInput(e.target.value) }))}
                placeholder="10-digit mobile"
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Role">
                <DarkSelect
                  value={form.role || roleOptions[0] || FALLBACK_ROLES[0]}
                  onValueChange={(role) => setForm((f) => ({ ...f, role }))}
                  options={(form.role && !roleOptions.includes(form.role)
                    ? [form.role, ...roleOptions]
                    : roleOptions
                  ).map((r) => ({ value: r, label: r }))}
                />
              </FormField>
              <FormField label="Team">
                <DarkSelect
                  value={form.teamId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, teamId: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Unassigned" },
                    ...teams.map((t) => ({ value: String(t.id), label: t.name })),
                  ]}
                />
              </FormField>
            </div>
            {showCategoryControls ? (
              <FormField label="Category">
                <DarkSelect
                  value={form.categoryId || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Assign later" },
                    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
                  ]}
                />
              </FormField>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="City">
                <input
                  className={inputClass}
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </FormField>
              <FormField label="Gender">
                <DarkSelect
                  value={form.gender || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, gender: v === "none" ? "" : v }))
                  }
                  options={[
                    { value: "none", label: "Not specified" },
                    { value: "M", label: "Male" },
                    { value: "F", label: "Female" },
                  ]}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Batting">
                <DarkSelect
                  value={form.battingStyle || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, battingStyle: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Not set" },
                    ...BATTING_STYLES.map((r) => ({ value: r, label: r })),
                  ]}
                />
              </FormField>
              <FormField label="Bowling">
                <DarkSelect
                  value={form.bowlingStyle || "none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, bowlingStyle: v === "none" ? "" : v }))}
                  options={[
                    { value: "none", label: "Not set" },
                    ...BOWLING_STYLES.map((r) => ({ value: r, label: r })),
                    { value: "None", label: "None" },
                  ]}
                />
              </FormField>
            </div>
            {formError ? <FormError message={formError} /> : null}
          </div>
        </FormModal>
      ) : null}

      <ImageEditorDialog
        open={photoEditorOpen}
        onClose={() => setPhotoEditorOpen(false)}
        initialUrl={form.photoUrl || undefined}
        aspect={PLAYER_PHOTO_ASPECT}
        title="Player Photo"
        exportMaxWidthOrHeight={PLAYER_PHOTO_WIDTH}
        exportMaxSizeMB={PLAYER_PHOTO_EXPORT_MAX_MB}
        exportHint="Higher resolution for sharp scoreboard & overlay display — use a clear, well-lit photo."
        onSave={(upload) => {
          setForm((f) => ({
            ...f,
            photoUrl: upload.url,
            photoPublicId: upload.publicId,
          }));
          setPhotoEditorOpen(false);
        }}
      />

      {assignPlayer ? (
        <FormModal
          title={assignPlayer.teamId != null ? "Re-assign team" : "Assign team"}
          subtitle={assignPlayer.name}
          onClose={closeAssignTeam}
          size="sm"
          footer={
            <FormActions
              onCancel={closeAssignTeam}
              onSubmit={() => void handleAssignTeam()}
              submitLabel={assignBusy ? "Saving…" : "Confirm"}
              saving={assignBusy}
              disabled={assignBusy || !assignTeamId}
            />
          }
        >
          <div className="space-y-3">
            {assignPlayer.teamId != null ? (
              <button
                type="button"
                disabled={assignBusy || unassignBusy}
                onClick={() => void handleUnassignTeam()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
              >
                <UserMinus className="w-3.5 h-3.5" />
                Remove from squad (Move to unassigned)
              </button>
            ) : null}
            <FormField label="Team" required>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {teams.map((t) => {
                  const selected = assignTeamId === String(t.id);
                  const accent = normalizeTeamColor(t.color);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={assignBusy}
                      onClick={() => setAssignTeamId(String(t.id))}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/60 bg-muted/20 hover:border-primary/35",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate font-medium">{t.name}</span>
                      {t.shortCode ? (
                        <span className="ml-auto text-[11px] text-muted-foreground shrink-0">
                          {t.shortCode}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </FormField>
            {assignError ? <FormError message={assignError} /> : null}
          </div>
        </FormModal>
      ) : null}

      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {playerToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this player from the tournament roster? This will remove their scoring roster profile and squad assignment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                if (playerToDelete) void handleDeletePlayer(playerToDelete);
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete Player"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Registration Link Dialog */}
      <Dialog open={regSettingsOpen} onOpenChange={setRegSettingsOpen}>
        <DialogContent className="max-w-lg dark">
          <DialogHeader>
            <DialogTitle>Share Player Registration Link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Share this link with players so they can register directly for this cricket tournament and select their team.
          </p>
          {regStatus && (
            <div className="pt-1">
              {regStatus.open ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                  <CheckCircle2 className="w-3 h-3" /> Open — {regStatus.currentCount}{regStatus.limit != null ? ` / ${regStatus.limit}` : ""} registered
                </span>
              ) : regStatus.reason === "deadline_passed" ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2.5 py-0.5">
                  <CalendarX className="w-3 h-3" /> Closed — deadline passed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-full px-2.5 py-0.5">
                  <Lock className="w-3 h-3" /> Closed — limit reached
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
            {regUrl ? (
              <>
                <p className="text-xs font-mono text-primary truncate flex-1 min-w-0">{regUrl}</p>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => void handleCopyLink()}>
                  {regCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {regCopied ? "Copied" : "Copy link"}
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" asChild>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`Register for our cricket tournament: ${regUrl}`)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3 h-3 text-emerald-400" /> WhatsApp
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => window.open(regUrl, "_blank")}>
                  <ExternalLink className="w-3 h-3" /> Open
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Registration link is unavailable until this tournament has a registration code.
              </p>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              asChild
            >
              <a href={`/tournament/${tournamentId}/score/settings#registration`}>
                <Settings className="w-3.5 h-3.5" />
                Registration Settings
              </a>
            </Button>
            <Button type="button" onClick={() => setRegSettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RosterImportModal
        open={excelImportOpen}
        onOpenChange={setExcelImportOpen}
        tournamentId={tournamentId}
        tournamentName={tournament?.name}
        teams={teams}
        players={players}
        onImportComplete={() => {
          void Promise.all([
            qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) }),
            qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) }),
          ]);
        }}
      />
    </CricketOrganizerPageShell>
  );
}
