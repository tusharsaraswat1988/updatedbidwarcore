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

export function BidWarLiveBrand({
  feed = "live",
  showLive = true,
}: {
  feed?: FeedStatus;
  showLive?: boolean;
}) {
  const label = feed === "disconnected" ? "OFFLINE" : feed === "stale" ? "DELAYED" : "LIVE";
  return (
    <div className="bw-livebrand">
      <img
        src="/assets/branding/bidwar-reverse-logo-official.png"
        alt="BidWar"
        className="bw-brand-logo"
        style={{
          height: "46px",
          width: "auto",
          maxWidth: "200px",
          objectFit: "contain",
          display: "block",
          filter: "drop-shadow(0 0 12px rgba(255, 215, 0, 0.35))",
        }}
        onError={(e) => {
          const target = e.currentTarget;
          if (!target.src.includes("broadcast/bidwar-reverse-logo-official")) {
            target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
          }
        }}
      />
      {showLive && (
        <>
          <span className="bw-divider" />
          <span className="bw-live" data-feed={feed}>
            <i />
            {label}
          </span>
        </>
      )}
    </div>
  );
}

/** Legacy alias for BidWarLiveBrand */
export const BidWarHeaderBrand = BidWarLiveBrand;

/**
 * Compact LIVE broadcast badge positioned just below the top header on the right.
 */
export function LiveBroadcastBug({ feed = "live" }: { feed?: FeedStatus }) {
  const label = feed === "disconnected" ? "OFFLINE" : feed === "stale" ? "DELAYED" : "LIVE";
  return (
    <div
      className="bw-live-bug"
      style={{
        position: "absolute",
        top: "102px",
        right: "72px",
        zIndex: 30,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "4px",
        background:
          feed === "disconnected"
            ? "var(--bw-navy-700)"
            : feed === "stale"
            ? "var(--bw-amber)"
            : "var(--bw-live)",
        color: feed === "stale" ? "var(--bw-navy-950)" : "#fff",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.45)",
        fontFamily: "var(--bw-font-display)",
      }}
    >
      <i
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: feed === "stale" ? "var(--bw-navy-950)" : "#fff",
          display: "inline-block",
          animation: feed === "disconnected" ? "none" : "bw-blink 1.4s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "12px",
          fontWeight: 800,
          letterSpacing: "0.15em",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Title Sponsor / Official Partner docked on the right side of the header.
 */
export function TitleSponsor({ sponsor }: { sponsor?: SponsorLogo | undefined }) {
  if (!sponsor) return null;
  const tierLabel = sponsor.label || (sponsor.tier ? sponsor.tier.replace(/_/g, " ").toUpperCase() : "OFFICIAL PARTNER");
  return (
    <div className="bw-title-sponsor">
      <div className="bw-ts-text">
        <span style={{ color: "var(--bw-gold)" }}>{tierLabel}</span>
        <strong>{sponsor.name}</strong>
      </div>
      <div className="bw-ts-logo">
        {sponsor.logoUrl ? (
          <img src={sponsor.logoUrl} alt={sponsor.name} />
        ) : (
          <span>{sponsor.name.slice(0, 2)}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Rotates through associate sponsors (~5s interval) with smooth fade/slide.
 */
export function AssociateSponsorRail({
  sponsors,
  intervalMs = 5000,
}: {
  sponsors: SponsorLogo[];
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (sponsors.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % sponsors.length), intervalMs);
    return () => clearInterval(t);
  }, [sponsors.length, intervalMs]);

  if (!sponsors.length) return null;
  const s = sponsors[i % sponsors.length];
  if (!s) return null;

  const label = s.label || (s.tier ? s.tier.replace(/_/g, " ").toUpperCase() : "ASSOCIATE");

  return (
    <div className="bw-assoc">
      <span className="bw-assoc-label">{label}</span>
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id || s.name}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="bw-assoc-item flex items-center gap-2"
        >
          {s.logoUrl && (
            <img
              src={s.logoUrl}
              alt={s.name}
              style={{ height: "24px", maxWidth: "60px", objectFit: "contain", borderRadius: "3px" }}
            />
          )}
          <span>{s.name}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Frameless Associate Sponsor display docked just above the lower third scorebug on the right.
 * No box or card background — clean text and logo.
 */
export function AssociateSponsorScorebug({
  sponsors,
  intervalMs = 5000,
}: {
  sponsors: SponsorLogo[];
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (sponsors.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % sponsors.length), intervalMs);
    return () => clearInterval(t);
  }, [sponsors.length, intervalMs]);

  if (!sponsors.length) return null;
  const s = sponsors[i % sponsors.length];
  if (!s) return null;

  const sponsorType = s.label && !/^associate$/i.test(s.label.trim())
    ? s.label.toUpperCase()
    : "OFFICIAL PARTNER";

  return (
    <div
      className="bw-scorebug-assoc"
      style={{
        position: "absolute",
        bottom: "206px",
        right: "72px",
        zIndex: 25,
        display: "flex",
        alignItems: "center",
        background: "transparent",
        border: "none",
        padding: 0,
        boxShadow: "none",
        pointerEvents: "none",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={s.id || s.name}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {s.logoUrl && (
              <img
                src={s.logoUrl}
                alt={s.name}
                style={{
                  height: "38px",
                  width: "auto",
                  maxWidth: "96px",
                  objectFit: "contain",
                  display: "block",
                  filter: "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.85))",
                }}
              />
            )}
            <span
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "var(--bw-ink)",
                letterSpacing: "0.02em",
                fontFamily: "var(--bw-font-display)",
                textShadow: "0 2px 6px rgba(0, 0, 0, 0.9)",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </span>
          </div>
          {sponsorType && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                color: "var(--bw-gold)",
                fontFamily: "var(--bw-font-display)",
                textTransform: "uppercase",
                textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)",
                marginTop: "2px",
              }}
            >
              {sponsorType}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
