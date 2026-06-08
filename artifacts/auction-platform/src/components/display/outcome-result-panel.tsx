import { memo } from "react";
import { User } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";

export type OutcomeResultData = {
  outcome: "sold" | "unsold";
  playerName: string;
  photoUrl?: string | null;
  amount?: number;
  teamName?: string;
  teamColor?: string;
  teamLogoUrl?: string | null;
  basePrice?: number;
  role?: string | null;
  city?: string | null;
  age?: number | null;
};

const SOLD_ACCENT = "#22c55e";
const UNSOLD_ACCENT = "#ef4444";

/**
 * Shared sold/unsold result card — consistent visual language across
 * Public Viewer (compact) and Broadcast Overlay (banner row). LED uses full-screen
 * SoldCard/UnsoldCard but shares the same colour tokens.
 */
export const OutcomeResultPanel = memo(function OutcomeResultPanel({
  data,
  layout,
  className = "",
}: {
  data: OutcomeResultData;
  layout: "viewer" | "obs-banner";
  className?: string;
}) {
  const isSold = data.outcome === "sold";
  const accent = isSold ? (data.teamColor || SOLD_ACCENT) : UNSOLD_ACCENT;

  if (layout === "obs-banner") {
    return (
      <div
        className={`flex items-center gap-6 w-full ${className}`}
        style={{
          background: `linear-gradient(135deg, rgba(0,0,0,0.97) 0%, ${accent}28 100%)`,
        }}
      >
        <div
          className="font-display font-black uppercase tracking-widest flex-shrink-0"
          style={{ fontSize: 72, color: accent, textShadow: `0 0 40px ${accent}` }}
        >
          {isSold ? "SOLD" : "UNSOLD"}
        </div>
        <div
          className="w-[140px] h-[150px] rounded-2xl border-4 overflow-hidden flex-shrink-0 flex items-center justify-center"
          style={{ borderColor: accent, boxShadow: `0 0 40px ${accent}55` }}
        >
          {data.photoUrl ? (
            <img
              src={cldUrl(data.photoUrl, "soldCard")}
              alt={data.playerName}
              className={`w-full h-full object-cover ${isSold ? "" : "grayscale"}`}
            />
          ) : (
            <User className="w-16 h-16 text-white/20" />
          )}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-bold uppercase tracking-[0.3em] mb-1" style={{ color: accent }}>
            {isSold ? "SOLD" : "UNSOLD"}
          </p>
          <p className="font-display font-black text-5xl text-white truncate leading-none mb-2">
            {data.playerName}
          </p>
          <p className="text-lg text-white/70">
            {isSold ? `acquired by ${data.teamName || "Team"}` : "returns to the player pool"}
          </p>
        </div>
        <div className="text-right flex-shrink-0 pr-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">
            {isSold ? "SOLD FOR" : "RESULT"}
          </p>
          <p
            className="font-display font-black leading-none"
            style={{ fontSize: 64, color: accent, filter: `drop-shadow(0 0 20px ${accent})` }}
          >
            {isSold ? formatIndianRupee(data.amount ?? 0) : "UNSOLD"}
          </p>
          {isSold && data.teamLogoUrl ? (
            <img
              src={cldUrl(data.teamLogoUrl, "teamLogo")}
              alt=""
              className="h-10 mt-2 ml-auto object-contain"
            />
          ) : null}
        </div>
      </div>
    );
  }

  // viewer — compact frozen card between live players
  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl backdrop-blur border ${className}`}
      style={{
        backgroundColor: isSold ? `${accent}10` : "rgba(239,68,68,0.06)",
        borderColor: isSold ? `${accent}45` : "rgba(239,68,68,0.3)",
      }}
    >
      <div className="flex flex-row items-start gap-4">
        <div className="relative flex-shrink-0">
          <div
            className="w-24 h-32 sm:w-32 sm:h-40 rounded-2xl overflow-hidden border-2 flex items-center justify-center bg-card shadow-xl"
            style={{ borderColor: isSold ? `${accent}55` : "rgba(239,68,68,0.4)" }}
          >
            {data.photoUrl ? (
              <img
                src={cldUrl(data.photoUrl, "soldCard")}
                alt={data.playerName}
                className={`w-full h-full object-cover ${isSold ? "" : "grayscale"}`}
              />
            ) : (
              <User className="w-14 h-14 text-muted-foreground/25" />
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`font-display font-black text-xl px-4 py-2 rounded-lg border-4 border-white/40 shadow-2xl ${
                isSold ? "bg-green-600/90 text-white" : "bg-red-700/90 text-white"
              }`}
              style={{ transform: "rotate(-12deg)" }}
            >
              {isSold ? "SOLD" : "UNSOLD"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-left space-y-3">
          <div>
            <h2 className="font-display font-black text-3xl sm:text-4xl leading-none">
              {data.playerName}
            </h2>
            {(data.role || data.city || data.age) ? (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[data.role, data.city, data.age ? `Age ${data.age}` : null]
                  .filter((v): v is string => !!v)
                  .map((spec, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full bg-border/25 text-muted-foreground border border-border/40"
                    >
                      {spec}
                    </span>
                  ))}
              </div>
            ) : null}
            {data.basePrice != null && data.basePrice > 0 ? (
              <p className="text-xs text-muted-foreground mt-1.5">
                Base: {formatIndianRupee(data.basePrice)}
              </p>
            ) : null}
          </div>

          {isSold ? (
            <>
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  Sold at
                </p>
                <p
                  className="font-display font-black text-5xl sm:text-6xl leading-none"
                  style={{ color: accent, textShadow: `0 0 28px ${accent}55` }}
                >
                  {formatIndianRupee(data.amount ?? 0)}
                </p>
              </div>
              {data.teamName ? (
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold"
                  style={{
                    borderColor: `${accent}55`,
                    backgroundColor: `${accent}15`,
                    color: accent,
                  }}
                >
                  {data.teamLogoUrl ? (
                    <img
                      src={cldUrl(data.teamLogoUrl, "teamLogo")}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                    />
                  ) : null}
                  Sold to {data.teamName}
                </span>
              ) : null}
            </>
          ) : (
            <div className="px-4 py-3 rounded-xl border border-red-500/35 bg-red-500/10">
              <p className="text-[10px] font-semibold text-red-300/80 uppercase tracking-widest mb-0.5">
                Auction result
              </p>
              <p className="font-display font-black text-2xl text-red-300 leading-none">
                Returns to pool
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
