import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_BROADCAST_SETTINGS,
  buildObsOverlayUrl,
  resolveBroadcastSettings,
  saveBroadcastSettings,
  type BroadcastSettings,
  type BroadcastTheme,
} from "@/components/broadcast";

type BroadcastControlPanelProps = {
  tournamentId: number;
};

export function BroadcastControlPanel({ tournamentId }: BroadcastControlPanelProps) {
  const [settings, setSettings] = useState<BroadcastSettings>(() =>
    resolveBroadcastSettings(tournamentId),
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSettings(resolveBroadcastSettings(tournamentId));
  }, [tournamentId]);

  const obsUrl = buildObsOverlayUrl(window.location.origin, tournamentId, settings);

  const update = useCallback(
    (patch: Partial<BroadcastSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveBroadcastSettings(tournamentId, next);
        return next;
      });
    },
    [tournamentId],
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(obsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/70">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="font-display text-base font-black text-white">Broadcast Control</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Scene engine settings for OBS Browser Source. Saved locally and encoded in the overlay URL.
        </p>
      </div>

      <div className="space-y-5 p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="sold-anim" className="text-sm text-white">
            Enable sold animation
          </Label>
          <Switch
            id="sold-anim"
            checked={settings.enableSoldAnimation}
            onCheckedChange={(v) => update({ enableSoldAnimation: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-white">
            Sold / unsold duration — {settings.soldAnimationDurationMs / 1000}s
          </Label>
          <Slider
            min={1500}
            max={8000}
            step={500}
            value={[settings.soldAnimationDurationMs]}
            onValueChange={([v]) => update({ soldAnimationDurationMs: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="break-mode" className="text-sm text-white">
            Enable break mode scene
          </Label>
          <Switch
            id="break-mode"
            checked={settings.enableBreakMode}
            onCheckedChange={(v) => update({ enableBreakMode: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-white">Theme</Label>
          <Select
            value={settings.theme}
            onValueChange={(v) => update({ theme: v as BroadcastTheme })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="premium-dark">Premium Dark</SelectItem>
              <SelectItem value="gold">Gold</SelectItem>
              <SelectItem value="crimson">Crimson</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-white">
            Sponsor rotation — {settings.sponsorRotationSpeedSec}s
          </Label>
          <Slider
            min={2}
            max={15}
            step={1}
            value={[settings.sponsorRotationSpeedSec]}
            onValueChange={([v]) => update({ sponsorRotationSpeedSec: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="auto-summary" className="text-sm text-white">
            Auto summary when auction completes
          </Label>
          <Switch
            id="auto-summary"
            checked={settings.autoSummary}
            onCheckedChange={(v) => update({ autoSummary: v })}
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="obs-perf" className="text-sm text-white">
            OBS performance mode
          </Label>
          <Switch
            id="obs-perf"
            checked={settings.obsPerformanceMode}
            onCheckedChange={(v) => update({ obsPerformanceMode: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm text-white">Broadcast overlay URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={obsUrl} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyUrl} title="Copy URL">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" variant="outline" size="icon" asChild title="Open overlay">
              <a href={obsUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {copied && <p className="text-xs text-green-400">Copied to clipboard</p>}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => update(DEFAULT_BROADCAST_SETTINGS)}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}
