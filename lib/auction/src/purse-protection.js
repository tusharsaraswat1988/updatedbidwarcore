import { computeEffectiveCapacity } from "./purse-capacity";
export function computePurseProtection(input) {
    const { purse, purseUsed, boosterTotal, playersBought, minimumSquadSize: minSquadSize, maximumSquadSize: maxSquadSize, minBid: tournamentMinBid, } = input;
    const originalPurse = purse;
    const effectiveCapacity = computeEffectiveCapacity(originalPurse, boosterTotal);
    const purseRemaining = effectiveCapacity - purseUsed;
    const base = {
        originalPurse,
        boosterTotal,
        effectiveCapacity,
        purseRemaining,
        lowestBasePrice: minSquadSize > 0 ? tournamentMinBid : 0,
        maximumSquadSize: maxSquadSize,
        playersBought,
    };
    if (minSquadSize === 0) {
        return {
            ...base,
            slotsRequired: 0,
            reservePurse: 0,
            spendablePurse: purseRemaining,
            futurePlayersBought: playersBought + 1,
            futureSlotsRequired: 0,
            futureReservePurse: 0,
            maxAllowedBid: purseRemaining,
        };
    }
    const slotsRequired = Math.max(0, minSquadSize - playersBought);
    const futurePlayersBought = playersBought + 1;
    const futureSlotsRequired = Math.max(0, minSquadSize - futurePlayersBought);
    const reservePurse = slotsRequired * tournamentMinBid;
    const spendablePurse = slotsRequired === 0 ? purseRemaining : Math.max(0, purseRemaining - reservePurse);
    const futureReservePurse = futureSlotsRequired * tournamentMinBid;
    const maxAllowedBid = Math.max(0, purseRemaining - futureReservePurse);
    return {
        ...base,
        slotsRequired,
        reservePurse,
        spendablePurse,
        futurePlayersBought,
        futureSlotsRequired,
        futureReservePurse,
        maxAllowedBid,
    };
}
/** Format a bid-rejection message using future (post-purchase) reserve state. */
export function formatPurseProtectionBidError(protection, fallback = "Insufficient purse") {
    if (protection.futureReservePurse > 0) {
        const slots = protection.futureSlotsRequired;
        return `Insufficient spendable purse — ₹${protection.futureReservePurse.toLocaleString("en-IN")} reserved for ${slots} minimum squad slot${slots !== 1 ? "s" : ""} after purchase`;
    }
    return fallback;
}
