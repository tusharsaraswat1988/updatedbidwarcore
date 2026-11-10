import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

// ── 1. Calligraphic Script Title ──────────────────────────────────────────
export interface WeddingScriptTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

export function WeddingScriptTitle({
  children,
  color = WEDDING_TOKENS.color.charcoal.ink,
  className = "",
  style,
  ...rest
}: WeddingScriptTitleProps) {
  const scale = WEDDING_TOKENS.typography.scale.cupTitle;
  return (
    <h1
      className={`wedding-script-title select-none text-center ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        ...style,
      }}
      {...rest}
    >
      {children}
    </h1>
  );
}

// ── 2. Classical Serif Subtitle ───────────────────────────────────────────
export interface WeddingSerifSubtitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

export function WeddingSerifSubtitle({
  children,
  color = WEDDING_TOKENS.color.charcoal.muted,
  className = "",
  style,
  ...rest
}: WeddingSerifSubtitleProps) {
  const scale = WEDDING_TOKENS.typography.scale.coupleSubtitle;
  return (
    <h2
      className={`wedding-serif-subtitle select-none tracking-widest text-center ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        textTransform: scale.textTransform,
        ...style,
      }}
      {...rest}
    >
      {children}
    </h2>
  );
}

// ── 3. Team Badge Title (Bride's XI / Groom's XI) ─────────────────────────
export interface WeddingTeamTitleProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  variant?: "bride" | "groom" | "ivory";
  className?: string;
}

export function WeddingTeamTitle({
  children,
  variant = "ivory",
  className = "",
  style,
  ...rest
}: WeddingTeamTitleProps) {
  const scale = WEDDING_TOKENS.typography.scale.teamName;
  const color =
    variant === "bride" || variant === "groom" || variant === "ivory"
      ? WEDDING_TOKENS.color.ivory.pure
      : WEDDING_TOKENS.color.charcoal.ink;

  return (
    <span
      className={`wedding-team-title select-none ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        fontWeight: scale.fontWeight,
        fontStyle: scale.fontStyle,
        color,
        textShadow: "0 1px 3px rgba(0, 0, 0, 0.4)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── 4. Dominant Score Numerals (e.g. 72/3) ─────────────────────────────────
export interface WeddingScoreNumProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

export function WeddingScoreNum({
  children,
  color = WEDDING_TOKENS.color.charcoal.ink,
  className = "",
  style,
  ...rest
}: WeddingScoreNumProps) {
  const scale = WEDDING_TOKENS.typography.scale.primaryScore;
  return (
    <span
      className={`wedding-score-num select-none tabular-nums font-bold ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── 5. Uppercase Label (CRR, PROJECTED, OVERS) ─────────────────────────────
export interface WeddingLabelProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

export function WeddingLabel({
  children,
  color = WEDDING_TOKENS.color.charcoal.muted,
  className = "",
  style,
  ...rest
}: WeddingLabelProps) {
  const scale = WEDDING_TOKENS.typography.scale.analyticsLabel;
  return (
    <span
      className={`wedding-label select-none uppercase font-bold tracking-wider ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        textTransform: scale.textTransform,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── 6. Formatted Metric Value (e.g. 8.31, 83) ───────────────────────────────
export interface WeddingValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

export function WeddingValue({
  children,
  color = WEDDING_TOKENS.color.charcoal.espresso,
  className = "",
  style,
  ...rest
}: WeddingValueProps) {
  const scale = WEDDING_TOKENS.typography.scale.analyticsValue;
  return (
    <span
      className={`wedding-value select-none tabular-nums font-bold ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}

// ── 7. Player Name Typography (e.g. Riya S., Arjun M.) ─────────────────────
export interface WeddingPlayerNameProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
  color?: string;
  isOnStrike?: boolean;
  className?: string;
}

export function WeddingPlayerName({
  children,
  color = WEDDING_TOKENS.color.charcoal.ink,
  isOnStrike = false,
  className = "",
  style,
  ...rest
}: WeddingPlayerNameProps) {
  const scale = WEDDING_TOKENS.typography.scale.playerLine;
  return (
    <span
      className={`wedding-player-name inline-flex items-center gap-1.5 select-none font-semibold ${className}`}
      style={{
        fontFamily: scale.fontFamily,
        fontSize: `${scale.fontSize}px`,
        lineHeight: scale.lineHeight,
        letterSpacing: scale.letterSpacing,
        color,
        fontWeight: scale.fontWeight,
        ...style,
      }}
      {...rest}
    >
      {isOnStrike && (
        <span
          className="text-[11px] leading-none"
          style={{ color: WEDDING_TOKENS.color.semantic.strikerMark }}
        >
          ▶
        </span>
      )}
      {children}
    </span>
  );
}
