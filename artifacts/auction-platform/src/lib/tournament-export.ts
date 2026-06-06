export async function exportTournamentForLocal(
  tournamentId: number,
  tournamentName?: string,
): Promise<void> {
  const res = await fetch(`/api/tournaments/${tournamentId}/export`);
  if (!res.ok) throw new Error("Export failed");
  const data = await res.json();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(tournamentName || "tournament").replace(/\s+/g, "-").toLowerCase()}-bidwar-export.json`;
  a.click();
  URL.revokeObjectURL(url);
}
