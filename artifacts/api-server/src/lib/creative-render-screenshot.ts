/**
 * Headless PNG screenshot via Playwright.
 */

import type { RenderDimensions } from "@workspace/buzz-studio-render";

let browserPromise: Promise<import("playwright").Browser> | null = null;

const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-software-rasterizer",
  "--font-render-hinting=none",
] as const;

function launchErrorHint(message: string): string {
  if (/Executable doesn't exist|ENOENT|browserType\.launch/i.test(message)) {
    return `${message}\n\nPlaywright Chromium is not installed on this server. Run: pnpm run setup:playwright-browsers (or set PLAYWRIGHT_BROWSERS_PATH and install during deploy).`;
  }
  return message;
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();
      try {
        return await chromium.launch({
          headless: true,
          args: [...CHROMIUM_ARGS],
          ...(executablePath ? { executablePath } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(launchErrorHint(message));
      }
    })().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function screenshotHtmlToPng(
  html: string,
  dimensions: RenderDimensions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: dimensions.width, height: dimensions.height },
    deviceScaleFactor: 1,
  });

  try {
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.waitForTimeout(500);
    const buffer = await page.screenshot({
      type: "png",
      fullPage: false,
      omitBackground: false,
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

export async function closeRenderBrowser(): Promise<void> {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // Launch or close failed — singleton already cleared.
  }
}
