import type { Express, Request, Response } from "express";
import { isValidRegistrationCodeFormat, normalizeRegistrationCode } from "@workspace/api-base/registration-url";
import { getOrCreateRegistrationOgImage } from "../lib/og-image/registration-og-service.js";
import { logger } from "../lib/logger.js";

function parseRegistrationCodeParam(raw: string): string | null {
  const code = normalizeRegistrationCode(raw);
  if (!isValidRegistrationCodeFormat(code)) return null;
  return code;
}

export function registerOgImageRoutes(app: Express): void {
  app.get("/og/register/:code.png", async (req: Request, res: Response) => {
    const code = parseRegistrationCodeParam(String(req.params.code ?? ""));
    if (!code) {
      res.status(404).end();
      return;
    }

    try {
      const result = await getOrCreateRegistrationOgImage(code);
      if (!result) {
        res.status(404).end();
        return;
      }

      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.setHeader("ETag", `"${result.etag}"`);
      if (req.headers["if-none-match"] === `"${result.etag}"`) {
        res.status(304).end();
        return;
      }
      res.send(result.buffer);
    } catch (err) {
      logger.error({ err, code }, "Registration OG image generation failed");
      res.status(500).end();
    }
  });
}
