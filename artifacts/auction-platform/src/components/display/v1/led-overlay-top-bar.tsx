import { memo, type ReactNode } from "react";
import { cldUrl } from "@/lib/cloudinary";
import {
  LED_HEADLINE_CLASS,
  LED_META_LABEL_CLASS,
  LED_STAGE_FONT_CLASS,
} from "@/lib/led-display-typography";
import { LedTopBrandMark } from "./led-top-brand-mark";
import { TrialLicenseBadge } from "@/components/trial-license-badge";

/** Matches TopStrip row height so overlay ↔ live scene switches keep logo fixed. */
export const LED_TOP_ROW_HEIGHT_CLASS = "min-h-[5.2cqh] max-h-[5.2cqh]";

const TOP_BAR_SHELL_CLASS = `relative grid h-full ${LED_TOP_ROW_HEIGHT_CLASS} grid-cols-[1fr_auto_1fr] items-center gap-[1.7cqw] overflow-visible px-[3%] border-b border-white/10 bg-black/40 ${LED_STAGE_FONT_CLASS}`;

function LedTournamentBlock({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-[1.1cqw] min-w-0 max-h-[4.8cqh]">
      {logoUrl ? (
        <img
          src={cldUrl(logoUrl, "headerLogo")}
          alt=""
          className="h-[5.6cqh] w-auto max-w-[9cqw] shrink-0 object-contain"
          loading="eager"
          decoding="async"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <div className="flex min-w-0 flex-col justify-center leading-none">
        <span className={`${LED_META_LABEL_CLASS} text-white/45`}>
          Tournament
        </span>
        <span className={`mt-0.5 truncate ${LED_HEADLINE_CLASS} text-xl text-white/95 md:text-2xl`}>
          {name}
        </span>
      </div>
    </div>
  );
}

/**
 * Overlay top bar — same geometry as TopStrip (center OBS crest, tournament left).
 */
export const LedOverlayTopBar = memo(function LedOverlayTopBar({
  tournamentName,
  tournamentLogoUrl,
  isTrial = false,
  right,
  className = "",
  barClassName = "",
}: {
  tournamentName: string;
  tournamentLogoUrl?: string | null;
  isTrial?: boolean;
  right?: ReactNode;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className={`${TOP_BAR_SHELL_CLASS} ${barClassName}`}>
        <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2">
          <LedTopBrandMark />
        </div>

        <div className="col-start-1 flex items-center gap-3 min-w-0 justify-self-start">
          <div className="hidden @md/stage:flex min-w-0">
            <LedTournamentBlock name={tournamentName} logoUrl={tournamentLogoUrl} />
          </div>
        </div>

        <div
          aria-hidden
          className="col-start-2 w-[min(11.5cqw,18cqw)] shrink-0"
        />

        {right || isTrial ? (
          <div className="col-start-3 flex items-center justify-end gap-3 justify-self-end min-w-0 text-right">
            {isTrial ? <TrialLicenseBadge size="led" /> : null}
            {right}
          </div>
        ) : (
          <div aria-hidden className="col-start-3" />
        )}
      </div>
    </div>
  );
});
