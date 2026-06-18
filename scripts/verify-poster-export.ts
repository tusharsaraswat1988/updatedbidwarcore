/**
 * Phase 16.2 verification — render Team Reveal posters at all aspect ratios.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { renderCreativeJobHtml } from "../lib/buzz-studio-render/src/render-html.tsx";
import { BuzzTemplateType } from "../artifacts/auction-platform/src/features/buzz-studio/registry/template-types.ts";
import { demoFullCricket } from "../artifacts/auction-platform/src/features/buzz-studio/templates/team-reveal/demo-data.ts";
import {
  screenshotHtmlToPng,
  closeRenderBrowser,
} from "../artifacts/api-server/src/lib/creative-render-screenshot.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "artifacts", "poster-verify");

mkdirSync(outDir, { recursive: true });

const ratios = ["1:1", "4:5", "16:9"] as const;
const results: Array<{
  aspectRatio: string;
  width: number;
  height: number;
  pngPath: string;
  pngBytes: number;
  hasFullBleedRoot: boolean;
  hasLandscapeLayout: boolean;
}> = [];

for (const aspectRatio of ratios) {
  const { html, dimensions } = renderCreativeJobHtml({
    templateId: BuzzTemplateType.TEAM_REVEAL,
    contract: demoFullCricket as unknown as Record<string, unknown>,
    aspectRatio,
  });

  const slug = aspectRatio.replace(":", "x");
  writeFileSync(join(outDir, `team-reveal-${slug}.html`), html);

  const png = await screenshotHtmlToPng(html, dimensions);
  const pngPath = join(outDir, `team-reveal-${slug}.png`);
  writeFileSync(pngPath, png);

  results.push({
    aspectRatio,
    width: dimensions.width,
    height: dimensions.height,
    pngPath,
    pngBytes: png.length,
    hasFullBleedRoot: html.includes("minHeight:100%") || html.includes("height:100%"),
    hasLandscapeLayout: aspectRatio === "16:9" ? html.includes("flex-direction:row") : true,
  });
}

await closeRenderBrowser();
console.log(JSON.stringify(results, null, 2));
