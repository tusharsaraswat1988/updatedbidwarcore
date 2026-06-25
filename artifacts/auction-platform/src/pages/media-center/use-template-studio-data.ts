/**
 * Template Studio — data hook.
 *
 * Loads provider data once per tournament + template pair.
 * Selection changes do not trigger re-fetch.
 */

import { useQuery } from "@tanstack/react-query";
import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import { getTemplateStudioConfig } from "./template-studio-config";

export function templateStudioQueryKey(
  tournamentId: number,
  templateId: BuzzTemplateType,
) {
  return ["buzz-studio", "template-studio", tournamentId, templateId] as const;
}

export function useTemplateStudioData(
  tournamentId: number,
  templateId: BuzzTemplateType,
) {
  const config = getTemplateStudioConfig(templateId);

  return useQuery({
    queryKey: templateStudioQueryKey(tournamentId, templateId),
    queryFn: () => config!.load(tournamentId),
    enabled: tournamentId > 0 && Boolean(config),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
