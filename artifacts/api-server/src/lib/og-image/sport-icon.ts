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

export function formatSportLabel(sport: string): string {
  const key = sport.trim().toLowerCase();
  if (SPORT_LABELS[key]) return SPORT_LABELS[key];
  const trimmed = sport.trim();
  if (!trimmed) return "Sports";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
