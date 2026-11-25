/**
 * Pre-Auction Strategy War Room & Precision Placement Engine
 * Pure mathematical logic, role normalization, draft scarcity, and budget simulation.
 */

export interface SquadRoleRecommendation {
  role: string;
  min: number;
  max: number;
  description: string;
}

export interface ScarcityAlert {
  role: string;
  availableCount: number;
  isCritical: boolean;
  deficit: number;
  message: string;
}

export interface BudgetStatus {
  level: "healthy" | "tight" | "deficit" | "overdraft";
  badge: string;
  color: string;
  message: string;
}

export interface BudgetSimulationResult {
  targetedCount: number;
  estimatedTargetSpend: number;
  purseAfterTargets: number;
  unfilledSlotsAfterTargets: number;
  remainingPursePerSlot: number;
  isQuotaCoveredByTargets: boolean;
  surplusPurse: number;
  status: BudgetStatus;
}

/**
 * Safely check if a player role is defined and recognized.
 * Gracefully ignores blank, empty, 'unknown', or raw Excel placeholders.
 */
export function isRecognizedRole(role?: string | null): boolean {
  if (!role) return false;
  const trimmed = role.trim().toLowerCase();
  return (
    trimmed !== "" &&
    trimmed !== "unknown" &&
    trimmed !== "n/a" &&
    trimmed !== "na" &&
    trimmed !== "-" &&
    trimmed !== "--" &&
    trimmed !== "none" &&
    trimmed !== "null" &&
    trimmed !== "undefined"
  );
}

/**
 * Normalizes role names into canonical categories for blueprint comparison.
 */
export function normalizeSportRole(role?: string | null, sport = "cricket"): string {
  if (!isRecognizedRole(role)) return "General Player";
  const r = (role || "").toLowerCase();
  const s = (sport || "cricket").toLowerCase();

  if (s.includes("cricket")) {
    if (/keeper|wk|wicket/i.test(r)) return "Wicketkeeper";
    if (/all-rounder|allrounder|all rounder/i.test(r)) return "All-Rounder";
    if (/bowler|bowling|pacer|spinner|fast/i.test(r)) return "Bowler";
    if (/batter|batsman|batting/i.test(r)) return "Batter";
    return role?.trim() || "Player";
  }

  if (s.includes("football") || s.includes("soccer")) {
    if (/goal|gk/i.test(r)) return "Goalkeeper";
    if (/defen|back|cb|lb|rb/i.test(r)) return "Defender";
    if (/midfield|mid|cm|cam|cdm/i.test(r)) return "Midfielder";
    if (/forward|striker|winger|attack|st|cf/i.test(r)) return "Forward";
    return role?.trim() || "Player";
  }

  if (s.includes("badminton")) {
    if (/single/i.test(r)) return "Singles Specialist";
    if (/mixed/i.test(r)) return "Mixed Doubles";
    if (/double/i.test(r)) return "Doubles Specialist";
    return role?.trim() || "Player";
  }

  return role?.trim() || "Player";
}

/**
 * Returns sport-aware squad architecture guidelines.
 */
export function getSportBlueprintRules(sport = "cricket"): SquadRoleRecommendation[] {
  const s = (sport || "cricket").toLowerCase();
  if (s.includes("cricket")) {
    return [
      { role: "Batter", min: 3, max: 4, description: "Top order batters & power hitters" },
      { role: "Wicketkeeper", min: 1, max: 2, description: "Main wicketkeeper & backup keeper" },
      { role: "All-Rounder", min: 3, max: 4, description: "Key all-rounders for batting & bowling balance" },
      { role: "Bowler", min: 4, max: 5, description: "Fast bowlers & spin attack" },
    ];
  }
  if (s.includes("football") || s.includes("soccer")) {
    return [
      { role: "Goalkeeper", min: 1, max: 2, description: "Primary shot-stopper & backup" },
      { role: "Defender", min: 4, max: 5, description: "Center-backs & wing-backs" },
      { role: "Midfielder", min: 4, max: 5, description: "Playmakers & defensive ball-winners" },
      { role: "Forward", min: 2, max: 3, description: "Strikers & wing attackers" },
    ];
  }
  if (s.includes("badminton")) {
    return [
      { role: "Singles Specialist", min: 2, max: 3, description: "High stamina singles aces" },
      { role: "Doubles Specialist", min: 3, max: 4, description: "Front court & smash specialists" },
      { role: "Mixed Doubles", min: 1, max: 2, description: "Tactical mixed doubles pairings" },
    ];
  }
  return [
    { role: "Star Players", min: 2, max: 3, description: "Match-winning key pillars" },
    { role: "Main Squad", min: 4, max: 6, description: "Dependable primary playing lineup" },
    { role: "Backup Players", min: 3, max: 5, description: "Reserve depth & impact replacements" },
  ];
}

