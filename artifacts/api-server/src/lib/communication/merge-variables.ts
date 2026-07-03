import { KNOWN_MERGE_VARIABLES } from "./types.js";

const MERGE_VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const CONDITIONAL_BLOCK_PATTERN = /\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

function isTruthyMergeValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  return String(value).trim().length > 0;
}

function renderConditionalBlocks(
  template: string,
  data: Record<string, unknown>,
): string {
  let result = template;
  let previous = "";
  while (result !== previous) {
    previous = result;
    result = result.replace(
      CONDITIONAL_BLOCK_PATTERN,
      (_match, key: string, content: string) =>
        isTruthyMergeValue(data[key]) ? content : "",
    );
  }
  return result;
}

export function extractMergeVariables(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MERGE_VAR_PATTERN)) {
    if (match[1]) found.add(match[1]);
  }
  return [...found];
}

export function findUnknownVariables(text: string): string[] {
  const known = new Set<string>(KNOWN_MERGE_VARIABLES);
  return extractMergeVariables(text).filter((v) => !known.has(v));
}

export function renderMergeTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  const withConditionals = renderConditionalBlocks(template, data);
  return withConditionals.replace(MERGE_VAR_PATTERN, (_match, key: string) => {
    const value = data[key];
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

export function highlightUnknownVariables(html: string): string {
  const unknown = new Set(findUnknownVariables(html));
  if (unknown.size === 0) return html;

  return html.replace(MERGE_VAR_PATTERN, (match, key: string) => {
    if (!unknown.has(key)) return match;
    return `<mark style="background:#fef08a;color:#854d0e;padding:0 2px;border-radius:2px;" title="Unknown variable">${match}</mark>`;
  });
}

export function buildSampleMergeData(): Record<string, string> {
  const year = String(new Date().getFullYear());
  const appUrl = "https://bidwar.in";
  const bidwarLogo =
    `<img src="${appUrl}/bidwar-primary-logo.png" width="140" height="48" alt="BidWar" style="display:block;border:0;outline:none;text-decoration:none;max-width:140px;height:auto;" />`;
  const tournamentLogo =
    `<img src="${appUrl}/logo.png" width="72" height="72" alt="Premier Cricket League 2026" style="display:block;border:0;outline:none;text-decoration:none;max-width:72px;height:auto;" />`;

  return {
    team_name: "Mumbai Warriors",
    owner_name: "Rahul Sharma",
    player_name: "Virat Kohli",
    tournament_name: "Premier Cricket League 2026",
    auction_name: "Season 3 Player Auction",
    auction_date: "15 March 2026",
    match_date: "20 March 2026",
    login_link: "https://bidwar.in/owner/join",
    password: "••••••••",
    email: "owner@example.com",
    phone: "+91 98765 43210",
    payment_link: "https://bidwar.in/pay/abc123",
    support_number: "+91 8707488250",
    organiser_name: "Rajesh Kumar",
    organiser_phone: "+91 98765 43210",
    organiser_email: "organiser@example.com",
    sponsor_name: "Acme Corp",
    amount: "₹5,000",
    team_budget: "₹1,00,00,000",
    current_year: year,
    app_url: appUrl,
    brand_name: "BidWar",
    powered_by_text: "Powered by BidWar",
    bidwar_logo: bidwarLogo,
    tournament_logo: tournamentLogo,
    sport_name: "Cricket",
    registration_id: "#42",
    registration_date: new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    venue: "Wankhede Stadium, Mumbai",
    tournament_dates: "15 March 2026 at 14:00",
  };
}
