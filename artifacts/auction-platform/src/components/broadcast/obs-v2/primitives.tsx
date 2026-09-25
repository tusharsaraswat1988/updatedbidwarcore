import type { CSSProperties, ReactNode } from "react";
import { initials } from "./format";

/**
 * Re-keys on value change so the tick animation replays.
 * Animation is clipped by the component's own overflow box.
 */
export function AnimatedValue({ value, className }: { value: string | number; className?: string }) {
  return (
    <span className={`bw-ticker-box ${className ?? ""}`}>
      <span key={String(value)} className="bw-tick">
        {value}
      </span>
    </span>
  );
}

/** Shield crest with optional logo image; falls back to short text. */
export function Crest({
  text,
  logoUrl,
  size = 64,
}: {
  text: string;
  logoUrl?: string | undefined;
  size?: number;
}) {
  const style: CSSProperties = { width: size, height: size * 1.12 };
  return (
    <div className="bw-crest" style={style}>
      {logoUrl ? <img src={logoUrl} alt={text} /> : <span>{text}</span>}
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 96 }: { name: string; photoUrl?: string | undefined; size?: number }) {
  return (
    <div className="bw-avatar" style={{ width: size, height: size }}>
      {photoUrl ? <img src={photoUrl} alt={name} /> : <span>{initials(name)}</span>}
    </div>
  );
}

/** Chamfered navy panel with gold/cyan top edge. */
export function Panel({
  children,
  className,
  style,
  edge = "gold",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  edge?: "gold" | "cyan" | "none";
}) {
  return (
    <div className={`bw-panel ${className ?? ""}`} data-edge={edge} style={style}>
      {children}
    </div>
  );
}