/**
 * 40-40-20 Purse Distribution Rule:
 * 40% Anchor Stars (2-3 marquee game-changers)
 * 40% Core XI (regular starting lineup)
 * 20% Value Bench (depth & minimum base-price buffers)
 */
export function calculatePurseDistribution40_40_20(totalPurse: number): {
  anchorStars: number;
  coreXI: number;
  valueBench: number;
} {
  const safePurse = Math.max(0, totalPurse);
  const anchorStars = Math.round(safePurse * 0.4);
  const coreXI = Math.round(safePurse * 0.4);
  const valueBench = safePurse - anchorStars - coreXI;
  return { anchorStars, coreXI, valueBench };
}

export interface PlayerLike {
  id: number;
  name?: string | null;
  role?: string | null;
  status?: string | null;
  basePrice?: number | null;
  playerTag?: string | null;
  isNonPlayingMember?: boolean | null;
  achievements?: string | null;
  teamId?: number | null;
}

/**
 * FOMO Engine: scans tournament draft pool for position scarcity.
 * Computes critical deficit alerts when supply < competing teams count.
 */
export function computeDraftPoolScarcity({
  availablePlayers,
  teamsCount,
  sportName = "cricket",
  blueprintRules,
}: {
  availablePlayers: PlayerLike[];
  teamsCount: number;
  sportName?: string;
  blueprintRules?: SquadRoleRecommendation[];
}): ScarcityAlert[] {
  if (!availablePlayers.length) return [];
  const rules = blueprintRules ?? getSportBlueprintRules(sportName);
  const poolRoleCounts: Record<string, number> = {};
  let unknownRoleCount = 0;

  for (const p of availablePlayers) {
    if (p.isNonPlayingMember) continue;
    if (!isRecognizedRole(p.role)) {
      unknownRoleCount++;
      continue;
    }
    const norm = normalizeSportRole(p.role, sportName);
    poolRoleCounts[norm] = (poolRoleCounts[norm] || 0) + 1;
  }

  const alerts: ScarcityAlert[] = [];
  const safeTeamsCount = Math.max(1, teamsCount);

  for (const bp of rules) {
    const avail = poolRoleCounts[bp.role] || 0;
    // If roles were unassigned in Excel import, silently fall back
    if (avail === 0 && unknownRoleCount > 0 && Object.keys(poolRoleCounts).length === 0) {
      continue;
    }

    const pluralRole = bp.role.endsWith("s") ? bp.role : `${bp.role}s`;
    const countRoleStr = avail === 1 ? bp.role : pluralRole;
    const teamsStr = safeTeamsCount === 1 ? "1 team" : `${safeTeamsCount} teams`;

    if (avail < safeTeamsCount) {
      const deficit = safeTeamsCount - avail;
      const deficitStr =
        deficit === 1 ? "1 team will face a deficit" : `${deficit} teams will face a deficit`;
      const availPrefix =
        avail === 0
          ? `No ${pluralRole} available`
          : `Only ${avail} ${countRoleStr} available`;

      alerts.push({
        role: bp.role,
        availableCount: avail,
        isCritical: true,
        deficit,
        message: `${availPrefix} in draft pool across ${teamsStr}! (${deficitStr}).`,
      });
    } else if (avail <= Math.ceil(safeTeamsCount * 1.35)) {
      alerts.push({
        role: bp.role,
        availableCount: avail,
        isCritical: false,
        deficit: 0,
        message: `Tight pool: ${avail} ${countRoleStr} for ${teamsStr}. High bidding intensity expected.`,
      });
    }
  }

  return alerts;
}

