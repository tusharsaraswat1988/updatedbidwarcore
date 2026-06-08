import {
  BROADCAST_OVERLAY_METADATA,
  BROADCAST_OVERLAY_QUICK_SETUP,
} from "@/lib/broadcast-overlay";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

export function BroadcastOverlayInfo() {
  const meta = BROADCAST_OVERLAY_METADATA;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-display font-bold text-foreground mb-3">Broadcast Info</h3>
        <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 space-y-2.5">
          <InfoRow label="Recommended Resolution" value={meta.recommendedResolution} />
          <InfoRow label="Aspect Ratio" value={meta.aspectRatio} />
          <InfoRow label="Update Method" value={meta.updateMethod} />
          <InfoRow label="Usage" value={meta.usage} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
          Works with OBS, vMix, Wirecast, XSplit, StreamYard, and any browser-source capable software.
          Landscape 16:9 is the primary supported mode; portrait layouts are planned for a future release.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-display font-bold text-foreground mb-3">Quick Setup</h3>
        <ol className="space-y-2">
          {BROADCAST_OVERLAY_QUICK_SETUP.map(({ step, text }) => (
            <li key={step} className="flex items-start gap-3 text-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {step}
              </span>
              <span className="pt-0.5 text-muted-foreground">
                <span className="font-medium text-foreground">Step {step}:</span> {text}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
