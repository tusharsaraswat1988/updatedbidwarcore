import { useState, type ReactNode } from "react";

type Props = {
  logoUrl?: string | null;
  shortCode?: string | null;
  teamName?: string;
  teamColor: string;
  className?: string;
  textClassName?: string;
  imageClassName?: string;
  alt?: string;
  fallback?: ReactNode;
};

function isUsableLogoUrl(url?: string | null): url is string {
  return !!url && !url.startsWith("data:");
}

export function TeamLogo({
  logoUrl,
  shortCode,
  teamName,
  teamColor,
  className = "w-11 h-11 rounded-xl",
  textClassName = "text-sm",
  imageClassName = "object-contain",
  alt,
  fallback,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showLogo = isUsableLogoUrl(logoUrl) && !failed;
  const fallbackLabel = (shortCode || teamName?.substring(0, 3) || "?").toUpperCase();

  if (showLogo) {
    return (
      <div
        className={`${className} flex-shrink-0 overflow-hidden flex items-center justify-center`}
        style={{ backgroundColor: `${teamColor}15`, border: `2px solid ${teamColor}55` }}
      >
        <img
          src={logoUrl}
          alt={alt ?? teamName ?? shortCode ?? "Team logo"}
          className={`w-full h-full ${imageClassName}`}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  if (fallback) {
    return (
      <div
        className={`${className} flex-shrink-0 overflow-hidden flex items-center justify-center`}
        style={{ backgroundColor: `${teamColor}15`, border: `2px solid ${teamColor}55` }}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={`${className} flex items-center justify-center font-display font-black flex-shrink-0 ${textClassName}`}
      style={{ backgroundColor: `${teamColor}30`, color: teamColor, border: `2px solid ${teamColor}55` }}
    >
      {fallbackLabel}
    </div>
  );
}
