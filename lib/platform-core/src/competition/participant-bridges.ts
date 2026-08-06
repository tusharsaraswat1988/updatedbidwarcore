import type { Participant, ParticipantKindId, RegistrationStatusId } from "./types.ts";

/** Minimal runtime row shapes — bridges never leak these upward. */
export type AuctionPlayerRow = {
  id: number;
  name: string;
  status?: string | null;
  withdrawnAt?: Date | string | null;
};

export type BadmintonRegistrationRow = {
  id: number;
  status?: string | null;
  player1Name?: string | null;
  player2Name?: string | null;
  matchType?: string | null;
};

function mapAuctionRegistrationStatus(row: AuctionPlayerRow): RegistrationStatusId | string {
  if (row.withdrawnAt) return "withdrawn";
  const status = (row.status ?? "").toLowerCase();
  if (status === "sold" || status === "retained" || status === "available" || status === "unsold") {
    return "accepted";
  }
  return status || "accepted";
}

function mapBadmintonRegistrationStatus(status: string | null | undefined): RegistrationStatusId | string {
  const s = (status ?? "pending").toLowerCase();
  if (s === "accepted") return "accepted";
  if (s === "withdrawn") return "withdrawn";
  if (s === "disqualified") return "rejected";
  if (s === "pending") return "pending_verification";
  return s;
}

/** Sport Bridge: auction/cricket players → Participant views. */
export function mapAuctionPlayersToParticipants(
  sportId: string,
  rows: readonly AuctionPlayerRow[],
): Participant[] {
  return rows.map((row) => ({
    id: `auction-player:${row.id}`,
    kind: "individual" as ParticipantKindId,
    displayName: row.name,
    sportId,
    registration: {
      id: String(row.id),
      status: mapAuctionRegistrationStatus(row),
    },
    eligibility: {
      eligible: !row.withdrawnAt,
      reasons: row.withdrawnAt ? ["withdrawn"] : [],
    },
  }));
}

/** Sport Bridge: badminton registrations → Participant views. */
export function mapBadmintonRegistrationsToParticipants(
  sportId: string,
  rows: readonly BadmintonRegistrationRow[],
): Participant[] {
  return rows.map((row) => {
    const isDoubles = Boolean(row.player2Name) || (row.matchType ?? "").includes("doubles");
    const displayName = row.player2Name
      ? `${row.player1Name ?? "Player"} / ${row.player2Name}`
      : (row.player1Name ?? `Entry #${row.id}`);
    return {
      id: `badminton-registration:${row.id}`,
      kind: (isDoubles ? "team" : "individual") as ParticipantKindId,
      displayName,
      sportId,
      registration: {
        id: String(row.id),
        status: mapBadmintonRegistrationStatus(row.status),
      },
      eligibility: {
        eligible: mapBadmintonRegistrationStatus(row.status) !== "withdrawn",
        reasons: [],
      },
    };
  });
}
