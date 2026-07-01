import type { TournamentInsight, TournamentInsightsSummary } from "./types";

const TYPE_EMOJI: Record<TournamentInsight["type"], string> = {
  trending: "🔥",
  insight: "💰",
  funFact: "🎯",
  strategy: "⚡",
};

function formatInr(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(0)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function clampInsights(insights: TournamentInsight[]): TournamentInsight[] {
  return insights
    .filter((i) => i.title && i.description)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4)
    .map((i, idx) => ({ ...i, priority: idx + 1 }));
}

export function buildTemplateInsights(summary: TournamentInsightsSummary): TournamentInsight[] {
  const candidates: TournamentInsight[] = [];

  if (summary.topSpender && summary.soldPlayers > 0) {
    candidates.push({
      type: "trending",
      emoji: TYPE_EMOJI.trending,
      title: `${summary.topSpender.teamName} leading the spend chart`,
      description: `${summary.topSpender.teamName} has committed ${formatInr(summary.topSpender.spent)} so far — the heaviest wallet in the room.`,
      priority: 1,
    });
  }

  if (summary.highestRemainingBudgetTeam && summary.totalTeams > 1) {
    candidates.push({
      type: "insight",
      emoji: TYPE_EMOJI.insight,
      title: `${summary.highestRemainingBudgetTeam.teamName} holds the deepest purse`,
      description: `${formatInr(summary.highestRemainingBudgetTeam.remaining)} still available — the strongest war chest heading into the next picks.`,
      priority: 2,
    });
  }

  if (summary.hottestPlayer && summary.hottestPlayer.bidCount >= 3) {
    candidates.push({
      type: "funFact",
      emoji: TYPE_EMOJI.funFact,
      title: `${summary.hottestPlayer.playerName} drew a bidding frenzy`,
      description: `${summary.hottestPlayer.bidCount} bids flew in before the hammer fell — one of the most contested lots today.`,
      priority: 3,
    });
  } else if (summary.highestBidMultiplier && summary.highestBidMultiplier.multiplier >= 2) {
    candidates.push({
      type: "funFact",
      emoji: TYPE_EMOJI.funFact,
      title: `${summary.highestBidMultiplier.playerName} smashed the base price`,
      description: `Sold at ${summary.highestBidMultiplier.multiplier}× base for ${formatInr(summary.highestBidMultiplier.soldPrice)} — a premium pick by any measure.`,
      priority: 3,
    });
  }

  if (summary.availablePlayers > 0 && summary.tournamentPhase === "active") {
    const budgetHint = summary.highestRemainingBudgetTeam
      ? `${summary.highestRemainingBudgetTeam.teamName} can still stretch the market.`
      : "Teams with room in their purse hold the edge.";
    candidates.push({
      type: "strategy",
      emoji: TYPE_EMOJI.strategy,
      title: `${summary.availablePlayers} players still on the board`,
      description: `${summary.soldPlayers} sold, ${summary.unsoldPlayers} unsold — ${budgetHint}`,
      priority: 4,
    });
  }

  if (summary.completedTeams > 0) {
    candidates.push({
      type: "insight",
      emoji: "✅",
      title: `${summary.completedTeams} squad${summary.completedTeams !== 1 ? "s" : ""} already complete`,
      description: `${summary.completedTeams} of ${summary.totalTeams} teams have filled their roster — the finish line is in sight for them.`,
      priority: 2,
    });
  }

  if (summary.lastFewSales.length > 0 && candidates.length < 4) {
    const latest = summary.lastFewSales[0]!;
    candidates.push({
      type: "trending",
      emoji: "🏏",
      title: `${latest.playerName} just went to ${latest.teamName}`,
      description: `Latest deal: ${formatInr(latest.amount)} — keeping the auction floor buzzing.`,
      priority: 1,
    });
  }

  if (summary.tournamentPhase === "setup") {
    return clampInsights([
      {
        type: "insight",
        emoji: "📋",
        title: `${summary.totalTeams} teams, ${summary.totalPlayers} players registered`,
        description: `The ${summary.sport} auction floor is set — once bidding opens, live intelligence will appear here.`,
        priority: 1,
      },
      {
        type: "strategy",
        emoji: TYPE_EMOJI.strategy,
        title: "War chests are loaded",
        description: `${formatInr(summary.totalBudgetRemaining + summary.totalBudgetSpent)} in combined team budgets ready to deploy.`,
        priority: 2,
      },
    ]);
  }

  if (summary.tournamentPhase === "completed") {
    return clampInsights([
      {
        type: "insight",
        emoji: "🏆",
        title: "Auction complete — final ledger",
        description: `${summary.soldPlayers} players sold for ${formatInr(summary.totalBudgetSpent)} across ${summary.totalTeams} franchises.`,
        priority: 1,
      },
      ...(summary.topSpender
        ? [{
            type: "trending" as const,
            emoji: TYPE_EMOJI.trending,
            title: `${summary.topSpender.teamName} topped the spending table`,
            description: `Final outlay of ${formatInr(summary.topSpender.spent)} — the biggest investor in this draft.`,
            priority: 2,
          }]
        : []),
      ...(summary.highestBid
        ? [{
            type: "funFact" as const,
            emoji: TYPE_EMOJI.funFact,
            title: `${summary.highestBid.playerName} fetched the top price`,
            description: `${formatInr(summary.highestBid.amount)} to ${summary.highestBid.teamName} — the marquee signing of the night.`,
            priority: 3,
          }]
        : []),
    ]);
  }

  if (candidates.length === 0) {
    return clampInsights([
      {
        type: "insight",
        emoji: "📡",
        title: "Auction floor is warming up",
        description: "Bidding activity will populate live insights as players go under the hammer.",
        priority: 1,
      },
    ]);
  }

  return clampInsights(candidates);
}

