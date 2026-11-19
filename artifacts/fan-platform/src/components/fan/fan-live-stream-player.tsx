import React, { useState, useMemo } from "react";
import { Tv, ExternalLink, ChevronDown, ChevronUp, Radio, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseStreamEmbed, isTestStreamUrl, type StreamPresentationStatus } from "@/lib/stream-utils";

export interface FanLiveStreamPlayerProps {
  streamUrl?: string | null;
  streamEnabled?: boolean;
  tournamentName: string;
  isLive?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

export { parseStreamEmbed };

export function FanLiveStreamPlayer({
  streamUrl,
  streamEnabled = true,
  tournamentName,
  isLive = false,
  className,
  defaultExpanded = false,
}: FanLiveStreamPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const parsed = useMemo(() => parseStreamEmbed(streamUrl), [streamUrl]);

  // If stream is disabled, null, or a test/demo URL, do not render a stream strip
  if (!streamEnabled || !streamUrl || !parsed.isValid || !parsed.directUrl) {
    return null;
  }

  return (
    <section
      aria-label="Official Video Broadcast"
      className={cn(
        "w-full overflow-hidden rounded-3xl border border-red-500/30 bg-slate-950/90 text-white shadow-xl transition-all dark:bg-black/80",
        className
      )}
      data-testid="fan-live-stream-player"
    >
      {/* Top Banner / Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-gradient-to-r from-red-950/60 via-slate-950 to-slate-950 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isLive ? 'bg-red-500/20 text-red-500 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
            <Radio className={`h-4 w-4 ${isLive ? 'animate-pulse' : ''}`} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${isLive ? 'bg-red-500 shadow-red-500/50' : 'bg-slate-700'}`}>
                {isLive ? "● LIVE" : "STREAM"}
              </span>
              <h3 className="truncate font-display font-bold text-sm text-white">
                {isLive ? "Official Live Broadcast" : "Official Broadcast Stream"}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {tournamentName} · Streaming on {parsed.providerLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={parsed.directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl bg-white/[0.06] hover:bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-slate-300 border border-white/10 transition cursor-pointer"
            title="Open stream in external browser tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pop Out</span>
          </a>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-red-500/30 transition cursor-pointer"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse live stream player" : "Watch live stream player"}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>{isExpanded ? "Hide Player" : "Watch Stream"}</span>
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Embedded Video Pane (Expanded) */}
      {isExpanded && (
        <div className="relative w-full bg-black animate-in fade-in zoom-in-95 duration-200">
          {parsed.embedUrl ? (
            <div className="relative aspect-video w-full">
              <iframe
                src={parsed.embedUrl}
                title={`${tournamentName} Official Live Stream`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          ) : (
            <div className="p-8 text-center sm:p-12">
              <Tv className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h4 className="font-display font-bold text-base text-white">External Video Stream</h4>
              <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
                This broadcast is hosted externally. Click below to watch the live video stream.
              </p>
              <a
                href={parsed.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-500/40 hover:bg-red-500 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Open Live Video Stream
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default FanLiveStreamPlayer;
