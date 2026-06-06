export type SponsorLogo = {
  url: string;
  name?: string;
  type?: string;
};

export function normalizeSponsorLogos(raw: unknown): SponsorLogo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry): SponsorLogo => {
      const e = entry as Record<string, unknown>;
      return {
        url: typeof e.url === "string" ? e.url : "",
        name: typeof e.name === "string" ? e.name : "",
        type: typeof e.type === "string" ? e.type : "",
      };
    })
    .filter(l => l.url.trim());
}

export function parseSponsorLogos(json: string | null | undefined): SponsorLogo[] {
  if (!json) return [];
  try {
    return normalizeSponsorLogos(JSON.parse(json));
  } catch {
    return [];
  }
}

/** Ticker label — names only; sponsors without a name are omitted from the ribbon. */
export function formatSponsorTickerSegment(logo: SponsorLogo): string | null {
  const name = logo.name?.trim();
  return name || null;
}

export function buildSponsorTickerText(logos: SponsorLogo[]): string {
  const names = logos.map(formatSponsorTickerSegment).filter((n): n is string => !!n);
  if (!names.length) return "";
  return names.join(" • ") + " • ";
}
