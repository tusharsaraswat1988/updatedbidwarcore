import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { useRoute } from "wouter";
import {
  useListPlayers,
  useListCategories,
  useListTeams,
  useGetTournament,
  useGetRegistrationStatus,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  useBulkCreatePlayers,
  useApproveRegistrationPayment,
  useRejectRegistrationPayment,
  useResetRegistrationPaymentPending,
  useSearchGlobalPlayers,
  getSearchGlobalPlayersQueryKey,
  useListImportSources,
  getListImportSourcesQueryKey,
  useListImportCandidates,
  getListImportCandidatesQueryKey,
  useImportPlayersFromTournament,
  getListPlayersQueryKey,
  getListCategoriesQueryKey,
  getListTeamsQueryKey,
  getGetTournamentQueryKey,
  getGetRegistrationStatusQueryKey,
  type SearchGlobalPlayersParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { playerRegistrationShareUrl } from "@workspace/api-base/registration-url";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RegistrationPaymentReview } from "@/components/registration-payment/registration-payment-review";
import type { RegistrationPaymentStatus } from "@workspace/api-base/registration-payment";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, User, UserRound, Upload, Download, ExternalLink, X, ArrowLeft, Sparkles, Loader2, AlertTriangle, Users, CalendarDays, ChevronDown, ChevronUp, MoreHorizontal, Copy, Check, Gavel, ArrowUp, ArrowDown, ArrowUpDown, Filter, SlidersHorizontal, Search, CalendarX, Lock, CheckCircle2, MessageCircle, FileSpreadsheet, Sheet as SheetIcon } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import {
  buildCsvTemplateExampleRow,
  buildCsvTemplateHeaders,
  fetchSportSpecCatalog,
  parsePlayerCsv,
  type SportSpecCatalog,
} from "@/lib/csv-player-import";
import { getTagTheme, TAG_PULSE_ANIMATION, TAG_PULSE_KEYFRAMES, PLAYER_TAG_OPTIONS, playerTagLabel } from "@/lib/tag-theme";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoleSpecMap } from "@/hooks/use-role-spec-groups";
import { parseIndianMobile, sanitizeMobileInput, mobilesMatch } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { JerseySizeSelect } from "@/components/jersey-size-select";
import type { JerseySize } from "@workspace/api-base/jersey-size";
import { useToast } from "@/hooks/use-toast";
import {
  applySpecificationsToSelections,
  buildSpecificationsPayload,
} from "@/lib/player-specifications";
import { PlayerGenderSelect, formatPlayerGender } from "@/components/player-gender-select";
import { mapStoredGenderToPortrait } from "@workspace/api-base/player-gender";
import { settingsPath } from "@/lib/settings-navigation";
import {
  bidValueSourceLabel,
  canEditPlayerBidValue,
  getOrganizerBidOptions,
  shouldShowPlayerBidValueSelector,
} from "@workspace/api-base/bid-value";
import {
  reinstateTournamentPlayer,
  withdrawTournamentPlayer,
} from "@/lib/registration-api";
import { exportPlayersToExcel } from "@/lib/export-players-excel";
import {
  clearPendingGoogleSheetsExport,
  exportPlayersToGoogleSheetsApi,
  googleSheetsConnectUrl,
  GoogleSheetsAuthRequiredError,
  readPendingGoogleSheetsExport,
  savePendingGoogleSheetsExport,
} from "@/lib/export-players-google-sheets";

// ─── Global Player Search Autocomplete ────────────────────────────────────────

type SuggestionProfile = {
  id: number;
  name: string;
  mobileNumber?: string | null;
  city?: string | null;
  age?: number | null;
  gender?: string | null;
  role?: string | null;
  photoUrl?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  achievements?: string | null;
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  cricheroUrl?: string | null;
  availabilityDates?: string | null;
  basePrice?: number;
  specifications?: { specGroupId: number; groupName?: string; value: string }[];
  appearanceCount: number;
};