/**
 * Detects proven stars based on:
 * - Special tags ('star_player', 'icon', 'captain', 'booster', 'marquee')
 * - High base valuation (basePrice >= 2 * minBasePrice)
 * - Achievements mentioning Top 5, MVP, Champion, Star
 */
export function detectProvenStars(
  availablePlayers: PlayerLike[],
  minBasePrice: number,
): PlayerLike[] {
  const safeBase = Math.max(1, minBasePrice);
  return (availablePlayers ?? []).filter((p) => {
    if (p.isNonPlayingMember) return false;
    const tag = (p.playerTag || "").toLowerCase();
    const isTaggedStar =
      tag === "star_player" ||
      tag === "icon" ||
      tag === "captain" ||
      tag === "booster" ||
      tag === "marquee";
    const isHighBase = (p.basePrice ?? 0) >= safeBase * 2;
    const hasStarAchievements =
      typeof p.achievements === "string" &&
      /top\s*5|mvp|most valuable|highest bid|record breaker|champion|star/i.test(p.achievements);
    return isTaggedStar || isHighBase || hasStarAchievements;
  });
}

/**
 * Computes live budget simulation for target shortlists.
 * Accurately handles:
 * - Overdraft detection (spend > purse)
 * - Remaining purse per unfilled slot
 * - Quota fulfillment when shortlisted targets >= mandatory slots (unfilled slots = 0)
 */
export function computeBudgetSimulation({
  purseRemaining,
  targetedAvailablePlayers,
  remainingMandatorySlots,
  minBasePrice,
  formatCurrencyFn,
}: {
  purseRemaining: number;
  targetedAvailablePlayers: PlayerLike[];
  remainingMandatorySlots: number;
  minBasePrice: number;
  formatCurrencyFn?: (amt: number) => string;
}): BudgetSimulationResult {
  const fmt = formatCurrencyFn ?? ((n: number) => `₹${n.toLocaleString("en-IN")}`);
  const safeMinBase = Math.max(1, minBasePrice);
  const targetedCount = targetedAvailablePlayers.length;

  const estimatedTargetSpend = targetedAvailablePlayers.reduce(
    (sum, p) => sum + (p.basePrice && p.basePrice > 0 ? p.basePrice : safeMinBase),
    0
  );

  const purseAfterTargets = purseRemaining - estimatedTargetSpend;
  const isQuotaCoveredByTargets = targetedCount >= remainingMandatorySlots;
  const unfilledSlotsAfterTargets = Math.max(0, remainingMandatorySlots - targetedCount);

  let remainingPursePerSlot = 0;
  if (unfilledSlotsAfterTargets > 0) {
    remainingPursePerSlot = Math.floor(purseAfterTargets / unfilledSlotsAfterTargets);
  } else {
    // When all mandatory slots are covered by shortlisted targets
    remainingPursePerSlot = Math.max(0, purseAfterTargets);
  }

  const unfilledSlotsStr =
    unfilledSlotsAfterTargets === 1
      ? "1 unfilled mandatory slot"
      : `${unfilledSlotsAfterTargets} unfilled mandatory slots`;
  const reqStr =
    remainingMandatorySlots === 1
      ? "1 mandatory squad slot requirement"
      : `${remainingMandatorySlots} mandatory squad slot requirements`;

  let status: BudgetStatus;

  if (purseAfterTargets < 0) {
    status = {
      level: "overdraft",
      badge: "CRITICAL OVERDRAFT",
      color: "text-rose-400 bg-rose-500/20 border-rose-500/40",
      message: `Targets exceed your remaining purse by ${fmt(
        Math.abs(purseAfterTargets)
      )}. You cannot afford all shortlisted targets at base prices!`,
    };
  } else if (unfilledSlotsAfterTargets > 0 && remainingPursePerSlot < safeMinBase) {
    status = {
      level: "deficit",
      badge: "QUOTA DEFICIT RISK",
      color: "text-amber-400 bg-amber-500/20 border-amber-500/40",
      message: `Warning: Only ${fmt(
        remainingPursePerSlot
      )}/slot left for ${unfilledSlotsStr}. You risk being unable to meet minimum base prices!`,
    };
  } else if (unfilledSlotsAfterTargets > 0 && remainingPursePerSlot < safeMinBase * 1.5) {
    const slotsRemainingStr =
      unfilledSlotsAfterTargets === 1 ? "1 remaining slot" : `${unfilledSlotsAfterTargets} remaining slots`;
    status = {
      level: "tight",
      badge: "TIGHT PURSE MARGIN",
      color: "text-yellow-400 bg-yellow-500/20 border-yellow-500/40",
      message: `Tight reserve: ${fmt(
        remainingPursePerSlot
      )}/slot available for ${slotsRemainingStr}. Stick strictly to walk-away prices.`,
    };
  } else if (unfilledSlotsAfterTargets === 0) {
    status = {
      level: "healthy",
      badge: "SQUAD QUOTA COVERED",
      color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40",
      message: `All ${remainingMandatorySlots} mandatory squad slot requirements covered by your shortlist, with ${fmt(
        purseAfterTargets
      )} surplus purse remaining.`,
    };
  } else {
    status = {
      level: "healthy",
      badge: "BALANCED SQUAD PLAN",
      color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40",
      message: `Healthy budget: ${fmt(
        remainingPursePerSlot
      )}/slot preserved for ${unfilledSlotsStr}.`,
    };
  }

  return {
    targetedCount,
    estimatedTargetSpend,
    purseAfterTargets,
    unfilledSlotsAfterTargets,
    remainingPursePerSlot,
    isQuotaCoveredByTargets,
    surplusPurse: Math.max(0, purseAfterTargets),
    status,
  };
}

