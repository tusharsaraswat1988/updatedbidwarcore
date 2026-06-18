/**
 * Read completed creative PNG bytes from Cloudinary or local private storage.
 * Proxied through the organizer API so browser fetch/img avoids cross-origin redirects.
 */

import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import {
  isLocalCreativeResultUrl,
  resolveLocalCreativePngPath,
} from "./creative-render-storage.js";

export async function readCreativeJobPngBuffer(resultUrl: string): Promise<Buffer> {
  if (isLocalCreativeResultUrl(resultUrl)) {
    const filePath = resolveLocalCreativePngPath(resultUrl);
    if (!filePath) {
      throw new Error("Creative file not found");
    }
    await access(filePath, fsConstants.R_OK);
    return readFile(filePath);
  }

  if (resultUrl.startsWith("https://")) {
    const response = await fetch(resultUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch creative from storage");
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Unsupported creative storage URL");
}
