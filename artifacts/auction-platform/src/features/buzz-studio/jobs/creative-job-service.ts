/**
 * Buzz Studio — Creative Job Service
 *
 * Client-side facade over the creative job API.
 * Generic entry point for Template Studio and future server-side auto-creative hooks.
 */

import { fetchCreativeJob, fetchCreativeJobs, postCreativeJob } from "./creative-job-api";
import type { CreativeJob, CreateCreativeJobRequest } from "./creative-job-types";

export type { CreativeJob, CreateCreativeJobRequest, CreativeJobStatus, CreativeJobMetadata } from "./creative-job-types";
export { CREATIVE_JOB_STATUS_LABELS } from "./creative-job-types";
export { canDownloadCreative } from "./can-download-creative";

/**
 * Queue a new creative job. Does not render PNG — inserts a queued row only.
 */
export async function createCreativeJob(request: CreateCreativeJobRequest): Promise<CreativeJob> {
  return postCreativeJob(request);
}

export async function listCreativeJobs(
  tournamentId: number,
  options?: { limit?: number; templateId?: string },
): Promise<CreativeJob[]> {
  return fetchCreativeJobs(tournamentId, options);
}

export async function getCreativeJob(
  tournamentId: number,
  jobId: string,
): Promise<CreativeJob> {
  return fetchCreativeJob(tournamentId, jobId);
}