export interface BluffRadarInput {
  currentBidTeamId?: number | null;
  currentBidTeamName?: string | null;
  myTeamId: number;
  currentPlayerRole?: string | null;
  currentPlayerBasePrice?: number | null;
  currentBidAmount?: number | null;
  sportName?: string;
  allPlayers?: PlayerLike[];
  teamPurses?: {
    teamId: number;
    slotsRequired?: number;
    minimumSquadSize?: number;
    playersBought?: number;
    spendablePurse?: number;
    purseRemaining?: number;
  }[];
  walkAwayPrice?: number;
}

export interface BluffRadarResult {
  isBluffRisk: boolean;
  severity: "none" | "caution" | "high";
  rivalTeamName: string;
  rivalRoleCount: number;
  rivalRemainingSlots: number;
  normalizedRole: string;
  headline: string;
  message: string;
}

/**
 * Computes real-time Rival Bluff & Price-Bumping Warning.
 * Analyzes whether the currently leading rival team is bidding on a role
 * where they already have an over-saturated squad or negligible remaining slots.
 *
 * Guarantees:
 * - NEVER leaks rival's private shortlists or secret maximum budgets.
 * - NEVER mentions any other player's name during an active lot.
 * - Purely inspects public roster counts and public purse states.
 */
export function computeBluffRadar({
  currentBidTeamId,
  currentBidTeamName,
  myTeamId,
  currentPlayerRole,
  currentPlayerBasePrice,
  currentBidAmount,
  sportName = "cricket",
  allPlayers = [],
  teamPurses = [],
  walkAwayPrice = 0,
}: BluffRadarInput): BluffRadarResult {
  const defaultNoBluff: BluffRadarResult = {
    isBluffRisk: false,
    severity: "none",
    rivalTeamName: "",
    rivalRoleCount: 0,
    rivalRemainingSlots: 0,
    normalizedRole: "",
    headline: "",
    message: "",
  };

  // If no one is leading or my own team is leading, no rival bluff against us
  if (!currentBidTeamId || currentBidTeamId === myTeamId) {
    return defaultNoBluff;
  }

  // If role is unrecognized (e.g. unvalidated Excel import), silently pass without crashing
  if (!isRecognizedRole(currentPlayerRole)) {
    return defaultNoBluff;
  }

  const normRole = normalizeSportRole(currentPlayerRole, sportName);
  const rivalName = currentBidTeamName?.trim() || `Team #${currentBidTeamId}`;

  // Analyze rival's public squad
  const rivalSquad = allPlayers.filter(
    (p) =>
      p.teamId === currentBidTeamId &&
      (p.status === "sold" || p.status === "retained") &&
      !p.isNonPlayingMember
  );

  const rivalRoleCount = rivalSquad.filter(
    (p) => normalizeSportRole(p.role, sportName) === normRole
  ).length;

  const rivalPurse = teamPurses.find((tp) => tp.teamId === currentBidTeamId);
  const rivalRemainingSlots =
    rivalPurse?.slotsRequired ??
    Math.max(
      0,
      (rivalPurse?.minimumSquadSize ?? 11) - (rivalPurse?.playersBought ?? rivalSquad.length)
    );

  // Retrieve sport blueprint recommendations
  const rules = getSportBlueprintRules(sportName);
  const roleRule = rules.find((r) => r.role === normRole) ?? { min: 2, max: 4, role: normRole };

  // ── High Severity: Quota Satiation / Over-saturation ──
  // Rival already has >= max recommended for this role, and has very few slots left (<= 2).
  // They do not need this role for squad balance; high likelihood of price-bumping to drain your purse!
  if (rivalRoleCount >= roleRule.max && rivalRemainingSlots <= 2) {
    return {
      isBluffRisk: true,
      severity: "high",
      rivalTeamName: rivalName,
      rivalRoleCount,
      rivalRemainingSlots,
      normalizedRole: normRole,
      headline: "⚠️ HIGH PRICE-BUMPING RISK",
      message: `${rivalName} already has ${rivalRoleCount} ${normRole}s with only ${rivalRemainingSlots} squad slot${
        rivalRemainingSlots === 1 ? "" : "s"
      } open. High likelihood of price-bumping! Recommend stopping near walk-away.`,
    };
  }

  // ── Caution Severity: Satiation & Escalated Price ──
  // Rival has already met their target quota for this role (>= min),
  // and current bid is reaching walk-away territory or has inflated >= 1.5x base price.
  const basePrice = Math.max(1, currentPlayerBasePrice || 0);
  const currentBid = currentBidAmount || 0;
  const isPriceInflated = currentBid >= basePrice * 1.5;
  const isNearWalkAway = walkAwayPrice > 0 && currentBid >= walkAwayPrice * 0.85;

  if (rivalRoleCount >= roleRule.min && (isPriceInflated || isNearWalkAway) && rivalRemainingSlots <= 3) {
    return {
      isBluffRisk: true,
      severity: "caution",
      rivalTeamName: rivalName,
      rivalRoleCount,
      rivalRemainingSlots,
      normalizedRole: normRole,
      headline: "⚡ RIVAL BLUFF RADAR",
      message: `${rivalName} already met their ${normRole} quota (${rivalRoleCount} acquired). Caution: Bidding duel may artificially inflate your acquisition cost.`,
    };
  }

  return defaultNoBluff;
}

