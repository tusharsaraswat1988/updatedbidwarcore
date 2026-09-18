import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/ui/field-tooltip";
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
  Search,
  Sparkles,
  Info,
  Building2,
} from "lucide-react";
import {
  type SponsorLogo,
  validateSponsorList,
  SPONSOR_VALIDATION_ERRORS,
} from "@/lib/sponsor-logo";

const TITLE_SPONSOR_INFO =
  "Highest priority branding category (Max 1). Displayed prominently across auction screens, scoreboards, OBS overlays, live streams, and LED displays.";

const CO_SPONSOR_INFO =
  "Second highest branding category (Max 3). Shown alongside Title Sponsor on overlays, banners, and big screen displays.";

type SponsorTier = "title" | "co" | "standard";

function getSponsorTier(logo: SponsorLogo): SponsorTier {
  if (logo.isTitleSponsor) return "title";
  if (logo.isCoSponsor) return "co";
  return "standard";
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
      if (!next.type?.trim()) next.type = "Title Sponsor";
    } else if (tier === "co") {
      next.isTitleSponsor = false;
      next.isCoSponsor = true;
      if (!next.type?.trim()) next.type = "Co Sponsor";
    } else {
      next.isTitleSponsor = false;
      next.isCoSponsor = false;
      if (next.type === "Title Sponsor" || next.type === "Co Sponsor") {
        next.type = "";
      }
    }
    return next;
  });
}

function countPriorityFlags(logos: SponsorLogo[]) {
  let titleCount = 0;
  let coCount = 0;
  for (const logo of logos) {
    if (logo.isTitleSponsor) titleCount += 1;
    if (logo.isCoSponsor) coCount += 1;
  }
  return { titleCount, coCount };
}

