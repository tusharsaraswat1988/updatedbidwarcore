/**
 * Process a single creative_jobs row: SSR → PNG → storage → status update.
 */

import { renderCreativeJobHtml } from "@workspace/buzz-studio-render";
import type { CreativeJobRow } from "@workspace/db";
import { updateCreativeJobStatus, updateCreativeJobStatusById } from "./creative-jobs-service.js";
import { screenshotHtmlToPng, closeRenderBrowser } from "./creative-render-screenshot.js";
import { storeCreativePng } from "./creative-render-storage.js";
import { logger } from "./logger.js";
import { resolveBuzzStudioBackground } from "./buzz-studio-assets.js";

export async function processCreativeJobRow(row: CreativeJobRow): Promise<void> {
  const { id: jobId, tournamentId, templateId, contractJson, aspectRatio } = row;

  try {
    // Resolve the admin-uploaded background URL at render time.
    // This keeps background ownership in Creative Assets Manager, not in contracts.
    const { url: backgroundImageUrl, featuredFrameLayout } = await resolveBuzzStudioBackground(
      templateId,
      aspectRatio,
    );

    const { html, dimensions } = renderCreativeJobHtml({
      templateId,
      contract: contractJson,
      aspectRatio,
      backgroundImageUrl: backgroundImageUrl ?? undefined,
      featuredFrameLayout,
    });

    const pngBuffer = await screenshotHtmlToPng(html, dimensions);
    const stored = await storeCreativePng({
      tournamentId,
      jobId,
      buffer: pngBuffer,
    });

    await updateCreativeJobStatus(tournamentId, jobId, {
      status: "completed",
      resultUrl: stored.resultUrl,
      errorMessage: null,
    });

    logger.info(
      { jobId, tournamentId, templateId, storage: stored.storage, aspectRatio },
      "Creative job rendered",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Render failed";
    const failed = await updateCreativeJobStatus(tournamentId, jobId, {
      status: "failed",
      errorMessage: message.slice(0, 2000),
      resultUrl: null,
    });
    if (!failed) {
      await updateCreativeJobStatusById(jobId, {
        status: "failed",
        errorMessage: message.slice(0, 2000),
        resultUrl: null,
      });
    }
    logger.error({ err, jobId, tournamentId, templateId }, "Creative job render failed");
  } finally {
    await closeRenderBrowser();
  }
}
