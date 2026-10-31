import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Loader2,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  Crown,
  Star,
  Radio,
  Search,
  Sparkles,
  Info,
  Building2,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronUp,
  Wrench,
  Check,
} from "lucide-react";
import {
  type SponsorLogo,
  validateSponsorList,
  SPONSOR_VALIDATION_ERRORS,
  SponsorPriorityType,
  LIVE_STREAMING_PARTNER_LABEL,
  isLiveStreamingPartnerLogo,
} from "@/lib/sponsor-logo";

const TITLE_SPONSOR_INFO =
  "Highest priority branding category (Max 1). Displayed prominently across auction screens, scoreboards, OBS overlays, live streams, and LED displays.";

const CO_SPONSOR_INFO =
  "Second highest branding category (Max 3). Shown alongside Title Sponsor on overlays, banners, and big screen displays.";

const LIVE_STREAMING_PARTNER_INFO =
  "Fixed category (Max 1). The linked sponsor stays on the OBS broadcast with logo, name, and this sponsor type.";

const SPONSOR_ROW_GRID =
  "grid-cols-1 md:grid-cols-[3.5rem_minmax(140px,1.4fr)_minmax(130px,1.2fr)_210px_136px]";

type SponsorTier = "title" | "co" | "live" | "standard";

function getSponsorTier(logo: SponsorLogo): SponsorTier {
  if (logo.isTitleSponsor) return "title";
  if (logo.isCoSponsor) return "co";
  if (isLiveStreamingPartnerLogo(logo)) return "live";
  return "standard";
}

function isRedundantTierString(type: string | undefined): boolean {
  if (!type?.trim()) return true;
  const t = type.trim();
  return (
    /^title\s*sponsor$/i.test(t) ||
    /^co[\s-]*sponsor$/i.test(t) ||
    t === LIVE_STREAMING_PARTNER_LABEL
  );
}

function setSponsorTier(
  logos: SponsorLogo[],
  index: number,
  tier: SponsorTier,
): SponsorLogo[] {
  return logos.map((logo, i) => {
    if (i !== index) return logo;
    const next = { ...logo };
    if (tier === "title") {
      next.isTitleSponsor = true;
      next.isCoSponsor = false;
      next.isLiveStreamingPartner = false;
      if (next.priorityType === SponsorPriorityType.LIVE_STREAMING_PARTNER) {
        next.priorityType = undefined;
      }
      if (isRedundantTierString(next.type)) {
        next.type = "";
      }
    } else if (tier === "co") {
      next.isTitleSponsor = false;
      next.isCoSponsor = true;
      next.isLiveStreamingPartner = false;
      if (next.priorityType === SponsorPriorityType.LIVE_STREAMING_PARTNER) {
        next.priorityType = undefined;
      }
      if (isRedundantTierString(next.type)) {
        next.type = "";
      }
    } else if (tier === "live") {
      next.isTitleSponsor = false;
      next.isCoSponsor = false;
      next.isLiveStreamingPartner = true;
      next.priorityType = SponsorPriorityType.LIVE_STREAMING_PARTNER;
      next.type = LIVE_STREAMING_PARTNER_LABEL;
    } else {
      next.isTitleSponsor = false;
      next.isCoSponsor = false;
      next.isLiveStreamingPartner = false;
      if (next.priorityType === SponsorPriorityType.LIVE_STREAMING_PARTNER) {
        next.priorityType = undefined;
      }
      if (isRedundantTierString(next.type)) {
        next.type = "";
      }
    }
    return next;
  });
}

function countPriorityFlags(logos: SponsorLogo[]) {
  let titleCount = 0;
  let coCount = 0;
  let liveCount = 0;
  for (const logo of logos) {
    if (logo.isTitleSponsor) titleCount += 1;
    else if (logo.isCoSponsor) coCount += 1;
    else if (isLiveStreamingPartnerLogo(logo)) liveCount += 1;
  }
  return { titleCount, coCount, liveCount };
}

