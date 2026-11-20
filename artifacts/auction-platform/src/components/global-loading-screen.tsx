import { useState, useEffect } from "react";
import {
  BRANDING_BOOT_SPLASH_LOGO_PATH,
  withBrandingAssetVersion,
} from "@workspace/api-base/branding-assets";
import { useBranding } from "@/hooks/use-branding";
import { isOrganizerRoute, isAdminRoute } from "@/lib/portal-theme";
import { cn } from "@/lib/utils";

export interface GlobalLoadingScreenProps {
  /** Optional understated loading label (e.g. "Loading...", "Verifying access..."). Omit or pass null to hide. */
  label?: string | null;
  /** Additional CSS class names. */
  className?: string;
  /** Force theme, or "auto" to detect from current route / surface / system preference. */
  theme?: "dark" | "light" | "auto";
  /** If false, fills parent container instead of fixed/viewport fullscreen. Defaults to true. */
  fullScreen?: boolean;
}

/**
 * Resolves whether the active context should be rendered in light mode.
 *
 * Precedence Order:
 * 1. Explicit theme override (`theme="light"` / `theme="dark"`).
 * 2. Persisted application theme (`localStorage.getItem("bidwar_theme")` / `"theme"`).
 * 3. Actual DOM state on `<html>` or `<body>` (`data-theme`, `data-surface`, `.light`, `.dark`, `.bw-organizer-light`, `.bw-admin-dark`).
 * 4. Route-based detection used strictly as a fallback when actual theme state is indeterminate.
 * 5. Operating system preference (`prefers-color-scheme: light`).
 * 6. Default to dark mode.
 */
export function resolveIsLightTheme(themeProp: "dark" | "light" | "auto" = "auto"): boolean {
  // 1. Explicit theme override takes absolute precedence
  if (themeProp === "light") return true;
  if (themeProp === "dark") return false;
  if (typeof window === "undefined") return false;

  const path = window.location.pathname;

  // 2. Protected route architecture contracts:
  // Organizer routes are mandatory light enterprise workspace by design
  if (isOrganizerRoute(path)) return true;
  if (isAdminRoute(path)) return false;

  // 3. Fan routes respect explicit fan preference stored in localStorage
  if (path.includes("/fan")) {
    try {
      const fanTheme =
        localStorage.getItem("bidwar_fan_theme") ||
        localStorage.getItem("bidwar_theme") ||
        localStorage.getItem("theme");
      if (fanTheme === "light") return true;
      if (fanTheme === "dark") return false;
    } catch {}
  }

  // 4. Actual active DOM state on html/body (attributes or classes)
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    const body = document.body;

    const dataTheme = root.getAttribute("data-theme") || body?.getAttribute("data-theme");
    if (dataTheme === "light") return true;
    if (dataTheme === "dark") return false;

    if (
      root.classList.contains("bw-organizer-light") ||
      body?.classList.contains("bw-organizer-light") ||
      root.getAttribute("data-surface") === "organizer" ||
      body?.getAttribute("data-surface") === "organizer" ||
      root.classList.contains("light") ||
      body?.classList.contains("light")
    ) {
      return true;
    }

    if (
      root.classList.contains("bw-admin-dark") ||
      body?.classList.contains("bw-admin-dark") ||
      root.getAttribute("data-surface") === "admin" ||
      body?.getAttribute("data-surface") === "admin" ||
      root.classList.contains("dark") ||
      body?.classList.contains("dark")
    ) {
      return false;
    }
  }

  // 5. Persisted application theme in storage
  try {
    const persisted = localStorage.getItem("bidwar_theme") || localStorage.getItem("theme");
    if (persisted === "light") return true;
    if (persisted === "dark") return false;
  } catch {}

  // 6. Operating system preference fallback
  if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return true;
  }

  return false;
}

const STATIC_FALLBACK_PRIMARY = "/assets/branding/bidwar-clean-logo-v2-dark.png";
const STATIC_FALLBACK_REVERSE = "/assets/branding/bidwar-reverse-logo-official.png";
const FALLBACK_PRIMARY = "/bidwar-primary-logo.png";
const FALLBACK_REVERSE = "/bidwar-reverse-logo.png";

/**
 * GlobalLoadingScreen
 *
 * BidWar canonical, premium, theme-aware global loading experience.
 * Features:
 * - Visually calm, elegant, brand-consistent presentation.
 * - Perfectly responsive: desktop, laptop, tablet, mobile, small mobile.
 * - Theme-aware: automatic light (off-white #F8FAFC) vs dark (deep navy #080B14) switching.
 * - Theme-matched BidWar logo: Reverse logo for dark mode, Primary logo for light mode.
 * - Thin BidWar-gold circular rotating stroke.
 * - Subtle ambient radial glow.
 * - Supports prefers-reduced-motion and semantic accessibility standards.
 */
