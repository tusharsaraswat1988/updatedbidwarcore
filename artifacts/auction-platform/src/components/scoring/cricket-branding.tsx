import type { CSSProperties, ReactNode } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc, getBrandWordmarkSrc, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

const BIDWAR_HOME_URL = "https://bidwar.in/";

/** Shared BidWar theme tokens for cricket surfaces (organizer + public). */
export function useCricketBidWarTheme() {
  const { logos, brandName, colors, fonts, poweredByText, visibility, tagline, iconVersion } = useBranding();

  // Cricket broadcast surfaces (OBS overlay masthead, dark scoreboards) use a dark theme.
  // We MUST consistently resolve to the high-contrast white & gold reverse wordmark across ALL devices.
  // Never fall back to square "B" icon (mini/appIcon) or dark primary logo for wordmark positions.
  const rawWordmark = logos.obsWatermark || logos.mainReverse || logos.main;
  const logoSrc =
    (rawWordmark && cldUrl(rawWordmark, "brandWordmark")) ||
    rawWordmark ||
    getBrandWordmarkSrc(logos, ["obsWatermark", "mainReverse"]) ||
    getPublicBrandLogoSrc(["mainReverse", "main"], iconVersion);

  const rawMini = logos.mini || logos.appIcon;
  const miniSrc =
    (rawMini && cldUrl(rawMini, "headerLogo")) ||
    rawMini ||
    getBrandLogoSrc(logos, ["mini", "appIcon"], iconVersion);

  const shellStyle = {
    "--bw-primary": colors.primary,
    "--bw-accent": colors.accent,
    "--bw-heading-font": fonts.heading,
    "--bw-body-font": fonts.body,
  } as CSSProperties;

  return {
    brandName,
    tagline,
    poweredByText: poweredByText?.trim() || "Powered by BidWar",
    showPublicCredit: visibility.showPoweredByViewer,
    logoSrc,
    miniSrc,
    logoAlt: getBrandLogoAlt(brandName),
    shellStyle,
    primary: colors.primary,
    accent: colors.accent,
  };
}

export function CricketOrganizerBrandBar({
  className,
}: {
  tournamentId?: number;
  className?: string;
}) {
  const { brandName, logoSrc, logoAlt } = useCricketBidWarTheme();

  return (
    <header className={cn("border-b border-border bg-card/95 backdrop-blur-sm", className)}>
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-3 min-h-0">
        <a
          href={BIDWAR_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center shrink-0 leading-none rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`${brandName} — opens home page in a new tab`}
        >
          <img
            src={logoSrc}
            alt={logoAlt}
            className="block h-[1.8rem] sm:h-8 md:h-[2.4rem] w-auto max-w-[min(288px,35vw)] object-contain object-left"
            loading="eager"
            decoding="async"
          />
        </a>
      </div>
    </header>
  );
}

export function CricketOrganizerShell({
  children,
  className,
  tournamentId,
}: {
  children: ReactNode;
  className?: string;
  tournamentId?: number;
}) {
  const { shellStyle } = useCricketBidWarTheme();

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground antialiased flex flex-col dark relative", className)}
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
      <CricketOrganizerBrandBar tournamentId={tournamentId} className="relative z-10" />
      <div className="flex-1 flex flex-col min-h-0 relative z-10">{children}</div>
    </div>
  );
}

export function CricketPublicBrandMark({
  className,
  variant = "watermark",
}: {
  className?: string;
  variant?: "watermark" | "inline" | "overlay" | "pin-screen" | "scorer-header" | "scorer-bar" | "footer";
}) {
  const { showPublicCredit, logoSrc, miniSrc, logoAlt, poweredByText } = useCricketBidWarTheme();
  const markLogoSrc = miniSrc || logoSrc;

  if (variant === "scorer-bar") {
    if (!markLogoSrc) {
      return (
        <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/55 whitespace-nowrap", className)}>
          {poweredByText}
        </span>
      );
    }
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex items-center gap-1.5 shrink-0 rounded-sm opacity-90 hover:opacity-100 transition-opacity", className)}
        aria-label={poweredByText}
      >
        <img src={markLogoSrc} alt={logoAlt} className="block h-7 w-auto max-w-[6.5rem] object-contain" loading="eager" />
      </a>
    );
  }

  if (!showPublicCredit && variant === "watermark") return null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {markLogoSrc ? (
        <img src={markLogoSrc} alt={logoAlt} className="h-6 w-auto object-contain opacity-80" loading="lazy" />
      ) : (
        <span className="text-xs text-muted-foreground">{poweredByText}</span>
      )}
    </div>
  );
}
