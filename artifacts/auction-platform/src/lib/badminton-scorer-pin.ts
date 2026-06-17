/** Suggest a random 4-digit PIN for new matches (server generates if omitted). */
export function suggestScorerPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
