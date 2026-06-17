import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Upload } from "lucide-react";
import type { SponsorLogo } from "@/lib/sponsor-logo";

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
  return (
    <div className="space-y-2">
      {logos.length > 0 ? (
        <div className="max-h-[280px] overflow-y-auto space-y-2 pr-0.5">
          {logos.map((logo, i) => (
            <div
              key={i}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 items-center rounded-lg border border-border/50 bg-muted/5 p-2"
            >
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
                placeholder="Sponsor Type (e.g. Title Sponsor)"
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
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-2">No sponsor logos yet. Add logos to rotate on the LED display.</p>
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
    </div>
  );
}
