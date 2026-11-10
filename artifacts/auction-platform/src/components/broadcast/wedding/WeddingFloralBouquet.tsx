import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export interface WeddingFloralBouquetProps extends React.SVGProps<SVGSVGElement> {
  variant?: "corner-left" | "corner-right" | "center" | "cluster";
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingFloralBouquet
 * High-definition vector floral arrangement featuring luxury Indian wedding roses,
 * peach peonies, sage eucalyptus sprigs, and champagne gold berry clusters.
 *
 * Designed to frame the Royal Wedding Cartouche Header and Scorebug without obscuring
 * match data or camera action lines.
 */
export function WeddingFloralBouquet({
  variant = "corner-left",
  size = 110,
  className = "",
  style,
  ...rest
}: WeddingFloralBouquetProps) {
  const isRight = variant === "corner-right";
  const isCenter = variant === "center";

  // Center Garland Variant
  if (isCenter) {
    return (
      <svg
        viewBox="0 0 200 60"
        width={size * 1.8}
        height={(size * 1.8 * 60) / 200}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`wedding-floral-garland pointer-events-none select-none ${className}`}
        style={{ overflow: "visible", ...style }}
        aria-hidden="true"
        {...rest}
      >
        <defs>
          <linearGradient id="roseGarlandCenter" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FADBD8" />
            <stop offset="50%" stopColor="#E89CAE" />
            <stop offset="100%" stopColor="#A9324B" />
          </linearGradient>
          <linearGradient id="roseGarlandPeach" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FDEBD0" />
            <stop offset="60%" stopColor="#F5CBA7" />
            <stop offset="100%" stopColor="#D98880" />
          </linearGradient>
          <linearGradient id="leafGarland" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7D9D85" />
            <stop offset="100%" stopColor="#3F5E4B" />
          </linearGradient>
        </defs>

        {/* Flanking Leaves Left */}
        <path d="M40 32C20 30 10 24 0 18C14 14 30 18 42 26" fill="url(#leafGarland)" opacity="0.9" />
        <path d="M60 36C40 38 24 36 12 42C24 46 44 44 62 38" fill="url(#leafGarland)" opacity="0.8" />

        {/* Flanking Leaves Right */}
        <path d="M160 32C180 30 190 24 200 18C186 14 170 18 158 26" fill="url(#leafGarland)" opacity="0.9" />
        <path d="M140 36C160 38 176 36 188 42C176 46 156 44 138 38" fill="url(#leafGarland)" opacity="0.8" />

        {/* Left Peach Rose */}
        <g transform="translate(62, 14)">
          <circle cx="16" cy="16" r="15" fill="url(#roseGarlandPeach)" />
          <path d="M8 14C10 8 22 8 24 14C20 22 12 22 8 14Z" fill="#FDEBD0" opacity="0.8" />
          <path d="M11 16C13 12 19 12 21 16C18 20 14 20 11 16Z" fill="#D98880" />
          <circle cx="16" cy="16" r="3" fill="#D4AF37" />
        </g>

        {/* Right Peach Rose */}
        <g transform="translate(106, 14)">
          <circle cx="16" cy="16" r="15" fill="url(#roseGarlandPeach)" />
          <path d="M8 14C10 8 22 8 24 14C20 22 12 22 8 14Z" fill="#FDEBD0" opacity="0.8" />
          <path d="M11 16C13 12 19 12 21 16C18 20 14 20 11 16Z" fill="#D98880" />
          <circle cx="16" cy="16" r="3" fill="#D4AF37" />
        </g>

        {/* Center Main Velvet Rose */}
        <g transform="translate(82, 6)">
          <circle cx="18" cy="18" r="18" fill="url(#roseGarlandCenter)" />
          <path d="M6 18C6 10 14 4 22 6C30 8 32 16 28 24C24 30 12 30 6 18Z" fill="#FADBD8" opacity="0.75" />
          <path d="M10 18C10 12 16 8 22 9C26 10 28 16 24 22C20 26 13 26 10 18Z" fill="#A9324B" />
          <path d="M14 18C15 14 18 12 21 13C23 14 24 18 21 20C18 22 15 21 14 18Z" fill="#FADBD8" />
          <circle cx="18" cy="17" r="3.5" fill="#E5C378" />
        </g>

        {/* Gold Sprig Berries */}
        <circle cx="48" cy="22" r="2.5" fill="#D4AF37" />
        <circle cx="42" cy="27" r="2" fill="#E5C378" />
        <circle cx="152" cy="22" r="2.5" fill="#D4AF37" />
        <circle cx="158" cy="27" r="2" fill="#E5C378" />
      </svg>
    );
  }

  // Corner Left & Corner Right Floral Clusters
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`wedding-floral-bouquet pointer-events-none select-none ${className}`}
      style={{
        overflow: "visible",
        transform: isRight ? "scaleX(-1)" : undefined,
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <radialGradient id="roseMain" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FDE8EC" />
          <stop offset="45%" stopColor="#E2869A" />
          <stop offset="85%" stopColor="#9C243B" />
          <stop offset="100%" stopColor="#6E1527" />
        </radialGradient>
        <radialGradient id="rosePeach" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FFF3E6" />
          <stop offset="50%" stopColor="#F5C29E" />
          <stop offset="90%" stopColor="#D97A60" />
          <stop offset="100%" stopColor="#9E432E" />
        </radialGradient>
        <radialGradient id="roseIvory" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#F6EDDA" />
          <stop offset="100%" stopColor="#D5C09B" />
        </radialGradient>
        <linearGradient id="leafGrad1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8BAF96" />
          <stop offset="60%" stopColor="#55755E" />
          <stop offset="100%" stopColor="#324939" />
        </linearGradient>
        <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A3BEAB" />
          <stop offset="100%" stopColor="#4A6552" />
        </linearGradient>
      </defs>

      {/* ── Outer Eucalyptus Sprigs & Leaves ── */}
      <path
        d="M25 95C10 85 4 65 8 48C18 52 28 66 32 82"
        fill="url(#leafGrad1)"
        opacity="0.85"
      />
      <path
        d="M15 50C8 38 10 20 22 10C28 22 26 38 20 48"
        fill="url(#leafGrad2)"
        opacity="0.9"
      />
      <path
        d="M48 24C46 10 56 2 70 0C72 14 65 24 52 26"
        fill="url(#leafGrad1)"
        opacity="0.85"
      />
      <path
        d="M85 30C95 18 108 14 118 16C114 28 104 36 90 34"
        fill="url(#leafGrad2)"
        opacity="0.8"
      />

      {/* Gold Laurel Tendril */}
      <path
        d="M22 68C14 54 18 36 30 25"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="42" r="2" fill={WEDDING_TOKENS.color.gold.champagne} />
      <circle cx="26" cy="30" r="1.5" fill={WEDDING_TOKENS.color.gold.rich} />
      <circle cx="20" cy="56" r="2" fill={WEDDING_TOKENS.color.gold.champagne} />

      {/* ── Rose 1: Peach Garden Rose (Top Right) ── */}
      <g transform="translate(56, 26)">
        <circle cx="20" cy="20" r="19" fill="url(#rosePeach)" />
        {/* Layered Petal Folds */}
        <path
          d="M8 16C12 8 28 8 32 16C28 26 14 26 8 16Z"
          fill="#FFF3E6"
          opacity="0.6"
        />
        <path
          d="M12 18C14 12 24 12 28 18C25 24 16 24 12 18Z"
          fill="#D97A60"
        />
        <circle cx="20" cy="19" r="4" fill="#F5C29E" />
        <circle cx="20" cy="19" r="2" fill="#D4AF37" />
      </g>

      {/* ── Rose 2: Ivory Cream Peony (Bottom Left) ── */}
      <g transform="translate(18, 54)">
        <circle cx="18" cy="18" r="17" fill="url(#roseIvory)" />
        <path
          d="M8 14C12 8 24 8 28 14C24 22 12 22 8 14Z"
          fill="#FFFFFF"
          opacity="0.8"
        />
        <path
          d="M11 16C13 12 21 12 24 16C22 20 14 20 11 16Z"
          fill="#D5C09B"
        />
        <circle cx="17.5" cy="17" r="3" fill="#E5C378" />
      </g>

      {/* ── Rose 3: Primary Royal Velvet Burgundy / Rose Blossom (Center Focal) ── */}
      <g transform="translate(36, 42)">
        <circle cx="26" cy="26" r="25" fill="url(#roseMain)" />
        {/* Outer Petals */}
        <path
          d="M6 22C8 10 24 4 36 8C48 12 50 24 46 36C40 48 18 50 8 38C4 32 4 26 6 22Z"
          fill="#FDE8EC"
          opacity="0.45"
        />
        {/* Mid Petals */}
        <path
          d="M12 24C14 14 26 10 36 14C44 18 44 28 40 36C34 44 18 42 12 34C9 30 10 26 12 24Z"
          fill="#9C243B"
        />
        {/* Inner Cup & Swirl */}
        <path
          d="M18 25C20 18 28 16 34 19C38 22 38 28 34 33C30 37 20 36 18 30Z"
          fill="#FDE8EC"
          opacity="0.8"
        />
        <path
          d="M21 26C22 22 26 20 30 22C33 24 33 28 30 30C28 32 23 31 21 26Z"
          fill="#6E1527"
        />
        <circle cx="26" cy="26" r="4.5" fill="#E5C378" />
        <circle cx="26" cy="26" r="2" fill="#D4AF37" />
      </g>

      {/* Tiny Gypsophila (Baby's Breath) Florets */}
      <circle cx="96" cy="56" r="2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="102" cy="62" r="1.5" fill="#FFF3E6" opacity="0.9" />
      <circle cx="92" cy="68" r="2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="42" cy="18" r="2" fill="#FFFFFF" opacity="0.9" />
      <circle cx="48" cy="12" r="1.5" fill="#FFF3E6" opacity="0.9" />
    </svg>
  );
}
