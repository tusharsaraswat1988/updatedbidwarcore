import type { CSSProperties, ReactNode } from "react";
import { useBranding } from "@/hooks/use-branding";import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc, getBrandWordmarkSrc } from "@/lib/brand-assets";
import { cn } from "@/lib/utils";

const BIDWAR_HOME_URL = "https://bidwar.in/";

/** Shared BidWar theme tokens for badminton surfaces (organizer + public). */
export function useBadmintonBidWarTheme() {
  const { logos, brandName, colors, fonts, poweredByText, visibility, tagline } = useBranding();

  const rawWordmark = logos.mainReverse || logos.main;
  const logoSrc =
    (rawWordmark && cldUrl(rawWordmark, "brandWordmark")) ||
    rawWordmark ||
    getBrandWordmarkSrc(logos, ["mainReverse", "main"]) ||
    getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const miniSrc =
    cldUrl(logos.mini, "headerLogo") ||
    getBrandWordmarkSrc(logos, ["mainReverse", "main"]) ||
    getBrandLogoSrc(logos, ["mini", "appIcon"]);

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

/** Slim top bar — logo-sized height only; no extra label rows bloating the strip. */
export function BadmintonOrganizerBrandBar({
  className,
}: {
  /** @deprecated Kept for call-site compatibility; unused — scoring has no Auction exit link. */
  tournamentId?: number;
  className?: string;
}) {
  const { brandName, logoSrc, logoAlt } = useBadmintonBidWarTheme();

  return (
    <header
      className={cn(
        "border-b border-border bg-card/95 backdrop-blur-sm",
        className,
      )}
    >
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

/** Wrapper for tournament director / data-entry badminton pages. */
export function BadmintonOrganizerShell({
  children,
  className,
  tournamentId,
}: {
  children: ReactNode;
  className?: string;
  tournamentId?: number;
}) {
  const { shellStyle } = useBadmintonBidWarTheme();

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground antialiased flex flex-col dark relative", className)}
      style={shellStyle}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
      <BadmintonOrganizerBrandBar tournamentId={tournamentId} className="relative z-10" />
      <div className="flex-1 flex flex-col min-h-0 relative z-10">{children}</div>
    </div>
  );
}

/** Court-side / broadcast credit — respects admin “show on viewer” toggle. */
export function BadmintonPublicBrandMark({
  className,
  variant = "watermark",
}: {
  className?: string;
  variant?: "watermark" | "inline" | "overlay" | "pin-screen" | "scorer-header" | "scorer-bar" | "footer";
}) {
  const { showPublicCredit, logoSrc, miniSrc, logoAlt, poweredByText, brandName, primary } =
    useBadmintonBidWarTheme();

  const markLogoSrc = miniSrc || logoSrc;

  if (variant === "scorer-bar") {
    if (!markLogoSrc) {
      return (
        <span
          className={cn(
            "shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/55 whitespace-nowrap",
            className,
          )}
        >
          {poweredByText}
        </span>
      );
    }

    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 shrink-0 rounded-sm",
          "opacity-90 hover:opacity-100 transition-opacity",
          className,
        )}
        aria-label={poweredByText}
      >
        <img
          src={markLogoSrc}
          alt={logoAlt}
          className="block h-6 w-auto max-w-[5rem] object-contain"
          loading="eager"
          decoding="async"
        />
        <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-white/60 leading-none hidden min-[360px]:inline">
          {poweredByText}
        </span>
        <span className="text-[9px] font-bold text-white/60 leading-none min-[360px]:hidden">
          {brandName}
        </span>
      </a>
    );
  }

  if (variant === "scorer-header") {
    if (!showPublicCredit && !markLogoSrc) return null;
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex shrink-0 opacity-35 hover:opacity-55 transition-opacity",
          className,
        )}
        aria-label={brandName}
      >
        <img
          src={markLogoSrc}
          alt={logoAlt}
          className="block h-5 w-auto max-w-[4.5rem] object-contain"
          loading="lazy"
          decoding="async"
        />
      </a>
    );
  }

  if (!showPublicCredit) return null;

  if (variant === "pin-screen") {
    return (
      <div className={cn("flex flex-col items-center gap-3", className)}>
        <a
          href={BIDWAR_HOME_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          aria-label={`${brandName} scoring`}
        >
          <img
            src={markLogoSrc}
            alt={logoAlt}
            className="block w-auto max-h-16 sm:max-h-20 max-w-[min(360px,85vw)] object-contain"
            loading="eager"
            decoding="async"
          />
        </a>
      </div>
    );
  }

  if (variant === "overlay") {
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("inline-flex items-center gap-2.5", className)}
        aria-label={poweredByText}
      >
        <img
          src={markLogoSrc}
          alt={logoAlt}
          className="block w-auto max-h-[6.5rem] sm:max-h-28 max-w-[480px] object-contain"
          loading="lazy"
          decoding="async"
        />
        <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.12em] text-white/45 leading-tight">
          {poweredByText}
        </span>
      </a>
    );
  }

  if (variant === "inline") {
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-black/50 px-4 py-2 backdrop-blur-sm",
          "hover:border-white/25 transition-colors",
          className,
        )}
        aria-label={poweredByText}
      >
        <img
          src={markLogoSrc}
          alt={logoAlt}
          className="block w-auto max-h-9 sm:max-h-10 max-w-[180px] object-contain"
          loading="lazy"
          decoding="async"
        />
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
          {poweredByText}
        </span>
      </a>
    );
  }

  if (variant === "footer") {
    if (!showPublicCredit && !markLogoSrc) return null;
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-2.5 rounded-lg px-2 py-1",
          "hover:opacity-90 transition-opacity",
          className,
        )}
        aria-label={poweredByText}
      >
        {markLogoSrc ? (
          <img
            src={markLogoSrc}
            alt={logoAlt}
            className="block h-7 w-auto max-w-[7rem] object-contain"
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {poweredByText}
        </span>
      </a>
    );
  }

  return (
    <a
      href={BIDWAR_HOME_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "absolute z-30 flex items-center gap-2.5 rounded-full px-4 py-2 sm:px-5 sm:py-2.5",
        "border backdrop-blur-sm pointer-events-auto",
        "hover:opacity-100 opacity-95 transition-opacity",
        "bottom-4 left-4 sm:bottom-5 sm:left-5",
        className,
      )}
      style={{
        borderColor: `${primary}40`,
        backgroundColor: "rgba(0,0,0,0.62)",
        boxShadow: `0 0 24px ${primary}18`,
      }}
      aria-label={poweredByText}
    >
      <img
        src={markLogoSrc}
        alt={logoAlt}
        className="block w-auto max-h-9 sm:max-h-10 max-w-[200px] object-contain"
        loading="lazy"
        decoding="async"
      />
      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white/65 whitespace-nowrap">
        {poweredByText}
      </span>
    </a>
  );
}
