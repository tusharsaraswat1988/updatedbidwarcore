/**
 * Tournament Director utilities — incident timeline and match report generation.
 * All data is derived from the event log; no silent state mutations.
 */
import { BadmintonEventType } from "./events/badminton";
const PAUSE_REASON_LABELS = {
    medical: "Medical Timeout",
    technical_issue: "Technical Issue",
    weather: "Weather Delay",
    court_issue: "Court Issue",
    ops_hold: "Ops Hold",
    other: "Other",
};
const RETIREMENT_REASON_LABELS = {
    injury: "Injury",
    illness: "Illness",
    other: "Other",
};
const WALKOVER_REASON_LABELS = {
    opponent_absent: "Opponent Absent",
    forfeit: "Forfeit",
    administrative_decision: "Administrative Decision",
};
export function formatPauseReason(reason, detail) {
    const base = PAUSE_REASON_LABELS[reason] ?? reason;
    if (reason === "other" && detail)
        return detail;
    return base;
}
export function formatRetirementReason(reason) {
    if (!reason)
        return "Retirement";
    return RETIREMENT_REASON_LABELS[reason] ?? reason;
}
export function formatWalkoverReason(reason) {
    if (!reason)
        return "Walkover";
    return WALKOVER_REASON_LABELS[reason] ?? reason;
}
function formatTime(iso) {
    if (!iso)
        return "—";
    const d = typeof iso === "string" ? new Date(iso) : iso;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function incidentLabel(event) {
    const p = event.payload;
    switch (event.eventType) {
        case BadmintonEventType.MATCH_STARTED:
            return "Match Started";
        case BadmintonEventType.TOSS_CORRECTED:
            return "Toss Corrected";
        case BadmintonEventType.MATCH_PAUSED: {
            const payload = p;
            return formatPauseReason(payload.reason, payload.detail);
        }
        case BadmintonEventType.MATCH_RESUMED:
            return "Play Resumed";
        case BadmintonEventType.TIMEOUT_STARTED: {
            const payload = p;
            return payload.kind === "medical" ? "Medical Timeout" : "Timeout";
        }
        case BadmintonEventType.TIMEOUT_ENDED:
            return "Timeout Ended";
        case BadmintonEventType.INTERVAL_STARTED:
            return "Interval";
        case BadmintonEventType.INTERVAL_ENDED:
            return "Interval Ended";
        case BadmintonEventType.SIDE_CHANGED:
            return "Court Change";
        case BadmintonEventType.RETIREMENT_DECLARED: {
            const payload = p;
            return `Retirement — ${formatRetirementReason(payload.reason)}`;
        }
        case BadmintonEventType.WALKOVER_DECLARED: {
            const payload = p;
            return `Walkover — ${formatWalkoverReason(payload.reason)}`;
        }
        case BadmintonEventType.DISQUALIFICATION_DECLARED: {
            const payload = p;
            return `Disqualified — ${payload.reason}`;
        }
        case BadmintonEventType.MATCH_ENDED: {
            const payload = p;
            if (payload.reason === "normal")
                return "Match Completed";
            if (payload.reason === "abandoned")
                return "Match Force Ended";
            if (payload.reason === "retirement")
                return "Match Ended (Retirement)";
            if (payload.reason === "walkover")
                return "Match Ended (Walkover)";
            if (payload.reason === "disqualification")
                return "Match Ended (Disqualification)";
            return "Match Ended";
        }
        case BadmintonEventType.MATCH_NOTE_ADDED: {
            const payload = p;
            return `Note: ${payload.text}`;
        }
        case BadmintonEventType.MARGIN_POINTS_ASSIGNED: {
            const payload = p;
            return `Margin points assigned (+${payload.assignedMarginPoints})`;
        }
        case BadmintonEventType.GAME_ENDED:
            return "Game Completed";
        default:
            return null;
    }
}
/** Build a timestamped incident timeline from event history. */
export function deriveIncidentLog(events) {
    const entries = [];
    for (const event of events) {
        const label = incidentLabel(event);
        if (!label)
            continue;
        entries.push({
            sequence: event.sequence,
            timestamp: event.occurredAt
                ? typeof event.occurredAt === "string"
                    ? event.occurredAt
                    : event.occurredAt.toISOString()
                : new Date().toISOString(),
            label,
            actorType: event.actorType,
            actorId: event.actorId,
            eventType: event.eventType,
        });
    }
    return entries;
}
/** Filter timeline to director-relevant incidents (excludes point-by-point). */
export function deriveDirectorIncidents(events) {
    return deriveIncidentLog(events).filter((e) => e.eventType !== BadmintonEventType.POINT_WON &&
        e.eventType !== BadmintonEventType.POINT_UNDONE &&
        e.eventType !== BadmintonEventType.GAME_ENDED);
}
export function buildMatchReport(state, events) {
    const timeline = deriveIncidentLog(events);
    const incidents = deriveDirectorIncidents(events);
    const durationMs = state.startedAt && state.endedAt
        ? new Date(state.endedAt).getTime() - new Date(state.startedAt).getTime()
        : state.startedAt
            ? Date.now() - new Date(state.startedAt).getTime()
            : null;
    const winnerLabel = state.winnerSide === "left"
        ? state.leftSide.label
        : state.winnerSide === "right"
            ? state.rightSide.label
            : null;
    const lastMatchEnded = [...events]
        .reverse()
        .find((e) => e.eventType === BadmintonEventType.MATCH_ENDED);
    const resultSummary = lastMatchEnded
        ? lastMatchEnded.payload.resultSummary
        : undefined;
    return {
        matchId: state.matchId,
        tournamentId: state.tournamentId,
        generatedAt: new Date().toISOString(),
        players: {
            left: { label: state.leftSide.label, shortLabel: state.leftSide.shortLabel },
            right: { label: state.rightSide.label, shortLabel: state.rightSide.shortLabel },
        },
        matchKind: state.matchKind,
        status: state.matchStatus,
        winner: winnerLabel,
        games: state.games.map((g) => ({
            gameNumber: g.gameNumber,
            leftScore: g.leftScore,
            rightScore: g.rightScore,
            winner: g.winner,
        })),
        gamesWon: { left: state.gamesLeft, right: state.gamesRight },
        resultReason: state.resultReason,
        resultSummary,
        durationMs,
        timeline: timeline.map((e) => ({ ...e, timestamp: formatTime(e.timestamp) })),
        notes: state.matchNotes.map((n) => ({ text: n.text, addedAt: n.addedAt })),
        incidents,
    };
}
/** Status banner for OBS / scoreboard when match is not in normal live play. */
export function deriveDirectorStatusBanner(state) {
    if (state.matchStatus === "on_hold" || state.pauseReason === "ops_hold") {
        return {
            kind: "paused",
            title: "MATCH ON HOLD",
            subtitle: state.pauseReason
                ? `Reason: ${formatPauseReason(state.pauseReason, state.pauseDetail)}`
                : "Court freed for another match",
        };
    }
    if (state.matchStatus === "paused" || state.isPaused) {
        return {
            kind: "paused",
            title: "MATCH PAUSED",
            subtitle: state.pauseReason
                ? `Reason: ${formatPauseReason(state.pauseReason, state.pauseDetail)}`
                : undefined,
        };
    }
    if (state.matchStatus === "retired") {
        return {
            kind: "retired",
            title: "RETIRED",
            subtitle: state.winnerSide
                ? `Winner: ${state.winnerSide === "left" ? state.leftSide.shortLabel : state.rightSide.shortLabel}`
                : undefined,
        };
    }
    if (state.matchStatus === "walkover") {
        return {
            kind: "walkover",
            title: "WALKOVER",
            subtitle: state.winnerSide
                ? `Winner: ${state.winnerSide === "left" ? state.leftSide.shortLabel : state.rightSide.shortLabel}`
                : undefined,
        };
    }
    if (state.matchStatus === "disqualified") {
        return {
            kind: "disqualified",
            title: "DISQUALIFIED",
            subtitle: state.winnerSide
                ? `Winner: ${state.winnerSide === "left" ? state.leftSide.shortLabel : state.rightSide.shortLabel}`
                : undefined,
        };
    }
    if (state.matchStatus === "abandoned") {
        return { kind: "abandoned", title: "MATCH ABANDONED" };
    }
    if (state.matchStatus === "completed") {
        return {
            kind: "completed",
            title: "MATCH COMPLETED",
            subtitle: state.winnerSide
                ? `Winner: ${state.winnerSide === "left" ? state.leftSide.shortLabel : state.rightSide.shortLabel}`
                : undefined,
        };
    }
    return null;
}
