import { Badge } from "@/components/ui/badge";

export type StatusTone = "green" | "red" | "amber" | "blue" | "purple" | "muted";

const TONE_CLASSES: Record<StatusTone, string> = {
  green: "bg-green-500/15 text-green-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-300",
  blue: "bg-blue-500/15 text-blue-400",
  purple: "bg-purple-500/15 text-purple-300",
  muted: "bg-muted text-muted-foreground",
};

/**
 * Shared tone-based status badge for tournament/organiser license & lock
 * state. Consolidates the StatusBadge / StatusPill / LiveStatus variants
 * that were previously re-implemented per page with slightly different
 * opacity values for the same meaning ("Live", "Locked", etc).
 *
 * For domain-specific status vocabularies (message delivery states, asset
 * config states, court states) keep using a local status->tone map and pass
 * the resolved tone here, rather than inventing new class strings.
 */
export function StatusBadge({
  tone = "muted",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge className={`${TONE_CLASSES[tone]}${className ? ` ${className}` : ""}`}>
      {children}
    </Badge>
  );
}

/** Tone for a tournament's live/lock state, shared across Dashboard, Live Ops, and Tournament Detail. */
export function tournamentLiveTone(t: { licenseStatus: string; adminLocked: boolean }): StatusTone {
  if (t.adminLocked) return "red";
  return t.licenseStatus === "active" ? "green" : "muted";
}

/** Tone for an organiser's account access state. */
export function organiserAccessTone(accessEnabled: boolean): StatusTone {
  return accessEnabled ? "green" : "red";
}
