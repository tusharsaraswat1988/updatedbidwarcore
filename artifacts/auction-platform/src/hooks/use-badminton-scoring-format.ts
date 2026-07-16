import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { badmintonFetch } from "@/lib/badminton-api";
import type { BadmintonMatchFormat } from "@workspace/badminton-core";

export type BadmintonScoringFormatResponse = {
  sport: "badminton";
  presetId: string;
  format: BadmintonMatchFormat;
  label: string;
  configured: boolean;
  options?: { suddenDeath?: boolean };
};

export function useBadmintonScoringFormat(tournamentId: number) {
  return useQuery<BadmintonScoringFormatResponse>({
    queryKey: ["badminton-scoring-format", tournamentId],
    queryFn: () =>
      badmintonFetch<BadmintonScoringFormatResponse>(tournamentId, `/scoring-format`),
    enabled: !!tournamentId,
    staleTime: 60_000,
  });
}

export function useSaveBadmintonScoringFormat(tournamentId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      presetId: string;
      format: BadmintonMatchFormat;
      options?: { suddenDeath?: boolean };
    }) =>
      badmintonFetch<BadmintonScoringFormatResponse>(tournamentId, `/scoring-format`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["badminton-scoring-format", tournamentId], data);
    },
  });
}
