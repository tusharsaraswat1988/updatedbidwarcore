export type BadmintonBroadcastKind = "display" | "overlay-compact" | "overlay-full" | "scorer";

export function badmintonBroadcastPath(tournamentId: number, matchId?: number) {
  const base = `/tournament/${tournamentId}/badminton/broadcast`;
  return matchId ? `${base}?match=${matchId}` : base;
}

export function badmintonBroadcastUrl(
  kind: BadmintonBroadcastKind,
  matchId: number,
  tournamentId: number,
  origin = typeof window !== "undefined" ? window.location.origin : "",
) {
  switch (kind) {
    case "display":
      return `${origin}/badminton/${matchId}/display?tid=${tournamentId}`;
    case "overlay-compact":
      return `${origin}/badminton/${matchId}/overlay?tid=${tournamentId}&type=compact`;
    case "overlay-full":
      return `${origin}/badminton/${matchId}/overlay?tid=${tournamentId}&type=full`;
    case "scorer":
      return `${origin}/badminton/${matchId}/score?tid=${tournamentId}`;
  }
}

export function badmintonQrImageUrl(targetUrl: string, size = 240) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}
