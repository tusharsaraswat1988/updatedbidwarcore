import { useState, useEffect, useCallback } from "react";
import { useBranding } from "@/hooks/use-branding";
import { ExternalLink } from "lucide-react";
import { BRAND_ICON_PLACEHOLDER, getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const registrationHeaderPreset = getBrandSurfacePreset("registration-header");

const BIDWAR_HOME_URL = "https://bidwar.in/";

type PoweredByBidWarLinkProps = {
  className?: string;
  variant?: "default" | "footer" | "headerLogo";
};

function useResilientBrandLogo(order: Array<"main" | "mainReverse" | "mini" | "appIcon">) {
  const { logos } = useBranding();
  const primary = getBrandLogoSrc(logos, order);
  const [src, setSrc] = useState(primary);

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  const onError = useCallback(() => {
    setSrc(BRAND_ICON_PLACEHOLDER);
  }, []);

  return { src, onError };
}

export function PoweredByBidWarLink({ className, variant = "default" }: PoweredByBidWarLinkProps) {
  const { brandName, poweredByText } = useBranding();
  const headerLogo = useResilientBrandLogo(registrationHeaderPreset.logoOrder);
  const defaultLogo = useResilientBrandLogo(["mainReverse", "main", "mini", "appIcon"]);
  const logoAlt = getBrandLogoAlt(brandName);
  const label = poweredByText?.trim() || "Powered by BidWar";

  if (variant === "headerLogo") {
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${brandName} — opens home page in a new tab`}
        className={[
          "group inline-flex items-center justify-center px-1 py-0.5",
          "transition-all duration-300",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <img
          src={headerLogo.src}
          alt={logoAlt}
          onError={headerLogo.onError}
          className={`${registrationHeaderPreset.sizeClass} transition-all duration-300 group-hover:opacity-95 group-hover:scale-105`}
          loading="lazy"
          decoding="async"
        />
      </a>
    );
  }

  if (variant === "footer") {
    return (
      <a
        href={BIDWAR_HOME_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} — opens BidWar home page in a new tab`}
        className={[
          "inline-block text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em]",
          "text-muted-foreground/60 text-center leading-tight",
          "transition-colors duration-300 hover:text-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </a>
    );
  }

  return (
    <a
      href={BIDWAR_HOME_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — opens BidWar home page in a new tab`}
      className={[
        "group inline-flex flex-col items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-3",
        "transition-all duration-300",
        "hover:border-primary/30 hover:bg-white/[0.05] hover:shadow-[0_0_28px_rgba(251,191,36,0.1)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <img
        src={defaultLogo.src}
        alt={logoAlt}
        onError={defaultLogo.onError}
        className="h-6 w-auto opacity-40 transition-all duration-300 group-hover:opacity-90 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50 transition-colors duration-300 group-hover:text-primary/90">
        {label}
        <ExternalLink
          className="h-3 w-3 opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-70 group-hover:translate-x-0"
          aria-hidden
        />
      </span>
    </a>
  );
}
