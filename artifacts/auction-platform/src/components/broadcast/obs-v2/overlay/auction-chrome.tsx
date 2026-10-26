import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BroadcastFrame, FeedStatus, SponsorLogo } from "../contracts";
import {
  auctionActivityKey,
  buildPattiLine,
  fadeSponsors,
  headerRightSponsors,
  pattiFallback,
  sponsorGlow,
  sponsorTypeLabel,
  type PattiLine,
} from "./auction-chrome-logic";

const FADE_MS = 5200;

function SponsorMark({
  sponsor,
  prominent = false,
}: {
  sponsor: SponsorLogo;
  prominent?: boolean;
}) {
  const glow = sponsorGlow(sponsor);
  return (
    <div
      className="bw-slot-sponsor"
      data-tier={sponsor.tier}
      data-glow={glow}
      data-prominent={prominent ? "true" : "false"}
    >
      <div className="bw-slot-copy">
        <span>{sponsorTypeLabel(sponsor)}</span>
        {sponsor.name ? <strong>{sponsor.name}</strong> : null}
      </div>
      <div className="bw-slot-logo">
        {sponsor.logoUrl ? (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name || sponsorTypeLabel(sponsor)}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span>{(sponsor.name || "SP").slice(0, 2)}</span>
        )}
      </div>
    </div>
  );
}

/** Right side of the auction header. Live Streaming Partner, or title and co-sponsors. */
export function HeaderSponsorSlot({ sponsors }: { sponsors: SponsorLogo[] }) {
  const slot = headerRightSponsors(sponsors);
  const [index, setIndex] = useState(0);
  const rotating = slot.items.length > 2;

  useEffect(() => {
    setIndex(0);
  }, [slot.mode, slot.items.length]);

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % slot.items.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [rotating, slot.items.length]);

  const visible = rotating ? slot.items.slice(index, index + 1) : slot.items.slice(0, 2);
  const key = visible.map((s) => s.id || s.name).join("|") || "empty";

  return (
    <div className="bw-header-slot" data-mode={slot.mode} data-header-sponsor-slot="">
      <AnimatePresence mode="wait">
        {visible.length > 0 && (
          <motion.div
            key={key}
            className="bw-header-slot-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {visible.map((sponsor) => (
              <SponsorMark key={sponsor.id || sponsor.name} sponsor={sponsor} prominent={slot.mode === "live"} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small LIVE mark, centered under the BidWar logo in the camera space. */
export function AuctionLiveBug({ feed = "live" }: { feed?: FeedStatus }) {
  const label = feed === "disconnected" ? "OFFLINE" : feed === "stale" ? "DELAYED" : "LIVE";
  return (
    <div className="bw-auction-live" data-feed={feed} data-auction-live-bug="">
      <i />
      <span>{label}</span>
    </div>
  );
}

/** All non-live sponsors, fading above the lower third on the right. */
export function AuctionSponsorFade({ sponsors }: { sponsors: SponsorLogo[] }) {
  const items = fadeSponsors(sponsors);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % items.length);
    }, FADE_MS);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!items.length) return null;
  const sponsor = items[index % items.length];
  if (!sponsor) return null;
  const glow = sponsorGlow(sponsor);

  return (
    <div className="bw-sponsor-fade" data-sponsor-fade="" aria-hidden>
      <AnimatePresence mode="wait">
        <motion.div
          key={sponsor.id || sponsor.name}
          className="bw-fade-sponsor"
          data-glow={glow}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {sponsor.logoUrl ? (
            <img
              className="bw-fade-logo"
              src={sponsor.logoUrl}
              alt=""
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <span className="bw-fade-copy">
            {sponsor.name ? <strong className="bw-fade-name">{sponsor.name}</strong> : null}
            <small className="bw-fade-type">{sponsorTypeLabel(sponsor)}</small>
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Bottom patti. Recent sold / unsold lines travel left to right across the bar
 * and keep circulating, including older lines when the operator is quiet.
 */
export function AuctionOutcomePatti({ frame }: { frame: BroadcastFrame }) {
  const historyRef = useRef<PattiLine[]>([]);
  const unsoldNamesRef = useRef<string[]>([]);
  const outcomeKeyRef = useRef("");
  const outcomeArmedRef = useRef(true);
  const [lines, setLines] = useState<PattiLine[]>([]);

  const fallback = pattiFallback(frame);
  const items = lines.length ? lines : fallback ? [{ id: "fallback", text: fallback }] : [];

  useEffect(() => {
    if (frame.scene !== "SOLD" && frame.scene !== "UNSOLD") {
      outcomeArmedRef.current = true;
      return;
    }

    const outcomeKey = auctionActivityKey(frame);
    if (!outcomeArmedRef.current && outcomeKey === outcomeKeyRef.current) return;

    const line = buildPattiLine(frame, unsoldNamesRef.current);
    outcomeArmedRef.current = false;
    outcomeKeyRef.current = outcomeKey;
    if (!line || historyRef.current.some((item) => item.id === line.id)) return;
    if (frame.scene === "UNSOLD") {
      unsoldNamesRef.current.push(frame.model.player.name.trim().toLowerCase());
    }
    historyRef.current = [...historyRef.current, line].slice(-24);
    setLines(historyRef.current);
  }, [frame]);

  if (!items.length) return <div className="bw-patti" data-auction-patti="" />;

  const renderItem = (item: PattiLine, key: string) => (
    <span key={key} className="bw-patti-item" data-tone={item.tone ?? "plain"}>
      {item.tone === "sold" && item.amount ? (
        <>
          <b className="bw-patti-name">{item.name}</b>
          <em className="bw-patti-sold">SOLD AT</em>
          <strong className="bw-patti-amount">{item.amount}</strong>
        </>
      ) : (
        item.text
      )}
    </span>
  );

  const cars = items.map((item) => renderItem(item, item.id));

  return (
    <div className="bw-patti" data-auction-patti="">
      <div className="bw-patti-track">
        <div className="bw-patti-half">{cars}</div>
        <div className="bw-patti-half" aria-hidden>
          {items.map((item) => renderItem(item, `${item.id}-copy`))}
        </div>
      </div>
    </div>
  );
}
