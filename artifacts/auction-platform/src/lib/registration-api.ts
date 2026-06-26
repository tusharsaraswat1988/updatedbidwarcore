import { apiFetch } from "@workspace/api-base";

export async function withdrawTournamentPlayer(
  tournamentId: number,
  playerId: number,
  reason?: string,
) {
  const res = await apiFetch(`/tournaments/${tournamentId}/players/${playerId}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to withdraw player");
  }
  return res.json();
}

export async function reinstateTournamentPlayer(
  tournamentId: number,
  playerId: number,
  reason?: string,
) {
  const res = await apiFetch(`/tournaments/${tournamentId}/players/${playerId}/reinstate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reason ? { reason } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to reinstate player");
  }
  return res.json();
}
