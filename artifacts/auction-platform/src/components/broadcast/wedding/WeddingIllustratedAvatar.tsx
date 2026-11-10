import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export interface WeddingAvatarProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Regal Indian Bride Vector Illustration
 * Features traditional bridal dupatta, maang tikka, choker, and bindi.
 */
export function WeddingBrideAvatar({ size = 68, className = "", style, ...rest }: WeddingAvatarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`wedding-bride-avatar select-none ${className}`}
      style={{ overflow: "visible", ...style }}
      aria-label="Bride illustration"
      {...rest}
    >
      <defs>
        <radialGradient id="brideGlow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#F5EBC7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#801830" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brideDupatta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#9C243B" />
          <stop offset="50%" stopColor="#6E1527" />
          <stop offset="100%" stopColor="#4A0D1A" />
        </linearGradient>
      </defs>

      {/* Background Soft Aura */}
      <circle cx="50" cy="50" r="46" fill="url(#brideGlow)" />

      {/* Traditional Dupatta / Veil Drape */}
      <path
        d="M24 88C22 72 26 50 32 38C38 26 48 22 56 22C64 22 72 26 76 38C80 48 82 72 80 88"
        fill="url(#brideDupatta)"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.5"
      />

      {/* Dupatta Gold Scalloped Border */}
      <path
        d="M28 88C26 74 30 52 35 42C40 30 48 26 55 26C62 26 69 30 73 42C77 52 79 74 77 88"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="0.75"
        strokeDasharray="2 2"
      />

      {/* Head / Face Profile */}
      <ellipse cx="53" cy="46" rx="13" ry="16" fill="#FCEADB" />

      {/* Hair Bun / Partition */}
      <path
        d="M40 42C42 35 48 31 54 31C60 31 66 35 67 42C64 38 58 36 53 36C48 36 43 38 40 42Z"
        fill="#261A16"
      />

      {/* Maang Tikka (Forehead Jewel) */}
      <line x1="53.5" y1="31" x2="53.5" y2="38" stroke={WEDDING_TOKENS.color.gold.rich} strokeWidth="1" />
      <circle cx="53.5" cy="39" r="2" fill={WEDDING_TOKENS.color.gold.champagne} />
      <circle cx="53.5" cy="42" r="1" fill="#801830" />

      {/* Elegant Eye & Eyelash Profile */}
      <path d="M57 44C59 43 62 44 63 46" stroke="#261A16" strokeWidth="1" strokeLinecap="round" />
      <path d="M57 48C58.5 49 61 49 62 47.5" stroke="#261A16" strokeWidth="0.8" strokeLinecap="round" />

      {/* Traditional Nose Ring (Nath) */}
      <circle cx="61" cy="50" r="2.2" stroke={WEDDING_TOKENS.color.gold.champagne} strokeWidth="0.75" fill="none" />
      <path d="M62.5 50C65 47 67 44 68 41" stroke={WEDDING_TOKENS.color.gold.rich} strokeWidth="0.5" />

      {/* Delicate Smile */}
      <path d="M56 55C58 56.5 60 56 61 54.5" stroke="#9C243B" strokeWidth="0.8" strokeLinecap="round" />

      {/* Royal Choker / Gold Necklace */}
      <path
        d="M45 64C49 67 57 67 61 64"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M43 68C48 72 58 72 63 68"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="1.5"
        strokeLinecap="round"
      />

      {/* Embroidered Blouse / Bodice */}
      <path
        d="M36 88C38 78 44 74 53 74C62 74 68 78 70 88"
        fill="#801830"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.2"
      />
    </svg>
  );
}

/**
 * Regal Indian Groom Vector Illustration
 * Features traditional royal safa/turban, feather kalgi, and sherwani.
 */
