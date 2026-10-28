/**
 * Badminton Universal Rules-Driven Standings & Tie-Breaker Engine.
 *
 * Implements:
 * 1. BWF General Competition Regulations (GCR 16) Group-Stage Multi-Tier Tie-Breakers.
 * 2. Corporate & Custom Configurable Ordered Tie-Breakers (Wins, Margin, Points Diff, Points Ratio).
 * 3. Team Tie Rubber Differentials.
 * 4. Deterministic Unresolved-Tie Safety (never guesses or sorts arbitrarily).
 */
const TERMINAL_MATCH_STATUSES = new Set([
    "completed",
    "walkover",
    "retired",
    "disqualified",
    "abandoned",
]);
function createEmptyRow(registrationId) {
    return {
        registrationId,
        played: 0,
        won: 0,
        lost: 0,
        gamesWon: 0,
        gamesLost: 0,
        gamesDifference: 0,
        gamesRatio: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDifference: 0,
        pointsRatio: 0,
        marginPoints: 0,
        rubbersWon: 0,
        rubbersLost: 0,
        rubberDifference: 0,
        rank: 1,
        tiedWithNext: false,
    };
}
/**
 * Computes raw participant totals from matches.
 */
export function computeRawParticipantStats(registrationIds, matches, walkoverMargin = 21) {
    const allowedSet = registrationIds.length > 0 ? new Set(registrationIds) : null;
    const map = new Map();
    for (const id of registrationIds) {
        map.set(id, createEmptyRow(id));
    }
    for (const m of matches) {
        if (!m.registrationAId || !m.registrationBId)
            continue;
        if (!TERMINAL_MATCH_STATUSES.has(m.status))
            continue;
        // If a restricted registration list was provided, only process participants in that list
        if (allowedSet) {
            if (!allowedSet.has(m.registrationAId) && !allowedSet.has(m.registrationBId))
                continue;
        }
        const rowA = map.get(m.registrationAId) ?? (allowedSet ? null : createEmptyRow(m.registrationAId));
        const rowB = map.get(m.registrationBId) ?? (allowedSet ? null : createEmptyRow(m.registrationBId));
        if (!rowA && !rowB)
            continue;
        if (rowA && !allowedSet)
            map.set(m.registrationAId, rowA);
        if (rowB && !allowedSet)
            map.set(m.registrationBId, rowB);
        if (rowA)
            rowA.played += 1;
        if (rowB)
            rowB.played += 1;
        const winnerId = m.winnerRegistrationId ??
            (m.winnerSide === "left"
                ? m.registrationAId
                : m.winnerSide === "right"
                    ? m.registrationBId
                    : null);
        if (winnerId === m.registrationAId) {
            if (rowA)
                rowA.won += 1;
            if (rowB)
                rowB.lost += 1;
        }
        else if (winnerId === m.registrationBId) {
            if (rowB)
                rowB.won += 1;
            if (rowA)
                rowA.lost += 1;
        }
        // Team tie rubbers
        if (m.rubbersWonA != null || m.rubbersWonB != null) {
            const rA = m.rubbersWonA ?? 0;
            const rB = m.rubbersWonB ?? 0;
            if (rowA) {
                rowA.rubbersWon += rA;
                rowA.rubbersLost += rB;
            }
            if (rowB) {
                rowB.rubbersWon += rB;
                rowB.rubbersLost += rA;
            }
        }
        // Games and points
        const completedGames = m.games.filter((g) => g.phase === "completed" || g.winner);
        if (completedGames.length > 0) {
            for (const g of completedGames) {
                if (rowA) {
                    rowA.pointsFor += g.leftScore;
                    rowA.pointsAgainst += g.rightScore;
                    if (g.leftScore > g.rightScore) {
                        rowA.gamesWon += 1;
                        if (winnerId === m.registrationAId) {
                            rowA.marginPoints += g.leftScore - g.rightScore;
                        }
                    }
                    else if (g.rightScore > g.leftScore) {
                        rowA.gamesLost += 1;
                    }
                }
                if (rowB) {
                    rowB.pointsFor += g.rightScore;
                    rowB.pointsAgainst += g.leftScore;
                    if (g.rightScore > g.leftScore) {
                        rowB.gamesWon += 1;
                        if (winnerId === m.registrationBId) {
                            rowB.marginPoints += g.rightScore - g.leftScore;
                        }
                    }
                    else if (g.leftScore > g.rightScore) {
                        rowB.gamesLost += 1;
                    }
                }
            }
        }
        else {
            // Walkover / non-scored match with assigned margin
            const margin = m.assignedMarginPoints != null && m.assignedMarginPoints > 0
                ? m.assignedMarginPoints
                : walkoverMargin;
            if (winnerId === m.registrationAId) {
                if (rowA) {
                    rowA.gamesWon += 2;
                    rowA.pointsFor += margin;
                    rowA.marginPoints += margin;
                }
                if (rowB) {
                    rowB.gamesLost += 2;
                    rowB.pointsAgainst += margin;
                }
            }
            else if (winnerId === m.registrationBId) {
                if (rowB) {
                    rowB.gamesWon += 2;
                    rowB.pointsFor += margin;
                    rowB.marginPoints += margin;
                }
                if (rowA) {
                    rowA.gamesLost += 2;
                    rowA.pointsAgainst += margin;
                }
            }
        }
    }
    // Derive differences and ratios
    for (const row of map.values()) {
        row.gamesDifference = row.gamesWon - row.gamesLost;
        row.gamesRatio =
            row.gamesLost === 0
                ? row.gamesWon > 0
                    ? 999999
                    : 1
                : Number((row.gamesWon / row.gamesLost).toFixed(4));
        row.pointsDifference = row.pointsFor - row.pointsAgainst;
        row.pointsRatio =
            row.pointsAgainst === 0
                ? row.pointsFor > 0
                    ? 999999
                    : 1
                : Number((row.pointsFor / row.pointsAgainst).toFixed(4));
        row.rubberDifference = row.rubbersWon - row.rubbersLost;
    }
    return map;
}
/**
 * Resolves head-to-head match between two specific participants.
 * Returns -1 if A beat B, 1 if B beat A, 0 if no match or tied.
 */
