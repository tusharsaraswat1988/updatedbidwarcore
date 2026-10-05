/**
 * Pure badminton branding helpers (no database imports — safe for unit tests).
 */
export const BADMINTON_OVERLAY_SCENES = [
    "auto",
    "compact",
    "full",
    "intro",
    "winner",
    "sponsor",
    "next",
    "multi",
    "results",
    "leaderboards",
];
export const BADMINTON_VENUE_SCENES = [
    "auto",
    "live_score",
    "standby",
    "multi",
    "intro",
    "winner",
    "sponsor",
    "banner",
    "next",
    "results",
    "leaderboards",
];
function parseScoreBoardSponsor(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const o = raw;
    const logoUrl = typeof o.logoUrl === "string" && o.logoUrl.trim() ? o.logoUrl.trim() : null;
    const logoPublicId = typeof o.logoPublicId === "string" && o.logoPublicId.trim()
        ? o.logoPublicId.trim()
        : null;
    const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : null;
    const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : null;
    if (!logoUrl && !name && !title)
        return null;
    return { logoUrl, logoPublicId, name, title };
}
/** Badminton LED/OBS sponsors — stored separately from auction `tournaments.sponsor_logos`. */
export function resolveBadmintonSponsorLogos(brandingRaw, tournamentSponsorLogos) {
    if ("sponsorLogos" in brandingRaw) {
        const value = brandingRaw.sponsorLogos;
        if (value === null || value === undefined)
            return null;
        return typeof value === "string" ? value : null;
    }
    return tournamentSponsorLogos ?? null;
}
function broadcastBlock(scoringSettingsJson) {
    return (scoringSettingsJson?.broadcast ?? {});
}
function parsePrimaryBroadcastMatchId(scoringSettingsJson) {
    const broadcast = broadcastBlock(scoringSettingsJson);
    const raw = broadcast.primaryMatchId;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0)
        return Math.floor(raw);
    if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
        const n = parseInt(raw.trim(), 10);
        return n > 0 ? n : null;
    }
    return null;
}
function parsePositiveId(raw) {
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0)
        return Math.floor(raw);
    if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
        const n = parseInt(raw.trim(), 10);
        return n > 0 ? n : null;
    }
    return null;
}
export function parseUpNextMatchId(raw) {
    return parsePositiveId(raw);
}
export function parseSponsorUrlKey(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}
export function parseOverlayScene(raw) {
    if (typeof raw === "string" && BADMINTON_OVERLAY_SCENES.includes(raw)) {
        return raw;
    }
    return "auto";
}
export function parseVenueScene(raw) {
    if (typeof raw === "string" && BADMINTON_VENUE_SCENES.includes(raw)) {
        return raw;
    }
    return "auto";
}
export function parseVenueMusicPlaying(raw) {
    return raw === true;
}
export function parseVenueMusicUrl(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}
export function parseVenueMusicFileName(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed.slice(0, 180) : null;
}
export function parseVenueMusicVolume(raw) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
        return Math.max(0, Math.min(100, Math.round(raw)));
    }
    if (typeof raw === "string" && raw.trim() !== "") {
        const n = Number(raw);
        if (Number.isFinite(n))
            return Math.max(0, Math.min(100, Math.round(n)));
    }
    return 80;
}
/** Badminton override → auction break → platform default. */
export function resolveVenueMusicUrl(badmintonOverride, auctionBreakUrl, platformDefaultUrl) {
    const override = badmintonOverride?.trim();
    if (override)
        return override;
    const auction = auctionBreakUrl?.trim();
    if (auction)
        return auction;
    const platform = platformDefaultUrl?.trim();
    if (platform)
        return platform;
    return null;
}
export function parseVenueBannerUrl(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}
export function parseVenueBannerPublicId(raw) {
    if (typeof raw !== "string")
        return null;
    const trimmed = raw.trim();
    return trimmed ? trimmed : null;
}
export function parseVenueBannerFit(raw) {
    return raw === "contain" ? "contain" : "cover";
}
/** Badminton override → auction main banner. */
export function resolveVenueBannerUrl(badmintonOverride, auctionMainBannerUrl) {
    const override = badmintonOverride?.trim();
    if (override)
        return override;
    const auction = auctionMainBannerUrl?.trim();
    if (auction)
        return auction;
    return null;
}
export function resolveVenueBannerFit(broadcast, auctionFit) {
    // Explicit badminton fit wins even when the image falls through from auction.
    if ("venueBannerFit" in broadcast)
        return parseVenueBannerFit(broadcast.venueBannerFit);
    return parseVenueBannerFit(auctionFit);
}
export function getBadmintonBranding(tournament, scoringSettingsJson, platformBreakMusicUrl) {
    const raw = (scoringSettingsJson?.branding ?? {});
    const broadcast = broadcastBlock(scoringSettingsJson);
    const venueMusicUrl = parseVenueMusicUrl(broadcast.venueMusicUrl);
    const venueBannerUrl = parseVenueBannerUrl(broadcast.venueBannerUrl);
    const auctionMainBannerUrl = tournament.mainBannerUrl?.trim() || null;
    return {
        displayName: typeof raw.displayName === "string" && raw.displayName.trim()
            ? raw.displayName.trim()
            : tournament.name,
        logoUrl: tournament.logoUrl ?? null,
        sponsorLogos: resolveBadmintonSponsorLogos(raw, tournament.sponsorLogos),
        venue: tournament.venue ?? null,
        organizerName: tournament.organizerName ?? null,
        primaryColor: typeof raw.primaryColor === "string" && raw.primaryColor.trim()
            ? raw.primaryColor.trim()
            : "#0070f3",
        accentColor: typeof raw.accentColor === "string" && raw.accentColor.trim()
            ? raw.accentColor.trim()
            : "#4fc3f7",
        scoreBoardSponsor: parseScoreBoardSponsor(raw.scoreBoardSponsor),
        primaryBroadcastMatchId: parsePrimaryBroadcastMatchId(scoringSettingsJson),
        overlayScene: parseOverlayScene(broadcast.overlayScene),
        venueScene: parseVenueScene(broadcast.venueScene),
        upNextMatchId: parseUpNextMatchId(broadcast.upNextMatchId),
        spotlightSponsorUrl: parseSponsorUrlKey(broadcast.spotlightSponsorUrl),
        pinnedSponsorUrl: parseSponsorUrlKey(broadcast.pinnedSponsorUrl),
        venueMusicPlaying: parseVenueMusicPlaying(broadcast.venueMusicPlaying),
        venueMusicUrl,
        venueMusicFileName: venueMusicUrl
            ? parseVenueMusicFileName(broadcast.venueMusicFileName)
            : null,
        venueMusicVolume: parseVenueMusicVolume(broadcast.venueMusicVolume),
        resolvedVenueMusicUrl: resolveVenueMusicUrl(venueMusicUrl, tournament.breakEndMusicUrl, platformBreakMusicUrl),
        venueBannerUrl,
        venueBannerPublicId: venueBannerUrl
            ? parseVenueBannerPublicId(broadcast.venueBannerPublicId)
            : null,
        venueBannerFit: parseVenueBannerFit(broadcast.venueBannerFit),
        auctionMainBannerUrl,
        resolvedVenueBannerUrl: resolveVenueBannerUrl(venueBannerUrl, auctionMainBannerUrl),
        resolvedVenueBannerFit: resolveVenueBannerFit(broadcast, tournament.mainBannerFit),
    };
}
