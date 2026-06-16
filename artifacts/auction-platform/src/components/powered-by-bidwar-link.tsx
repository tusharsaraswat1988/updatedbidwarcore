import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { ExternalLink } from "lucide-react";

const BIDWAR_HOME_URL = "https://bidwar.in/";

export function PoweredByBidWarLink({ className }: { className?: string }) {
  const { logos, brandName, poweredByText } = useBranding();
  const logoSrc = cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.webp";
  const label = poweredByText?.trim() || "Powered by BidWar";

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
        src={logoSrc}
        alt={brandName}
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