function SponsorCountSummary({ logos, compact = false }: { logos: SponsorLogo[]; compact?: boolean }) {
  const total = logos.length;
  const { titleCount, coCount, liveCount } = countPriorityFlags(logos);

  if (total === 0) {
    if (compact) return null;
    return (
      <p className="text-xs text-muted-foreground">
        No sponsors yet — add logos to rotate on the LED display.
      </p>
    );
  }

  // When compact (top card header toolbar), only render the total count
  // and any alert badges for tier conflicts. The interactive filter tab
  // buttons directly below already display the breakdown (Title, Co, Live, Standard)
  // to eliminate duplicate pill badges at the top of the card.
  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-foreground tabular-nums">
          {total} {total === 1 ? "Sponsor" : "Sponsors"}
        </Badge>
        {titleCount > 1 && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-0.5 border-destructive/60 bg-destructive/15 text-destructive font-semibold flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-destructive" />
            {titleCount}/1 Title Sponsor
          </Badge>
        )}
        {coCount > 3 && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-0.5 border-destructive/60 bg-destructive/15 text-destructive font-semibold flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-destructive" />
            {coCount}/3 Co-Sponsors
          </Badge>
        )}
        {liveCount > 1 && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-0.5 border-destructive/60 bg-destructive/15 text-destructive font-semibold flex items-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-destructive" />
            {liveCount}/1 Live Streaming Partner
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-foreground tabular-nums">
        {total} {total === 1 ? "Sponsor" : "Sponsors"}
      </Badge>
      {titleCount > 0 ? (
        <Badge
          variant="outline"
          className={`text-xs px-2 py-0.5 font-medium flex items-center gap-1 ${
            titleCount > 1
              ? "border-destructive/60 bg-destructive/15 text-destructive font-semibold"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300"
          }`}
        >
          {titleCount > 1 ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Crown className="w-3 h-3 text-amber-400" />}
          {titleCount}/1 Title Sponsor
        </Badge>
      ) : null}
      {coCount > 0 ? (
        <Badge
          variant="outline"
          className={`text-xs px-2 py-0.5 font-medium flex items-center gap-1 ${
            coCount > 3
              ? "border-destructive/60 bg-destructive/15 text-destructive font-semibold"
              : "border-violet-500/50 bg-violet-500/10 text-violet-300 font-medium"
          }`}
        >
          {coCount > 3 ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Star className="w-3 h-3 text-violet-400" />}
          {coCount}/3 Co-Sponsors
        </Badge>
      ) : null}
      {liveCount > 0 ? (
        <Badge
          variant="outline"
          className={`text-xs px-2 py-0.5 font-medium flex items-center gap-1 ${
            liveCount > 1
              ? "border-destructive/60 bg-destructive/15 text-destructive font-semibold"
              : "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
          }`}
        >
          {liveCount > 1 ? <AlertTriangle className="w-3 h-3 text-destructive" /> : <Radio className="w-3 h-3 text-cyan-400" />}
          {liveCount}/1 Live Streaming Partner
        </Badge>
      ) : null}
    </div>
  );
}