function SponsorCountSummary({ logos, compact = false }: { logos: SponsorLogo[]; compact?: boolean }) {
  const total = logos.length;
  const { titleCount, coCount } = countPriorityFlags(logos);

  if (total === 0) {
    if (compact) return null;
    return (
      <p className="text-xs text-muted-foreground">
        No sponsors yet — add logos to rotate on the LED display.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5 bg-muted/60 text-foreground tabular-nums">
        {total} {total === 1 ? "Sponsor" : "Sponsors"}
      </Badge>
      {titleCount > 0 ? (
        <Badge variant="outline" className="text-xs px-2 py-0.5 border-amber-500/50 bg-amber-500/10 text-amber-300 font-medium flex items-center gap-1">
          <Crown className="w-3 h-3 text-amber-400" />
          {titleCount}/1 Title Sponsor
        </Badge>
      ) : null}
      {coCount > 0 ? (
        <Badge variant="outline" className="text-xs px-2 py-0.5 border-violet-500/50 bg-violet-500/10 text-violet-300 font-medium flex items-center gap-1">
          <Star className="w-3 h-3 text-violet-400" />
          {coCount}/3 Co-Sponsors
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
        {(logo.type || logo.isTitleSponsor || logo.isCoSponsor) && (
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
            {logo.type?.trim() && !logo.isTitleSponsor && !logo.isCoSponsor && (
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
            window.alert(
              `You can upload up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} sponsor logos at once. Only the first ${SPONSOR_LOGO_BULK_UPLOAD_MAX} will be added.`,
            );
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
  const validation = validateSponsorList(logos);
  const { titleCount, coCount } = countPriorityFlags(logos);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTier, setFilterTier] = useState<"all" | "title" | "co" | "standard">("all");

  const previewLogo = previewIndex !== null ? logos[previewIndex] ?? null : null;

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
      if (filterTier === "standard" && tier !== "standard") return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (logo.name || "").toLowerCase().includes(q);
        const typeMatch = (logo.type || "").toLowerCase().includes(q);
        return nameMatch || typeMatch;
      }
      return true;
    });
  }, [indexedLogos, filterTier, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Top Controls: Search & Filter Tabs */}
      {logos.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/50">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sponsor brand or category..."
              className="h-8 pl-8 text-xs bg-muted/15 border-border/60"
            />
          </div>
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
              onClick={() => setFilterTier("standard")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterTier === "standard"
                  ? "bg-muted/40 text-foreground border border-border"
                  : "bg-muted/20 text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              Standard ({logos.length - titleCount - coCount})
            </button>
          </div>
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
        <div className="space-y-2.5 max-h-[calc(100dvh-18rem)] overflow-y-auto pr-1">
          {/* Header Row (Desktop) */}
          <div className="hidden xl:grid grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,1.1fr)_13rem_5.5rem] gap-3 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
            <span>Logo</span>
            <span>Brand / Sponsor Name</span>
            <span>Category / Designation</span>
            <span className="flex items-center gap-1">
              Sponsorship Tier
              <FieldTooltip text="Title Sponsor (max 1) and Co-Sponsors (max 3) receive primary visibility across all screens and overlays." />
            </span>
            <span className="text-right pr-2">Actions</span>
          </div>

          {filteredLogos.map(({ logo, originalIndex: i }) => {
            const tier = getSponsorTier(logo);
            const isTitle = tier === "title";
            const isCo = tier === "co";

            return (
              <div
                key={i}
                className={`rounded-xl border transition-all p-3 sm:p-3.5 ${
                  isTitle
                    ? "border-amber-500/50 bg-amber-500/[0.04] ring-1 ring-amber-500/20 shadow-xs"
                    : isCo
                    ? "border-violet-500/50 bg-violet-500/[0.04] ring-1 ring-violet-500/20 shadow-xs"
                    : "border-border/60 bg-card/60 hover:bg-card/90"
                }`}
              >
                <div className="grid grid-cols-1 xl:grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,1.1fr)_13rem_5.5rem] gap-3 items-center">
                  {/* 1. Logo Thumbnail */}
                  <label
                    className="cursor-pointer group relative block w-14 h-10 rounded-lg border border-border/70 bg-black/30 overflow-hidden shrink-0 shadow-inner"
                    title="Click to change logo image"
                  >
                    {uploadingIdx === i ? (
                      <div className="w-full h-full flex items-center justify-center bg-muted/40">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : logo.url ? (
                      <div className="w-full h-full p-1 flex items-center justify-center">
                        <img
                          src={logo.url}
                          alt={logo.name || logo.type || "logo"}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Upload className="w-3.5 h-3.5" />
                      </div>
                    )}
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

                  {/* 2. Brand / Sponsor Name */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground xl:hidden font-medium">Brand Name</span>
                    <Input
                      className="h-9 text-xs font-medium"
                      value={logo.name ?? ""}
                      onChange={e => {
                        const next = [...logos];
                        next[i] = { ...next[i], name: e.target.value };
                        onChange(next);
                      }}
                      placeholder="e.g. Electrical Cable India"
                    />
                  </div>

                  {/* 3. Category / Designation */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground xl:hidden font-medium">Designation / Category</span>
                    <Input
                      className="h-9 text-xs"
                      value={logo.type ?? ""}
                      onChange={e => {
                        const next = [...logos];
                        next[i] = { ...next[i], type: e.target.value };
                        onChange(next);
                      }}
                      placeholder="e.g. Scoreboard / Team Sponsor"
                    />
                  </div>

                  {/* 4. Sponsorship Tier Selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-muted-foreground xl:hidden font-medium">Tier / Priority</span>
                    <Select
                      value={tier}
                      onValueChange={(val: SponsorTier) => {
                        onChange(setSponsorTier(logos, i, val));
                      }}
                    >
                      <SelectTrigger
                        className={`h-9 text-xs font-medium ${
                          isTitle
                            ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                            : isCo
                            ? "border-violet-500/50 text-violet-300 bg-violet-500/10"
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
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 5. Row Actions */}
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={i === 0}
                      title="Move up in rotation order"
                      onClick={() => {
                        if (i === 0) return;
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
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={i === logos.length - 1}
                      title="Move down in rotation order"
                      onClick={() => {
                        if (i >= logos.length - 1) return;
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
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      disabled={!logo.url}
                      title="Preview high-res logo"
                      onClick={() => setPreviewIndex(i)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Remove sponsor"
                      onClick={() => onChange(logos.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
            Logos cycle on the live LED screen every 4 seconds. <span className="text-amber-300 font-medium">Title Sponsor</span> (max 1) and <span className="text-violet-300 font-medium">Co-Sponsors</span> (max 3) receive primary placement on broadcast overlays, live stream headers, and auction reports.
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

