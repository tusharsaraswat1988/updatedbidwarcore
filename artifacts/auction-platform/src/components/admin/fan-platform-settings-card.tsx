import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";
import { updateAdminTournament } from "@/lib/auth";

export const FanPlatformSettingsCard = ({
  tournamentId,
  features,
  onUpdate,
}: {
  tournamentId: number;
  features: {
    featuredEnabled?: boolean;
    featuredStartDate?: string;
    featuredEndDate?: string;
    featuredPriority?: number;
  };
  onUpdate: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(features.featuredEnabled ?? false);
  const [startDate, setStartDate] = useState(toLocalInput(features.featuredStartDate));
  const [endDate, setEndDate] = useState(toLocalInput(features.featuredEndDate));
  const [priority, setPriority] = useState(features.featuredPriority ?? 0);

  useEffect(() => {
    setEnabled(features.featuredEnabled ?? false);
    setStartDate(toLocalInput(features.featuredStartDate));
    setEndDate(toLocalInput(features.featuredEndDate));
    setPriority(features.featuredPriority ?? 0);
  }, [features.featuredEnabled, features.featuredStartDate, features.featuredEndDate, features.featuredPriority]);

  const handleSave = async () => {
    setLoading(true);
    setNotice(null);
    const result = await updateAdminTournament(tournamentId, {
      features: {
        featuredEnabled: enabled,
        featuredStartDate: startDate,
        featuredEndDate: endDate,
        featuredPriority: priority,
      },
    });
    setLoading(false);
    if (!result.success) {
      setNotice(result.error || "Save failed");
      return;
    }
    setNotice(enabled ? "Saved. This tournament is featured on the fan homepage." : "Saved. Removed from the fan homepage.");
    onUpdate();
  };

  const windowLabel = featuredWindowLabel(enabled, startDate, endDate);

  return (
    <div className="rounded-xl border border-border bg-card/70 p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Fan Platform Hero</h3>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm">Feature on Homepage</span>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Promotion Start Date (ISO)</label>
        <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Promotion End Date (ISO)</label>
        <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-muted-foreground">Priority</label>
        <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save"}</Button>
        <span className="text-xs text-muted-foreground">{windowLabel}</span>
      </div>
      {notice && <p className="text-xs text-foreground">{notice}</p>}
    </div>
  );
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function featuredWindowLabel(enabled: boolean, start: string, end: string) {
  if (!enabled) return "Not on the homepage";
  const now = Date.now();
  const startMs = start ? new Date(start).getTime() : null;
  const endMs = end ? new Date(end).getTime() : null;
  if (startMs != null && !Number.isNaN(startMs) && now < startMs) return "Scheduled";
  if (endMs != null && !Number.isNaN(endMs) && now > endMs) return "Promotion ended";
  return "On the homepage now";
}
