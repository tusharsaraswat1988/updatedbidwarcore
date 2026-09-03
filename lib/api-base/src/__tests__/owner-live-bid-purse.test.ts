import { describe, expect, it } from "vitest";
import { computePurseProtection } from "../purse-protection";
import {
  hasAuthoritativePurseFields,
  resolveOwnerLiveBidFooterPurse,
  selectAuthoritativeTeamPurse,
  shouldPreferEmbeddedTeamPurses,
  uiBiddingLimit,
  uiReserveDisplay,
} from "../purse-protection-expect";

/** CASE 1 fixture: 15.00 L purse, 11-slot min squad × 10k min bid = 1.10 L reserve. */
const EXAMPLE = {
  purse: 1_500_000,
  purseUsed: 0,
  boosterTotal: 0,
  playersBought: 0,
  minimumSquadSize: 11,
  maximumSquadSize: 18,
  minBid: 10_000,
};

function snapshotFor(
  protection: ReturnType<typeof computePurseProtection>,
  teamId = 7,
  extra: { purseUsed?: number; boosterTotal?: number } = {},
) {
  return {
    teamId,
    originalPurse: protection.originalPurse,
    boosterTotal: extra.boosterTotal ?? protection.boosterTotal,
    effectiveCapacity: protection.effectiveCapacity,
    purse: protection.effectiveCapacity,
    purseUsed: extra.purseUsed ?? 0,
    purseRemaining: protection.purseRemaining,
    reservePurse: protection.reservePurse,
    spendablePurse: protection.spendablePurse,
    slotsRequired: protection.slotsRequired,
    futureReservePurse: protection.futureReservePurse,
    futureSlotsRequired: protection.futureSlotsRequired,
    maxAllowedBid: protection.maxAllowedBid,
    playersBought: protection.playersBought,
  };
}

describe("15.00 L / 1.10 L owner-vs-organizer purse snapshot", () => {
  it("CASE 1: idle team — reserve 1.10 L, spendable 13.90 L, maxAllowedBid respects future reserve", () => {
    const p = computePurseProtection(EXAMPLE);

    expect(p.purseRemaining).toBe(1_500_000);
    expect(p.slotsRequired).toBe(11);
    expect(p.reservePurse).toBe(110_000);
    expect(p.spendablePurse).toBe(1_390_000);
    expect(p.futureSlotsRequired).toBe(10);
    expect(p.futureReservePurse).toBe(100_000);
    expect(p.maxAllowedBid).toBe(1_400_000);

    const row = snapshotFor(p);
    expect(uiReserveDisplay(row)).toBe(110_000);
    expect(uiBiddingLimit(row)).toBe(1_400_000);
    expect(uiBiddingLimit(row)).not.toBe(p.spendablePurse);

    const footer = resolveOwnerLiveBidFooterPurse(row, { purse: 1_500_000, purseUsed: 0 });
    expect(footer.reservePurse).toBe(110_000);
    expect(footer.maxAllowedBid).toBe(1_400_000);
    expect(footer.purseRemaining).toBe(1_500_000);
  });

  it("CASE 2: after buying a player, reserve drops by one min-bid slot", () => {
    const afterBuy = computePurseProtection({
      ...EXAMPLE,
      purseUsed: 50_000,
      playersBought: 1,
    });

    expect(afterBuy.slotsRequired).toBe(10);
    expect(afterBuy.reservePurse).toBe(100_000);
    expect(afterBuy.futureSlotsRequired).toBe(9);
    expect(afterBuy.futureReservePurse).toBe(90_000);
    expect(afterBuy.purseRemaining).toBe(1_450_000);
    expect(afterBuy.maxAllowedBid).toBe(1_360_000);
  });

  it("CASE 3: reserve is 0 only after the minimum squad is already filled", () => {
    const filled = computePurseProtection({
      ...EXAMPLE,
      purseUsed: 400_000,
      playersBought: 11,
    });
    expect(filled.slotsRequired).toBe(0);
    expect(filled.reservePurse).toBe(0);
    expect(filled.futureReservePurse).toBe(0);
    expect(filled.maxAllowedBid).toBe(1_100_000);

    const stillShort = computePurseProtection({
      ...EXAMPLE,
      purseUsed: 350_000,
      playersBought: 10,
    });
    expect(stillShort.reservePurse).toBe(10_000);
    expect(stillShort.reservePurse).not.toBe(0);
  });

  it("CASE 4: Owner LiveBid footer uses the same reserve/maxAllowedBid as Organizer snapshot", () => {
    const p = computePurseProtection(EXAMPLE);
    const organizerRow = snapshotFor(p);
    const ownerFooter = resolveOwnerLiveBidFooterPurse(organizerRow, {
      purse: 1_500_000,
      purseUsed: 0,
    });

    expect(ownerFooter.reservePurse).toBe(organizerRow.reservePurse);
    expect(ownerFooter.maxAllowedBid).toBe(organizerRow.maxAllowedBid);
    expect(ownerFooter.purseRemaining).toBe(organizerRow.purseRemaining);
  });

  it("CASE 5: idle refresh does not fall back to reserve=0 / maxBid=full purse", () => {
    const p = computePurseProtection(EXAMPLE);
    const queried = [snapshotFor(p)];
    const selected = selectAuthoritativeTeamPurse(7, [], queried);
    const footer = resolveOwnerLiveBidFooterPurse(selected, { purse: 1_500_000, purseUsed: 0 });

    expect(shouldPreferEmbeddedTeamPurses([])).toBe(false);
    expect(footer.reservePurse).toBe(110_000);
    expect(footer.maxAllowedBid).toBe(1_400_000);
    expect(footer.reservePurse).not.toBe(0);
    expect(footer.maxAllowedBid).not.toBe(1_500_000);
  });

  it("CASE 6: reconnect during live auction keeps authoritative values; empty embed does not zero them", () => {
    const p = computePurseProtection(EXAMPLE);
    const live = [snapshotFor(p)];
    const first = selectAuthoritativeTeamPurse(7, live, undefined);
    const reconnect = selectAuthoritativeTeamPurse(7, [], live);

    expect(first?.reservePurse).toBe(110_000);
    expect(reconnect?.reservePurse).toBe(110_000);
    expect(reconnect?.maxAllowedBid).toBe(1_400_000);
  });

  it("CASE 7: purse booster changes effective purse while reserve math stays authoritative", () => {
    const boosted = computePurseProtection({ ...EXAMPLE, boosterTotal: 200_000 });
    expect(boosted.effectiveCapacity).toBe(1_700_000);
    expect(boosted.reservePurse).toBe(110_000);
    expect(boosted.spendablePurse).toBe(1_590_000);
    expect(boosted.maxAllowedBid).toBe(1_600_000);

    const footer = resolveOwnerLiveBidFooterPurse(snapshotFor(boosted, 7, { boosterTotal: 200_000 }), {
      purse: 1_500_000,
      purseUsed: 0,
    });
    expect(footer.reservePurse).toBe(110_000);
    expect(footer.maxAllowedBid).toBe(1_600_000);
    expect(footer.purseRemaining).toBe(1_700_000);
  });
});

