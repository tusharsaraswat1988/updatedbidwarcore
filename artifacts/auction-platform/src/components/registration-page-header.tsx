import { useEffect, useMemo, useState } from "react";
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

  if (!logos.length) return null;

  const current = logos[idx];
  const label = current.name?.trim() || current.type?.trim() || "Sponsor";

  return (
    <div className="reg-sponsor">
      {current.type?.trim() ? <p className="reg-sponsor-type">{current.type}</p> : null}
      <div style={{ opacity: visible ? 1 : 0, transition: "opacity 300ms" }}>
        <img
          key={current.url}
          src={cldUrl(current.url, "teamLogo")}
          alt={label}
          loading="lazy"
          decoding="async"
          onError={e => { e.currentTarget.style.display = "none"; }}
        />
      </div>
      {current.name?.trim() ? <p className="reg-sponsor-name">{current.name}</p> : null}
      {logos.length > 1 ? (
        <div className="reg-sponsor-dots" aria-hidden="true">
          {logos.map((_, i) => (
            <span key={i} data-active={i === idx ? "true" : "false"} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export type RegistrationHeaderFact = {
  label: string;
  value: string;
};

type RegistrationPageHeaderProps = {
  tournamentName?: string;
  tournamentLogoUrl?: string | null;
  sponsorLogosJson?: string | null;
  brandNameFallback?: string;
  registeredCount?: number;
  registrationLimit?: number | null;
  subtitle?: string;
  tagline?: string;
  facts?: RegistrationHeaderFact[];
};

function capacityFact(
  registeredCount: number | undefined,
  registrationLimit: number | null | undefined,
): RegistrationHeaderFact | null {
  if (registeredCount == null) return null;
  if (registrationLimit == null) {
    return {
      label: "Registered",
      value: `${registeredCount} player${registeredCount === 1 ? "" : "s"}`,
    };
  }
  const remaining = Math.max(0, registrationLimit - registeredCount);
  return {
    label: "Capacity",
    value: `${registeredCount} of ${registrationLimit} registered · ${remaining} slot${remaining === 1 ? "" : "s"} left`,
  };
}

export function RegistrationPageHeader({
  tournamentName,
  tournamentLogoUrl,
  sponsorLogosJson,
  brandNameFallback = "BidWar",
  registeredCount,
  registrationLimit,
  subtitle = "Player Registration",
  tagline,
  facts = [],
}: RegistrationPageHeaderProps) {
  const sponsorLogos = useMemo(
    () => getSponsorsByPriority(parseSponsorLogos(sponsorLogosJson)),
    [sponsorLogosJson],
  );
  const title = tournamentName?.trim() || brandNameFallback;
  // Registered-player counts and capacity are intentionally hidden from the public
  // registration page. Keep only organizer-provided facts such as schedule dates.
  const visibleFacts = facts.filter((fact): fact is RegistrationHeaderFact => !!fact?.value);

  return (
    <header className="reg-header">
      <div className="reg-brand-row">
        <div className="flex justify-start min-w-0">
          {tournamentLogoUrl ? (
            <img
              src={tournamentLogoUrl}
              alt={`${title} logo`}
              className="reg-tournament-logo"
            />
          ) : (
            <div className="reg-tournament-fallback" aria-hidden="true">
              {title.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="reg-brand-mark">
          <PoweredByBidWarLink variant="headerLogo" />
        </div>

        <div className="flex justify-end min-w-0">
          <RegistrationSponsors logos={sponsorLogos} />
        </div>
      </div>

      <div className="reg-header-copy">
        <p className="reg-kicker">{subtitle}</p>
        <h1>{title}</h1>
        {tagline ? <p className="reg-tagline">{tagline}</p> : null}
        {visibleFacts.length > 0 ? (
          <dl className="reg-facts">
            {visibleFacts.map(fact => (
              <div key={fact.label} className={fact.label === "Capacity" || fact.label === "Registered" ? "reg-fact reg-fact--capacity" : "reg-fact"}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </header>
  );
}
