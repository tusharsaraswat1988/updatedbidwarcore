import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BroadcastBranding, FeedStatus, SponsorLogo } from "../contracts";
import { Crest } from "../primitives";

/** Container: 1920x96, clip-path chamfer, overflow hidden — all header motion stays inside. */
export function HeaderFrame({ children }: { children: ReactNode }) {
  return <header className="bw-header">{children}</header>;
}

/** Sweep light that travels inside the header only. Disabled in performance mode by CSS. */
export function HeaderEnergy() {
  return (
    <div className="bw-header-energy" aria-hidden>
      <span />
    </div>
  );
}

/** Static gold/cyan rules and angled slashes. */
export function HeaderAccents() {
  return (
    <div className="bw-header-accents" aria-hidden>
      <i className="bw-rule-left" />
      <i className="bw-rule-right" />
      <i className="bw-slash bw-slash-a" />
      <i className="bw-slash bw-slash-b" />
    </div>
  );
}

export function TournamentBrand({ branding }: { branding: BroadcastBranding }) {
  const fullName = `${branding.tournamentName || ""} ${branding.tournamentAccent || ""}`.trim();
  const isVeryLong = fullName.length > 30;
  const isMedium = fullName.length > 20;

  return (
    <div className="bw-tournament">
      <Crest text={branding.tournamentShort} logoUrl={branding.tournamentLogoUrl} size={58} />
      <div className="bw-tournament-name" data-long={isVeryLong ? "xl" : isMedium ? "lg" : "md"}>
        <div className="bw-tournament-title-row">
          <span className="bw-tn-main">{branding.tournamentName}</span>
          {branding.tournamentAccent && (
            <span className="bw-tn-accent">{branding.tournamentAccent}</span>
          )}
        </div>
        {branding.venue && (
          <span
            className="bw-tn-venue"
            style={{
              fontSize: 10,
              color: "rgba(248, 250, 252, 0.55)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              display: "block",
              marginTop: 1,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {branding.venue}
          </span>
        )}
      </div>
    </div>
  );
}

export function BidWarLiveBrand({ feed }: { feed: FeedStatus }) {
  const label = feed === "disconnected" ? "OFFLINE" : "LIVE";
  return (
    <div className="bw-livebrand">
      <span className="bw-wordmark">
        <b>bid</b>war
      </span>
      <span className="bw-divider" />
      <span className="bw-live" data-feed={feed}>
        <i />
        {label}
      </span>
    </div>
  );
}

export function TitleSponsor({ sponsor }: { sponsor?: SponsorLogo | undefined }) {
  if (!sponsor) return <div className="bw-title-sponsor" />;
  return (
    <div className="bw-title-sponsor">
      <div className="bw-ts-text">
        <span>{sponsor.label ?? "Official Partner"}</span>
        <strong>{sponsor.name}</strong>
      </div>
      <div className="bw-ts-logo">
        {sponsor.logoUrl ? <img src={sponsor.logoUrl} alt={sponsor.name} /> : <span>{sponsor.name.slice(0, 2)}</span>}
      </div>
    </div>
  );
}

/** Rotates associate sponsors one at a time (~7s interval); cross-fade scoped to this box. */
export function AssociateSponsorRail({ sponsors, intervalMs = 7000 }: { sponsors: SponsorLogo[]; intervalMs?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (sponsors.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % sponsors.length), intervalMs);
    return () => clearInterval(t);
  }, [sponsors.length, intervalMs]);
  if (!sponsors.length) return null;
  const s = sponsors[i % sponsors.length];
  if (!s) return null;
  return (
    <div className="bw-assoc">
      <span className="bw-assoc-label">Associate</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={s.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className="bw-assoc-item"
        >
          {s.logoUrl ? <img src={s.logoUrl} alt={s.name} /> : s.name}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
