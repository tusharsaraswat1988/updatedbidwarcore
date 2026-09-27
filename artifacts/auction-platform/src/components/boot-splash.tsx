import {
  BRANDING_BOOT_SPLASH_LOGO_PATH,
  withBrandingAssetVersion,
} from "@workspace/api-base/branding-assets";
import { useBranding } from "@/hooks/use-branding";

/** Branded startup loader — matches index.html #bidwar-boot-splash (inline critical CSS). */
export function BootSplash({ label = "Loading BidWar" }: { label?: string }) {
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
    >
      <img
        className="bidwar-boot-logo"
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
      <div className="bidwar-boot-spinner" aria-hidden="true" />
      <div className="bidwar-boot-text">{label}</div>
    </div>
  );
}
