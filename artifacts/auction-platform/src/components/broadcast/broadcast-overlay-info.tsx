import { useState } from "react";
import { ChevronUp, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [expanded, setExpanded] = useState(false);
  const meta = BROADCAST_OVERLAY_METADATA;

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setExpanded(true)}
      >
        <Info className="w-3.5 h-3.5" />
        View setup instructions
      </Button>
    );
  }

  return (
    <div className="space-y-6 pt-6 border-t border-border/50">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-display font-bold text-foreground">Broadcast setup</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 h-8 text-xs text-muted-foreground"
          onClick={() => setExpanded(false)}
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Hide
        </Button>
      </div>

      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Broadcast Info</h4>
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
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Setup</h4>
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
