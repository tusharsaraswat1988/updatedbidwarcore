import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { cldUrl } from "@/lib/cloudinary";
import { getSponsorsByPriority, parseSponsorLogos, type SponsorLogo } from "@/lib/sponsor-logo";
import { PoweredByBidWarLink } from "@/components/powered-by-bidwar-link";

function RegistrationSponsors({ logos }: { logos: SponsorLogo[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (logos.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % logos.length);
        setVisible(true);
      }, 300);
    }, 3500);
    return () => clearInterval(id);
  }, [logos.length]);

  if (!logos.length) {
    return <div className="w-12 sm:w-14 shrink-0" aria-hidden />;
  }

  const current = logos[idx];
  const label = current.name?.trim() || current.type?.trim() || "Sponsor";

  return (
    <div className="flex flex-col items-end min-w-0 max-w-[132px] sm:max-w-[168px]">
      {current.type?.trim() ? (
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400/80 text-right truncate w-full">
          {current.type}
        </p>
      ) : null}
      <div
        className="flex items-center justify-end transition-opacity duration-300 my-0.5"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <img
          key={current.url}
          src={cldUrl(current.url, "teamLogo")}
          alt={label}
          className="h-10 sm:h-12 max-w-full object-contain"
          loading="lazy"
          decoding="async"
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      </div>
      {current.name?.trim() ? (
        <p className="text-[10px] sm:text-[11px] font-semibold text-white/90 text-right truncate w-full leading-tight">
          {current.name}
        </p>
      ) : null}
      {logos.length > 1 ? (
        <div className="flex gap-1 justify-end mt-1">
          {logos.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{ backgroundColor: i === idx ? "#fbbf24" : "#ffffff30" }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type RegistrationPageHeaderProps = {
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  sponsorLogosJson?: string | null;
  brandNameFallback?: string;
};

export function RegistrationPageHeader({
  tournamentName,
  tournamentLogoUrl,
  sponsorLogosJson,
  brandNameFallback = "BidWar",
}: RegistrationPageHeaderProps) {
  const sponsorLogos = useMemo(
    () => getSponsorsByPriority(parseSponsorLogos(sponsorLogosJson)),
    [sponsorLogosJson],
  );

  return (
    <div className="mb-6 sm:mb-8">
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3 mb-5 sm:mb-6">
        <div className="flex justify-start min-w-0">
          {tournamentLogoUrl ? (
            <img
              src={tournamentLogoUrl}
              alt={tournamentName ?? "Tournament logo"}
              className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-xl border border-white/10 bg-white/[0.03]"
            />
          ) : (
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl border border-white/10 bg-white/[0.03] flex items-center justify-center">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
            </div>
          )}
        </div>

        <div className="flex justify-center px-1">
          <PoweredByBidWarLink variant="headerLogo" />
        </div>

        <div className="flex justify-end min-w-0">
          <RegistrationSponsors logos={sponsorLogos} />
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-display font-black text-white leading-tight px-1">
          {tournamentName || brandNameFallback}
        </h1>
        <p className="text-muted-foreground mt-1">Player Registration</p>
      </div>
    </div>
  );
}
