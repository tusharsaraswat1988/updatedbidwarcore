export const JERSEY_SIZE_VALUES = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
export function isJerseySize(value) {
    if (!value)
        return false;
    return JERSEY_SIZE_VALUES.includes(value);
}
function canonicalizeJerseySize(value) {
    const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
    const normalized = trimmed === "XXL" ? "2XL"
        : trimmed === "XXXL" ? "3XL"
            : trimmed === "XXXXL" ? "4XL"
                : trimmed === "XXXXXL" ? "5XL"
                    : trimmed;
    return isJerseySize(normalized) ? normalized : null;
}
export function normalizeJerseySize(value) {
    if (!value?.trim())
        return null;
    const direct = canonicalizeJerseySize(value);
    if (direct)
        return direct;
    const paren = value.match(/\(\s*(XXS|XS|5XL|4XL|3XL|2XL|XXXXXL|XXXXL|XXXL|XXL|XL|[SML])\s*\)/i);
    return paren ? canonicalizeJerseySize(paren[1]) : null;
}
/** Numeric size and chest from the jersey chart. Length is not shown. */
export const JERSEY_SIZE_CHART = {
    XXS: { size: "32", letter: "XXS", chest: "33" },
    XS: { size: "34", letter: "XS", chest: "35" },
    S: { size: "36", letter: "S", chest: "37" },
    M: { size: "38", letter: "M", chest: "39" },
    L: { size: "40", letter: "L", chest: "41" },
    XL: { size: "42", letter: "XL", chest: "43" },
    "2XL": { size: "44", letter: "XXL", chest: "45" },
    "3XL": { size: "46", letter: "3XL", chest: "47" },
    "4XL": { size: "48", letter: "4XL", chest: "49" },
    "5XL": { size: "50", letter: "5XL", chest: "51" },
};
/** Display label. Stored value stays the letter code (S, M, 2XL, …). */
export function jerseySizeLabel(value) {
    const normalized = normalizeJerseySize(value);
    if (!normalized)
        return value?.trim() ?? "";
    const { size, letter, chest } = JERSEY_SIZE_CHART[normalized];
    return `${size} (${letter}) - ${chest}`;
}
