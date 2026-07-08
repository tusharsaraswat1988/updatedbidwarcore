/**
 * Headless PNG screenshot via Playwright.
 */

import type { RenderDimensions } from "@workspace/buzz-studio-render";

let browserPromise: Promise<import("playwright").Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { chromium } = await import("playwright");
      return chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
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