export interface PlanBPivotInput {
  lastSoldPlayer?: {
    id?: number | null;
    name?: string | null;
    role?: string | null;
    photoUrl?: string | null;
    soldToTeamId?: number | null;
    soldToTeamName?: string | null;
    soldAmount?: number | null;
  } | null;
  myTeamId: number;
  targetPlayerIds: (number | string)[];
  allPlayers?: PlayerLike[];
  sportName?: string;
  purseRemaining?: number;
  remainingMandatorySlots?: number;
  formatCurrencyFn?: (amt: number) => string;
}

export interface PlanBPivotResult {
  isTargetLost: boolean;
  lostPlayerName: string;
  lostPlayerRole: string;
  soldToTeamName: string;
  soldAmount: number;
  remainingSimilarCount: number;
  remainingSimilarPlayers: PlayerLike[];
  suggestedHeadroomPct: number;
  headline: string;
  message: string;
  recommendedAction: string;
}

/**
 * Computes post-lot "Plan-B Pivot" when a shortlisted target is acquired by a rival.
 * Activated between lots during the Inter-Lot window.
 *
 * Guarantees:
 * - Immediate emotional reassurance (prevents panic buying).
 * - Identifies remaining pool depth for the same role.
 * - Suggests reallocated budget headroom without exceeding safe limits.
 */
