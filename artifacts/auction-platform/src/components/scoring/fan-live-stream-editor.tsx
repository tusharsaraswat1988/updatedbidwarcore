import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Tv } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  cricketBrandingQueryKey,
  getCricketBranding,
  patchCricketBroadcastPresentation,
} from "@/lib/scoring-api";
import type { SportsBranding } from "@/lib/sports-branding-types";

const STREAM_URL_PATTERN = /^https?:\/\/\S+$/i;

/**
 * Organizer control that saves the public fan-page watch URL.
 * Mount only for a signed-in tournament organizer.
 */
export function FanLiveStreamEditor({
  tournamentId,
  plain = false,
}: {
  tournamentId: number;
  /** Sit inside a parent section instead of drawing a second card. */
  plain?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<SportsBranding>(tournamentId),
    enabled: tournamentId > 0,
  });
  const saved = data?.liveStreamUrl?.trim() ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = value.trim();
      if (trimmed && !STREAM_URL_PATTERN.test(trimmed)) {
        throw new Error("Enter a full http or https link, or leave it blank to remove it.");
      }
      return patchCricketBroadcastPresentation<SportsBranding>(tournamentId, {
        liveStreamUrl: trimmed || null,
      });
    },
    onSuccess: (branding) => {
      qc.setQueryData(cricketBrandingQueryKey(tournamentId), branding);
      void qc.invalidateQueries({ queryKey: ["scoring-public", tournamentId] });
      setDraft(null);
      toast({
        title: "Live stream link saved",
        description: branding.liveStreamUrl
          ? "Fans can open Watch Live Stream on the fan page."
          : "The fan page watch button is hidden until a link is saved.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save stream link",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const inputId = `fan-live-stream-${tournamentId}`;

  return (
    <form
      className={cn(
        "space-y-3",
        plain ? "py-3" : "rounded-2xl border border-border bg-card p-4",
      )}
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex items-start gap-2">
        <Tv className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
        <div>
          <label htmlFor={inputId} className="text-sm font-semibold text-foreground">
            Fan page live stream
          </label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paste the YouTube, Facebook, or other live video link. Fans see Watch Live Stream on the cricket fan page.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          id={inputId}
          name="liveStreamUrl"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          value={value}
          disabled={isLoading || save.isPending}
          onChange={(event) => setDraft(event.target.value)}
          className="flex-1 min-w-0 h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" disabled={isLoading || save.isPending} className="shrink-0">
          {save.isPending ? "Saving…" : "Save link"}
        </Button>
      </div>
    </form>
  );
}
