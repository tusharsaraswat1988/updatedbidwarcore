import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2, Trash2, Upload } from "lucide-react";
import {
  type SponsorLogo,
  validateSponsorList,
  SPONSOR_VALIDATION_ERRORS,
} from "@/lib/sponsor-logo";

const TITLE_SPONSOR_INFO =
  "Highest priority branding category. Typically used on auction screens, scoreboards, OBS overlays, live streams, tournament websites, LED displays, reports, and team cards. Future versions may allow organisers to control visibility placement.";

const CO_SPONSOR_INFO =
  "Second highest branding category. Shown after Title Sponsor and before all other sponsors. Maximum 3 Co Sponsors allowed.";

function setSponsorPriorityFlags(
  logos: SponsorLogo[],
  index: number,
  flags: { isTitleSponsor?: boolean; isCoSponsor?: boolean },
): SponsorLogo[] {
  return logos.map((logo, i) => {
    if (i !== index) return logo;
    const next = { ...logo, ...flags };
    if (flags.isTitleSponsor) {
      next.isCoSponsor = false;
      next.type = next.type?.trim() ? next.type : "Title Sponsor";
    } else if (flags.isCoSponsor) {
      next.isTitleSponsor = false;
      next.type = next.type?.trim() ? next.type : "Co Sponsor";
    } else {
      next.isTitleSponsor = false;
      next.isCoSponsor = false;
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
      <span className="font-semibold text-foreground tabular-nums whitespace-nowrap">
        {total} sponsor{total === 1 ? "" : "s"} total
      </span>
      {titleCount > 0 ? (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-500/40 text-amber-300/90">
          {titleCount} title
        </Badge>
      ) : null}
      {coCount > 0 ? (
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-violet-500/40 text-violet-300/90">
          {coCount} co
        </Badge>
      ) : null}
      {titleCount === 0 && coCount === 0 && !compact ? (
        <span className="text-muted-foreground">No title or co sponsor assigned</span>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl dark">
        <DialogHeader>
          <DialogTitle className="truncate">{label}</DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-border/60 bg-muted/10 p-4 sm:p-6 flex items-center justify-center min-h-[200px] max-h-[min(70vh,520px)]">
          <img
            src={logo.url}
            alt={label}
            className="max-w-full max-h-[min(65vh,480px)] object-contain"
          />
        </div>
        {(logo.type || logo.isTitleSponsor || logo.isCoSponsor) && (
          <p className="text-xs text-muted-foreground text-center">
            {[
              logo.type?.trim(),
              logo.isTitleSponsor ? "Title Sponsor" : null,
              logo.isCoSponsor ? "Co Sponsor" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
    <label className={className ?? "cursor-pointer shrink-0"} title={`Select up to ${SPONSOR_LOGO_BULK_UPLOAD_MAX} images at once`}>
      <div
        className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed text-xs transition-colors whitespace-nowrap ${
          uploadingIdx === "new"
            ? "border-border/50 text-muted-foreground cursor-wait"
            : "border-yellow-500/50 bg-yellow-500/5 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/70 hover:text-yellow-300 cursor-pointer"
        }`}
      >
        {uploadingIdx === "new" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5" /> Add Sponsor Logo
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
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <SponsorAddLogoButton onUploadFile={onUploadFile} uploadingIdx={uploadingIdx} />
      <SponsorCountSummary logos={logos} compact />
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
  const previewLogo = previewIndex !== null ? logos[previewIndex] ?? null : null;

  return (
    <div className="space-y-3">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SponsorLogosToolbar logos={logos} onUploadFile={onUploadFile} uploadingIdx={uploadingIdx} />
        </div>
      ) : null}

      {logos.length === 0 && !showToolbar ? (
        <p className="text-xs text-muted-foreground">
          No sponsors yet — add logos to rotate on the LED display.
        </p>
      ) : null}

      {logos.length > 0 ? (
        <div className="space-y-2 max-h-[calc(100dvh-16rem)] overflow-y-auto pr-1">
          {logos.map((logo, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 bg-muted/5 p-2.5 sm:p-3"
            >
              <div className="grid grid-cols-1 xl:grid-cols-[5rem_minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.35fr)_auto] gap-2 xl:gap-3 xl:items-center">
                <label className="cursor-pointer justify-self-start" title="Click to replace logo image">
                  <div className="w-[4.5rem] h-11 rounded border border-border/50 bg-muted/20 overflow-hidden flex items-center justify-center">
                    {uploadingIdx === i ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : logo.url ? (
                      <img
                        src={logo.url}
                        alt={logo.name || logo.type || "logo"}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
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

                <Input
                  className="h-9 text-sm"
                  value={logo.name ?? ""}
                  onChange={e => {
                    const next = [...logos];
                    next[i] = { ...next[i], name: e.target.value };
                    onChange(next);
                  }}
                  placeholder="Sponsor name"
                />
                <Input
                  className="h-9 text-sm"
                  value={logo.type ?? ""}
                  onChange={e => {
                    const next = [...logos];
                    next[i] = { ...next[i], type: e.target.value };
                    onChange(next);
                  }}
                  placeholder="Sponsor type (optional)"
                />

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 xl:justify-start">
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={logo.isTitleSponsor === true}
                      disabled={!logo.isTitleSponsor && titleCount >= 1}
                      onChange={e =>
                        onChange(setSponsorPriorityFlags(logos, i, { isTitleSponsor: e.target.checked }))
                      }
                    />
                    <span>Title Sponsor</span>
                    <FieldTooltip text={TITLE_SPONSOR_INFO} />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={logo.isCoSponsor === true}
                      disabled={!logo.isCoSponsor && coCount >= 3}
                      onChange={e =>
                        onChange(setSponsorPriorityFlags(logos, i, { isCoSponsor: e.target.checked }))
                      }
                    />
                    <span>Co Sponsor</span>
                    <FieldTooltip text={CO_SPONSOR_INFO} />
                  </label>
                </div>

                <div className="flex items-center gap-1 justify-end xl:justify-start">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    disabled={!logo.url}
                    title={logo.url ? "View logo" : "Upload a logo to preview"}
                    onClick={() => setPreviewIndex(i)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(logos.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!validation.ok && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Title Sponsor and Co Sponsor are optional. At most one Title Sponsor and three Co Sponsors per tournament.
        {!validation.ok && validation.error === SPONSOR_VALIDATION_ERRORS.mutualExclusivity
          ? " A sponsor cannot hold both roles."
          : null}
      </p>

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
