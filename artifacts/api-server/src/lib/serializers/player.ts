import type { playersTable } from "@workspace/db";

type PlayerRow = typeof playersTable.$inferSelect;

/** @deprecated Legacy cricket-shaped columns — prefer `specifications[]` when PLAYER_SPECS_V2_ENABLED. */

/** Organizer/admin player — full record including PII and payment fields. */
export function privatePlayerSerializer(p: PlayerRow) {
  return {
    id: p.id,
    serialNo: p.serialNo,
    tournamentId: p.tournamentId,
    categoryId: p.categoryId,
    teamId: p.teamId,
    name: p.name,
    city: p.city,
    role: p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    specialization: p.specialization,
    age: p.age,
    gender: p.gender ?? null,
    photoUrl: p.photoUrl,
    basePrice: p.basePrice,
    selectedBidValue: p.selectedBidValue ?? null,
    bidValueSource: p.bidValueSource ?? null,
    soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice,
    status: p.status,
    jerseyNumber: p.jerseyNumber,
    jerseySize: p.jerseySize ?? null,
    achievements: p.achievements,
    mobileNumber: p.mobileNumber,
    email: p.email ?? null,
    cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates,
    playerTag: p.playerTag ?? null,
    playerTagTeamId: p.playerTagTeamId ?? null,
    isNonPlayingMember: p.isNonPlayingMember ?? false,
    registrationPaymentStatus: p.registrationPaymentStatus ?? null,
    utrNumber: p.utrNumber ?? null,
    paymentScreenshotUrl: p.paymentScreenshotUrl ?? null,
    paymentSubmittedAt: p.paymentSubmittedAt ? p.paymentSubmittedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Public-safe player — no mobile, email, or payment fields. */
export function publicPlayerSerializer(p: PlayerRow) {
  return {
    id: p.id,
    serialNo: p.serialNo,
    tournamentId: p.tournamentId,
    categoryId: p.categoryId,
    teamId: p.teamId,
    name: p.name,
    city: p.city,
    role: p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    specialization: p.specialization,
    age: p.age,
    gender: p.gender ?? null,
    photoUrl: p.photoUrl,
    basePrice: p.basePrice,
    selectedBidValue: p.selectedBidValue ?? null,
    bidValueSource: p.bidValueSource ?? null,
    soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice,
    status: p.status,
    jerseyNumber: p.jerseyNumber,
    jerseySize: p.jerseySize ?? null,
    achievements: p.achievements,
    cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates,
    playerTag: p.playerTag ?? null,
    playerTagTeamId: p.playerTagTeamId ?? null,
    isNonPlayingMember: p.isNonPlayingMember ?? false,
    createdAt: p.createdAt.toISOString(),
  };
}

/** Minimal public player for live auction current-player card. */
export function publicAuctionPlayerSerializer(p: PlayerRow) {
  return {
    id: p.id,
    serialNo: p.serialNo,
    tournamentId: p.tournamentId,
    categoryId: p.categoryId,
    teamId: p.teamId,
    name: p.name,
    city: p.city,
    role: p.role,
    battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle,
    specialization: p.specialization,
    age: p.age,
    gender: p.gender ?? null,
    photoUrl: p.photoUrl,
    basePrice: p.basePrice,
    soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice,
    status: p.status,
    jerseyNumber: p.jerseyNumber,
    achievements: p.achievements,
    cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates,
    playerTag: p.playerTag ?? null,
    isNonPlayingMember: p.isNonPlayingMember ?? false,
    createdAt: p.createdAt.toISOString(),
  };
}
