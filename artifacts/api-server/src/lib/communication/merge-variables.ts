import { KNOWN_MERGE_VARIABLES } from "./types.js";

const MERGE_VAR_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

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
  return template.replace(MERGE_VAR_PATTERN, (_match, key: string) => {
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
    support_number: "+91 98765 43210",
    organiser_name: "Rajesh Kumar",
    sponsor_name: "Acme Corp",
    amount: "₹5,000",
    team_budget: "₹1,00,00,000",
    current_year: year,
    app_url: "https://bidwar.in",
    brand_name: "BidWar",
    powered_by_text: "Powered by BidWar",
  };
}
