export const JERSEY_SIZE_VALUES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
export function isJerseySize(value) {
    if (!value)
        return false;
    return JERSEY_SIZE_VALUES.includes(value);
}
export function normalizeJerseySize(value) {
    if (!value?.trim())
        return null;
    const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
    const normalized = trimmed === "XXL" ? "2XL"
        : trimmed === "XXXL" ? "3XL"
            : trimmed === "XXXXL" ? "4XL"
                : trimmed === "XXXXXL" ? "5XL"
                    : trimmed;
    return isJerseySize(normalized) ? normalized : null;
}