export function computePlanBPivot({
  lastSoldPlayer,
  myTeamId,
  targetPlayerIds = [],
  allPlayers = [],
  sportName = "cricket",
  purseRemaining = 0,
  remainingMandatorySlots = 1,
  formatCurrencyFn,
}: PlanBPivotInput): PlanBPivotResult {
  const fmt = formatCurrencyFn ?? ((n: number) => `₹${n.toLocaleString("en-IN")}`);
  const defaultNoPivot: PlanBPivotResult = {
    isTargetLost: false,
    lostPlayerName: "",
    lostPlayerRole: "",
    soldToTeamName: "",
    soldAmount: 0,
    remainingSimilarCount: 0,
    remainingSimilarPlayers: [],
    suggestedHeadroomPct: 0,
    headline: "",
    message: "",
    recommendedAction: "",
  };

  if (!lastSoldPlayer || lastSoldPlayer.id == null) {
    return defaultNoPivot;
  }

  // If won by this team, it is a target ACQUIRED, not lost!
  if (lastSoldPlayer.soldToTeamId === myTeamId) {
    return defaultNoPivot;
  }

  // Check if player was in target shortlist
  const targetIdSet = new Set(targetPlayerIds.map((id) => Number(id)));
  const wasTarget = targetIdSet.has(Number(lastSoldPlayer.id));

  if (!wasTarget) {
    return defaultNoPivot;
  }

  // The target was acquired by a rival team
  const normRole = normalizeSportRole(lastSoldPlayer.role, sportName);
  const lostName = lastSoldPlayer.name?.trim() || "Target Player";
  const rivalWinner = lastSoldPlayer.soldToTeamName?.trim() || "Rival Team";
  const soldAmt = lastSoldPlayer.soldAmount || 0;

  // Find remaining unacquired players in draft pool with similar role
  const remainingSimilar = allPlayers.filter((p) => {
    if (p.isNonPlayingMember) return false;
    if (p.id === lastSoldPlayer.id) return false;
    const isAvail = p.status === "available" || p.status === "unsold" || !p.status;
    return isAvail && normalizeSportRole(p.role, sportName) === normRole;
  });

  const remainingCount = remainingSimilar.length;
  const suggestedHeadroomPct = remainingCount <= 2 ? 15 : 10;

  let headline = "⚡ PLAN-B PIVOT ACTIVE";
  let message = "";
  let recommendedAction = "";

  if (remainingCount > 0) {
    const rolePluralStr =
      remainingCount === 1
        ? normRole
        : normRole.endsWith("s")
          ? normRole
          : `${normRole}s`;
    const remainVerb = remainingCount === 1 ? "remains" : "remain";

    message = `Your target ${lostName} went to ${rivalWinner} for ${fmt(
      soldAmt
    )}. No panic! You preserved your purse (${fmt(purseRemaining)}). ${remainingCount} other ${rolePluralStr} ${remainVerb} in the draft pool.`;
    recommendedAction = `Re-tune your targets in War Room or adjust headroom by +${suggestedHeadroomPct}% for upcoming ${normRole} lots.`;
  } else {
    headline = "⚠️ CRITICAL POOL EXHAUSTION";
    message = `Your target ${lostName} went to ${rivalWinner}. That was the last pure ${normRole} in the available draft pool!`;
    recommendedAction = `Pivot your remaining purse to versatile all-rounders or flex roles in the next rounds.`;
  }

  return {
    isTargetLost: true,
    lostPlayerName: lostName,
    lostPlayerRole: normRole,
    soldToTeamName: rivalWinner,
    soldAmount: soldAmt,
    remainingSimilarCount: remainingCount,
    remainingSimilarPlayers: remainingSimilar.slice(0, 3),
    suggestedHeadroomPct,
    headline,
    message,
    recommendedAction,
  };
}
