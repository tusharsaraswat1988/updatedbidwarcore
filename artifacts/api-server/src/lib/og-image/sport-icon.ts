const SPORT_LABELS: Record<string, string> = {
  cricket: "Cricket",
  badminton: "Badminton",
  football: "Football",
  kabaddi: "Kabaddi",
  basketball: "Basketball",
  volleyball: "Volleyball",
  esports: "Esports",
  tennis: "Tennis",
  hockey: "Hockey",
};

const SPORT_ACCENTS: Record<string, string> = {
  cricket: "#22c55e",
  badminton: "#f59e0b",
  football: "#3b82f6",
  kabaddi: "#ef4444",
  basketball: "#f97316",
  volleyball: "#a855f7",
  esports: "#06b6d4",
  tennis: "#84cc16",
  hockey: "#14b8a6",
};

export function formatSportLabel(sport: string): string {
  const key = sport.trim().toLowerCase();
  if (SPORT_LABELS[key]) return SPORT_LABELS[key];
  const trimmed = sport.trim();
  if (!trimmed) return "Sports";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function sportAccentColor(sport: string): string {
  return SPORT_ACCENTS[sport.trim().toLowerCase()] ?? "#f59e0b";
}
