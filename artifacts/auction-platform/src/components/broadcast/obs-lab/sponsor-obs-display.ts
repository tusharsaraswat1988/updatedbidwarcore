import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  getSponsorsByPriority,
  resolveSponsorPriorityType,
  SponsorPriorityType,
} from "@/lib/sponsor-logo";
import type { SponsorBroadcastTier } from "@/lib/sponsor-broadcast-priority-styles";
import { sponsorBroadcastTier } from "@/lib/sponsor-broadcast-priority-styles";

const DEFAULT_CAROUSEL_MS = 4000;
const TITLE_CAROUSEL_MS = 6500;
const CO_CAROUSEL_MS = 5500;

const LOGO_SCALE: Record<SponsorBroadcastTier, number> = {
  title: 1.12,
  co_sponsor: 1.08,
  normal: 1,
};

export function getSponsorCarouselRotateMs(logo: SponsorLogo): number {
  const tier = resolveSponsorPriorityType(logo);
  if (tier === SponsorPriorityType.TITLE) return TITLE_CAROUSEL_MS;
  if (tier === SponsorPriorityType.CO_SPONSOR) return CO_CAROUSEL_MS;
  return DEFAULT_CAROUSEL_MS;
}

export function getSponsorCarouselLogoScale(logo: SponsorLogo): number {
  return LOGO_SCALE[sponsorBroadcastTier(resolveSponsorPriorityType(logo))];
}

function typeBucket(type: string | undefined): "venue" | "media" | "team" | "other" {
  const t = (type ?? "").toLowerCase();
  if (/venue/i.test(t)) return "venue";
  if (/media/i.test(t)) return "media";
  if (/team/i.test(t)) return "team";
  return "other";
}

/** OBS ticker order: Title → Co → Powered By → Venue → Media → Team → Other */
export function sortSponsorsForObsTicker(logos: SponsorLogo[]): SponsorLogo[] {
  const ordered = getSponsorsByPriority(logos);
  const titleCo: SponsorLogo[] = [];
  const venue: SponsorLogo[] = [];
  const media: SponsorLogo[] = [];
  const team: SponsorLogo[] = [];
  const other: SponsorLogo[] = [];

  for (const logo of ordered) {
    const tier = resolveSponsorPriorityType(logo);
    if (tier === SponsorPriorityType.TITLE || tier === SponsorPriorityType.CO_SPONSOR) {
      titleCo.push(logo);
      continue;
    }
    switch (typeBucket(logo.type)) {
      case "venue":
        venue.push(logo);
        break;
      case "media":
        media.push(logo);
        break;
      case "team":
        team.push(logo);
        break;
      default:
        other.push(logo);
    }
  }

  return [...titleCo, ...venue, ...media, ...team, ...other];
}
