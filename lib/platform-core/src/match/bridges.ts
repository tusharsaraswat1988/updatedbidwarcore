import type { ParticipantKindId } from "../competition/types.ts";
import type {
  MatchIdentity,
  MatchOfficial,
  MatchSide,
  MatchSideSubject,
} from "./types.ts";
import {
  resolveMatchConfiguration,
  type ScoringMatchRuntimeColumns,
} from "./configuration.ts";
import { resolveMatchLifecycle } from "./lifecycle.ts";

/** Runtime row for ScoringMatchesBridge — never returned from product APIs. */
export type ScoringMatchBridgeRow = ScoringMatchRuntimeColumns & {
  matchTypeId?: string | null;
  lifecycleStatus?: string | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeSideJson?: {
    teamId?: number;
    playerIds?: number[];
    displayName?: string;
  } | null;
  awaySideJson?: {
    teamId?: number;
    playerIds?: number[];
    displayName?: string;
  } | null;
  officialsJson?: {
    scorers?: number[];
    matchReferee?: number | null;
  } | null;
};

export type SideSubjectHint = {
  teamId?: number | null;
  teamDisplayName?: string | null;
  participantId?: string | null;
  participantKind?: ParticipantKindId | null;
  participantDisplayName?: string | null;
};

export type OfficialSignal = {
  participantId: string;
  participantKind: ParticipantKindId;
  displayName: string;
  roleId: string;
  status?: string | null;
};

function subjectFromHint(hint: SideSubjectHint | null | undefined): MatchSideSubject | null {
  if (!hint) return null;
  if (hint.participantId) {
    return {
      kind: "participant",
      id: hint.participantId,
      participantKind: hint.participantKind ?? "individual",
      displayName: hint.participantDisplayName ?? hint.participantId,
    };
  }
  if (hint.teamId != null && hint.teamId > 0) {
    return {
      kind: "team",
      id: String(hint.teamId),
      displayName: hint.teamDisplayName ?? `Team ${hint.teamId}`,
    };
  }
  return null;
}

/** ScoringMatchesBridge → Match Identity (product). */
export function mapScoringMatchToIdentity(row: ScoringMatchBridgeRow): MatchIdentity {
  return {
    id: String(row.id),
    tournamentId: row.tournamentId,
    typeId: row.matchTypeId ?? "league",
  };
}

/** ScoringMatchesBridge → Match Configuration (product). */
export function mapScoringMatchToConfiguration(
  row: ScoringMatchBridgeRow,
  opts?: { planVersion?: number | null },
) {
  return resolveMatchConfiguration(row, opts);
}

/** ScoringMatchesBridge → Match Lifecycle (separate module). */
export function mapScoringMatchToLifecycle(row: ScoringMatchBridgeRow) {
  return resolveMatchLifecycle(
    String(row.id),
    row.tournamentId,
    row.lifecycleStatus,
    !!row.configurationLocked,
  );
}

/**
 * ScoringMatchesBridge → Match Sides.
 * Platform slots are side_a / side_b — never home/away presentation labels.
 */
export function mapScoringMatchToSides(
  row: ScoringMatchBridgeRow,
  hints?: { sideA?: SideSubjectHint | null; sideB?: SideSubjectHint | null },
): MatchSide[] {
  let sideAHint: SideSubjectHint = hints?.sideA ?? {
    teamId: row.homeTeamId,
    teamDisplayName: row.homeSideJson?.displayName ?? null,
  };
  let sideBHint: SideSubjectHint = hints?.sideB ?? {
    teamId: row.awayTeamId,
    teamDisplayName: row.awaySideJson?.displayName ?? null,
  };

  // Prefer participant subject when side JSON carries player-only contests.
  if (
    !sideAHint.participantId &&
    row.homeSideJson?.playerIds?.length &&
    (!row.homeTeamId || row.homeTeamId <= 0)
  ) {
    const pid = row.homeSideJson.playerIds[0];
    sideAHint = {
      ...sideAHint,
      participantId: `auction-player:${pid}`,
      participantKind: "individual",
      participantDisplayName: row.homeSideJson.displayName ?? `Player ${pid}`,
    };
  }
  if (
    !sideBHint.participantId &&
    row.awaySideJson?.playerIds?.length &&
    (!row.awayTeamId || row.awayTeamId <= 0)
  ) {
    const pid = row.awaySideJson.playerIds[0];
    sideBHint = {
      ...sideBHint,
      participantId: `auction-player:${pid}`,
      participantKind: "individual",
      participantDisplayName: row.awaySideJson.displayName ?? `Player ${pid}`,
    };
  }

  const subjectA = subjectFromHint(sideAHint);
  const subjectB = subjectFromHint(sideBHint);

  return [
    {
      sideId: "side_a",
      subject: subjectA,
      roles: subjectA ? ["competitor"] : [],
    },
    {
      sideId: "side_b",
      subject: subjectB,
      roles: subjectB ? ["competitor"] : [],
    },
  ];
}

/** ScoringMatchesBridge → Match Officials (members). */
export function mapScoringMatchToOfficials(
  row: ScoringMatchBridgeRow,
  signals?: readonly OfficialSignal[],
): MatchOfficial[] {
  if (signals && signals.length > 0) {
    return signals.map((s) => ({
      participant: {
        id: s.participantId,
        kind: s.participantKind,
        displayName: s.displayName,
      },
      roleId: s.roleId,
      status: s.status ?? "active",
    }));
  }

  const officials: MatchOfficial[] = [];
  const json = row.officialsJson;
  if (!json) return officials;

  for (const scorerId of json.scorers ?? []) {
    officials.push({
      participant: {
        id: `official-ref:${scorerId}`,
        kind: "individual",
        displayName: `Scorer ${scorerId}`,
      },
      roleId: "scorer",
      status: "active",
    });
  }
  if (json.matchReferee != null) {
    officials.push({
      participant: {
        id: `official-ref:${json.matchReferee}`,
        kind: "individual",
        displayName: `Referee ${json.matchReferee}`,
      },
      roleId: "referee",
      status: "active",
    });
  }
  return officials;
}
