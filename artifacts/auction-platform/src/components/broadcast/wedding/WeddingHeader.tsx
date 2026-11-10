import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";
import { WeddingScriptTitle, WeddingSerifSubtitle } from "./WeddingTypography";
import { WeddingGoldDivider } from "./WeddingGoldDivider";
import { WeddingFloralBouquet } from "./WeddingFloralBouquet";
import type { BroadcastBranding, FeedStatus } from "../obs-v2/contracts";

export interface WeddingHeaderProps {
  branding: BroadcastBranding;
  feedStatus?: FeedStatus;
  viewerCountText?: string;
  weddingBranding?: {
    cupTitle?: string;
    coupleTitle?: string;
  };
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Crossed Wooden Cricket Bats Crest SVG
 * Antique crossed cricket bats surrounded by a delicate gold laurel wreath.
 */
function CrossedBatsCrest({ size = 44 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="batWood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E5C378" />
          <stop offset="50%" stopColor="#C59B3B" />
          <stop offset="100%" stopColor="#8A6424" />
        </linearGradient>
      </defs>

      {/* Gold Laurel Sprigs */}
      <path
        d="M14 44C12 36 14 26 22 20M50 44C52 36 50 26 42 20"
        stroke={WEDDING_TOKENS.color.gold.antique}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="36" r="1.5" fill={WEDDING_TOKENS.color.gold.champagne} />
      <circle cx="20" cy="26" r="1.5" fill={WEDDING_TOKENS.color.gold.champagne} />
      <circle cx="48" cy="36" r="1.5" fill={WEDDING_TOKENS.color.gold.champagne} />
      <circle cx="44" cy="26" r="1.5" fill={WEDDING_TOKENS.color.gold.champagne} />

      {/* Bat 1 (Angled Left to Right) */}
      <g transform="rotate(45 32 32)">
        <rect x="29" y="8" width="6" height="34" rx="2" fill="url(#batWood)" stroke="#5A4016" strokeWidth="0.8" />
        <rect x="30.5" y="42" width="3" height="14" rx="1" fill="#FFFDF9" stroke="#5A4016" strokeWidth="0.6" />
        {/* Rubber grip rings */}
        <line x1="30.5" y1="45" x2="33.5" y2="45" stroke="#801830" strokeWidth="0.6" />
        <line x1="30.5" y1="49" x2="33.5" y2="49" stroke="#801830" strokeWidth="0.6" />
      </g>

      {/* Bat 2 (Angled Right to Left) */}
      <g transform="rotate(-45 32 32)">
        <rect x="29" y="8" width="6" height="34" rx="2" fill="url(#batWood)" stroke="#5A4016" strokeWidth="0.8" />
        <rect x="30.5" y="42" width="3" height="14" rx="1" fill="#FFFDF9" stroke="#5A4016" strokeWidth="0.6" />
        <line x1="30.5" y1="45" x2="33.5" y2="45" stroke="#182042" strokeWidth="0.6" />
        <line x1="30.5" y1="49" x2="33.5" y2="49" stroke="#182042" strokeWidth="0.6" />
      </g>

      {/* Center Cricket Ball */}
      <circle cx="32" cy="32" r="5" fill="#8B1528" stroke={WEDDING_TOKENS.color.gold.champagne} strokeWidth="1" />
      <path d="M28.5 32C30 30 34 30 35.5 32" stroke="#FFFDF9" strokeWidth="0.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Top Right Live Stream Bug
 */
function WeddingLiveBug({ feedStatus = "live", viewerCount = "1.2K" }: { feedStatus?: FeedStatus; viewerCount?: string }) {
  const isLive = feedStatus === "live";

  return (
    <div
      className="wedding-live-bug absolute flex items-center gap-2.5 px-3.5 py-1.5 rounded-full select-none"
      style={{
        top: `${WEDDING_TOKENS.canvas.zones.liveBug.top}px`,
        right: `${WEDDING_TOKENS.canvas.zones.liveBug.right}px`,
        height: `${WEDDING_TOKENS.canvas.zones.liveBug.height}px`,
        background: WEDDING_TOKENS.color.gradient.liveBug,
        border: `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
        boxShadow: "0 4px 14px rgba(107, 29, 47, 0.45)",
        zIndex: WEDDING_TOKENS.layer.liveBug,
      }}
    >
      <span
        className="h-2 w-2 rounded-full animate-pulse"
        style={{
          backgroundColor: isLive ? "#FFFDF9" : "#E5C378",
          boxShadow: isLive ? "0 0 8px #FFFDF9" : "none",
        }}
      />
      <span
        className="font-bold text-[12px] tracking-widest text-[#FFFDF9]"
        style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
      >
        {isLive ? "LIVE" : "STANDBY"}
      </span>

      <span className="w-[1px] h-3 bg-[rgba(255,255,255,0.3)]" />

      <div className="flex items-center gap-1 text-[11px] font-semibold text-[#FFFDF9]/90">
        <span aria-hidden="true">👁</span>
        <span>{viewerCount}</span>
      </div>
    </div>
  );
}

/**
 * WeddingHeader
 * Authoritative top tournament crest plaque with crossed bats and couple details.
 */
export function WeddingHeader({
  branding,
  feedStatus = "live",
  viewerCountText = "1.2K",
  weddingBranding,
  className = "",
  style,
}: WeddingHeaderProps) {
  // Derive cup title
  const cupTitle =
    weddingBranding?.cupTitle ||
    (branding.tournamentName
      ? branding.tournamentName.toLowerCase().includes("wedding")
        ? branding.tournamentName
        : `${branding.tournamentName} Wedding Cup`
      : "The Wedding Cricket Cup");

  // Derive couple title (venue strictly excluded per broadcast design specification)
  const coupleTitle =
    weddingBranding?.coupleTitle ||
    (branding.tournamentAccent
      ? branding.tournamentAccent.toUpperCase()
      : "AARAV & KIARA");

  return (
    <header
      className={`wedding-header absolute left-0 right-0 top-0 select-none pointer-events-none ${className}`}
      style={{
        height: `${WEDDING_TOKENS.canvas.zones.header.height}px`,
        zIndex: WEDDING_TOKENS.layer.headerPlaque,
        ...style,
      }}
    >
      {/* Top Right Live Bug */}
      <WeddingLiveBug feedStatus={feedStatus} viewerCount={viewerCountText} />

      {/* Centered Ornate Cartouche Plaque (single line title with responsive width) */}
      <div
        className="pointer-events-auto absolute left-1/2 -translate-x-1/2 flex flex-col items-center justify-center text-center"
        style={{
          top: `${WEDDING_TOKENS.canvas.zones.header.top}px`,
          minWidth: `${WEDDING_TOKENS.canvas.headerPlaque.width}px`,
          maxWidth: "1120px",
          width: "max-content",
          minHeight: `${WEDDING_TOKENS.canvas.headerPlaque.height}px`,
          background: WEDDING_TOKENS.color.gradient.parchment,
          border: `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
          borderRadius: "28px",
          boxShadow: `${WEDDING_TOKENS.depth.shadow.parchment}, 0 0 0 3px rgba(212, 175, 55, 0.25)`,
          padding: "10px 48px 14px",
        }}
      >
        {/* Inner delicate gold hairline */}
        <div
          className="pointer-events-none absolute inset-[4px] rounded-[24px]"
          style={{ border: `1px solid ${WEDDING_TOKENS.color.gold.hairline}` }}
        />

        {/* Crossed Bats Crest Motif */}
        <CrossedBatsCrest size={38} />

        {/* Title: Tournament / Cup Name (strictly single-line with fluid font size) */}
        <WeddingScriptTitle
          className="mt-[-4px] whitespace-nowrap"
          style={{
            fontSize:
              cupTitle.length > 32
                ? "28px"
                : cupTitle.length > 24
                ? "32px"
                : cupTitle.length > 18
                ? "36px"
                : "40px",
            color: WEDDING_TOKENS.color.charcoal.ink,
            whiteSpace: "nowrap",
          }}
        >
          {cupTitle}
        </WeddingScriptTitle>

        {/* Subtitle: Couple Names Flanked by Delicate Gold Rules & Centered Heart */}
        <div className="flex flex-col items-center justify-center w-max min-w-[360px] max-w-none mt-0.5">
          <span
            className="text-[10px] leading-none text-[#801830] opacity-85 select-none"
            aria-hidden="true"
          >
            ♥
          </span>
          <div className="flex items-center justify-center gap-3 w-full mt-1">
            <div
              className="flex-1 h-[1px]"
              style={{
                background: `linear-gradient(90deg, transparent 0%, ${WEDDING_TOKENS.color.gold.rich} 100%)`,
              }}
            />
            <WeddingSerifSubtitle
              className="tracking-[0.22em] uppercase font-semibold whitespace-nowrap"
              style={{
                fontSize: "13px",
                color: WEDDING_TOKENS.color.charcoal.espresso,
                whiteSpace: "nowrap",
              }}
            >
              {coupleTitle}
            </WeddingSerifSubtitle>
            <div
              className="flex-1 h-[1px]"
              style={{
                background: `linear-gradient(90deg, ${WEDDING_TOKENS.color.gold.rich} 0%, transparent 100%)`,
              }}
            />
          </div>
        </div>

        {/* Floral Bouquets Framing the Header Cartouche */}
        <div
          className="pointer-events-none absolute -bottom-3.5 -left-5"
          style={{ zIndex: WEDDING_TOKENS.layer.headerPlaque + 1 }}
        >
          <WeddingFloralBouquet variant="corner-left" size={82} />
        </div>
        <div
          className="pointer-events-none absolute -bottom-3.5 -right-5"
          style={{ zIndex: WEDDING_TOKENS.layer.headerPlaque + 1 }}
        >
          <WeddingFloralBouquet variant="corner-right" size={82} />
        </div>
        <div
          className="pointer-events-none absolute -bottom-3 left-1/2 -translate-x-1/2"
          style={{ zIndex: WEDDING_TOKENS.layer.headerPlaque + 1 }}
        >
          <WeddingFloralBouquet variant="center" size={60} />
        </div>
      </div>
    </header>
  );
}
