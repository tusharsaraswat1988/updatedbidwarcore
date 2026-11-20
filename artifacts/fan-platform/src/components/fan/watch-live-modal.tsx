import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tv, ExternalLink, ShieldCheck, Radio, AlertCircle } from "lucide-react";
import { parseStreamEmbed, isTestStreamUrl } from "@/lib/stream-utils";

export interface WatchLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentName: string;
  streamUrl?: string | null;
  isLive?: boolean;
}

export { parseStreamEmbed };

export function WatchLiveModal({
  isOpen,
  onClose,
  tournamentName,
  streamUrl,
  isLive = false,
}: WatchLiveModalProps) {
  const parsed = useMemo(() => parseStreamEmbed(streamUrl), [streamUrl]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white text-slate-900 border-slate-200 dark:bg-slate-950 dark:text-white dark:border-white/10 rounded-3xl shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isLive ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'}`}>
              <Tv className={`h-5 w-5 ${isLive ? 'animate-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm shadow-emerald-500/30">
                    ● Live
                  </span>
                )}
                <DialogTitle className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white truncate">
                  {isLive ? "Official Live Broadcast" : "Official Stream Broadcast"}
                </DialogTitle>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm sm:max-w-md">
                {tournamentName} · Streaming on {parsed.providerLabel}
              </p>
            </div>
          </div>

          {parsed.directUrl && (
            <a
              href={parsed.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/10 dark:text-slate-200 dark:border-white/10 px-3 py-1.5 text-xs font-bold transition"
              title="Pop out in external tab"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Pop Out</span>
            </a>
          )}
        </DialogHeader>

        {/* Video Surface Container */}
        <div className="relative w-full bg-black">
          {parsed.isValid && parsed.embedUrl ? (
            <div className="relative aspect-video w-full">
              <iframe
                src={parsed.embedUrl}
                title={`${tournamentName} Live Stream`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          ) : parsed.isValid && parsed.directUrl ? (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-black">
              <Tv className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-600 mb-3" />
              <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">External Stream Available</h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                This stream is hosted on an external provider. Click below to launch the video player directly.
              </p>
              <a
                href={parsed.directUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/40 hover:bg-emerald-500 transition"
              >
                <ExternalLink className="h-4 w-4" />
                <span>Launch Stream Player</span>
              </a>
            </div>
          ) : (
            <div className="p-8 sm:p-12 text-center bg-white dark:bg-black">
              <AlertCircle className="mx-auto h-12 w-12 text-amber-500/70 mb-3" />
              <h4 className="font-display font-bold text-base text-slate-900 dark:text-white">Stream Currently Unavailable</h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No active live broadcast stream is currently transmitting for this tournament. Please check back when matches or auction bidding commence.
              </p>
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 dark:bg-slate-900 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Organizer-verified broadcast stream</span>
          </div>
          {parsed.directUrl && (
            <a
              href={parsed.directUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 font-semibold inline-flex items-center gap-1"
            >
              <span>Watch on {parsed.providerLabel}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WatchLiveModal;