function SponsorLogoPreviewDialog({
  logo,
  open,
  onOpenChange,
}: {
  logo: SponsorLogo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!logo?.url) return null;

  const label = logo.name?.trim() || logo.type?.trim() || "Sponsor logo";
  const tier = getSponsorTier(logo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl dark">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate text-base font-semibold">
            {tier === "title" && <Crown className="w-4 h-4 text-amber-400" />}
            {tier === "co" && <Star className="w-4 h-4 text-violet-400" />}
            {tier === "live" && <Radio className="w-4 h-4 text-cyan-400" />}
            {label}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-border/70 bg-black/40 p-6 flex items-center justify-center min-h-[220px] max-h-[min(70vh,520px)] shadow-inner">
          <img
            src={logo.url}
            alt={label}
            className="max-w-full max-h-[min(65vh,480px)] object-contain"
          />
        </div>
        {(logo.type || logo.isTitleSponsor || logo.isCoSponsor || isLiveStreamingPartnerLogo(logo)) && (
          <div className="flex items-center justify-center gap-2 pt-1">
            {logo.isTitleSponsor && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                👑 Title Sponsor
              </Badge>
            )}
            {logo.isCoSponsor && (
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/40 text-xs">
                ⭐ Co-Sponsor
              </Badge>
            )}
            {isLiveStreamingPartnerLogo(logo) && (
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs">
                LIVE STREAMING PARTNER
              </Badge>
            )}
            {logo.type?.trim() && !logo.isTitleSponsor && !logo.isCoSponsor && !isLiveStreamingPartnerLogo(logo) && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {logo.type.trim()}
              </Badge>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const SPONSOR_LOGO_BULK_UPLOAD_MAX = 5;

function SponsorAddLogoButton({
  onUploadFile,
  uploadingIdx,
  className,
}: {
  onUploadFile: (file: File | File[], idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
  className?: string;
}) {
  const { toast } = useToast();

  return (
    <label className={className ?? "cursor-pointer shrink-0"} title={`Upload up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} images at once`}>
      <div
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-all whitespace-nowrap shadow-xs ${
          uploadingIdx === "new"
            ? "border-border/50 bg-muted/20 text-muted-foreground cursor-wait"
            : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 cursor-pointer"
        }`}
      >
        {uploadingIdx === "new" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" /> + Add Sponsor Logo
          </>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (picked.length === 0) return;
          if (picked.length > SPONSOR_LOGO_BULK_UPLOAD_MAX) {
            toast({
              title: "Upload limit",
              description: `Select up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} images per batch. Adding the first ${SPONSOR_LOGO_BULK_UPLOAD_MAX}.`,
            });
          }
          const files = picked.slice(0, SPONSOR_LOGO_BULK_UPLOAD_MAX);
          onUploadFile(files.length === 1 ? files[0] : files, "new");
        }}
        disabled={uploadingIdx !== null}
      />
    </label>
  );
}

export function SponsorLogosToolbar({
  logos,
  onUploadFile,
  uploadingIdx,
}: {
  logos: SponsorLogo[];
  onUploadFile: (file: File | File[], idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <SponsorCountSummary logos={logos} compact />
      <SponsorAddLogoButton onUploadFile={onUploadFile} uploadingIdx={uploadingIdx} />
    </div>
  );
}


function resolveSponsorConflict(logos: SponsorLogo[], error: string): SponsorLogo[] {
  if (error === SPONSOR_VALIDATION_ERRORS.liveStreamingPartnerLimit) {
    let seen = false;
    return logos.map((l) => {
      if (isLiveStreamingPartnerLogo(l)) {
        if (!seen) {
          seen = true;
          return l;
        }
        return {
          ...l,
          isLiveStreamingPartner: false,
          priorityType: undefined,
          type: l.type === LIVE_STREAMING_PARTNER_LABEL ? "" : l.type,
        };
      }
      return l;
    });
  }
  if (error === SPONSOR_VALIDATION_ERRORS.titleLimit) {
    let seen = false;
    return logos.map((l) => {
      if (l.isTitleSponsor) {
        if (!seen) {
          seen = true;
          return l;
        }
        return {
          ...l,
          isTitleSponsor: false,
          type: l.type === "Title Sponsor" ? "" : l.type,
        };
      }
      return l;
    });
  }
  if (error === SPONSOR_VALIDATION_ERRORS.coSponsorLimit) {
    let count = 0;
    return logos.map((l) => {
      if (l.isCoSponsor) {
        if (count < 3) {
          count++;
          return l;
        }
        return {
          ...l,
          isCoSponsor: false,
          type: l.type === "Co Sponsor" ? "" : l.type,
        };
      }
      return l;
    });
  }
  return logos;
}

export function SponsorLogosEditor({
  logos,
  onChange,
  onUploadFile,
  uploadingIdx,
  showToolbar = true,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
  onUploadFile: (file: File | File[], idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
  showToolbar?: boolean;
}) {
  const { toast } = useToast();
  const validation = validateSponsorList(logos);
  const { titleCount, coCount, liveCount } = countPriorityFlags(logos);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "title" | "co" | "live" | "standard">("all");
  const [showRotationExplainer, setShowRotationExplainer] = useState(false);

  const previewLogo = previewIndex !== null ? logos[previewIndex] ?? null : null;
  const isFiltered = filterTier !== "all" || searchQuery.trim().length > 0;


  // Filtered sponsor list with original indices maintained
  const indexedLogos = useMemo(() => {
    return logos.map((logo, originalIndex) => ({ logo, originalIndex }));
  }, [logos]);

  const filteredLogos = useMemo(() => {
    return indexedLogos.filter(({ logo }) => {
      // Tier filter
      const tier = getSponsorTier(logo);
      if (filterTier === "title" && tier !== "title") return false;
      if (filterTier === "co" && tier !== "co") return false;
      if (filterTier === "live" && tier !== "live") return false;
      if (filterTier === "standard" && tier !== "standard") return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (logo.name || "").toLowerCase().includes(q);
        const typeMatch = (logo.type || "").toLowerCase().includes(q);
        const tierMatch =
          (tier === "title" && ("title".includes(q) || "title sponsor".includes(q))) ||
          (tier === "co" && ("co".includes(q) || "co sponsor".includes(q) || "co-sponsor".includes(q))) ||
          (tier === "live" && ("live".includes(q) || "streaming".includes(q) || "live streaming partner".includes(q))) ||
          (tier === "standard" && "standard sponsor".includes(q));
        return nameMatch || typeMatch || tierMatch;
      }
      return true;
    });
  }, [indexedLogos, filterTier, searchQuery]);

  return (
    <div className="space-y-4">
      {!validation.ok ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-destructive/10 border border-destructive/40 text-destructive text-xs font-medium animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-sm">Sponsorship Tier Conflict:</span>
              <p className="text-destructive/90">{validation.error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {validation.error === SPONSOR_VALIDATION_ERRORS.liveStreamingPartnerLimit && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-destructive/40 hover:bg-destructive/15 gap-1 font-semibold"
                  onClick={() => setFilterTier("live")}
                >
                  <Radio className="w-3 h-3 text-cyan-400" /> View Live (2)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1 font-semibold"
                  onClick={() => {
                    const resolved = resolveSponsorConflict(logos, validation.error!);
                    onChange(resolved);
                    toast({
                      title: "Conflict resolved",
                      description: "Kept first Live Streaming Partner and demoted extra to Standard.",
                    });
                  }}
                >
                  <Wrench className="w-3 h-3" /> Auto-Fix
                </Button>
              </>
            )}
            {validation.error === SPONSOR_VALIDATION_ERRORS.titleLimit && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-destructive/40 hover:bg-destructive/15 gap-1 font-semibold"
                  onClick={() => setFilterTier("title")}
                >
                  <Crown className="w-3 h-3 text-amber-400" /> View Title
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1 font-semibold"
                  onClick={() => {
                    const resolved = resolveSponsorConflict(logos, validation.error!);
                    onChange(resolved);
                    toast({
                      title: "Conflict resolved",
                      description: "Kept first Title Sponsor and demoted extra to Standard.",
                    });
                  }}
                >
                  <Wrench className="w-3 h-3" /> Auto-Fix
                </Button>
              </>
            )}
            {validation.error === SPONSOR_VALIDATION_ERRORS.coSponsorLimit && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-destructive/40 hover:bg-destructive/15 gap-1 font-semibold"
                  onClick={() => setFilterTier("co")}
                >
                  <Star className="w-3 h-3 text-violet-400" /> View Co (4+)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1 font-semibold"
                  onClick={() => {
                    const resolved = resolveSponsorConflict(logos, validation.error!);
                    onChange(resolved);
                    toast({
                      title: "Conflict resolved",
                      description: "Kept first 3 Co-Sponsors and demoted extras to Standard.",
                    });
                  }}
                >
                  <Wrench className="w-3 h-3" /> Auto-Fix
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Top Controls: Search, Filter Tabs & Add Button */}
      {logos.length > 0 ? (
        <div className="space-y-3 pb-3 border-b border-border/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sponsor brand or category..."
              aria-label="Search sponsors by brand or category"
              className="h-8 pl-8 pr-8 text-xs bg-muted/15 border-border/60"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTier("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterTier === "all"
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                All ({logos.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier("title")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                  filterTier === "title"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                <Crown className="w-3 h-3 text-amber-400" /> Title ({titleCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier("co")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                  filterTier === "co"
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                <Star className="w-3 h-3 text-violet-400" /> Co ({coCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier("live")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                  filterTier === "live"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                <Radio className="w-3 h-3 text-cyan-400" /> Live ({liveCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterTier("standard")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterTier === "standard"
                    ? "bg-muted/40 text-foreground border border-border"
                    : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                Standard ({logos.length - titleCount - coCount - liveCount})
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowRotationExplainer((v) => !v)}
              className="text-xs text-primary hover:underline flex items-center gap-1 font-medium shrink-0 self-end md:self-auto cursor-pointer"
            >
              <Info className="w-3.5 h-3.5" />
              {showRotationExplainer ? "Hide Tier Guide" : "Sponsor Tier Guide"}
              {showRotationExplainer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          </div>
          {showRotationExplainer && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted-foreground animate-in fade-in duration-200">
              <p className="text-foreground font-semibold mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Sponsor Rotation &amp; Overlay Placements:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px] leading-relaxed">
                <div className="p-2 rounded-md bg-card/60 border border-border/40">
                  <span className="font-semibold text-amber-300 block mb-0.5">👑 Title Sponsor (Max 1)</span>
                  Prominent header placement across live auction display, scoreboard, LED loop, and official team reports.
                </div>
                <div className="p-2 rounded-md bg-card/60 border border-border/40">
                  <span className="font-semibold text-violet-300 block mb-0.5">⭐ Co-Sponsors (Max 3)</span>
                  Rotates alongside Title Sponsor on top broadcast overlays, TV graphics, and player cards.
                </div>
                <div className="p-2 rounded-md bg-card/60 border border-border/40">
                  <span className="font-semibold text-cyan-300 block mb-0.5">LIVE STREAMING PARTNER (Max 1)</span>
                  Permanently pinned on the OBS live stream chyron overlay with custom live streaming designation.
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Empty State */}
      {logos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/5 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-semibold text-foreground">No Sponsor Logos Added</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add brand logos to display on the live LED screen, stream overlays, auction player cards, and reports.
            </p>
          </div>
          <div className="pt-2">
            <SponsorAddLogoButton onUploadFile={onUploadFile} uploadingIdx={uploadingIdx} />
          </div>
        </div>
      ) : null}

      {/* Sponsor Table / Grid */}
      {filteredLogos.length > 0 ? (
        <div className="w-full space-y-2.5" role="table" aria-label="Tournament Sponsor Logos">
            {isFiltered && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/20 border border-border/40 px-3 py-1.5 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  Filtered view active — clear search and filters to change rotation order.
                </span>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(""); setFilterTier("all"); }}
                  className="text-primary hover:underline font-medium ml-2"
                >
                  Clear filters
                </button>
              </div>
            )}
            {/* Header Row (Desktop) */}
            <div role="row" className={`hidden md:grid ${SPONSOR_ROW_GRID} gap-3 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider`}>
              <span role="columnheader">Logo</span>
              <span role="columnheader">Brand / Sponsor Name</span>
              <span role="columnheader">Category / Designation</span>
              <span role="columnheader" className="flex items-center gap-1">
                Sponsorship Tier
                <FieldTooltip text={`${TITLE_SPONSOR_INFO} ${CO_SPONSOR_INFO} ${LIVE_STREAMING_PARTNER_INFO}`} />
              </span>
              <span role="columnheader" className="text-right pr-2">Actions</span>
            </div>

          {filteredLogos.map(({ logo, originalIndex: i }) => {
            const tier = getSponsorTier(logo);
            const isTitle = tier === "title";
            const isCo = tier === "co";
            const isLive = tier === "live";

            return (
              <div
                key={i}
                role="row"
                className={`rounded-xl border transition-all p-3 sm:p-3.5 ${
                  isTitle
                    ? "border-amber-500/50 bg-amber-500/[0.04] ring-1 ring-amber-500/20 shadow-xs"
                    : isCo
                    ? "border-violet-500/50 bg-violet-500/[0.04] ring-1 ring-violet-500/20 shadow-xs"
                    : isLive
                    ? "border-cyan-500/50 bg-cyan-500/[0.04] ring-1 ring-cyan-500/20 shadow-xs"
                    : "border-border/60 bg-card/60 hover:bg-card/90"
                }`}
              >
                <div className={`grid ${SPONSOR_ROW_GRID} gap-3 items-center`}>
                  {/* 1. Logo Thumbnail with separate preview & replace actions */}
                  <div className="relative group w-14 h-10 rounded-lg border border-border/70 bg-black/30 overflow-hidden shrink-0 shadow-inner" role="cell">
                    {uploadingIdx === i ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/40">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : logo.url ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewIndex(i)}
                          className="w-full h-full p-1 flex items-center justify-center cursor-zoom-in"
                          title="Click to preview logo"
                          aria-label={`Preview logo for ${logo.name || `sponsor ${i + 1}`}`}
                        >
                          <img
                            src={logo.url}
                            alt={logo.name || logo.type || "logo"}
                            className="w-full h-full object-contain"
                          />
                        </button>
                        <label
                          className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer text-white gap-1"
                          title="Click to replace logo image"
                        >
                          <Upload className="w-3 h-3" />
                          <span className="text-[9px] font-semibold tracking-tight">Replace</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) onUploadFile(f, i);
                              e.target.value = "";
                            }}
                            disabled={uploadingIdx !== null}
                          />
                        </label>
                      </>
                    ) : (
                      <label
                        className="w-full h-full flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Upload logo image"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) onUploadFile(f, i);
                            e.target.value = "";
                          }}
                          disabled={uploadingIdx !== null}
                        />
                      </label>
                    )}
                  </div>

                  {/* 2. Brand / Sponsor Name */}
                  <div className="space-y-1" role="cell">
                    <span className="text-[10px] text-muted-foreground md:hidden font-medium">Brand Name</span>
                    <Input
                      className="h-9 text-xs font-medium"
                      placeholder="Brand or sponsor name"
                      aria-label={`Brand name for sponsor ${i + 1}`}
                      value={logo.name ?? ""}
                      onChange={e => {
                        const next = [...logos];
                        next[i] = { ...next[i], name: e.target.value };
                        onChange(next);
                      }}
                    />
                  </div>

                  {/* 3. Category / Designation */}
                  <div className="space-y-1" role="cell">
                    <span className="text-[10px] text-muted-foreground md:hidden font-medium">Designation / Category</span>
                    <Input
                      className={`h-9 text-xs ${isLive ? "bg-cyan-500/10 text-cyan-200 border-cyan-500/40" : ""}`}
                      placeholder={
                        isLive
                          ? LIVE_STREAMING_PARTNER_LABEL
                          : isTitle
                          ? "Optional tagline (e.g. Powered By, Driven By)"
                          : isCo
                          ? "Optional tagline (e.g. Associate Sponsor, In Association With)"
                          : "Designation (e.g. Powered By, Beverage Partner)"
                      }
                      aria-label={`Category or designation for sponsor ${i + 1}`}
                      value={
                        isLive
                          ? LIVE_STREAMING_PARTNER_LABEL
                          : (isTitle || isCo) && isRedundantTierString(logo.type)
                          ? ""
                          : (logo.type ?? "")
                      }
                      onChange={e => {
                        if (isLive) return;
                        const next = [...logos];
                        next[i] = { ...next[i], type: e.target.value };
                        onChange(next);
                      }}
                      readOnly={isLive}
                      title={isLive ? LIVE_STREAMING_PARTNER_INFO : undefined}
                    />
                  </div>

                  {/* 4. Sponsorship Tier Selector */}
                  <div className="space-y-1" role="cell">
                    <span className="text-[10px] text-muted-foreground md:hidden font-medium">Tier / Priority</span>
                    <Select
                      value={tier}
                      onValueChange={(val: SponsorTier) => {
                        onChange(setSponsorTier(logos, i, val));
                      }}
                    >
                      <SelectTrigger
                        aria-label={`Sponsorship tier for ${logo.name || `sponsor ${i + 1}`}`}
                        className={`h-9 text-xs font-medium ${
                          isTitle
                            ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                            : isCo
                            ? "border-violet-500/50 text-violet-300 bg-violet-500/10"
                            : isLive
                            ? "border-cyan-500/50 text-cyan-300 bg-cyan-500/10"
                            : "border-border/70 text-muted-foreground"
                        }`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark">
                        <SelectItem value="standard" className="text-xs">
                          Standard Sponsor
                        </SelectItem>
                        <SelectItem
                          value="title"
                          disabled={!isTitle && titleCount >= 1}
                          className="text-xs text-amber-300 font-medium"
                        >
                          👑 Title Sponsor {!isTitle && titleCount >= 1 ? "(1/1 Full)" : "(Max 1)"}
                        </SelectItem>
                        <SelectItem
                          value="co"
                          disabled={!isCo && coCount >= 3}
                          className="text-xs text-violet-300 font-medium"
                        >
                          ⭐ Co-Sponsor {!isCo && coCount >= 3 ? "(3/3 Full)" : `(${coCount}/3)`}
                        </SelectItem>
                        <SelectItem
                          value="live"
                          disabled={!isLive && liveCount >= 1}
                          className="text-xs text-cyan-300 font-medium"
                        >
                          LIVE STREAMING PARTNER {!isLive && liveCount >= 1 ? "(1/1 Full)" : "(Max 1)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 5. Row Actions */}
                  <div className="flex items-center gap-1 justify-end shrink-0 pt-2 border-t border-border/30 md:border-t-0 md:pt-0" role="cell">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-40"
                      disabled={i === 0 || isFiltered}
                      title={isFiltered ? "Clear filters to reorder rotation sequence" : "Move up in rotation order"}
                      aria-label={isFiltered ? "Clear filters to reorder" : `Move ${logo.name || `sponsor ${i + 1}`} up in rotation`}
                      onClick={() => {
                        if (i === 0 || isFiltered) return;
                        const next = [...logos];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        onChange(next);
                      }}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-40"
                      disabled={i === logos.length - 1 || isFiltered}
                      title={isFiltered ? "Clear filters to reorder rotation sequence" : "Move down in rotation order"}
                      aria-label={isFiltered ? "Clear filters to reorder" : `Move ${logo.name || `sponsor ${i + 1}`} down in rotation`}
                      onClick={() => {
                        if (i >= logos.length - 1 || isFiltered) return;
                        const next = [...logos];
                        [next[i], next[i + 1]] = [next[i + 1], next[i]];
                        onChange(next);
                      }}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                      disabled={!logo.url}
                      title="Preview high-res logo"
                      aria-label={`Preview logo for ${logo.name || `sponsor ${i + 1}`}`}
                      onClick={() => setPreviewIndex(i)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      title="Remove sponsor"
                      aria-label={`Remove sponsor ${logo.name || i + 1}`}
                      onClick={() => onChange(logos.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Prominent "+ Add Another Sponsor Logo" bar below the list */}
          <div className="pt-1">
            <label
              className="w-full flex items-center justify-center p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary hover:border-primary transition-all cursor-pointer text-xs font-semibold gap-2 shadow-xs group"
              title={`Upload up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} sponsor logos at once`}
            >
              {uploadingIdx === "new" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Uploading sponsors...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" /> + Add Another Sponsor Logo (Upload JPG, PNG, WEBP)
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => {
                  const picked = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (picked.length === 0) return;
                  if (picked.length > SPONSOR_LOGO_BULK_UPLOAD_MAX) {
                    toast({
                      title: "Upload limit",
                      description: `Select up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} images per batch. Adding the first ${SPONSOR_LOGO_BULK_UPLOAD_MAX}.`,
                    });
                  }
                  const files = picked.slice(0, SPONSOR_LOGO_BULK_UPLOAD_MAX);
                  onUploadFile(files.length === 1 ? files[0] : files, "new");
                }}
                disabled={uploadingIdx !== null}
              />
            </label>
          </div>
        </div>
      ) : null}

      {/* No Search Results */}
      {logos.length > 0 && filteredLogos.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No sponsors match your filter. <button type="button" onClick={() => { setSearchQuery(""); setFilterTier("all"); }} className="text-primary underline ml-1">Clear filters</button>
        </div>
      ) : null}

      {/* Validation Error */}
      {!validation.ok && (
        <p className="text-xs text-destructive font-medium">{validation.error}</p>
      )}

      {/* Helpful Footer Note */}
      <div className="flex items-start gap-2 p-3 rounded-lg border border-border/40 bg-muted/10 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-foreground/90 font-medium">Sponsor Rotation &amp; Overlay Logic:</p>
          <p className="text-[11px] leading-relaxed">
            Logos cycle on the live LED screen every 4 seconds. <span className="text-amber-300 font-medium">Title Sponsor</span> (max 1) and <span className="text-violet-300 font-medium">Co-Sponsors</span> (max 3) receive primary placement on broadcast overlays, live stream headers, and auction reports. <span className="text-cyan-300 font-medium">LIVE STREAMING PARTNER</span> (max 1) stays on the OBS broadcast with logo, name, and sponsor type.
          </p>
        </div>
      </div>

      {/* High-res Image Modal */}
      <SponsorLogoPreviewDialog
        logo={previewLogo}
        open={previewIndex !== null && !!previewLogo?.url}
        onOpenChange={open => {
          if (!open) setPreviewIndex(null);
        }}
      />
    </div>
  );
}

