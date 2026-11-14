import {
  BRANDING_BOOT_SPLASH_LOGO_PATH,
  withBrandingAssetVersion,
} from "@workspace/api-base/branding-assets";
import { useBranding } from "@/hooks/use-branding";
import { isOrganizerRoute } from "@/lib/portal-theme";
import { cn } from "@/lib/utils";

/** Branded startup loader — matches index.html #bidwar-boot-splash (inline critical CSS). */
export function BootSplash({
  label = "Loading...",
  className,
  theme = "auto",
}: {
  label?: string;
  className?: string;
  theme?: "dark" | "light" | "auto";
}) {
  const isLight =
    theme === "light" ||
    (theme === "auto" && typeof window !== "undefined" && isOrganizerRoute());

  const { logos, brandName, iconVersion } = useBranding();
  const fallbackLogo = withBrandingAssetVersion(
    BRANDING_BOOT_SPLASH_LOGO_PATH,
    iconVersion,
  );

  // In light theme: use primary dark-text logo (logos.main || logos.splash || fallbackLogo).
  // In dark theme: prefer reverse logo (logos.mainReverse || logos.main || ...).
  const logoSrc = isLight
    ? logos.main || logos.splash || fallbackLogo
    : logos.mainReverse || logos.main || logos.splash || fallbackLogo;

  return (
    <div
      id="bidwar-boot-splash"
      data-surface={isLight ? "organizer" : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "min-h-screen w-full flex flex-col items-center justify-center gap-4 p-6 select-none",
        isLight
          ? "bw-organizer-light bg-[#F8FAFC] text-[#0F172A]"
          : "bg-[#07090e] text-white",
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
            if (isLight) {
              if (e.currentTarget.src !== fallbackLogo && !e.currentTarget.src.includes("bidwar-logo")) {
                e.currentTarget.src = "/bidwar-logo.png";
              }
            } else {
              if (
                e.currentTarget.src !== fallbackLogo &&
                !e.currentTarget.src.includes("bidwar-reverse-logo")
              ) {
                e.currentTarget.src = "/assets/branding/bidwar-reverse-logo-official.png";
              }
            }
          }}
        />
      </div>
      <div
        className={cn(
          "bidwar-boot-spinner w-8 h-8 rounded-full border-2 animate-spin shrink-0",
          isLight
            ? "border-amber-500/30 border-t-amber-500"
            : "border-amber-500/30 border-t-amber-400",
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "bidwar-boot-text text-xs sm:text-sm font-bold uppercase tracking-[0.25em] font-mono",
          isLight ? "text-slate-600" : "text-white/80",
        )}
      >
        {label}
      </div>
    </div>
  );
}