function compareHeadToHead(idA, idB, matches) {
    const directMatches = matches.filter((m) => TERMINAL_MATCH_STATUSES.has(m.status) &&
        ((m.registrationAId === idA && m.registrationBId === idB) ||
            (m.registrationAId === idB && m.registrationBId === idA)));
    let winsA = 0;
    let winsB = 0;
    for (const m of directMatches) {
        const winnerId = m.winnerRegistrationId ??
            (m.winnerSide === "left"
                ? m.registrationAId
                : m.winnerSide === "right"
                    ? m.registrationBId
                    : null);
        if (winnerId === idA)
            winsA++;
        if (winnerId === idB)
            winsB++;
    }
    if (winsA > winsB)
        return -1;
    if (winsB > winsA)
        return 1;
    return 0;
}
/**
 * Evaluates a single tie-breaking criterion between two rows.
 * Returns negative if A is better, positive if B is better, 0 if tied.
 */
function compareCriterion(criterion, a, b, matches) {
    switch (criterion) {
        case "matches_won":
            return b.won - a.won;
        case "head_to_head":
            return compareHeadToHead(a.registrationId, b.registrationId, matches);
        case "games_difference":
            return b.gamesDifference - a.gamesDifference;
        case "games_ratio":
            return b.gamesRatio - a.gamesRatio;
        case "points_difference":
            return b.pointsDifference - a.pointsDifference;
        case "points_ratio":
            return b.pointsRatio - a.pointsRatio;
        case "rubber_difference":
            return b.rubberDifference - a.rubberDifference;
        case "margin_points":
            return b.marginPoints - a.marginPoints;
        case "draw_of_lots":
            return 0; // Deterministic tiebreaker does not invent random numbers
        default:
            return 0;
    }
}
/**
 * Recursive Multi-Group Tie-Breaking Algorithm (BWF GCR 16.2 & Universal Configurable).
 *
 * For a cluster of participants tied on earlier criteria:
 * 1. If cluster size is 2 and twoWayHeadToHeadOverride is enabled -> Head-to-Head is tested first.
 * 2. Each criterion in the ordered list is tested.
 * 3. If a criterion subdivides the cluster into distinct non-tied subclusters,
 *    each subcluster is recursively resolved.
 * 4. If all criteria are exhausted and 2 or more participants are still completely tied,
 *    an unresolved tie is recorded without guessing.
 */