function GlobalPlayerSearch({ value, onChange, onFillFromProfile, sportSlug }: {
  value: string;
  onChange: (v: string) => void;
  onFillFromProfile: (p: SuggestionProfile) => void;
  sportSlug?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(value), 300);
    return () => clearTimeout(t);
  }, [value]);

  const { data: suggestions, isLoading, isFetching } = useSearchGlobalPlayers(
    { q: debouncedQ, limit: 8, ...(sportSlug ? { sport: sportSlug } : {}) } as SearchGlobalPlayersParams & { sport?: string },
    { query: { queryKey: getSearchGlobalPlayersQueryKey({ q: debouncedQ, ...(sportSlug ? { sport: sportSlug } : {}) }), enabled: debouncedQ.length >= 2 } },
  );

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const searching = open && debouncedQ.length >= 2 && (isLoading || isFetching);
  const showDropdown = open && debouncedQ.length >= 2 && (searching || (suggestions?.length ?? 0) > 0);

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        required
        placeholder="Full name"
        autoComplete="off"
      />
      {showDropdown && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-xl overflow-hidden">
          {searching ? (
            <div className="flex items-center gap-2.5 px-3 py-3 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="w-4 h-4 animate-spin shrink-0 text-primary" />
              Searching player database…
            </div>
          ) : (suggestions?.length ?? 0) === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground text-center">No matching players found</p>
          ) : (
          suggestions!.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors flex items-center gap-3 border-b border-border/40 last:border-0"
              onMouseDown={() => { onFillFromProfile(p as SuggestionProfile); setOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.photoUrl ? (
                  <img src={cldUrl(p.photoUrl, "thumbnail")} alt={p.name} className="w-full h-full object-cover" decoding="async" />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">{p.name}</span>
                  {p.role && <span className="text-xs text-muted-foreground capitalize">{p.role}</span>}
                  {p.appearanceCount > 1 && (
                    <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {p.appearanceCount} tournaments
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {p.city && <span>{p.city}</span>}
                  {p.mobileNumber && <span className="font-mono">{p.mobileNumber}</span>}
                </div>
              </div>
            </button>
          ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tournament Import Dialog ──────────────────────────────────────────────────

function TournamentImportDialog({ tournamentId, onClose }: {
  tournamentId: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [sourceTournamentId, setSourceTournamentId] = useState<number | null>(null);
  const [sourceName, setSourceName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; total: number } | null>(null);

  const importMutation = useImportPlayersFromTournament();

  const { data: sources, isLoading: sourcesLoading } = useListImportSources(tournamentId, {
    query: { queryKey: getListImportSourcesQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: candidates, isLoading: candidatesLoading } = useListImportCandidates(
    tournamentId,
    { sourceTournamentId: sourceTournamentId ?? 0 },
    {
      query: {
        queryKey: getListImportCandidatesQueryKey(tournamentId, { sourceTournamentId: sourceTournamentId ?? 0 }),
        enabled: !!sourceTournamentId,
      },
    },
  );

  const filteredCandidates = (candidates || []).filter(p => {
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.mobileNumber || "").includes(search);
  });

  const nonDupeCount = (candidates || []).filter(p => !p.isDuplicate).length;
  const dupeCount = (candidates || []).filter(p => p.isDuplicate).length;

  function selectAllNonDupes() {
    setSelectedIds(new Set((candidates || []).filter(p => !p.isDuplicate).map(p => p.id)));
  }

  function deselectAll() { setSelectedIds(new Set()); }

  function togglePlayer(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selectedIds.size === 0 || !sourceTournamentId) return;
    const res = await importMutation.mutateAsync({
      tournamentId,
      data: {
        sourceTournamentId,
        playerIds: Array.from(selectedIds),
      },
    });
    setResult(res);
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }

  // Result screen
  if (result) {
    return (
      <div className="space-y-5">
        <div className={`p-5 rounded-lg border ${result.imported > 0 ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
          <p className="font-bold text-xl">{result.imported} player{result.imported !== 1 ? "s" : ""} imported</p>
          {result.skipped > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{result.skipped} skipped — already in tournament</p>
          )}
        </div>
        <Button className="w-full" onClick={onClose}>Done</Button>
      </div>
    );
  }

  // Step 1 — Source selection
  if (step === 1) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Select a tournament to import players from.</p>
        {sourcesLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : (sources || []).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No other tournaments found</p>
            <p className="text-xs mt-1">Other tournaments with registered players will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {(sources || []).map(s => (
              <button
                key={s.id}
                type="button"
                className="w-full text-left border border-border hover:border-primary/50 hover:bg-accent/40 rounded-lg p-4 transition-all"
                onClick={() => { setSourceTournamentId(s.id); setSourceName(s.name); setStep(2); }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{s.name}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">
                      {s.sport}{s.auctionDate ? ` · ${s.auctionDate}${(s as { auctionTime?: string | null }).auctionTime ? ` ${(s as { auctionTime?: string | null }).auctionTime}` : ""}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-mono shrink-0">{s.playerCount} players</Badge>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Step 2 — Player selection
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setStep(1); setSelectedIds(new Set()); setSearch(""); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span className="font-semibold text-sm truncate">{sourceName}</span>
        <span className="text-muted-foreground text-xs ml-auto shrink-0">{selectedIds.size} selected</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Filter by name or mobile..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 h-8 text-sm"
        />
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={selectAllNonDupes} disabled={nonDupeCount === 0}>
          All ({nonDupeCount})
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={deselectAll} disabled={selectedIds.size === 0}>
          Clear
        </Button>
      </div>

      {dupeCount > 0 && (
        <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
          {dupeCount} player{dupeCount !== 1 ? "s" : ""} already in this tournament — shown greyed out
        </div>
      )}

      <div className="space-y-1.5 max-h-[38vh] overflow-y-auto pr-0.5">
        {candidatesLoading ? (
          [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-13" />)
        ) : filteredCandidates.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">No players found</p>
        ) : filteredCandidates.map(p => (
          <button
            key={p.id}
            type="button"
            disabled={p.isDuplicate}
            className={`w-full text-left rounded-lg px-3 py-2.5 flex items-center gap-3 transition-all border ${
              p.isDuplicate
                ? "opacity-40 cursor-not-allowed border-border/30 bg-card/20"
                : selectedIds.has(p.id)
                ? "border-primary/60 bg-primary/10"
                : "border-border hover:border-primary/30 hover:bg-accent/40"
            }`}
            onClick={() => !p.isDuplicate && togglePlayer(p.id)}
          >
            <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded border border-border bg-card">
              {selectedIds.has(p.id) && !p.isDuplicate && (
                <div className="w-2.5 h-2.5 bg-primary rounded-sm" />
              )}
              {p.isDuplicate && <X className="w-2.5 h-2.5 text-yellow-500" />}
            </div>
            <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
              {p.photoUrl ? (
                <img src={cldUrl(p.photoUrl, "thumbnail")} alt={p.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{p.name}</span>
                {p.role && <span className="text-xs text-muted-foreground capitalize">{p.role}</span>}
                {p.isDuplicate && <span className="text-[10px] font-semibold text-yellow-400">Already in tournament</span>}
              </div>
              <div className="flex gap-2 text-xs text-muted-foreground">
                {p.city && <span>{p.city}</span>}
                {p.mobileNumber && <span className="font-mono">{p.mobileNumber}</span>}
                {p.age != null && <span>Age {p.age}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex gap-3 pt-2 border-t border-border">
        <Button
          className="flex-1"
          disabled={selectedIds.size === 0 || importMutation.isPending}
          onClick={handleImport}
        >
          {importMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Import {selectedIds.size} Player{selectedIds.size !== 1 ? "s" : ""}</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// ─── Player Form ───────────────────────────────────────────────────────────────

const PLAYER_TAGS = PLAYER_TAG_OPTIONS;

export { playerTagLabel };

function PlayerForm({ tournamentId, player, tournamentPlayers, categories, teams, tournament, onClose }: {
  tournamentId: number;
  player?: any;
  tournamentPlayers?: any[];
  categories: any[];
  teams: any[];
  tournament?: any;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [filledFromProfile, setFilledFromProfile] = useState(false);
  const [basePriceTouched, setBasePriceTouched] = useState(false);
  const [mobileError, setMobileError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [mobileLookupLoading, setMobileLookupLoading] = useState(false);
  const [mobileLookedUp, setMobileLookedUp] = useState(false);
  const [pendingMobileProfile, setPendingMobileProfile] = useState<SuggestionProfile | null>(null);
  const [matchedTournamentPlayer, setMatchedTournamentPlayer] = useState<any | null>(null);
  const mobileDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [extraSpecSelections, setExtraSpecSelections] = useState<Record<number, string>>({});
  const isEdit = !!player;
  const showPlayerBidSelector = shouldShowPlayerBidValueSelector(tournament ?? {});
  const organizerBidOptions = getOrganizerBidOptions(tournament ?? {});
  const bidValueEditable = canEditPlayerBidValue(tournament?.status);
  const isCricket = (tournament?.sport ?? "cricket") === "cricket";
  const lockedBidDisplayAmount =
    player?.selectedBidValue ?? player?.basePrice ?? tournament?.minBid ?? 100000;

  // Dynamic roles from sport master table
  const [sportRoles, setSportRoles] = useState<{ id: number; roleName: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    const slug = tournament?.sport ?? "cricket";

    async function loadRoles() {
      try {
        const res = await fetch(`/api/sports/by-slug/${encodeURIComponent(slug)}/roles`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setSportRoles([]);
          return;
        }
        const data: unknown = await res.json();
        const roles = Array.isArray(data)
          ? data.filter(
              (item): item is { id: number; roleName: string } =>
                typeof item === "object" &&
                item !== null &&
                typeof (item as { id?: unknown }).id === "number" &&
                typeof (item as { roleName?: unknown }).roleName === "string",
            )
          : [];
        if (!cancelled) setSportRoles(roles);
      } catch {
        if (!cancelled) setSportRoles([]);
      }
    }

    void loadRoles();
    return () => {
      cancelled = true;
    };
  }, [tournament?.sport]);

  // Spec groups state — populated after role selection (see effects below, after form state)
  type SpecOption = { id: number; optionName: string };
  type SpecGroup = { id: number; groupName: string; displayOrder: number; optional: boolean; options: SpecOption[] };
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>([]);
  const isFirstSpecRender = useRef(true);
  const SPEC_KEYS = ["battingStyle", "bowlingStyle", "specialization"] as const;

  // Sync basePrice default when tournament loads after the form opens (new players only)
  useEffect(() => {
    if (!player && !basePriceTouched && tournament?.minBid) {
      setForm(f => ({ ...f, basePrice: tournament.minBid }));
    }
  }, [tournament?.minBid, player, basePriceTouched]);

  const [form, setForm] = useState({
    name: player?.name || "",
    city: player?.city || "",
    role: player?.role || "",
    battingStyle: player?.battingStyle || "",
    bowlingStyle: player?.bowlingStyle || "",
    specialization: player?.specialization || "",
    age: player?.age ? String(player.age) : "",
    gender: player?.gender ?? "",
    photoUrl: player?.photoUrl && !player.photoUrl.startsWith("data:") ? player.photoUrl : "",
    basePrice: player?.basePrice || tournament?.minBid || 100000,
    selectedBidValue: player?.selectedBidValue ? String(player.selectedBidValue) : "",
    jerseyNumber: player?.jerseyNumber || "",
    jerseySize: (player?.jerseySize as JerseySize | null) || "",
    achievements: player?.achievements || "",
    mobileNumber: player?.mobileNumber ? sanitizeMobileInput(player.mobileNumber) : "",
    email: player?.email || "",
    cricheroUrl: player?.cricheroUrl || "",
    availabilityDates: player
      ? (player.availabilityDates || "")
      : (tournament?.matchDates || ""),
    retainedPrice: player?.retainedPrice ? String(player.retainedPrice) : "",
    retainedTeamId: player?.teamId && player?.status === "retained" ? String(player.teamId) : "",
    status: player?.status || "available",
    categoryId: player?.categoryId ? String(player.categoryId) : "",
    playerTag: player?.playerTag || "",
    playerTagTeamId: player?.playerTagTeamId ? String(player.playerTagTeamId) : "",
    isNonPlayingMember: player?.isNonPlayingMember ?? false,
    markPaymentCompleted: false,
  });

  const [submitError, setSubmitError] = useState("");

  // selectedRoleId must be derived AFTER form state to avoid temporal dead zone
  const selectedRoleId = sportRoles.find(r => r.roleName === form.role)?.id;
  useEffect(() => {
    if (!selectedRoleId) {
      setSpecGroups([]);
      return;
    }

    let cancelled = false;

    async function loadSpecs() {
      try {
        const res = await fetch(`/api/sports/roles/${selectedRoleId}/specs`, {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setSpecGroups([]);
          return;
        }
        const data: unknown = await res.json();
        const groups = Array.isArray(data)
          ? data.filter(
              (group): group is SpecGroup =>
                typeof group === "object" &&
                group !== null &&
                typeof (group as { id?: unknown }).id === "number" &&
                typeof (group as { groupName?: unknown }).groupName === "string" &&
                typeof (group as { displayOrder?: unknown }).displayOrder === "number" &&
                Array.isArray((group as { options?: unknown }).options),
            )
          : [];
        if (!cancelled) setSpecGroups(groups);
      } catch {
        if (!cancelled) setSpecGroups([]);
      }
    }

    void loadSpecs();
    return () => {
      cancelled = true;
    };
  }, [selectedRoleId]);
  useEffect(() => {
    if (isFirstSpecRender.current) { isFirstSpecRender.current = false; return; }
    setForm(prev => ({ ...prev, battingStyle: "", bowlingStyle: "", specialization: "" }));
    setExtraSpecSelections({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.role]);

  const sortedSpecGroups = [...specGroups].sort((a, b) => a.displayOrder - b.displayOrder);

  useEffect(() => {
    if (!player || sortedSpecGroups.length === 0) return;
    const playerSpecs = (player as { specifications?: { specGroupId: number; value: string }[] })
      .specifications;
    const { legacyForm, extraSelections } = applySpecificationsToSelections(
      sortedSpecGroups,
      playerSpecs,
      {
        battingStyle: player.battingStyle ?? "",
        bowlingStyle: player.bowlingStyle ?? "",
        specialization: player.specialization ?? "",
      },
    );
    setForm((prev) => ({
      ...prev,
      battingStyle: legacyForm.battingStyle ?? prev.battingStyle,
      bowlingStyle: legacyForm.bowlingStyle ?? prev.bowlingStyle,
      specialization: legacyForm.specialization ?? prev.specialization,
    }));
    setExtraSpecSelections(extraSelections);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, sortedSpecGroups.length]);

  function findTournamentPlayerByMobile(mobile: string) {
    const parsed = parseIndianMobile(mobile);
    if (!parsed.ok || !tournamentPlayers?.length) return null;
    return tournamentPlayers.find(
      (p) => p.mobileNumber && mobilesMatch(p.mobileNumber, parsed.normalized),
    ) ?? null;
  }

  function handleMobileChange(val: string) {
    const sanitized = sanitizeMobileInput(val);
    f("mobileNumber", sanitized);
    if (mobileError) setMobileError("");
    setMobileLookedUp(false);
    setPendingMobileProfile(null);
    setMatchedTournamentPlayer(null);
    if (player) return;
    if (sanitized.length >= 10) {
      const tournamentMatch = findTournamentPlayerByMobile(sanitized);
      if (tournamentMatch) {
        setMatchedTournamentPlayer(tournamentMatch);
        setMobileLookedUp(true);
        return;
      }
    }
    if (mobileDebounceRef.current) clearTimeout(mobileDebounceRef.current);
    const digits = sanitized;
    if (digits.length >= 10) {
      mobileDebounceRef.current = setTimeout(async () => {
        setMobileLookupLoading(true);
        try {
          const sportQ = tournament?.sport ? `&sport=${encodeURIComponent(tournament.sport)}` : "";
          const res = await fetch(`/api/global-players/search?q=${encodeURIComponent(sanitized)}&limit=5${sportQ}`, {
            credentials: "include",
          });
          if (!res.ok) {
            return;
          }
          const data: unknown = await res.json();
          const suggestions = Array.isArray(data)
            ? data.filter(
                (item): item is SuggestionProfile =>
                  typeof item === "object" &&
                  item !== null &&
                  typeof (item as { id?: unknown }).id === "number" &&
                  typeof (item as { name?: unknown }).name === "string",
              )
            : [];
          const match = suggestions.length > 0
            ? (digits.length >= 10 ? suggestions[0] : suggestions.find(p => p.name))
            : undefined;
          if (match) setPendingMobileProfile(match);
        } catch {
          // ignore lookup errors
        } finally {
          setMobileLookupLoading(false);
          setMobileLookedUp(true);
        }
      }, 600);
    }
  }

  function applyMobileProfile() {
    if (!pendingMobileProfile) return;
    fillFromProfile(pendingMobileProfile);
    setPendingMobileProfile(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mobileResult = parseIndianMobile(form.mobileNumber);
    if (!mobileResult.ok) {
      setMobileError(mobileResult.error);
      return;
    }
    setMobileError("");
    setEmailError("");
    setSubmitError("");
    const emailResult = parseOptionalEmail(form.email);
    if (!emailResult.ok) {
      setEmailError(emailResult.error);
      return;
    }
    const specifications = buildSpecificationsPayload(
      sortedSpecGroups,
      {
        battingStyle: form.battingStyle,
        bowlingStyle: form.bowlingStyle,
        specialization: form.specialization,
      },
      extraSpecSelections,
    );
    const data = {
      name: form.name,
      city: form.city || undefined,
      role: form.role || undefined,
      battingStyle: form.battingStyle || undefined,
      bowlingStyle: form.bowlingStyle || undefined,
      specialization: form.specialization || undefined,
      specifications: specifications.length > 0 ? specifications : undefined,
      age: form.age ? parseInt(form.age) : undefined,
      gender:
        form.gender === "M" || form.gender === "F"
          ? form.gender
          : isEdit
            ? null
            : undefined,
      photoUrl: form.photoUrl || undefined,
      ...(bidValueEditable
        ? showPlayerBidSelector
          ? { selectedBidValue: parseInt(form.selectedBidValue, 10) || undefined }
          : { basePrice: parseInt(String(form.basePrice)) || tournament?.minBid || 100000 }
        : {}),
      jerseyNumber: form.jerseyNumber || undefined,
      jerseySize: form.jerseySize || undefined,
      achievements: form.achievements || undefined,
      mobileNumber: mobileResult.normalized,
      email: emailResult.email || undefined,
      cricheroUrl: isCricket ? (form.cricheroUrl || undefined) : undefined,
      availabilityDates: form.availabilityDates || undefined,
      retainedPrice: form.retainedPrice ? parseInt(form.retainedPrice) : undefined,
      teamId: form.status === "retained" && form.retainedTeamId ? parseInt(form.retainedTeamId) : undefined,
      status: form.status,
      categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
      playerTag: (form.playerTag || undefined) as any,
      playerTagTeamId: form.playerTagTeamId ? parseInt(form.playerTagTeamId) : undefined,
      isNonPlayingMember: form.isNonPlayingMember || undefined,
      markPaymentCompleted: !player && tournament?.enableRegistrationPayment ? form.markPaymentCompleted : undefined,
    };
    try {
      const saveTarget = player ?? matchedTournamentPlayer;
      if (saveTarget) {
        await updatePlayer.mutateAsync({
          tournamentId,
          playerId: saveTarget.id,
          data,
        });
      } else {
        await createPlayer.mutateAsync({ tournamentId, data });
      }
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      onClose();
    } catch (err: any) {
      const body = err?.response?.data;
      const msg = body?.error || err?.message || "Failed to save player";
      if (body?.field === "mobileNumber") {
        setMobileError(msg);
      } else if (body?.field === "email") {
        setEmailError(msg);
      } else {
        setSubmitError(msg);
      }
    }
  }

  const f = (key: string, val: string | number | boolean) => setForm(prev => ({ ...prev, [key]: val }));

  function clearProfileFill(newName: string) {
    setForm(prev => ({
      ...prev,
      name: newName,
      city: "",
      role: "",
      battingStyle: "",
      bowlingStyle: "",
      specialization: "",
      age: "",
      gender: "",
      photoUrl: "",
      achievements: "",
      jerseyNumber: "",
      jerseySize: "",
      cricheroUrl: "",
      mobileNumber: "",
      basePrice: basePriceTouched ? prev.basePrice : (tournament?.minBid || 100000),
    }));
    setFilledFromProfile(false);
    setMobileLookedUp(false);
    setPendingMobileProfile(null);
    setMatchedTournamentPlayer(null);
    setExtraSpecSelections({});
  }

  function fillFromProfile(p: SuggestionProfile) {
    setForm(prev => ({
      ...prev,
      name: p.name,
      city: p.city || prev.city,
      role: p.role || prev.role,
      age: p.age != null ? String(p.age) : prev.age,
      gender: p.gender || prev.gender,
      photoUrl: p.photoUrl || prev.photoUrl,
      achievements: p.achievements || prev.achievements,
      jerseyNumber: p.jerseyNumber || prev.jerseyNumber,
      jerseySize: (p.jerseySize as JerseySize | null) || prev.jerseySize,
      cricheroUrl: p.cricheroUrl || prev.cricheroUrl,
      mobileNumber: p.mobileNumber || prev.mobileNumber,
      basePrice: p.basePrice || prev.basePrice,
    }));

    if (p.specifications?.length && sortedSpecGroups.length > 0) {
      const { legacyForm, extraSelections } = applySpecificationsToSelections(
        sortedSpecGroups,
        p.specifications,
        {
          battingStyle: p.battingStyle ?? "",
          bowlingStyle: p.bowlingStyle ?? "",
          specialization: p.specialization ?? "",
        },
      );
      setForm((prev) => ({
        ...prev,
        battingStyle: legacyForm.battingStyle ?? prev.battingStyle,
        bowlingStyle: legacyForm.bowlingStyle ?? prev.bowlingStyle,
        specialization: legacyForm.specialization ?? prev.specialization,
      }));
      setExtraSpecSelections(extraSelections);
    } else {
      setForm(prev => ({
        ...prev,
        battingStyle: p.battingStyle || prev.battingStyle,
        bowlingStyle: p.bowlingStyle || prev.bowlingStyle,
        specialization: p.specialization || prev.specialization,
      }));
    }

    setFilledFromProfile(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Player Name <span className="text-destructive">*</span></Label>
          {player ? (
            <Input value={form.name} onChange={e => f("name", e.target.value)} required placeholder="Full name" />
          ) : (
            <>
              <GlobalPlayerSearch
                value={form.name}
                onChange={v => {
                  if (filledFromProfile) clearProfileFill(v);
                  else f("name", v);
                }}
                onFillFromProfile={fillFromProfile}
                sportSlug={tournament?.sport ?? undefined}
              />
              {filledFromProfile && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Filled from player history
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => clearProfileFill(form.name)}
                  >
                    · clear
                  </button>
                </p>
              )}
            </>
          )}
        </div>
        {categories.length > 0 && (
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.categoryId} onValueChange={v => f("categoryId", v)}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent className="dark">
              {categories.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        )}
      </div>
      {/* Row 2: Mobile (required) | Role */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Mobile Number <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Input
              value={form.mobileNumber}
              onChange={e => handleMobileChange(e.target.value)}
              required
              placeholder="10-digit mobile (e.g. 9876543210)"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="pr-8"
            />
            {!player && mobileLookupLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
            )}
            {!player && !mobileLookupLoading && mobileLookedUp && (
              <Search className={`absolute right-2.5 top-2.5 w-4 h-4 ${pendingMobileProfile ? "text-green-500" : "text-muted-foreground"}`} />
            )}
          </div>
          {!player && mobileLookupLoading && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Looking up mobile number in player database…
            </p>
          )}
          {mobileError && <p className="text-xs text-destructive mt-1">{mobileError}</p>}
          {!player && matchedTournamentPlayer && (
            <p className="text-xs text-amber-400 mt-1">
              This mobile is already registered as <span className="font-semibold">{matchedTournamentPlayer.name}</span>.
              Saving will update that player — no duplicate will be created.
            </p>
          )}
          {!player && pendingMobileProfile && !matchedTournamentPlayer && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Existing profile found</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center overflow-hidden shrink-0">
                  {pendingMobileProfile.photoUrl ? (
                    <img
                      src={cldUrl(pendingMobileProfile.photoUrl, "thumbnail")}
                      alt={pendingMobileProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{pendingMobileProfile.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{pendingMobileProfile.mobileNumber}</p>
                  {pendingMobileProfile.appearanceCount > 1 && (
                    <p className="text-[10px] text-primary mt-0.5">
                      Seen in {pendingMobileProfile.appearanceCount} tournaments
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="h-8 gap-1.5" onClick={applyMobileProfile}>
                  <Sparkles className="w-3.5 h-3.5" /> Use this profile
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setPendingMobileProfile(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={v => f("role", v)}>
            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent className="dark">
              {(sportRoles.length > 0
                ? sportRoles.map(r => ({ value: r.roleName, label: r.roleName }))
                : ["Batsman","Bowler","All-Rounder","Wicketkeeper","Player"].map(r => ({ value: r, label: r }))
              ).map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <OptionalEmailField
        id="player-email"
        value={form.email}
        onChange={v => { f("email", v); if (emailError) setEmailError(""); }}
        error={emailError || undefined}
      />
      {/* Row 3: City | Age | Gender */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>City</Label>
          <CityAutocomplete value={form.city} onChange={v => f("city", v)} />
        </div>
        <div className="space-y-2">
          <Label>Age</Label>
          <Input type="number" value={form.age} onChange={e => f("age", e.target.value)} />
        </div>
        <PlayerGenderSelect
          value={form.gender}
          onChange={(v) => f("gender", v)}
        />
      </div>
      {/* Row 4: Jersey No | Jersey Size */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Jersey No.</Label>
          <Input value={form.jerseyNumber} onChange={e => f("jerseyNumber", e.target.value)} />
        </div>
        <JerseySizeSelect value={form.jerseySize} onChange={v => f("jerseySize", v)} />
      </div>
      {/* Row 5: Base Price / Selected Bid Value */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {showPlayerBidSelector && bidValueEditable ? (
          <div className="space-y-2 col-span-2">
            <Label>Selected Bid Value (₹) <span className="text-destructive">*</span></Label>
            <Select
              value={form.selectedBidValue}
              onValueChange={(v) => {
                setBasePriceTouched(true);
                f("selectedBidValue", v);
                f("basePrice", v);
              }}
              required
            >
              <SelectTrigger><SelectValue placeholder="Select bid value" /></SelectTrigger>
              <SelectContent className="dark">
                {organizerBidOptions.map((amount) => (
                  <SelectItem key={amount} value={String(amount)}>
                    {formatIndianRupee(amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : showPlayerBidSelector && !bidValueEditable ? (
          <div className="space-y-2 col-span-2">
            <Label>Selected Bid Value (₹)</Label>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
              {formatIndianRupee(lockedBidDisplayAmount)}
            </div>
            <p className="text-[10px] text-muted-foreground">Bid value is locked after the auction starts.</p>
          </div>
        ) : bidValueEditable ? (
          <div className="space-y-2">
            <Label>Base Price (₹) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              value={form.basePrice}
              onChange={e => { setBasePriceTouched(true); f("basePrice", e.target.value); }}
              required
            />
            <p className="text-[10px] text-muted-foreground">
              Uses tournament minimum bid ({formatIndianRupee(tournament?.minBid ?? 100000)}).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Base Price (₹)</Label>
            <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
              {formatIndianRupee(lockedBidDisplayAmount)}
            </div>
            <p className="text-[10px] text-muted-foreground">Base price is locked after the auction starts.</p>
          </div>
        )}
      </div>
      {/* Dynamic spec groups: loaded from sport master per selected role */}
      {sortedSpecGroups.length > 0 ? (
        <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {form.role} Specifications
          </p>
          {sortedSpecGroups.map((group, idx) => {
            const key = SPEC_KEYS[idx];
            const value = key ? form[key] : (extraSpecSelections[group.id] ?? "");
            const onValueChange = (v: string) => {
              if (key) f(key, v);
              else setExtraSpecSelections(prev => ({ ...prev, [group.id]: v }));
            };
            return (
              <div key={group.id} className="space-y-1.5">
                <Label className="text-sm">
                  {group.groupName}
                  {!group.optional && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {group.options.length > 0 ? (
                  <Select value={value} onValueChange={onValueChange}>
                    <SelectTrigger><SelectValue placeholder={`Select ${group.groupName}`} /></SelectTrigger>
                    <SelectContent className="dark">
                      {group.options.map(o => (
                        <SelectItem key={o.id} value={o.optionName}>{o.optionName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={value} onChange={e => onValueChange(e.target.value)} placeholder={group.groupName} />
                )}
              </div>
            );
          })}
        </div>
      ) : (["cricket", "other", ""].includes(tournament?.sport ?? "cricket") ? (
        /* Fallback free-text spec fields — only shown for cricket/other/unknown sport */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Batting Style</Label>
            <Input value={form.battingStyle} onChange={e => f("battingStyle", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Bowling Style</Label>
            <Input value={form.bowlingStyle} onChange={e => f("bowlingStyle", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Specialization</Label>
            <Input value={form.specialization} onChange={e => f("specialization", e.target.value)} />
          </div>
        </div>
      ) : null)}
      {/* Player Photo */}
      <div className="space-y-2">
          <Label>Player Photo</Label>
          <div className="flex gap-2 items-start">
            <div className="w-12 h-12 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              {form.photoUrl ? (
                <img
                  src={form.photoUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <User className="w-5 h-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => setPhotoEditorOpen(true)}
                >
                  {form.photoUrl ? <><Pencil className="w-3 h-3" /> Edit Photo</> : <><Upload className="w-3 h-3" /> Upload Photo</>}
                </Button>
                {form.photoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => f("photoUrl", "")}
                  >
                    <X className="w-3 h-3" /> Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
          <ImageEditorDialog
            open={photoEditorOpen}
            onClose={() => setPhotoEditorOpen(false)}
            initialUrl={form.photoUrl || undefined}
            aspect={1}
            title="Player Photo"
            onSave={url => f("photoUrl", url)}
          />
        </div>
      {(() => {
        const matchDates: string[] = (tournament?.matchDates || "").split(",").filter(Boolean) as string[];
        if (matchDates.length === 0) return null;
        const selectedDates: string[] = (form.availabilityDates || "").split(",").filter(Boolean) as string[];
        const selectedSet = new Set<string>(selectedDates);
        function toggleAvailDate(iso: string) {
          const next = new Set<string>(selectedSet);
          if (next.has(iso)) next.delete(iso); else next.add(iso);
          const kept: string[] = [];
          next.forEach((v: string) => { if (matchDates.includes(v)) kept.push(v); });
          f("availabilityDates", kept.join(","));
        }
        return (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
              Match Availability
            </Label>
            <p className="text-xs text-muted-foreground">Check the match days this player will be available to play. All days are selected by default.</p>
            <div className="flex flex-wrap gap-2">
              {matchDates.map((iso: string) => {
                const label = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
                const checked = selectedSet.has(iso);
                return (
                  <label
                    key={iso}
                    className={`flex items-center gap-1.5 cursor-pointer text-sm px-2.5 py-1.5 rounded-md border transition-colors ${checked ? "border-amber-500/60 bg-amber-500/10 text-amber-300" : "border-border hover:bg-muted/50 text-muted-foreground"}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAvailDate(iso)}
                      className="accent-amber-400"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })()}
      {isCricket && (
        <div className="space-y-2">
          <Label>Crichero URL</Label>
          <Input value={form.cricheroUrl} onChange={e => f("cricheroUrl", e.target.value)} />
        </div>
      )}
      <div className="space-y-2">
        <Label>Achievements</Label>
        <Input value={form.achievements} onChange={e => f("achievements", e.target.value)} />
      </div>

      {/* Retained player section */}
      <div className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-4">
        <div className="space-y-1">
          <Label>
            Retained Player <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Choose whether this player is available for auction or already pre-sold to a team.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select value={form.status} onValueChange={v => f("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="dark">
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="retained">Retained (Pre-sold)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.status === "retained" && (
            <div className="space-y-2">
              <Label>Retained Price (₹) <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.retainedPrice} onChange={e => f("retainedPrice", e.target.value)} placeholder="e.g. 1000000" />
            </div>
          )}
        </div>
        {form.status === "retained" && (
          <div className="space-y-2">
            <Label>Retained By Team <span className="text-destructive">*</span></Label>
            <Select value={form.retainedTeamId} onValueChange={v => f("retainedTeamId", v)}>
              <SelectTrigger><SelectValue placeholder="Select team..." /></SelectTrigger>
              <SelectContent className="dark">
                {teams.map(t => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Player tag section */}
      <div className="rounded-lg border border-border/60 bg-muted/15 p-4 space-y-4">
        <div className="space-y-1">
          <Label>
            Player Tag <span className="text-xs font-normal text-muted-foreground">(Optional — display only)</span>
          </Label>
          <p className="text-xs text-muted-foreground">
            Add a visual badge on the auction screen. Does not affect bidding rules.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select value={form.playerTag || "_none"} onValueChange={v => f("playerTag", v === "_none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="No tag" /></SelectTrigger>
              <SelectContent className="dark">
                <SelectItem value="_none">No tag</SelectItem>
                {PLAYER_TAGS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.playerTag && (
            <div className="space-y-2">
              <Label>Tag Team</Label>
              <Select value={form.playerTagTeamId || "_none"} onValueChange={v => f("playerTagTeamId", v === "_none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Any team" /></SelectTrigger>
                <SelectContent className="dark">
                  <SelectItem value="_none">Any team</SelectItem>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {!player && tournament?.enableRegistrationPayment && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Payment Completed</p>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={form.markPaymentCompleted}
              onChange={e => f("markPaymentCompleted", e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border bg-input accent-primary cursor-pointer"
            />
            <div>
              <p className="text-sm font-semibold group-hover:text-foreground transition-colors">Mark as Paid</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Check if payment was collected offline. Skips UTR and screenshot requirements.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Non-playing member toggle */}
      <div className="pt-2 border-t border-border">
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={form.isNonPlayingMember}
            onChange={e => f("isNonPlayingMember", e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-border bg-input accent-primary cursor-pointer"
          />
          <div>
            <p className="text-sm font-semibold group-hover:text-foreground transition-colors">Is Non-Playing Member?</p>
            <p className="text-xs text-muted-foreground mt-0.5">Shows in team roster for display purposes only. Not counted in squad size, category limits, or statistics.</p>
          </div>
        </label>
      </div>

      {submitError && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          <span className="flex-shrink-0">!</span>
          {submitError}
        </div>
      )}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="flex-1"
          disabled={createPlayer.isPending || updatePlayer.isPending}
        >
          {player ? "Update Player" : "Add Player"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Bulk Upload Dialog ────────────────────────────────────────────────────────

function BulkUploadDialog({ tournamentId, sportSlug, categories, onClose }: {
  tournamentId: number;
  sportSlug: string;
  categories: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const bulkCreate = useBulkCreatePlayers();
  const [csv, setCsv] = useState("");
  const [catalog, setCatalog] = useState<SportSpecCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; failed: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSportSpecCatalog(sportSlug)
      .then((c) => { if (!cancelled) setCatalog(c); })
      .catch((err) => {
        if (!cancelled) setCatalogError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, [sportSlug]);

  const templateHeaders = buildCsvTemplateHeaders(catalog);

  function downloadTemplate() {
    const content = `${templateHeaders}\n${buildCsvTemplateExampleRow(catalog)}`;
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `players_template_${sportSlug}.csv`;
    a.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsv(ev.target?.result as string || "");
    reader.readAsText(file);
  }

  async function handleUpload() {
    const players = parsePlayerCsv(csv, catalog);
    if (!players.length) return;
    const res = await bulkCreate.mutateAsync({ tournamentId, data: { players } });
    setResult({ created: res.created, failed: res.failed, errors: res.errors ?? [] });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }

  const parsed = csv ? parsePlayerCsv(csv, catalog) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Upload a CSV with sport-specific specification columns for{" "}
            <span className="font-medium capitalize">{sportSlug}</span>.
          </p>
          {catalogError && (
            <p className="text-xs text-amber-500 mt-1">Spec catalog unavailable — legacy columns used as fallback.</p>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
          <Download className="w-3.5 h-3.5" /> Template
        </Button>
      </div>

      {!result && (
        <>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-sm">Click to upload CSV</p>
            <p className="text-xs text-muted-foreground mt-1">or paste CSV data below</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
          <textarea
            className="w-full h-36 bg-card border border-border rounded-lg p-3 text-xs font-mono text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder={`Paste CSV here:\n${templateHeaders}\n...`}
            value={csv}
            onChange={e => setCsv(e.target.value)}
          />
          {parsed.length > 0 && (
            <div className="bg-card/50 border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{parsed.length} player(s) ready to upload:</p>
              <div className="flex flex-wrap gap-1">
                {parsed.slice(0, 10).map((p, i) => (
                  <span key={i} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">{p.name}</span>
                ))}
                {parsed.length > 10 && <span className="text-xs text-muted-foreground">+{parsed.length - 10} more</span>}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              disabled={parsed.length === 0 || bulkCreate.isPending}
              onClick={() => void handleUpload()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {bulkCreate.isPending ? "Uploading..." : `Upload ${parsed.length} Players`}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${result.failed === 0 ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
            <p className="font-bold text-lg">{result.created} players uploaded successfully</p>
            {result.failed > 0 && (
              <p className="text-sm text-destructive mt-1">{result.failed} failed</p>
            )}
            {result.errors.length > 0 && (
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                {result.errors.map((e, i) => <li key={i}>· {e}</li>)}
              </ul>
            )}
          </div>
          <Button className="w-full" onClick={onClose}>Done</Button>
        </div>
      )}
    </div>
  );
}

// ─── Status badge colours ──────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  available: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  sold: "bg-green-500/15 text-green-300 border-green-500/30",
  unsold: "bg-red-500/15 text-red-300 border-red-500/30",
  retained: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  withdrawn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

const statusLabels: Record<string, string> = {
  available: "Available",
  sold: "Sold",
  retained: "Retained",
  unsold: "Unsold",
  withdrawn: "Withdrawn",
};

function formatPlayerAmount(player: {
  status?: string | null;
  basePrice?: number | null;
  soldPrice?: number | null;
  retainedPrice?: number | null;
}): { text: string; className: string } {
  if (player.status === "sold" && player.soldPrice) {
    return { text: formatIndianRupee(player.soldPrice), className: "text-green-400 font-mono font-semibold" };
  }
  if (player.status === "retained" && player.retainedPrice) {
    return { text: formatIndianRupee(player.retainedPrice), className: "text-purple-400 font-mono font-semibold" };
  }
  if (player.basePrice != null && player.basePrice > 0) {
    return { text: formatIndianRupee(player.basePrice), className: "text-primary font-mono font-semibold" };
  }
  return { text: "—", className: "text-muted-foreground" };
}

function playerAmountForSort(player: {
  status?: string | null;
  basePrice?: number | null;
  soldPrice?: number | null;
  retainedPrice?: number | null;
}) {
  if (player.status === "sold") return player.soldPrice ?? 0;
  if (player.status === "retained") return player.retainedPrice ?? 0;
  return player.basePrice ?? 0;
}

function playerMatchesSearch(
  player: { id: number; serialNo?: number; name: string; mobileNumber?: string | null },
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  // Numeric: exact tournament serial first; partial mobile only for 4+ digits (avoids "3" matching names/mobiles loosely)
  if (/^\d+$/.test(query)) {
    const serial = player.serialNo ?? player.id;
    if (String(serial) === query) return true;
    if (query.length >= 4 && (player.mobileNumber || "").includes(query)) return true;
    return false;
  }

  if (player.name.toLowerCase().includes(query)) return true;
  if ((player.mobileNumber || "").includes(query)) return true;
  return false;
}

type PlayerSortKey = "id" | "name" | "status" | "category" | "amount" | "team";
type SortDir = "asc" | "desc";

type PlayersFilterPersist = {
  tab: string;
  search: string;
  categoryIds: number[];
  teamIds: number[];
  tagFilters: string[];
  genderFilters: string[];
  sortKey: PlayerSortKey;
  sortDir: SortDir;
};

const FILTER_STORAGE_VERSION = "v3";
function filterStorageKey(tournamentId: number) {
  return `players-filters:${FILTER_STORAGE_VERSION}:${tournamentId}`;
}

function loadPersistedFilters(tournamentId: number): PlayersFilterPersist | null {
  try {
    const raw = sessionStorage.getItem(filterStorageKey(tournamentId));
    if (!raw) return null;
    return JSON.parse(raw) as PlayersFilterPersist;
  } catch {
    return null;
  }
}

function savePersistedFilters(tournamentId: number, state: PlayersFilterPersist) {
  try {
    sessionStorage.setItem(filterStorageKey(tournamentId), JSON.stringify(state));
  } catch {
    // quota / private browsing
  }
}

const STATUS_SORT_ORDER: Record<string, number> = {
  available: 0,
  retained: 1,
  sold: 2,
  unsold: 3,
};

function sortPlayers(
  list: any[],
  sortKey: PlayerSortKey,
  sortDir: SortDir,
  catMap: Record<number, { name: string }>,
  teamMap: Record<number, { name: string }>,
) {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "id":
        cmp = (a.serialNo ?? a.id) - (b.serialNo ?? b.id);
        break;
      case "name":
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        break;
      case "status":
        cmp = (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
        break;
      case "category": {
        const ca = a.categoryId ? (catMap[a.categoryId]?.name ?? "") : "";
        const cb = b.categoryId ? (catMap[b.categoryId]?.name ?? "") : "";
        cmp = ca.localeCompare(cb, undefined, { sensitivity: "base" });
        break;
      }
      case "amount":
        cmp = playerAmountForSort(a) - playerAmountForSort(b);
        break;
      case "team": {
        const ta = a.teamId ? (teamMap[a.teamId]?.name ?? "") : "";
        const tb = b.teamId ? (teamMap[b.teamId]?.name ?? "") : "";
        cmp = ta.localeCompare(tb, undefined, { sensitivity: "base" });
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        break;
      }
    }
    if (cmp !== 0) return cmp * dir;
    return (a.serialNo ?? a.id) - (b.serialNo ?? b.id);
  });
}

function playerGenderFilterKey(gender: string | null | undefined): string {
  return gender === "M" || gender === "F" ? gender : "_unset";
}

function playerPassesAdvancedFilters(
  player: any,
  opts: {
    categoryIds: Set<number>;
    teamIds: Set<number>;
    tagFilters: Set<string>;
    genderFilters: Set<string>;
    teamFilterActive: boolean;
  },
) {
  if (opts.categoryIds.size > 0 && (!player.categoryId || !opts.categoryIds.has(player.categoryId))) {
    return false;
  }
  if (opts.teamFilterActive && opts.teamIds.size > 0 && (!player.teamId || !opts.teamIds.has(player.teamId))) {
    return false;
  }
  if (opts.tagFilters.size > 0 && (!player.playerTag || !opts.tagFilters.has(player.playerTag))) {
    return false;
  }
  if (opts.genderFilters.size > 0 && !opts.genderFilters.has(playerGenderFilterKey(player.gender))) {
    return false;
  }
  return true;
}

function MultiFilterPopover({
  label,
  options,
  selected,
  onToggle,
  onClear,
  disabled,
}: {
  label: string;
  options: { value: string | number; label: string; color?: string | null }[];
  selected: Set<string | number>;
  onToggle: (value: string | number) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const activeCount = selected.size;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2.5 text-xs" disabled={disabled}>
          <Filter className="w-3 h-3 shrink-0" />
          {label}
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px] font-bold">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="flex items-center justify-between px-2 py-1.5 mb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          {activeCount > 0 && (
            <button type="button" className="text-[10px] text-primary hover:underline" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
        <div className="max-h-52 overflow-y-auto space-y-0.5">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3">No options</p>
          ) : (
            options.map(opt => (
              <label
                key={String(opt.value)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox
                  checked={selected.has(opt.value)}
                  onCheckedChange={() => onToggle(opt.value)}
                />
                {opt.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                )}
                <span className="truncate">{opt.label}</span>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type StatusFilterValue = "all" | "available" | "sold" | "retained" | "unsold" | "withdrawn";

const STATUS_FILTER_CHIPS: { value: StatusFilterValue; label: string; idleClass: string; activeClass: string }[] = [
  { value: "all", label: "All", idleClass: "text-muted-foreground", activeClass: "bg-muted/60 text-foreground border-border" },
  { value: "available", label: "Available", idleClass: "text-blue-300/80", activeClass: "bg-blue-500/20 text-blue-200 border-blue-500/40" },
  { value: "retained", label: "Retained", idleClass: "text-purple-300/80", activeClass: "bg-purple-500/20 text-purple-200 border-purple-500/40" },
  { value: "sold", label: "Sold", idleClass: "text-green-300/80", activeClass: "bg-green-500/20 text-green-200 border-green-500/40" },
  { value: "unsold", label: "Unsold", idleClass: "text-red-300/80", activeClass: "bg-red-500/20 text-red-200 border-red-500/40" },
  { value: "withdrawn", label: "Withdrawn", idleClass: "text-amber-300/80", activeClass: "bg-amber-500/20 text-amber-200 border-amber-500/40" },
];

function StatusFilterChip({
  label,
  count,
  active,
  onClick,
  idleClass,
  activeClass,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  idleClass: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? activeClass : `bg-card border-border hover:bg-accent/50 ${idleClass}`
      }`}
    >
      {label}
      <span className={active ? "opacity-90" : "opacity-70"}>({count})</span>
    </button>
  );
}

function SortableTableHead({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: PlayerSortKey;
  activeKey: PlayerSortKey;
  sortDir: SortDir;
  onSort: (key: PlayerSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />
        ) : (
          <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

const statusBorderAccent: Record<string, string> = {
  available: "border-l-blue-500",
  sold: "border-l-green-500",
  unsold: "border-l-red-500",
  retained: "border-l-purple-500",
};

function PlayerPhoto({ photoUrl, name, gender, size = "sm" }: { photoUrl?: string | null; name: string; gender?: string | null; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16" : "w-9 h-9";
  const iconDim = size === "lg" ? "w-7 h-7" : "w-4 h-4";
  const portraitGender = mapStoredGenderToPortrait(gender);
  return (
    <div className={`${dim} rounded-full bg-card border border-border flex items-center justify-center overflow-hidden shrink-0`}>
      {photoUrl ? (
        <img
          src={cldUrl(photoUrl, "thumbnail")}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : portraitGender === "female" ? (
        <UserRound className={`${iconDim} text-muted-foreground/50`} aria-hidden />
      ) : (
        <User className={`${iconDim} text-muted-foreground/50`} aria-hidden />
      )}
    </div>
  );
}

function CopyTextButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => void handleCopy()}>
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : (label ?? "Copy")}
    </Button>
  );
}

function PlayerDetailPanel({
  player,
  cat,
  team,
  tagTeam,
  roleSpecGroups,
  tournamentId,
  tournament,
  categories,
  onEdit,
  onDelete,
  onWithdraw,
  onReinstate,
}: {
  player: any;
  cat: { name: string; colorCode?: string | null } | null;
  team: { name: string; color?: string | null } | null;
  tagTeam: { name: string; color?: string | null } | null;
  roleSpecGroups: { groupName: string }[];
  tournamentId: number;
  tournament?: { enableRegistrationPayment?: boolean; registrationFee?: number | null; sport?: string | null };
  categories?: CategoryOption[];
  onEdit: () => void;
  onDelete: () => void;
  onWithdraw: () => void;
  onReinstate: () => void;
}) {
  const tagTheme = getTagTheme(player.playerTag);
  const isCricket = (tournament?.sport ?? "cricket") === "cricket";
  const specValues = [player.battingStyle, player.bowlingStyle, player.specialization];
  const operatorUrl = `/tournament/${tournamentId}/auction`;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <PlayerPhoto photoUrl={player.photoUrl} name={player.name} gender={player.gender} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{player.serialNo ?? player.id}</span>
            <h3 className="font-bold text-lg truncate">{player.name}</h3>
            {tagTheme && (
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 999,
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  background: tagTheme.bg,
                  border: `1px solid ${tagTheme.border}`,
                  color: tagTheme.color,
                  animation: TAG_PULSE_ANIMATION,
                }}
              >
                {tagTheme.label}
              </span>
            )}
            {player.isNonPlayingMember && (
              <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-400 border-slate-500/20">
                Non-Playing
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant="outline" className={`text-[10px] font-semibold capitalize ${statusColors[player.status] || ""}`}>
              {statusLabels[player.status] || player.status}
            </Badge>
            {categories && categories.length > 0 ? (
              <PlayerCategorySelect
                tournamentId={tournamentId}
                playerId={player.id}
                categoryId={player.categoryId}
                categories={categories}
              />
            ) : cat ? (
              <Badge
                variant="outline"
                className="text-[10px] font-medium"
                style={{ color: cat.colorCode || "#F59E0B", borderColor: `${cat.colorCode || "#F59E0B"}44` }}
              >
                {cat.name}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
        {player.mobileNumber && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Mobile</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">{player.mobileNumber}</span>
              <CopyTextButton text={player.mobileNumber} label="Copy" />
            </div>
          </div>
        )}
        {player.email && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Email</p>
            <div className="flex items-center gap-2">
              <span className="text-xs break-all">{player.email}</span>
              <CopyTextButton text={player.email} label="Copy" />
            </div>
          </div>
        )}
        {player.city && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">City</p>
            <p>{player.city}</p>
          </div>
        )}
        {player.role && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Role</p>
            <p className="capitalize">{player.role}</p>
          </div>
        )}
        {player.age != null && player.age > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Age</p>
            <p>{player.age}</p>
          </div>
        )}
        {formatPlayerGender(player.gender) && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Gender</p>
            <p>{formatPlayerGender(player.gender)}</p>
          </div>
        )}
        {player.jerseyNumber && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Jersey #</p>
            <p className="font-mono">#{player.jerseyNumber}</p>
          </div>
        )}
        {player.jerseySize && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Jersey Size</p>
            <p>{player.jerseySize}</p>
          </div>
        )}
        {player.basePrice != null && player.basePrice > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Base Price</p>
            <p className="font-mono text-primary">{formatIndianRupee(player.basePrice)}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Bid Value Source</p>
          <p>{bidValueSourceLabel(player.bidValueSource)}</p>
        </div>
        {player.bidValueSource === "player" && player.selectedBidValue != null && player.selectedBidValue > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Selected Bid Value</p>
            <p className="font-mono text-primary">{formatIndianRupee(player.selectedBidValue)}</p>
          </div>
        )}
        {specValues.map((val, i) => {
          if (!val) return null;
          const label = roleSpecGroups[i]?.groupName;
          return (
            <div key={i}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label || "Spec"}</p>
              <p>{val}</p>
            </div>
          );
        })}
        {player.availabilityDates && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Availability</p>
            <p className="text-blue-300">{player.availabilityDates}</p>
          </div>
        )}
        {tagTeam && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Tag Team</p>
            <p style={{ color: tagTeam.color || undefined }}>{tagTeam.name}</p>
          </div>
        )}
        {team && (player.status === "sold" || player.status === "retained") && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Team</p>
            <p className="font-medium" style={{ color: team.color || undefined }}>{team.name}</p>
          </div>
        )}
        {player.status === "sold" && player.soldPrice && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Sold For</p>
            <p className="font-mono font-semibold text-green-400">{formatIndianRupee(player.soldPrice)}</p>
          </div>
        )}
        {player.status === "retained" && player.retainedPrice && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Retained At</p>
            <p className="font-mono font-semibold text-purple-400">{formatIndianRupee(player.retainedPrice)}</p>
          </div>
        )}
        {player.achievements && (
          <div className="col-span-2 sm:col-span-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Achievements</p>
            <p className="text-muted-foreground">{player.achievements}</p>
          </div>
        )}
        {isCricket && player.cricheroUrl && (
          <div className="col-span-2 sm:col-span-3">
            <a
              href={player.cricheroUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              Crichero Profile <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {tournament?.enableRegistrationPayment && (
        <RegistrationPaymentReview
          tournamentId={tournamentId}
          playerId={player.id}
          playerName={player.name}
          registrationFee={tournament.registrationFee}
          utrNumber={player.utrNumber}
          paymentScreenshotUrl={player.paymentScreenshotUrl}
          registrationPaymentStatus={player.registrationPaymentStatus as RegistrationPaymentStatus | null}
        />
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border/60">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5" /> Edit
        </Button>
        {player.status === "withdrawn" ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onReinstate}>
            <CheckCircle2 className="w-3.5 h-3.5" /> Reinstate
          </Button>
        ) : player.status !== "sold" && player.status !== "retained" ? (
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-400 hover:text-amber-300" onClick={onWithdraw}>
            <CalendarX className="w-3.5 h-3.5" /> Withdraw
          </Button>
        ) : null}
        <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.open(operatorUrl, "_blank", "noopener,noreferrer")}
        >
          <Gavel className="w-3.5 h-3.5" /> Auction Control
        </Button>
      </div>
    </div>
  );
}

// ─── Inline category assign (organizer list) ───────────────────────────────────

type CategoryOption = { id: number; name: string; colorCode?: string | null };

function PlayerCategorySelect({
  tournamentId,
  playerId,
  categoryId,
  categories,
}: {
  tournamentId: number;
  playerId: number;
  categoryId: number | null | undefined;
  categories: CategoryOption[];
}) {
  const updatePlayer = useUpdatePlayer();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  async function handleChange(value: string) {
    const nextId = value === "none" ? null : parseInt(value, 10);
    if (nextId === (categoryId ?? null)) return;
    setSaving(true);
    try {
      await updatePlayer.mutateAsync({
        tournamentId,
        playerId,
        data: { categoryId: nextId } as Parameters<typeof updatePlayer.mutateAsync>[0]["data"],
      });
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error
        || (err as { message?: string })?.message
        || "Please try again";
      toast({ title: "Could not save category", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const selectedCat = categoryId ? categories.find(c => c.id === categoryId) : null;

  return (
    <Select
      value={categoryId ? String(categoryId) : "none"}
      onValueChange={handleChange}
      disabled={saving}
    >
      <SelectTrigger
        className="h-8 min-w-[120px] max-w-[168px] text-xs border-border/60"
        style={selectedCat?.colorCode ? { borderColor: `${selectedCat.colorCode}66` } : undefined}
        onClick={e => e.stopPropagation()}
      >
        {saving ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </span>
        ) : (
          <SelectValue placeholder="Select…" />
        )}
      </SelectTrigger>
      <SelectContent className="dark" onClick={e => e.stopPropagation()}>
        <SelectItem value="none">—</SelectItem>
        {categories.map(c => (
          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const PAYMENT_STATUS_OPTIONS: { value: RegistrationPaymentStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function PlayerPaymentStatusSelect({
  tournamentId,
  playerId,
  status,
}: {
  tournamentId: number;
  playerId: number;
  status: RegistrationPaymentStatus | null | undefined;
}) {
  const approve = useApproveRegistrationPayment();
  const reject = useRejectRegistrationPayment();
  const resetPending = useResetRegistrationPaymentPending();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const current = status ?? "pending";

  async function handleChange(value: string) {
    const next = value as RegistrationPaymentStatus;
    if (next === current) return;
    setSaving(true);
    try {
      if (next === "approved") {
        await approve.mutateAsync({ tournamentId, playerId });
      } else if (next === "rejected") {
        await reject.mutateAsync({ tournamentId, playerId });
      } else {
        await resetPending.mutateAsync({ tournamentId, playerId });
      }
      await qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; data?: { error?: string }; message?: string })?.response?.data?.error
        || (err as { data?: { error?: string } })?.data?.error
        || (err as { message?: string })?.message
        || "Please try again";
      toast({ title: "Could not update payment status", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const statusTone: Record<RegistrationPaymentStatus, string> = {
    approved: "text-green-400 border-green-500/30",
    pending: "text-amber-400 border-amber-500/30",
    rejected: "text-red-400 border-red-500/30",
  };

  return (
    <Select value={current} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger
        className={`h-8 min-w-[108px] max-w-[132px] text-xs ${statusTone[current]}`}
        onClick={e => e.stopPropagation()}
      >
        {saving ? (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Saving…
          </span>
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent className="dark" onClick={e => e.stopPropagation()}>
        {PAYMENT_STATUS_OPTIONS.map(opt => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── Players Page ──────────────────────────────────────────────────────────────

export default function Players() {
  const [, params] = useRoute("/tournament/:id/players");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const { data: players, isLoading } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: categories, isFetched: categoriesFetched } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: regStatus } = useGetRegistrationStatus(tournamentId, {
    query: {
      queryKey: getGetRegistrationStatusQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 15000,
    },
  });
  const deletePlayer = useDeletePlayer();
  const [regSettingsOpen, setRegSettingsOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [categoryIds, setCategoryIds] = useState<Set<number>>(new Set());
  const [teamIds, setTeamIds] = useState<Set<number>>(new Set());
  const [tagFilters, setTagFilters] = useState<Set<string>>(new Set());
  const [genderFilters, setGenderFilters] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<PlayerSortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [drawerPlayer, setDrawerPlayer] = useState<any | null>(null);
  const [exportingTarget, setExportingTarget] = useState<"excel" | "sheets" | null>(null);
  const [googleSheetResult, setGoogleSheetResult] = useState<{ url: string; playerCount: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setFiltersHydrated(false);
    const saved = loadPersistedFilters(tournamentId);
    if (saved) {
      setTab(saved.tab ?? "all");
      setSearch(saved.search ?? "");
      setCategoryIds(new Set(saved.categoryIds ?? []));
      setTeamIds(new Set(saved.teamIds ?? []));
      setTagFilters(new Set(saved.tagFilters ?? []));
      setGenderFilters(new Set(saved.genderFilters ?? []));
      setSortKey(saved.sortKey ?? "id");
      setSortDir(saved.sortDir ?? "asc");
    } else {
      setTab("all");
      setSearch("");
      setCategoryIds(new Set());
      setTeamIds(new Set());
      setTagFilters(new Set());
      setGenderFilters(new Set());
      setSortKey("id");
      setSortDir("asc");
    }
    setExpandedId(null);
    setDrawerPlayer(null);
    setFiltersHydrated(true);
  }, [tournamentId]);

  useEffect(() => {
    if (!filtersHydrated || !tournamentId) return;
    savePersistedFilters(tournamentId, {
      tab,
      search,
      categoryIds: [...categoryIds],
      teamIds: [...teamIds],
      tagFilters: [...tagFilters],
      genderFilters: [...genderFilters],
      sortKey,
      sortDir,
    });
  }, [filtersHydrated, tournamentId, tab, search, categoryIds, teamIds, tagFilters, genderFilters, sortKey, sortDir]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deletePlayer.mutateAsync({ tournamentId, playerId: deleteTarget.id });
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetRegistrationStatusQueryKey(tournamentId) });
      setDeleteTarget(null);
      setExpandedId(null);
      setDrawerPlayer(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete player.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
    }
  }

  async function handleWithdraw(player: { id: number; name: string }) {
    try {
      await withdrawTournamentPlayer(tournamentId, player.id);
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetRegistrationStatusQueryKey(tournamentId) });
      toast({ title: "Player withdrawn", description: `${player.name} is no longer in the auction pool.` });
      setDrawerPlayer(null);
      setExpandedId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not withdraw player.";
      toast({ title: "Withdraw failed", description: message, variant: "destructive" });
    }
  }

  async function handleReinstate(player: { id: number; name: string }) {
    try {
      await reinstateTournamentPlayer(tournamentId, player.id);
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
      qc.invalidateQueries({ queryKey: getGetRegistrationStatusQueryKey(tournamentId) });
      toast({ title: "Player reinstated", description: `${player.name} is available for auction again.` });
      setDrawerPlayer(null);
      setExpandedId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reinstate player.";
      toast({ title: "Reinstate failed", description: message, variant: "destructive" });
    }
  }

  function openEdit(player: any) {
    setEditing(player);
    setOpen(true);
    setDrawerPlayer(null);
  }

  function openDelete(player: { id: number; name: string }) {
    setDeleteTarget(player);
    setDrawerPlayer(null);
  }

  function toggleExpand(playerId: number) {
    setExpandedId(prev => (prev === playerId ? null : playerId));
  }

  function handleSort(key: PlayerSortKey) {
    if (sortKey === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  }

  function toggleSetItem<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function clearAdvancedFilters() {
    setCategoryIds(new Set());
    setTeamIds(new Set());
    setTagFilters(new Set());
    setGenderFilters(new Set());
  }

  const catMap = useMemo(
    () => Object.fromEntries((categories || []).map(c => [c.id, c])) as Record<number, { name: string; colorCode?: string | null }>,
    [categories],
  );
  const teamMap = useMemo(
    () => Object.fromEntries((teams || []).map(t => [t.id, t])) as Record<number, { name: string; color?: string | null }>,
    [teams],
  );

  const roleSpecMap = useRoleSpecMap(tournament?.sport, players || []);

  const statusCounts = useMemo(() => {
    const list = players || [];
    return {
      all: list.length,
      available: list.filter(p => p.status === "available").length,
      sold: list.filter(p => p.status === "sold").length,
      retained: list.filter(p => p.status === "retained").length,
      unsold: list.filter(p => p.status === "unsold").length,
      withdrawn: list.filter(p => p.status === "withdrawn").length,
    };
  }, [players]);

  const teamFilterEnabled = tab === "all" || tab === "sold" || tab === "retained";

  const categoryOptions = (categories || []).map(c => ({
    value: c.id,
    label: c.name,
    color: c.colorCode,
  }));
  const hasCategories = categoriesFetched && categoryOptions.length > 0;

  useEffect(() => {
    if (!categoriesFetched || hasCategories) return;
    if (categoryIds.size > 0) setCategoryIds(new Set());
    if (sortKey === "category") {
      setSortKey("id");
      setSortDir("asc");
    }
  }, [categoriesFetched, hasCategories, categoryIds.size, sortKey]);

  const hasAdvancedFilters =
    (hasCategories && categoryIds.size > 0)
    || (teamFilterEnabled && teamIds.size > 0)
    || tagFilters.size > 0
    || genderFilters.size > 0;

  const paymentEnabled = tournament?.enableRegistrationPayment === true;

  const filtered = useMemo(() => {
    const list = (players || []).filter(p => {
      const matchesTab = tab === "all" || p.status === tab;
      if (!matchesTab || !playerMatchesSearch(p, search)) return false;
      return playerPassesAdvancedFilters(p, {
        categoryIds,
        teamIds,
        tagFilters,
        genderFilters,
        teamFilterActive: teamFilterEnabled,
      });
    });
    return sortPlayers(list, sortKey, sortDir, catMap, teamMap);
  }, [players, tab, search, categoryIds, teamIds, tagFilters, genderFilters, teamFilterEnabled, sortKey, sortDir, catMap, teamMap]);

  async function runGoogleSheetsExport(playerIds: number[]) {
    if (playerIds.length === 0) {
      toast({ title: "Nothing to export", description: "Adjust filters to include at least one player.", variant: "destructive" });
      return;
    }

    setExportingTarget("sheets");
    try {
      const result = await exportPlayersToGoogleSheetsApi(tournamentId, playerIds);
      clearPendingGoogleSheetsExport();
      setGoogleSheetResult({ url: result.spreadsheetUrl, playerCount: result.playerCount });
    } catch (err) {
      if (err instanceof GoogleSheetsAuthRequiredError) {
        const returnPath = `${window.location.pathname}${window.location.search}`;
        savePendingGoogleSheetsExport({ tournamentId, playerIds });
        window.location.href = googleSheetsConnectUrl(returnPath);
        return;
      }
      const message = err instanceof Error ? err.message : "Could not export to Google Sheets.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExportingTarget(null);
    }
  }

  async function handleExportExcel() {
    if (!filtered.length) return;
    setExportingTarget("excel");
    try {
      const fileStem = (tournament?.name || `tournament_${tournamentId}`).replace(/[^a-zA-Z0-9]+/g, "_");
      await exportPlayersToExcel(filtered, catMap, teamMap, `${fileStem}_Players_Master`);
      toast({ title: "Excel exported", description: `${filtered.length} players downloaded.` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not export players.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExportingTarget(null);
    }
  }

  async function handleExportGoogleSheets() {
    if (!filtered.length) return;
    await runGoogleSheetsExport(filtered.map((p) => p.id));
  }

  useEffect(() => {
    if (typeof window === "undefined" || !tournamentId || !filtersHydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("google_sheets_connected") !== "1") return;

    params.delete("google_sheets_connected");
    const qs = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);

    const pending = readPendingGoogleSheetsExport(tournamentId);
    if (pending) {
      void runGoogleSheetsExport(pending.playerIds);
    }
  }, [tournamentId, filtersHydrated]);

  const retainedCount = statusCounts.retained;
  const teamCount = teams?.length ?? 0;

  const tableColCount = 8 + (hasCategories ? 1 : 0) + (paymentEnabled ? 1 : 0);
  const teamOptions = (teams || []).map(t => ({
    value: t.id,
    label: t.name,
    color: t.color,
  }));
  const tagOptions = PLAYER_TAGS.map(t => ({ value: t.value, label: t.label }));
  const genderOptions = [
    { value: "M", label: "Male" },
    { value: "F", label: "Female" },
    { value: "_unset", label: "Not specified" },
  ];

  const regUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = tournament?.auctionCode;
    if (!code) return "";
    return playerRegistrationShareUrl(window.location.origin, code);
  }, [tournament?.auctionCode]);

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        {/* Phase 4: flow guard — need 2+ teams before adding players makes sense */}
        {!isLoading && teamCount < 2 && (players?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-5 flex items-start gap-3 max-w-xl">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300 text-sm">Add at least 2 teams first</p>
              <p className="text-xs text-muted-foreground mt-1">
                You need at least 2 franchise teams before adding players — otherwise there is no one to bid against each other. Go to the <strong className="text-foreground">Teams</strong> page in the sidebar to add them.
              </p>
            </div>
          </div>
        )}
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Players</h1>
          <p className="text-muted-foreground mt-2">
            {players?.length || 0} players registered
            {retainedCount > 0 && <span className="text-purple-400 ml-2">· {retainedCount} retained</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            type="button"
            onClick={() => { setEditing(null); setOpen(true); }}
            className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">Add one by one</p>
            </div>
            <p className="text-xs text-muted-foreground">Enter player details manually — best for a small list or last-minute additions.</p>
          </button>
          <button
            type="button"
            onClick={() => setBulkOpen(true)}
            className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">Upload Excel sheet</p>
            </div>
            <p className="text-xs text-muted-foreground">Bulk upload from a spreadsheet — fastest way to add 20+ players at once.</p>
          </button>
          <button
            type="button"
            onClick={() => setRegSettingsOpen(true)}
            className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <ExternalLink className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">Share registration link</p>
            </div>
            <p className="text-xs text-muted-foreground">Players fill their own details — entries appear here automatically.</p>
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold">Import from tournament</p>
            </div>
            <p className="text-xs text-muted-foreground">Copy players from a past auction — skip re-entering names and details.</p>
          </button>
        </div>

        <Dialog open={regSettingsOpen} onOpenChange={setRegSettingsOpen}>
          <DialogContent className="max-w-lg dark">
            <DialogHeader>
              <DialogTitle>Share registration link</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground -mt-2">
              Share this link before auction day. Players register themselves and appear in your list automatically.
            </p>
            {regStatus && (
              <div className="pt-1">
                {regStatus.open ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2.5 py-0.5">
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
                  <CopyTextButton text={regUrl} label="Copy link" />
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" asChild>
                    <a href={`https://wa.me/?text=${encodeURIComponent(`Register for our auction: ${regUrl}`)}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-3 h-3" /> WhatsApp
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => window.open(regUrl, "_blank")}>
                    <ExternalLink className="w-3 h-3" /> Open
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Registration link is unavailable until this tournament has an auction code.
                </p>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
              Configure registration deadline, payment, and declaration in{" "}
              <a
                href={settingsPath(tournamentId, "playerRegistration")}
                className="text-primary font-medium hover:underline"
              >
                Tournament Settings → Player Registration
              </a>
              .
            </p>
            <DialogFooter>
              <Button type="button" onClick={() => setRegSettingsOpen(false)}>
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogContent
            className="max-w-lg dark"
            onPointerDownOutside={e => e.preventDefault()}
            onEscapeKeyDown={e => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Player" : "Add Player"}</DialogTitle>
            </DialogHeader>
            <PlayerForm
              key={editing?.id ?? "new"}
              tournamentId={tournamentId}
              player={editing}
              tournamentPlayers={players || []}
              categories={categories || []}
              teams={teams || []}
              tournament={tournament}
              onClose={() => { setOpen(false); setEditing(null); }}
            />
          </DialogContent>
        </Dialog>

        <div className="rounded-xl border border-border/60 bg-card/25 px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            <div className="relative shrink-0 w-full sm:w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search serial, name, mobile…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>

            <div className="hidden sm:block w-px h-5 bg-border shrink-0" aria-hidden />

            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 flex-1">
              {STATUS_FILTER_CHIPS.map(chip => (
                <StatusFilterChip
                  key={chip.value}
                  label={chip.label}
                  count={statusCounts[chip.value]}
                  active={tab === chip.value}
                  onClick={() => setTab(chip.value)}
                  idleClass={chip.idleClass}
                  activeClass={chip.activeClass}
                />
              ))}
              {filtered.length !== statusCounts.all && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap px-1">
                  {filtered.length}/{statusCounts.all}
                </span>
              )}
            </div>

            <div className="hidden lg:block w-px h-5 bg-border shrink-0" aria-hidden />

            <div className="flex items-center gap-1 shrink-0">
              {hasCategories && (
                <MultiFilterPopover
                  label="Category"
                  options={categoryOptions}
                  selected={categoryIds}
                  onToggle={v => setCategoryIds(prev => toggleSetItem(prev, v as number))}
                  onClear={() => setCategoryIds(new Set())}
                />
              )}
              <MultiFilterPopover
                label="Team"
                options={teamOptions}
                selected={teamIds}
                onToggle={v => setTeamIds(prev => toggleSetItem(prev, v as number))}
                onClear={() => setTeamIds(new Set())}
                disabled={!teamFilterEnabled}
              />
              <MultiFilterPopover
                label="Tag"
                options={tagOptions}
                selected={tagFilters}
                onToggle={v => setTagFilters(prev => toggleSetItem(prev, v as string))}
                onClear={() => setTagFilters(new Set())}
              />
              <MultiFilterPopover
                label="Gender"
                options={genderOptions}
                selected={genderFilters}
                onToggle={v => setGenderFilters(prev => toggleSetItem(prev, v as string))}
                onClear={() => setGenderFilters(new Set())}
              />
              {hasAdvancedFilters && (
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={clearAdvancedFilters}>
                  <X className="w-3 h-3" /> Clear
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 sm:ml-auto">
              <Select
                value={`${sortKey}:${sortDir}`}
                onValueChange={v => {
                  const [k, d] = v.split(":") as [PlayerSortKey, SortDir];
                  setSortKey(k);
                  setSortDir(d);
                }}
              >
                <SelectTrigger className="h-8 w-[128px] text-xs gap-1">
                  <SlidersHorizontal className="w-3 h-3 shrink-0" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id:asc">Serial # ↑</SelectItem>
                  <SelectItem value="id:desc">Serial # ↓</SelectItem>
                  <SelectItem value="name:asc">Name A–Z</SelectItem>
                  <SelectItem value="name:desc">Name Z–A</SelectItem>
                  <SelectItem value="status:asc">Status</SelectItem>
                  {hasCategories ? <SelectItem value="category:asc">Category</SelectItem> : null}
                  <SelectItem value="amount:desc">Sold amount ↓</SelectItem>
                  <SelectItem value="team:asc">Team → Name</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs shrink-0"
                    disabled={!filtered.length || exportingTarget !== null}
                  >
                    {exportingTarget ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden md:inline">
                      {exportingTarget === "excel"
                        ? "Exporting Excel…"
                        : exportingTarget === "sheets"
                          ? "Exporting Sheets…"
                          : "Export"}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    disabled={exportingTarget !== null}
                    onClick={() => void handleExportExcel()}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={exportingTarget !== null}
                    onClick={() => void handleExportGoogleSheets()}
                  >
                    <SheetIcon className="w-4 h-4" />
                    Export to Google Sheets
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 && (players?.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/20 py-16 px-8 text-center max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-blue-500/60" />
            </div>
            <h3 className="font-display font-bold text-xl mb-2">Add your first player</h3>
            <p className="text-muted-foreground text-sm mb-1">
              Players are the athletes who will be auctioned off to the teams. Add them one by one, or use Bulk Upload to paste a list.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Make sure you have added at least 2 teams first — players cannot be sold without teams to buy them.
            </p>
            <Button className="gap-2" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4" /> Add First Player
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No players match your filters</p>
            {hasAdvancedFilters && (
              <Button variant="outline" size="sm" className="mt-4" onClick={clearAdvancedFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <style>{TAG_PULSE_KEYFRAMES}</style>
            {/* Desktop: scannable table + inline expand */}
            <div className="hidden lg:block rounded-xl border border-border/60 bg-card/20 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/60">
                    <SortableTableHead
                      label="Serial #"
                      sortKey="id"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="w-14 text-right"
                    />
                    <TableHead className="w-12">Photo</TableHead>
                    <SortableTableHead
                      label="Player Name"
                      sortKey="name"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="min-w-[160px]"
                    />
                    <TableHead className="min-w-[120px]">Mobile</TableHead>
                    {hasCategories && (
                    <SortableTableHead
                      label="Category"
                      sortKey="category"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="min-w-[140px]"
                    />
                    )}
                    <SortableTableHead
                      label="Status"
                      sortKey="status"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="min-w-[100px]"
                    />
                    {paymentEnabled && (
                      <TableHead className="min-w-[120px]">Payment</TableHead>
                    )}
                    <SortableTableHead
                      label="Team"
                      sortKey="team"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="min-w-[120px]"
                    />
                    <SortableTableHead
                      label="Base Value"
                      sortKey="amount"
                      activeKey={sortKey}
                      sortDir={sortDir}
                      onSort={handleSort}
                      className="min-w-[100px] text-right"
                    />
                    <TableHead className="w-20 text-right"> </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(player => {
                    const cat = player.categoryId ? catMap[player.categoryId] : null;
                    const team = player.teamId ? teamMap[player.teamId] : null;
                    const tagTeam = player.playerTagTeamId ? teamMap[player.playerTagTeamId] : null;
                    const amount = formatPlayerAmount(player);
                    const showTeam = player.status === "sold" || player.status === "retained";
                    const isExpanded = expandedId === player.id;
                    const roleSpecGroups = roleSpecMap.get((player.role || "").toLowerCase().trim()) || [];
                    const tagTheme = getTagTheme(player.playerTag);
                    return (
                      <Fragment key={player.id}>
                        <TableRow
                          className={`border-border/40 cursor-pointer border-l-2 ${statusBorderAccent[player.status] || "border-l-transparent"} ${isExpanded ? "bg-muted/20" : ""}`}
                          onClick={() => toggleExpand(player.id)}
                        >
                          <TableCell className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {player.serialNo ?? player.id}
                          </TableCell>
                          <TableCell>
                            <PlayerPhoto photoUrl={player.photoUrl} name={player.name} gender={player.gender} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold truncate">{player.name}</span>
                                {tagTheme && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-bold tracking-wider shrink-0"
                                    style={{
                                      color: tagTheme.color,
                                      borderColor: tagTheme.border,
                                      background: tagTheme.bg,
                                    }}
                                  >
                                    {tagTheme.label}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {player.mobileNumber || "—"}
                          </TableCell>
                          {hasCategories && (
                          <TableCell onClick={e => e.stopPropagation()}>
                            <PlayerCategorySelect
                              tournamentId={tournamentId}
                              playerId={player.id}
                              categoryId={player.categoryId}
                              categories={categories || []}
                            />
                          </TableCell>
                          )}
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold capitalize ${statusColors[player.status] || ""}`}
                            >
                              {statusLabels[player.status] || player.status}
                            </Badge>
                          </TableCell>
                          {paymentEnabled && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <PlayerPaymentStatusSelect
                                tournamentId={tournamentId}
                                playerId={player.id}
                                status={player.registrationPaymentStatus as RegistrationPaymentStatus | null}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            {showTeam && team ? (
                              <span className="text-sm font-medium truncate block" style={{ color: team.color || undefined }}>
                                {team.name}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className={`text-right text-sm ${amount.className}`}>
                            {amount.text}
                          </TableCell>
                          <TableCell onClick={e => e.stopPropagation()}>
                            <div className="flex justify-end gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => toggleExpand(player.id)}
                                title={isExpanded ? "Collapse details" : "Expand details"}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" title="More actions">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEdit(player)}>
                                    <Pencil className="w-4 h-4 mr-2" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => openDelete({ id: player.id, name: player.name })}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${player.id}-detail`} className="border-border/40 bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={tableColCount} className="py-3 px-4">
                              <PlayerDetailPanel
                                player={player}
                                cat={cat}
                                team={team}
                                tagTeam={tagTeam}
                                roleSpecGroups={roleSpecGroups}
                                tournamentId={tournamentId}
                                tournament={tournament}
                                categories={hasCategories ? categories || [] : undefined}
                                onEdit={() => openEdit(player)}
                                onDelete={() => openDelete({ id: player.id, name: player.name })}
                                onWithdraw={() => handleWithdraw({ id: player.id, name: player.name })}
                                onReinstate={() => handleReinstate({ id: player.id, name: player.name })}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: compact cards + bottom drawer */}
            <div className="lg:hidden space-y-2">
              {filtered.map(player => {
                const cat = player.categoryId ? catMap[player.categoryId] : null;
                const team = player.teamId ? teamMap[player.teamId] : null;
                const amount = formatPlayerAmount(player);
                const showTeam = player.status === "sold" || player.status === "retained";
                const tagTheme = getTagTheme(player.playerTag);
                return (
                  <div
                    key={player.id}
                    className={`w-full text-left rounded-xl border border-border/60 bg-card/30 p-3 transition-colors hover:bg-card/50 border-l-[3px] ${statusBorderAccent[player.status] || ""}`}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "0 72px" }}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-3"
                      onClick={() => setDrawerPlayer(player)}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-8 text-right shrink-0">{player.serialNo ?? player.id}</span>
                      <PlayerPhoto photoUrl={player.photoUrl} name={player.name} gender={player.gender} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{player.name}</span>
                          {tagTheme && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-bold shrink-0"
                              style={{ color: tagTheme.color, borderColor: tagTheme.border, background: tagTheme.bg }}
                            >
                              {tagTheme.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {[
                            player.mobileNumber,
                            hasCategories ? cat?.name : null,
                            statusLabels[player.status] || player.status,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {showTeam && team ? ` · ${team.name}` : ""}
                        </p>
                      </div>
                      {amount.text !== "—" && (
                        <p className={`text-sm font-mono shrink-0 ${amount.className}`}>{amount.text}</p>
                      )}
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                    {paymentEnabled && (
                      <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment</span>
                        <PlayerPaymentStatusSelect
                          tournamentId={tournamentId}
                          playerId={player.id}
                          status={player.registrationPaymentStatus as RegistrationPaymentStatus | null}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-xl dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Bulk Player Upload
            </DialogTitle>
          </DialogHeader>
          <BulkUploadDialog
            tournamentId={tournamentId}
            sportSlug={tournament?.sport ?? "cricket"}
            categories={categories || []}
            onClose={() => setBulkOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Import Players Dialog */}
      <Dialog open={importOpen} onOpenChange={v => { setImportOpen(v); }}>
        <DialogContent className="max-w-2xl dark max-h-[92vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Import Players from Other Tournaments
            </DialogTitle>
          </DialogHeader>
          <TournamentImportDialog
            tournamentId={tournamentId}
            onClose={() => setImportOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Sheet open={drawerPlayer !== null} onOpenChange={open => { if (!open) setDrawerPlayer(null); }}>
        <SheetContent side="bottom" className="dark max-h-[88vh] overflow-y-auto rounded-t-2xl">
          {drawerPlayer && (() => {
            const cat = drawerPlayer.categoryId ? catMap[drawerPlayer.categoryId] : null;
            const team = drawerPlayer.teamId ? teamMap[drawerPlayer.teamId] : null;
            const tagTeam = drawerPlayer.playerTagTeamId ? teamMap[drawerPlayer.playerTagTeamId] : null;
            const roleSpecGroups = roleSpecMap.get((drawerPlayer.role || "").toLowerCase().trim()) || [];
            return (
              <>
                <SheetHeader className="text-left mb-4">
                  <SheetTitle>Player Details</SheetTitle>
                </SheetHeader>
                <PlayerDetailPanel
                  player={drawerPlayer}
                  cat={cat}
                  team={team}
                  tagTeam={tagTeam}
                  roleSpecGroups={roleSpecGroups}
                  tournamentId={tournamentId}
                  tournament={tournament}
                  categories={hasCategories ? categories || [] : undefined}
                  onEdit={() => openEdit(drawerPlayer)}
                  onDelete={() => openDelete({ id: drawerPlayer.id, name: drawerPlayer.name })}
                  onWithdraw={() => handleWithdraw({ id: drawerPlayer.id, name: drawerPlayer.name })}
                  onReinstate={() => handleReinstate({ id: drawerPlayer.id, name: drawerPlayer.name })}
                />
                <SheetFooter className="mt-4 sm:justify-start" />
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{deleteTarget?.name}</strong> from this tournament? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deletePlayer.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deletePlayer.isPending} onClick={() => void confirmDelete()}>
              {deletePlayer.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Removing…
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Yes, remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={googleSheetResult !== null} onOpenChange={(open) => { if (!open) setGoogleSheetResult(null); }}>
        <DialogContent className="max-w-md dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="w-5 h-5" />
              Google Sheet Created Successfully
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {googleSheetResult
              ? `${googleSheetResult.playerCount} player${googleSheetResult.playerCount === 1 ? "" : "s"} exported to your Google Drive.`
              : null}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGoogleSheetResult(null)}>
              Close
            </Button>
            {googleSheetResult ? (
              <Button asChild>
                <a href={googleSheetResult.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Google Sheet
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
