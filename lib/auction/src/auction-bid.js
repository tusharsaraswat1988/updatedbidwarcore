/**
 * Shared auction bid math — used by API validation and all bidding UIs.
 *
 * Before any team has bid (currentBidTeamId is null), currentBid holds the
 * base/reserve price and the opening bid must match it exactly.
 * After a bidder exists, each raise must be exactly currentBid + bidIncrement.
 */
export function computeNextBidAmount(input) {
    const currentBid = input.currentBid ?? 0;
    if (input.currentBidTeamId == null) {
        return currentBid;
    }
    return currentBid + input.bidIncrement;
}
export function validateBidAmount(amount, input) {
    const expected = computeNextBidAmount(input);
    if (amount === expected) {
        return { ok: true };
    }
    const formatted = expected.toLocaleString("en-IN");
    if (input.currentBidTeamId == null) {
        return {
            ok: false,
            error: `Opening bid must be exactly ₹${formatted}`,
        };
    }
    return {
        ok: false,
        error: `Bid must be exactly ₹${formatted} (current bid + increment)`,
    };
}