export function WeddingGroomAvatar({ size = 68, className = "", style, ...rest }: WeddingAvatarProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`wedding-groom-avatar select-none ${className}`}
      style={{ overflow: "visible", ...style }}
      aria-label="Groom illustration"
      {...rest}
    >
      <defs>
        <radialGradient id="groomGlow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#F5EBC7" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#182042" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="groomTurban" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDFBF7" />
          <stop offset="50%" stopColor="#EFE7DA" />
          <stop offset="100%" stopColor="#D5C4A8" />
        </linearGradient>
      </defs>

      {/* Background Soft Aura */}
      <circle cx="50" cy="50" r="46" fill="url(#groomGlow)" />

      {/* Kalgi / Feather Plume */}
      <path
        d="M48 12C47 18 45 26 47 30C48 26 51 20 54 16C50 17 49 14 48 12Z"
        fill="#FDFBF7"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="0.8"
      />
      <circle cx="48" cy="30" r="2.5" fill={WEDDING_TOKENS.color.gold.rich} />
      <circle cx="48" cy="30" r="1.2" fill="#801830" />

      {/* Royal Turban (Safa) Swirls */}
      <path
        d="M32 38C34 26 44 24 54 24C64 24 71 28 73 38C69 34 60 32 52 33C42 34 35 36 32 38Z"
        fill="url(#groomTurban)"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.2"
      />
      <path
        d="M30 44C33 36 42 32 53 32C64 32 72 36 74 44C68 40 59 38 52 39C42 40 34 42 30 44Z"
        fill="url(#groomTurban)"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="1"
      />

      {/* Face & Jawline Profile */}
      <path
        d="M42 45C42 42 46 41 52 41C58 41 62 42 62 45C62 55 58 64 52 64C46 64 42 55 42 45Z"
        fill="#FCEADB"
      />

      {/* Groom Mustache & Beard Contour */}
      <path
        d="M46 54C49 55 51 54 52 53C53 54 55 55 58 54C57 56 54 57 52 56C50 57 47 56 46 54Z"
        fill="#261A16"
      />
      <path
        d="M43 50C43 56 46 62 52 62C58 62 61 56 61 50"
        stroke="#261A16"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {/* Refined Eyes */}
      <circle cx="47" cy="47" r="1.2" fill="#261A16" />
      <circle cx="56" cy="47" r="1.2" fill="#261A16" />

      {/* Royal Sherwani Collar with Gold Embroidery */}
      <path
        d="M38 72C42 66 48 64 52 64C56 64 62 66 66 72L68 88H36L38 72Z"
        fill="#FDFBF7"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.5"
      />

      {/* Sherwani Gold Placket / Buttons */}
      <line x1="52" y1="65" x2="52" y2="88" stroke={WEDDING_TOKENS.color.gold.rich} strokeWidth="1.2" />
      <circle cx="52" cy="70" r="1" fill={WEDDING_TOKENS.color.gold.rich} />
      <circle cx="52" cy="76" r="1" fill={WEDDING_TOKENS.color.gold.rich} />
      <circle cx="52" cy="82" r="1" fill={WEDDING_TOKENS.color.gold.rich} />

      {/* Royal Stole / Emerald Mala Necklace */}
      <path
        d="M43 72C46 76 58 76 61 72"
        stroke={WEDDING_TOKENS.color.emerald.base}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Universal Team Avatar
 * Renders custom uploaded logo image if available, or falls back to
 * regal Bride/Groom vector silhouettes.
 */
export function WeddingTeamAvatar({
  logoUrl,
  teamName = "",
  side = "bride",
  size = 68,
  className = "",
}: {
  logoUrl?: string | null;
  teamName?: string;
  side?: "bride" | "groom" | "neutral";
  size?: number;
  className?: string;
}) {
  const [hasError, setHasError] = React.useState(false);
  const isGroom =
    side === "groom" ||
    teamName.toLowerCase().includes("groom") ||
    teamName.toLowerCase().includes("boy") ||
    teamName.toLowerCase().includes("ladkewale");

  if (logoUrl && !hasError) {
    return (
      <img
        src={logoUrl}
        alt={teamName}
        onError={() => setHasError(true)}
        className={`wedding-team-avatar-img object-contain select-none ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  if (isGroom) {
    return <WeddingGroomAvatar size={size} className={className} />;
  }

  return <WeddingBrideAvatar size={size} className={className} />;
}
