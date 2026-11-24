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
      { role: "Batter", min: 3, max: 4, description: "Top order anchors & power hitters" },
      { role: "Wicketkeeper", min: 1, max: 2, description: "Primary specialist + reliable backup" },
      { role: "All-Rounder", min: 3, max: 4, description: "Critical team balance & flexible overs" },
      { role: "Bowler", min: 4, max: 5, description: "Pace & spin wicket-taking core" },
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
    { role: "Anchor Stars", min: 2, max: 3, description: "Match-winning marquee pillars" },
    { role: "Core Starters", min: 4, max: 6, description: "Dependable primary starting lineup" },
    { role: "Value Bench", min: 3, max: 5, description: "Depth & impact replacements" },
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

    if (avail < safeTeamsCount) {
      const deficit = safeTeamsCount - avail;
      alerts.push({
        role: bp.role,
        availableCount: avail,
        isCritical: true,
        deficit,
        message: `Only ${avail} ${bp.role}s available in draft pool across ${safeTeamsCount} teams! (${deficit} teams will face a deficit).`,
      });
    } else if (avail <= Math.ceil(safeTeamsCount * 1.35)) {
      alerts.push({
        role: bp.role,
        availableCount: avail,
        isCritical: false,
        deficit: 0,
        message: `Tight pool: ${avail} ${bp.role}s for ${safeTeamsCount} teams. High bidding intensity expected.`,
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
      )}/slot left for ${unfilledSlotsAfterTargets} unfilled mandatory slots. You risk being unable to meet minimum base prices!`,
    };
  } else if (unfilledSlotsAfterTargets > 0 && remainingPursePerSlot < safeMinBase * 1.5) {
    status = {
      level: "tight",
      badge: "TIGHT PURSE MARGIN",
      color: "text-yellow-400 bg-yellow-500/20 border-yellow-500/40",
      message: `Tight reserve: ${fmt(
        remainingPursePerSlot
      )}/slot available for ${unfilledSlotsAfterTargets} remaining slots. Stick strictly to walk-away prices.`,
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
      )}/slot preserved for ${unfilledSlotsAfterTargets} unfilled mandatory slots.`,
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
