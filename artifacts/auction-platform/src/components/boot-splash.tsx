import {
  BRANDING_BOOT_SPLASH_LOGO_PATH,
  withBrandingAssetVersion,
} from "@workspace/api-base/branding-assets";
import { useBranding } from "@/hooks/use-branding";
import { cn } from "@/lib/utils";

/** Branded startup loader — matches index.html #bidwar-boot-splash (inline critical CSS). */
export function BootSplash({
  label = "Loading...",
  className,
}: {
  label?: string;
  className?: string;
}) {
  const { logos, brandName, iconVersion } = useBranding();
  const fallbackLogo = withBrandingAssetVersion(
    BRANDING_BOOT_SPLASH_LOGO_PATH,
    iconVersion,
  );
  // Prefer Admin Branding: Reverse Logo (dark background) -> Primary Logo -> Splash Logo -> fallback
  const logoSrc =
    logos.mainReverse ||
    logos.main ||
    logos.splash ||
    fallbackLogo;

  return (
    <div
      id="bidwar-boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#07090e] text-white p-6 select-none",
        className,
      )}
    >
      <div className="h-12 sm:h-14 w-auto max-w-[240px] flex items-center justify-center shrink-0">
        <img
          className="bidwar-boot-logo max-h-full max-w-full w-auto object-contain drop-shadow-md"
          src={logoSrc}
          alt={brandName ? `${brandName} logo` : "BidWar logo"}
          height={48}
          decoding="async"
          onError={(e) => {
            if (
              e.currentTarget.src !== fallbackLogo &&
              !e.currentTarget.src.includes("bidwar-reverse-logo")
            ) {
              e.currentTarget.src = "/assets/branding/bidwar-reverse-logo-official.png";
            }
          }}
        />
      </div>
      <div
        className="bidwar-boot-spinner w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-400 animate-spin shrink-0"
        aria-hidden="true"
      />
      <div className="bidwar-boot-text text-xs sm:text-sm font-bold uppercase tracking-[0.25em] text-white/80 font-mono">
        {label}
      </div>
    </div>
  );
}
