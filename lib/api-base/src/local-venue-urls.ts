/** Operator auction controls (same path as cloud auction-platform). */
export function localOperatorPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/auction`;
}

/** LED / big-screen display view. */
export function localDisplayPath(tournamentId: number): string {
  return `/tournament/${tournamentId}/display`;
}

/** Absolute URL on the local venue server. */
export function localVenuePublicUrl(origin: string, path: string): string {
  const base = origin.replace(/\/+$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