export function GlobalLoadingScreen({
  label = "Loading...",
  className,
  theme = "auto",
  fullScreen = true,
}: GlobalLoadingScreenProps) {
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">(() =>
    resolveIsLightTheme(theme) ? "light" : "dark",
  );

  useEffect(() => {
    const updateTheme = () => {
      setActiveTheme(resolveIsLightTheme(theme) ? "light" : "dark");
    };
    updateTheme();

    if (theme === "auto" && typeof window !== "undefined" && window.MutationObserver) {
      const observer = new MutationObserver(updateTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme", "data-surface"],
      });
      if (document.body) {
        observer.observe(document.body, {
          attributes: true,
          attributeFilter: ["class", "data-theme", "data-surface"],
        });
      }
      return () => observer.disconnect();
    }
  }, [theme]);

  const isLight = activeTheme === "light";
  const { logos, brandName, iconVersion } = useBranding();

  // Pick canonical theme-matched logo with immediate local fallback
  const versionedFallback = withBrandingAssetVersion(
    isLight ? STATIC_FALLBACK_PRIMARY : (BRANDING_BOOT_SPLASH_LOGO_PATH || STATIC_FALLBACK_REVERSE),
    iconVersion,
  );

  const preferredLogo = isLight
    ? logos.main || STATIC_FALLBACK_PRIMARY || FALLBACK_PRIMARY
    : logos.mainReverse || STATIC_FALLBACK_REVERSE || logos.splash || versionedFallback;

  const [currentLogoSrc, setCurrentLogoSrc] = useState<string>(preferredLogo);
  const [hasErrorFallback, setHasErrorFallback] = useState(false);

  useEffect(() => {
    setCurrentLogoSrc(preferredLogo);
    setHasErrorFallback(false);
  }, [preferredLogo, isLight]);

  const handleImageError = () => {
    if (!hasErrorFallback) {
      setHasErrorFallback(true);
      setCurrentLogoSrc(isLight ? FALLBACK_PRIMARY : FALLBACK_REVERSE);
    }
  };

  return (
    <div
      id="bidwar-global-loader"
      data-surface={isLight ? "organizer" : undefined}
      data-theme={activeTheme}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label || "Loading"}
      className={cn(
        "w-full flex flex-col items-center justify-center p-6 select-none relative overflow-hidden overscroll-none",
        fullScreen ? "min-h-[100dvh] fixed inset-0 z-50" : "min-h-full py-12",
        isLight
          ? "bw-organizer-light text-[#0F172A]"
          : "text-white",
        className,
      )}
      style={{
        backgroundColor: isLight ? "#F8FAFC" : "#080B14",
        color: isLight ? "#0F172A" : "#FFFFFF",
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
        paddingLeft: "max(1.5rem, env(safe-area-inset-left))",
        paddingRight: "max(1.5rem, env(safe-area-inset-right))",
      }}
    >
      {/* Extremely subtle ambient background glow */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          isLight
            ? "bg-[radial-gradient(ellipse_at_50%_48%,rgba(245,158,11,0.04)_0%,rgba(248,250,252,0)_65%)]"
            : "bg-[radial-gradient(ellipse_at_50%_48%,rgba(245,158,11,0.06)_0%,rgba(8,11,20,0)_70%)]",
        )}
        aria-hidden="true"
      />

      {/* Main content stack */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-5 sm:gap-6 w-full max-w-xs px-4">
        {/* BidWar Brand Logo with smooth entrance */}
        <div className="bw-loader-logo-wrap h-10 sm:h-12 md:h-14 w-auto max-w-[190px] sm:max-w-[230px] md:max-w-[270px] flex items-center justify-center shrink-0">
          <img
            key={`${currentLogoSrc}-${activeTheme}`}
            className={cn(
              "bw-loader-logo max-h-full max-w-full w-auto object-contain transition-transform duration-300",
              isLight
                ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
            )}
            src={currentLogoSrc}
            alt={brandName ? `${brandName} logo` : "BidWar logo"}
            height={48}
            decoding="async"
            onError={handleImageError}
          />
        </div>

        {/* Refined BidWar-gold rotating indicator */}
        <div
          className={cn(
            "bw-loader-spinner w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 shrink-0 transition-all duration-300",
            isLight
              ? "border-amber-500/20 border-t-amber-500 border-r-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.18)]"
              : "border-amber-500/25 border-t-amber-400 border-r-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.25)]",
          )}
          aria-hidden="true"
        />

        {/* Small, understated loading label (optional) */}
        {label && (
          <div
            className={cn(
              "bw-loader-label text-[10px] sm:text-[11px] font-medium uppercase tracking-[0.22em] font-mono select-none text-center transition-colors duration-300",
              isLight ? "text-slate-500/90" : "text-slate-400/80",
            )}
          >
            {label}
          </div>
        )}
      </div>

      {/* Lightweight self-contained animation styles with reduced-motion support */}
      <style>{`
        @keyframes bwLoaderFadeScale {
          0% {
            opacity: 0;
            transform: scale(0.96);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes bwGoldSpin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        .bw-loader-logo {
          animation: bwLoaderFadeScale 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: opacity, transform;
        }
        .bw-loader-spinner {
          animation: bwGoldSpin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .bw-loader-logo,
          .bw-loader-spinner {
            animation: none !important;
            transition: none !important;
          }
          .bw-loader-spinner {
            border-color: rgba(245, 158, 11, 0.6) !important;
          }
        }
      `}</style>
    </div>
  );
}

export default GlobalLoadingScreen;
