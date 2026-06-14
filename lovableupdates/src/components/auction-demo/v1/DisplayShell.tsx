import { StageFrame } from "./StageFrame";
import { TopStrip } from "./TopStrip";
import { PlayerPortrait } from "./PlayerPortrait";
import { BidCenter } from "./BidCenter";
import { TimerPanel } from "./TimerPanel";
import { BidLadder } from "./BidLadder";
import { ChyronStrip } from "./ChyronStrip";
import { SponsorSpotlight } from "./SponsorSpotlight";
import { EffectsLayer } from "./EffectsLayer";
import { useLedView } from "@/lib/auction-demo/use-auction-state";

/**
 * V1 LED Shell — production-grade broadcast stage.
 *
 * Subscribes once to the production useAuction() via useLedView() and
 * passes pure-presentation props to each zone. No component owns state.
 */
export function DisplayShell() {
  const view = useLedView();

  if (view.loading) {
    return (
      <StageFrame>
        <StandbyScreen
          tone="info"
          tournamentName={view.tournament?.name}
          message="Connecting to live auction"
        />
      </StageFrame>
    );
  }
  if (view.error) {
    return (
      <StageFrame>
        <StandbyScreen
          tone="error"
          tournamentName={view.tournament?.name}
          message={view.error}
        />
      </StageFrame>
    );
  }
  const overlayActive =
    view.derivedState === "teamWise" ||
    view.derivedState === "playerWise" ||
    view.derivedState === "topSold" ||
    view.derivedState === "banner" ||
    view.derivedState === "teamPurse" ||
    view.derivedState === "fortuneWheel" ||
    view.derivedState === "break" ||
    view.derivedState === "preAuction" ||
    view.derivedState === "paused";

  if (!view.currentPlayer && !overlayActive) {
    return (
      <StageFrame>
        <div className="absolute inset-0 grid grid-rows-[8%_1fr_8%] font-['Barlow_Condensed']">
          <TopStrip view={view} />
          <div className="relative min-h-0 h-full w-full">
            <SponsorSpotlight
              tournamentName={view.tournament.name}
              sponsors={view.sponsors ?? []}
            />
          </div>
          <ChyronStrip view={view} />
        </div>
        <EffectsLayer view={view} />
      </StageFrame>
    );
  }

  return (
    <StageFrame>
      {view.currentPlayer ? (
        <div className="absolute inset-0 grid grid-rows-[8%_1fr_12%_8%] font-['Barlow_Condensed']">
          <TopStrip view={view} />
          <div className="grid grid-cols-[28%_1fr_24%] gap-[1.2%] p-[1.5%]">
            <PlayerPortrait view={view} />
            <BidCenter view={view} />
            <TimerPanel view={view} />
          </div>
          <BidLadder view={view} />
          <ChyronStrip view={view} />
        </div>
      ) : (
        <div className="absolute inset-0 grid grid-rows-[8%_1fr_8%] font-['Barlow_Condensed']">
          <TopStrip view={view} />
          <div />
          <ChyronStrip view={view} />
        </div>
      )}
      <EffectsLayer view={view} />
    </StageFrame>
  );
}

/**
 * Full-screen broadcast standby treatment shown while the live snapshot
 * is loading (or in an error state). Replaces the previous black-void +
 * tiny pill so the LED never looks like the feed has died.
 */
function StandbyScreen({
  message,
  tone,
  tournamentName,
}: {
  message: string;
  tone: "info" | "error";
  tournamentName?: string;
}) {
  const accent = tone === "error" ? "rgb(248 113 113)" : "var(--accent)";
  const accentSoft =
    tone === "error" ? "rgba(248,113,113,0.20)" : "color-mix(in oklab, var(--accent) 20%, transparent)";
  const accentGlow =
    tone === "error" ? "rgba(248,113,113,0.50)" : "color-mix(in oklab, var(--accent) 50%, transparent)";
  const statusLabel = tone === "error" ? "Signal Interrupted" : "Establishing Secure Connection";
  const headline = tone === "error" ? "OFFLINE" : "STANDBY";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[#050505] font-['Barlow_Condensed']"
      style={{ animation: "auction-toast-drop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.2) both" }}
    >
      {/* Ambient radial + diagonal grid */}
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, ${accentSoft} 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(0deg, transparent 24%, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.04) 26%, transparent 27%, transparent 74%, rgba(255,255,255,0.04) 75%, rgba(255,255,255,0.04) 76%, transparent 77%)",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Top branding bar */}
      <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-[2.5%]">
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: "var(--accent)" }}
        >
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            BIDWAR
          </span>
          <span
            className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
            style={{ color: "var(--accent-on)" }}
          >
            LIVE
          </span>
        </div>

        <div
          className="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-sm border"
          style={{ borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(0,0,0,0.40)" }}
        >
          <span
            className="size-2 rounded-full"
            style={{
              backgroundColor: accent,
              animation: "auction-pulse-dot 1.2s ease-in-out infinite",
            }}
          />
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-white/60">
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Center: signal bars + STANDBY + message */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-6 flex items-end gap-1">
          {[0.2, 0.4, 1, 0.4, 0.2].map((opacity, i) => (
            <span
              key={i}
              className="w-1"
              style={{
                height: `${[32, 48, 64, 48, 32][i]}px`,
                backgroundColor: accent,
                opacity,
                animation: `auction-pulse-dot 1.4s ease-in-out ${i * 0.12}s infinite`,
              }}
            />
          ))}
        </div>

        <h1 className="font-['Bebas_Neue'] text-7xl md:text-8xl tracking-[0.15em] text-white/95 text-center mb-3">
          {headline}
        </h1>

        <div className="flex items-center gap-4">
          <div className="h-px w-12" style={{ backgroundColor: accentSoft }} />
          <p
            className="uppercase tracking-[0.4em] text-xs font-semibold"
            style={{ color: accent }}
          >
            {message}
          </p>
          <div className="h-px w-12" style={{ backgroundColor: accentSoft }} />
        </div>

        {/* Indeterminate progress bar */}
        <div className="mt-10 w-64 h-[2px] bg-white/5 relative overflow-hidden">
          <div
            className="absolute top-0 left-0 h-full w-1/3"
            style={{
              backgroundColor: accent,
              boxShadow: `0 0 15px ${accentGlow}`,
              animation: "auction-standby-loading 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Bottom decorative info */}
      <div className="absolute bottom-0 left-0 right-0 px-[2.5%] pb-[2%]">
        <div className="flex items-end justify-between border-t border-white/5 pt-3">
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-[0.25em] leading-relaxed">
            <p>Signal Strength: {tone === "error" ? "Lost" : "Optimal"}</p>
            <p>Latency: {tone === "error" ? "—" : "< 40ms"}</p>
          </div>
          <div className="text-[10px] text-white/30 font-mono uppercase tracking-[0.25em] leading-relaxed text-right">
            <p>{tournamentName ?? "Broadcast System"}</p>
            <p>© Bidwar Live</p>
          </div>
        </div>
      </div>

      {/* Subtle CRT scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-50 mix-blend-overlay"
        style={{
          backgroundImage:
            "linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.10) 50%), linear-gradient(90deg, rgba(255,0,0,0.03), rgba(0,255,0,0.01), rgba(0,0,255,0.03))",
          backgroundSize: "100% 4px, 3px 100%",
        }}
      />

      <style>{`
        @keyframes auction-standby-loading {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}