function resolveTiedCluster(cluster, criteria, criterionIndex, matches, rules, unresolvedOut) {
    if (cluster.length <= 1)
        return cluster;
    // Rule: Two-way tie head-to-head priority (BWF GCR 16.2.1 & 16.2.4)
    if (cluster.length === 2 && rules.twoWayHeadToHeadOverride) {
        const h2h = compareHeadToHead(cluster[0].registrationId, cluster[1].registrationId, matches);
        if (h2h !== 0) {
            return h2h < 0 ? [cluster[0], cluster[1]] : [cluster[1], cluster[0]];
        }
    }
    if (criterionIndex >= criteria.length) {
        // All criteria exhausted! Cluster remains tied.
        unresolvedOut.push({
            tiedRegistrationIds: cluster.map((r) => r.registrationId),
            criteriaExhausted: [...criteria],
            actionRequired: rules.unresolvedTieAction,
        });
        return cluster;
    }
    const currentCriterion = criteria[criterionIndex];
    // Group cluster into buckets by current criterion value
    if (currentCriterion === "head_to_head") {
        // If cluster has 2 items, H2H was checked or is checked here
        if (cluster.length === 2) {
            const h2h = compareHeadToHead(cluster[0].registrationId, cluster[1].registrationId, matches);
            if (h2h !== 0) {
                return h2h < 0 ? [cluster[0], cluster[1]] : [cluster[1], cluster[0]];
            }
        }
        // For 3+ participants, BWF GCR 16 states H2H is evaluated among only the tied group,
        // or moves to games/points difference. Continue to next criterion.
        return resolveTiedCluster(cluster, criteria, criterionIndex + 1, matches, rules, unresolvedOut);
    }
    // Bucket participants by criterion value
    const valueMap = new Map();
    for (const row of cluster) {
        let val;
        switch (currentCriterion) {
            case "matches_won":
                val = row.won;
                break;
            case "games_difference":
                val = row.gamesDifference;
                break;
            case "games_ratio":
                val = row.gamesRatio;
                break;
            case "points_difference":
                val = row.pointsDifference;
                break;
            case "points_ratio":
                val = row.pointsRatio;
                break;
            case "rubber_difference":
                val = row.rubberDifference;
                break;
            case "margin_points":
                val = row.marginPoints;
                break;
            default:
                val = 0;
        }
        const bucket = valueMap.get(val) ?? [];
        bucket.push(row);
        valueMap.set(val, bucket);
    }
    // Sort bucket values descending (higher value is better)
    const sortedValues = [...valueMap.keys()].sort((a, b) => b - a);
    // If all participants ended up in a single bucket, this criterion didn't break the tie
    if (sortedValues.length === 1) {
        return resolveTiedCluster(cluster, criteria, criterionIndex + 1, matches, rules, unresolvedOut);
    }
    // Subdivide and recursively resolve each bucket
    const resolved = [];
    for (const val of sortedValues) {
        const subCluster = valueMap.get(val);
        const resolvedSub = resolveTiedCluster(subCluster, criteria, criterionIndex + 1, matches, rules, unresolvedOut);
        resolved.push(...resolvedSub);
    }
    return resolved;
}
/**
 * Universal Standings Calculator.
 *
 * Evaluates all matches according to the tournament's configured Rules Profile.
 */
export function calculateUniversalStandings(registrationIds, matches, rulesOrProfile) {
    const rules = "standings" in rulesOrProfile ? rulesOrProfile.standings : rulesOrProfile;
    const rawMap = computeRawParticipantStats(registrationIds, matches, rules.walkoverMarginPoints ?? 21);
    const allRows = [...rawMap.values()];
    if (allRows.length === 0) {
        return { rows: [], hasUnresolvedTies: false, unresolvedTies: [] };
    }
    const unresolvedTies = [];
    // Initial group: all participants start together
    const criteria = rules.orderedTieBreakers;
    const sortedRows = resolveTiedCluster(allRows, criteria, 0, matches, rules, unresolvedTies);
    // Assign ranks & mark ties
    let currentRank = 1;
    for (let i = 0; i < sortedRows.length; i++) {
        const row = sortedRows[i];
        row.rank = currentRank;
        // Check if tied with next row
        const nextRow = sortedRows[i + 1];
        if (nextRow) {
            const isTied = unresolvedTies.some((u) => u.tiedRegistrationIds.includes(row.registrationId) &&
                u.tiedRegistrationIds.includes(nextRow.registrationId));
            if (isTied) {
                row.tiedWithNext = true;
                // In sports standings, tied players share the same rank
            }
            else {
                row.tiedWithNext = false;
                currentRank = i + 2;
            }
        }
        else {
            row.tiedWithNext = false;
        }
    }
    return {
        rows: sortedRows,
        hasUnresolvedTies: unresolvedTies.length > 0,
        unresolvedTies,
    };
}
