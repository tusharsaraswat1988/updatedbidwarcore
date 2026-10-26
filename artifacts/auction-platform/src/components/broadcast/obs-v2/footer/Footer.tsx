import type { ReactNode } from "react";
import type { FeedStatus, SponsorLogo, TeamPurse } from "../contracts";
import { formatAmount } from "../format";

/** Left status chip + text, e.g. FINAL / WON BY WALKOVER */
export function FooterStatus({ chip, text }: { chip?: string; text: string }) {
  const isLiveChip = !chip || chip.trim().toUpperCase() === "LIVE";
  return (
    <div className="bw-fstatus">
      {!isLiveChip && <span className="bw-fchip">{chip}</span>}
      <span className="bw-ftext" style={isLiveChip ? { paddingLeft: "30px" } : undefined}>
        {text}
      </span>
    </div>
  );
}

function Marquee({ children }: { children: ReactNode }) {
  return (
    <div className="bw-marquee">
      <div className="bw-marquee-track">
        <div>{children}</div>
        <div aria-hidden>{children}</div>
      </div>
    </div>
  );
}

export function TeamTicker({ teams }: { teams: TeamPurse[] }) {
  return (
    <Marquee>
      {teams.map((t) => (
        <span key={t.teamId} className="bw-tick-item">
          <b>{t.short}</b> {formatAmount(t.purseRemaining)} <small>· {t.slotsRemaining} slots</small>
        </span>
      ))}
    </Marquee>
  );
}

export function SponsorTicker({ sponsors }: { sponsors: SponsorLogo[] }) {
  if (!sponsors || sponsors.length === 0) return null;
  // If fewer than 4 sponsors, repeat so marquee track has sufficient length for smooth scrolling
  const displaySponsors = sponsors.length < 4 ? [...sponsors, ...sponsors, ...sponsors, ...sponsors] : sponsors;
  return (
    <Marquee>
      {displaySponsors.map((s, idx) => (
        <span key={`${s.id || s.name}-${idx}`} className="bw-tick-item">
          {s.logoUrl && (
            <img
              src={s.logoUrl}
              alt={s.name}
              style={{
                height: "20px",
                width: "auto",
                maxWidth: "60px",
                objectFit: "contain",
                display: "inline-block",
                verticalAlign: "middle",
                marginRight: "6px",
              }}
            />
          )}
          <b>{s.name}</b>
          {s.label && <small style={{ marginLeft: "4px" }}>({s.label})</small>}
          <span style={{ color: "var(--bw-ink-mute)", margin: "0 8px", opacity: 0.6 }}>•</span>
        </span>
      ))}
    </Marquee>
  );
}

/** Subtle feed indicator. Lives in the footer only; never overlaps camera area. */
export function ConnectionStatus({ status, seconds }: { status: FeedStatus; seconds?: number | undefined }) {
  if (status === "live") return null;
  return (
    <span className="bw-conn" data-status={status}>
      <i />
      {status === "stale" ? `FEED DELAYED${seconds ? ` · ${seconds}s` : ""}` : "FEED DISCONNECTED"}
    </span>
  );
}

export function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="bw-fstat">
      <small>{label}</small> <b>{value}</b>
    </span>
  );
}

export function FooterBar({ left, center, right }: { left?: ReactNode; center?: ReactNode; right?: ReactNode }) {
  return (
    <footer className="bw-footer">
      <div className="bw-f-left">{left}</div>
      <div className="bw-f-center">{center}</div>
      <div className="bw-f-right">{right}</div>
    </footer>
  );
}
