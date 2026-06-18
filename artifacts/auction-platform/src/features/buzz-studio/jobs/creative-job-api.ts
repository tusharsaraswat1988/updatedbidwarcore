/**
 * Buzz Studio — Creative Job API Client
 *
 * HTTP layer for tournament-scoped creative job endpoints.
 */

import { apiFetch } from "@workspace/api-base";
import type { CreativeJob, CreateCreativeJobRequest } from "./creative-job-types";

export async function fetchCreativeJobs(
  tournamentId: number,
  options?: { limit?: number; templateId?: string },
): Promise<CreativeJob[]> {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.templateId) params.set("templateId", options.templateId);
  const query = params.toString();
  const path = `/tournaments/${tournamentId}/creative-jobs${query ? `?${query}` : ""}`;

  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(typeof err.error === "string" ? err.error : "Failed to load creative jobs");
  }
  const data = (await res.json()) as { jobs: CreativeJob[] };
  return data.jobs;
}

export async function fetchCreativeJob(
  tournamentId: number,
  jobId: string,
): Promise<CreativeJob> {
  const res = await apiFetch(`/tournaments/${tournamentId}/creative-jobs/${jobId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(typeof err.error === "string" ? err.error : "Failed to load creative job");
  }
  const data = (await res.json()) as { job: CreativeJob };
  return data.job;
}

export async function postCreativeJob(
  request: CreateCreativeJobRequest,
): Promise<CreativeJob> {
  const res = await apiFetch(`/tournaments/${request.tournamentId}/creative-jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      templateId: request.templateId,
      contract: request.contract,
      aspectRatio: request.aspectRatio,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(typeof err.error === "string" ? err.error : "Failed to create creative job");
  }
  const data = (await res.json()) as { job: CreativeJob };
  return data.job;
}
