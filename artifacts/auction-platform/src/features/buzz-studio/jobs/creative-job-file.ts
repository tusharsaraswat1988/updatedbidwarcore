/**
 * Buzz Studio — Creative job file URLs (view / download).
 */

import { apiFetch, apiUrl } from "@workspace/api-base";
import type { CreativeJob } from "./creative-job-types";

export function creativeJobFilePath(
  tournamentId: number,
  jobId: string,
  options?: { download?: boolean },
): string {
  const params = new URLSearchParams();
  if (options?.download) params.set("download", "1");
  const query = params.toString();
  return `/tournaments/${tournamentId}/creative-jobs/${jobId}/file${query ? `?${query}` : ""}`;
}

export function creativeJobFileUrl(
  tournamentId: number,
  jobId: string,
  options?: { download?: boolean },
): string {
  return apiUrl(creativeJobFilePath(tournamentId, jobId, options));
}

export function canViewCreativeJobFile(job: CreativeJob): boolean {
  return job.status === "completed" && Boolean(job.resultUrl);
}

export function canDownloadCreativeJobFile(job: CreativeJob): boolean {
  return canViewCreativeJobFile(job) && job.downloadEnabled;
}

export function creativeJobDownloadFilename(job: CreativeJob): string {
  const safeTemplate = job.templateId.replace(/[^a-z0-9_-]/gi, "-");
  const ratio = job.aspectRatio.replace(":", "x");
  return `bidwar-${safeTemplate}-${ratio}-${job.id.slice(0, 8)}.png`;
}

/** Fetch PNG bytes for programmatic download (handles local storage + Cloudinary redirect). */
export async function fetchCreativeJobFileBlob(
  tournamentId: number,
  jobId: string,
): Promise<Blob> {
  const res = await apiFetch(creativeJobFilePath(tournamentId, jobId, { download: true }));
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Download failed" }));
    throw new Error(typeof err.error === "string" ? err.error : "Download failed");
  }
  return res.blob();
}
