import { formatDistanceToNow, isToday, isYesterday, differenceInSeconds } from "date-fns";

export function formatRelativeTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = differenceInSeconds(new Date(), date);
  if (seconds < 45) return "Just now";

  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }

  if (isYesterday(date)) {
    return "Yesterday";
  }

  return formatDistanceToNow(date, { addSuffix: true });
}