describe("Owner footer must not treat futureReservePurse=0 as missing current reserve", () => {
  it("does not use futureReservePurse ?? reservePurse (zero future must not mask 1.10 L)", () => {
    const p = computePurseProtection({
      purse: 1_500_000,
      purseUsed: 0,
      boosterTotal: 0,
      playersBought: 0,
      minimumSquadSize: 1,
      maximumSquadSize: 18,
      minBid: 110_000,
    });
    expect(p.reservePurse).toBe(110_000);
    expect(p.futureReservePurse).toBe(0);

    const buggyUiReserve = p.futureReservePurse ?? p.reservePurse ?? 0;
    expect(buggyUiReserve).toBe(0);

    const footer = resolveOwnerLiveBidFooterPurse(snapshotFor(p), { purse: 1_500_000 });
    expect(footer.reservePurse).toBe(110_000);
    expect(footer.reservePurse).not.toBe(buggyUiReserve);
  });

  it("missing snapshot is null, not a silent reserve=0 / maxBid=purseRemaining", () => {
    expect(hasAuthoritativePurseFields(undefined)).toBe(false);
    const footer = resolveOwnerLiveBidFooterPurse(null, { purse: 1_500_000, purseUsed: 0 });
    expect(footer.reservePurse).toBeNull();
    expect(footer.maxAllowedBid).toBeNull();
    expect(footer.purseRemaining).toBe(1_500_000);
  });

  it("incomplete embed (no protection fields) yields to the analytics query", () => {
    const p = computePurseProtection(EXAMPLE);
    const incomplete = [
      {
        teamId: 7,
        purseRemaining: 1_500_000,
        purse: 1_500_000,
      },
    ];
    const queried = [snapshotFor(p)];
    expect(shouldPreferEmbeddedTeamPurses(incomplete)).toBe(false);
    expect(selectAuthoritativeTeamPurse(7, incomplete, queried)?.reservePurse).toBe(110_000);
  });
});
