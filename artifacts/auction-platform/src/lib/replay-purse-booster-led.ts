import { apiFetch } from "@workspace/api-base";

export async function replayPurseBoosterLed(tournamentId: number): Promise<void> {
  const res = await apiFetch(`/tournaments/${tournamentId}/purse-boosters/replay-led`, {
    method: "POST",
    json: {},
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to replay purse booster on LED");
  }
}
