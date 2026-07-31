/** Parse organizer-defined bid value options from JSON text. Returns sorted ascending values. */
export function parseBidValueOptions(raw) {
    if (!raw?.trim())
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        const values = parsed
            .map((v) => (typeof v === "number" ? v : parseInt(String(v), 10)))
            .filter((n) => Number.isFinite(n) && n > 0);
        return [...new Set(values)].sort((a, b) => a - b);
    }
    catch {
        return [];
    }
}
export function serializeBidValueOptions(values) {
    const cleaned = [...new Set(values.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    return JSON.stringify(cleaned);
}
export function isPlayerBidValueMode(config) {
    return config.bidValueMode === "player";
}
/** Normalize organizer bid options from API (array) or DB (JSON string). */
export function getOrganizerBidOptions(config) {
    const raw = config.bidValueOptions;
    if (Array.isArray(raw)) {
        return [...new Set(raw.filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    }
    return parseBidValueOptions(raw);
}
/** Player self-selection UI is shown only when mode is player and options are configured. */
export function shouldShowPlayerBidValueSelector(config) {
    return isPlayerBidValueMode(config) && getOrganizerBidOptions(config).length > 0;
}
export function bidValueSourceLabel(source) {
    return source === "player" ? "Player Selected" : "System Assigned";
}
/**
 * Resolve stored player bid fields from tournament config + input.
 * Player-selected mode replaces only the starting input (basePrice); category logic downstream is unchanged.
 */
export function resolvePlayerBidFields(tournament, input) {
    if (shouldShowPlayerBidValueSelector(tournament)) {
        const options = getOrganizerBidOptions(tournament);
        const selected = input.selectedBidValue ?? input.basePrice;
        if (selected == null || !Number.isFinite(selected)) {
            return { ok: false, error: "Please select your bid value.", field: "selectedBidValue" };
        }
        if (!options.includes(selected)) {
            return { ok: false, error: "Selected bid value is not allowed.", field: "selectedBidValue" };
        }
        return {
            ok: true,
            fields: {
                basePrice: selected,
                selectedBidValue: selected,
                bidValueSource: "player",
            },
        };
    }
    const basePrice = input.basePrice ?? tournament.minBid ?? 100000;
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return { ok: false, error: "Base price must be a positive amount.", field: "basePrice" };
    }
    return {
        ok: true,
        fields: {
            basePrice,
            selectedBidValue: null,
            bidValueSource: "system",
        },
    };
}
/** Whether organizer may edit player bid value fields (before auction starts). */
export function canEditPlayerBidValue(tournamentStatus) {
    return tournamentStatus === "setup";
}
