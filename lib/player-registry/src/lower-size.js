export const LOWER_SIZE_VALUES = [
    "24",
    "26",
    "28",
    "30",
    "32",
    "34",
    "36",
    "38",
    "40",
    "42",
    "44",
];
export function isLowerSize(value) {
    if (!value)
        return false;
    return LOWER_SIZE_VALUES.includes(value.trim());
}
export function normalizeLowerSize(value) {
    if (!value?.trim())
        return null;
    const cleaned = value.trim().replace(/[^0-9]/g, "");
    return isLowerSize(cleaned) ? cleaned : null;
}
export function lowerSizeLabel(value) {
    if (!value?.trim())
        return "";
    const normalized = normalizeLowerSize(value);
    return normalized ?? value.trim();
}