export function parseLlmInsights(raw: unknown): TournamentInsight[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { insights?: unknown };
  if (!Array.isArray(obj.insights)) return null;

  const validTypes = new Set(["trending", "insight", "funFact", "strategy"]);
  const parsed: TournamentInsight[] = [];

  for (const item of obj.insights) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = row.type;
    if (typeof type !== "string" || !validTypes.has(type)) continue;
    if (typeof row.title !== "string" || typeof row.description !== "string") continue;

    parsed.push({
      type: type as TournamentInsight["type"],
      emoji: typeof row.emoji === "string" && row.emoji.length > 0
        ? row.emoji
        : TYPE_EMOJI[type as TournamentInsight["type"]],
      title: row.title.slice(0, 80),
      description: row.description.slice(0, 160),
      priority: typeof row.priority === "number" ? row.priority : parsed.length + 1,
    });
  }

  return parsed.length > 0 ? clampInsights(parsed) : null;
}

async function llmInsights(summary: TournamentInsightsSummary): Promise<TournamentInsight[] | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.INTELLIGENCE_LLM_MODEL?.trim() || "gpt-4o-mini";

  const systemPrompt =
    "You are a live sports auction tournament analyst writing dashboard commentary. " +
    "Use ONLY facts from the JSON summary. Never mention AI, language models, analysis, or provided data. " +
    "Write like live auction floor commentary — energetic, factual, premium. " +
    "Return valid JSON: {\"insights\":[{\"type\":\"trending|insight|funFact|strategy\",\"emoji\":\"…\",\"title\":\"…\",\"description\":\"…\",\"priority\":1}]}. " +
    "Maximum 4 insights. Total description text under 250 words. No markdown.";

  const userPrompt =
    `Tournament: ${summary.tournamentName} (${summary.sport})\n` +
    `Phase: ${summary.tournamentPhase}, Auction: ${summary.auctionStatus ?? "n/a"}\n\n` +
    `Summary JSON:\n${JSON.stringify({
      totalTeams: summary.totalTeams,
      completedTeams: summary.completedTeams,
      totalPlayers: summary.totalPlayers,
      soldPlayers: summary.soldPlayers,
      unsoldPlayers: summary.unsoldPlayers,
      availablePlayers: summary.availablePlayers,
      highestBid: summary.highestBid,
      highestRemainingBudgetTeam: summary.highestRemainingBudgetTeam,
      lowestRemainingBudgetTeam: summary.lowestRemainingBudgetTeam,
      totalBudgetSpent: summary.totalBudgetSpent,
      totalBudgetRemaining: summary.totalBudgetRemaining,
      topSpender: summary.topSpender,
      biggestBargain: summary.biggestBargain,
      highestBidMultiplier: summary.highestBidMultiplier,
      hottestPlayer: summary.hottestPlayer,
      averagePlayerPrice: summary.averagePlayerPrice,
      lastFewSales: summary.lastFewSales,
      recentAuctionEvents: summary.recentAuctionEvents,
    })}`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.45,
        max_tokens: 450,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    return parseLlmInsights(JSON.parse(content));
  } catch {
    return null;
  }
}

export async function generateTournamentInsights(
  summary: TournamentInsightsSummary,
): Promise<{ insights: TournamentInsight[]; source: "llm" | "template" }> {
  const llm = await llmInsights(summary);
  if (llm && llm.length > 0) {
    return { insights: llm, source: "llm" };
  }
  return { insights: buildTemplateInsights(summary), source: "template" };
}
