import { useMutation } from "@tanstack/react-query";
import type { AuctionState } from "@workspace/api-client-react";
import { customFetch } from "../../../../lib/api-client-react/src/custom-fetch";
import type { PresentationContextKind } from "@/lib/presentation-context";

export type SetPresentationContextBody = {
  context?: PresentationContextKind;
  selectedTeamId?: number | null;
};

export async function setPresentationContext(
  tournamentId: number,
  data: SetPresentationContextBody,
): Promise<AuctionState> {
  return customFetch<AuctionState>(
    `/api/tournaments/${tournamentId}/auction/presentation-context`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function useSetPresentationContext() {
  return useMutation({
    mutationKey: ["setPresentationContext"],
    mutationFn: ({
      tournamentId,
      data,
    }: {
      tournamentId: number;
      data: SetPresentationContextBody;
    }) => setPresentationContext(tournamentId, data),
  });
}
