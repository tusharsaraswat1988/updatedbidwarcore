export interface ObservationNote {
  type: string;
  headline: string;
  detail: string;
}

export interface IntelligenceBriefing {
  summary: string;
  sections: Array<{ title: string; body: string }>;
  observations: ObservationNote[];
  generatedBy: "template" | "llm";
  disclaimer: string;
}

function templateBriefing(
  tournamentName: string,
  sport: string,
  notes: ObservationNote[],
): IntelligenceBriefing {
  const sections = notes.map((n) => ({
    title: n.headline,
    body: n.detail,
  }));

  const highlights = notes.slice(0, 3).map((n) => n.headline).join("; ");
  const summary = highlights
    ? `Auction intelligence briefing for ${tournamentName} (${sport}): ${highlights}.`
    : `Auction intelligence briefing for ${tournamentName} (${sport}): insufficient concluded auction data for detailed observations.`;

  return {
    summary,
    sections,
    observations: notes,
    generatedBy: "template",
    disclaimer:
      "Observational analysis only — no price predictions, bidding recommendations, or automated strategy advice.",
  };
}

async function llmBriefing(
  tournamentName: string,
  sport: string,
  notes: ObservationNote[],
): Promise<IntelligenceBriefing | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.INTELLIGENCE_LLM_MODEL?.trim() || "gpt-4o-mini";
  const observationText = notes
    .map((n, i) => `${i + 1}. [${n.type}] ${n.headline}\n   ${n.detail}`)
    .join("\n\n");

  const systemPrompt =
    "You write concise auction intelligence briefings for sports tournament operators. " +
    "Use ONLY the observations provided. Do NOT predict prices, recommend bids, or suggest strategies. " +
    "Write 2-3 short paragraphs plus bullet highlights. Plain text only.";

  const userPrompt =
    `Tournament: ${tournamentName}\nSport: ${sport}\n\nObservations:\n${observationText || "No observations available."}\n\n` +
    "Write an executive briefing summarizing what happened behaviorally during this auction.";

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 700,
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

    return {
      summary: content.split("\n\n")[0] ?? content,
      sections: notes.map((n) => ({ title: n.headline, body: n.detail })),
      observations: notes,
      generatedBy: "llm",
      disclaimer:
        "LLM narrative generated from rule-based observations only — not predictive advice.",
    };
  } catch {
    return null;
  }
}

export async function buildIntelligenceBriefing(
  tournamentName: string,
  sport: string,
  notes: ObservationNote[],
): Promise<IntelligenceBriefing> {
  const llm = await llmBriefing(tournamentName, sport, notes);
  if (llm) return llm;
  return templateBriefing(tournamentName, sport, notes);
}
