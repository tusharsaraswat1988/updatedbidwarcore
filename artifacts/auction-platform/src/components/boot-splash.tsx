import {
  BRANDING_BOOT_SPLASH_ICON_PATH,
  withBrandingAssetVersion,
} from "@workspace/api-base/branding-assets";
import { useBranding } from "@/hooks/use-branding";

/** Branded startup loader — matches index.html #bidwar-boot-splash (inline critical CSS). */
export function BootSplash({ label = "Loading BidWar" }: { label?: string }) {
  const { iconVersion } = useBranding();
  const logoSrc = withBrandingAssetVersion(BRANDING_BOOT_SPLASH_ICON_PATH, iconVersion);

  return (
    <div
      id="bidwar-boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <img src={logoSrc} alt="" width={64} height={64} decoding="async" />
      <div className="bidwar-boot-spinner" aria-hidden="true" />
    </div>
  );
}
