import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatusBadge
 * Auction: `.status-active/trial/done/locked` helpers + operator status pills
 * Badminton: Badge / status chip language on hub headers
 */
export type StatusBadgeTone = "active" | "trial" | "done" | "locked" | "neutral" | "warning" | "danger";

const TONE_CLASS: Record<StatusBadgeTone, string> = {
  active: "bg-green-500/15 text-green-400 border-green-500/30",
  trial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  done: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  locked: "bg-red-500/15 text-red-400 border-red-500/30",
  neutral: "bg-white/5 text-muted-foreground border-white/15",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  danger: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
