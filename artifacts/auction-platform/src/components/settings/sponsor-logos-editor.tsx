import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldTooltip } from "@/components/ui/field-tooltip";
import { Loader2, Trash2, Upload } from "lucide-react";
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

export function SponsorLogosEditor({
  logos,
  onChange,
  onUploadFile,
  uploadingIdx,
}: {
  logos: SponsorLogo[];
  onChange: (logos: SponsorLogo[]) => void;
  onUploadFile: (file: File, idx: number | "new") => void;
  uploadingIdx: number | "new" | null;
}) {
  const validation = validateSponsorList(logos);
  const { titleCount, coCount } = countPriorityFlags(logos);

  return (
    <div className="space-y-2">
      {logos.length > 0 ? (
        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-0.5">
          {logos.map((logo, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 bg-muted/5 p-2 space-y-2"
            >
              <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 items-center">
                <label className="cursor-pointer" title="Click to replace logo image">
                  <div className="w-14 h-10 rounded border border-border/50 bg-muted/20 overflow-hidden flex items-center justify-center">
                    {uploadingIdx === i ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : logo.url ? (
                      <img src={logo.url} alt={logo.name || logo.type || "logo"} className="w-full h-full object-contain" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f, i); e.target.value = ""; }}
                    disabled={uploadingIdx !== null}
                  />
                </label>
                <Input
                  className="h-8 text-sm"
                  value={logo.name ?? ""}
                  onChange={e => { const next = [...logos]; next[i] = { ...next[i], name: e.target.value }; onChange(next); }}
                  placeholder="Sponsor name"
                />
                <Input
                  className="h-8 text-sm"
                  value={logo.type ?? ""}
                  onChange={e => { const next = [...logos]; next[i] = { ...next[i], type: e.target.value }; onChange(next); }}
                  placeholder="Sponsor type (optional)"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(logos.filter((_, j) => j !== i))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[calc(3.5rem+0.5rem)]">
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
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
                <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer select-none">
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
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No sponsor logos yet. Add logos to rotate on the LED display.</p>
      )}

      {!validation.ok && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}

      <label className="cursor-pointer block">
        <div className={`flex items-center gap-1.5 h-8 px-3 rounded-md border border-dashed text-xs transition-colors ${
          uploadingIdx === "new"
            ? "border-border/50 text-muted-foreground cursor-wait"
            : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
        }`}>
          {uploadingIdx === "new"
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
            : <><Upload className="w-3.5 h-3.5" /> Add Sponsor Logo</>
          }
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadFile(f, "new"); e.target.value = ""; }}
          disabled={uploadingIdx !== null}
        />
      </label>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Title Sponsor and Co Sponsor are optional. At most one Title Sponsor and three Co Sponsors per tournament.
        {!validation.ok && validation.error === SPONSOR_VALIDATION_ERRORS.mutualExclusivity
          ? " A sponsor cannot hold both roles."
          : null}
      </p>
    </div>
  );
}
