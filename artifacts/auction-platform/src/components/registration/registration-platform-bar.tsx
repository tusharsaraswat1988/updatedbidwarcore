import { useMemo, useState, useCallback } from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, isBrandLogoPlaceholderSrc } from "@/lib/brand-assets";

const BIDWAR_HOME_URL = "https://bidwar.in/";
const FALLBACK_LOGO_SRC = "/assets/branding/bidwar-clean-logo-v2.png";

/**
 * Dedicated top platform header for public player registration.
 * Ensures BidWar maintains an authoritative, prominent platform identity
 * completely independent from tournament branding and logos.
 */
export function RegistrationPlatformBar() {
  const { brandName, logos } = useBranding();

  const initialLogoSrc = useMemo(() => {
    const candidates = [logos.main, logos.mainReverse, logos.mini];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return FALLBACK_LOGO_SRC;
  }, [logos]);

  const [currentLogoSrc, setCurrentLogoSrc] = useState(initialLogoSrc);

  const handleError = useCallback(() => {
    setCurrentLogoSrc(FALLBACK_LOGO_SRC);
  }, []);

  const logoAlt = getBrandLogoAlt(brandName) || "BidWar";

  return (
    <header className="reg-platform-bar" role="banner">
      <div className="reg-platform-bar-inner">
        <div className="reg-platform-brand">
          <a
            href={BIDWAR_HOME_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${brandName || "BidWar"} — opens official homepage in a new tab`}
            title={`${brandName || "BidWar"} — Official Platform`}
            className="reg-platform-logo-link"
          >
            <img
              src={currentLogoSrc}
              alt={logoAlt}
              onError={handleError}
              className="reg-platform-logo"
              loading="eager"
              decoding="async"
            />
          </a>
          <span className="reg-platform-divider" aria-hidden="true" />
          <span className="reg-platform-portal-label">Player Registration Portal</span>
        </div>

        <div className="reg-platform-actions">
          <div className="reg-platform-verified">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline font-medium">Verified Tournament</span>
            <span className="sm:hidden font-medium">Verified</span>
          </div>
          <a
            href={BIDWAR_HOME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="reg-platform-home-link"
            title="Visit BidWar Platform"
          >
            <span>bidwar.in</span>
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden="true" />
          </a>
        </div>
      </div>
    </header>
  );
}
