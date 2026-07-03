const SPORT_LABELS: Record<string, string> = {
  cricket: "Cricket",
  badminton: "Badminton",
  football: "Football",
  volleyball: "Volleyball",
  kabaddi: "Kabaddi",
  tennis: "Tennis",
  table_tennis: "Table Tennis",
  basketball: "Basketball",
  hockey: "Hockey",
  generic: "Generic",
};

function normalizeSportId(raw: unknown): string {
  const s = String(raw ?? "cricket").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "table tennis": "table_tennis",
    tabletennis: "table_tennis",
    soccer: "football",
    "field hockey": "hockey",
  };
  return aliases[s] ?? s.replace(/\s+/g, "_");
}

export function getSportLabel(sport: unknown): string {
  const id = normalizeSportId(sport);
  if (SPORT_LABELS[id]) return SPORT_LABELS[id];
  if (!id) return "Sports";
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " ");
}

export function getScoringNavLabel(sport: unknown): string {
  return `${getSportLabel(sport)} Scoring`;
}
