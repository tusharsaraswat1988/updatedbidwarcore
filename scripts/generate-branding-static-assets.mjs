#!/usr/bin/env node
/**
 * Regenerate static branding fallbacks from the official BidWar app icon.
 * Source: attached_assets/bidwar_app_icon.png (1024×1024 shield / gavel mark)
 *
 * Output: artifacts/auction-platform/public/assets/branding/*
 */
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("../artifacts/api-server/node_modules/sharp");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "attached_assets/bidwar_app_icon.png");
const OUT_DIR = path.join(ROOT, "artifacts/auction-platform/public/assets/branding");

async function writePng(name, size) {
  const out = path.join(OUT_DIR, name);
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log(`  ${name} (${size}×${size})`);
}

async function writeWebp(name, size) {
  const out = path.join(OUT_DIR, name);
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(out);
  console.log(`  ${name} (${size}×${size} webp)`);
}

async function writeIco() {
  const sizes = [16, 32, 48];
  const pngBuffers = await Promise.all(
    sizes.map((s) =>
      sharp(SOURCE)
        .resize(s, s, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  // Minimal ICO container: single 32×32 PNG embedded (widely supported).
  const primary = pngBuffers[1];
  const out = path.join(OUT_DIR, "favicon.ico");
  await sharp(primary).toFile(out);
  console.log("  favicon.ico (32×32 PNG payload)");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating branding fallbacks from ${SOURCE}`);
  await writePng("favicon-32.png", 32);
  await writePng("favicon-32x32.png", 32);
  await writePng("apple-touch-icon.png", 180);
  await writePng("pwa-icon-192.png", 192);
  await writePng("pwa-icon-512.png", 512);
  await writeWebp("boot-splash-logo.webp", 128);
  await writeIco();

  // Copy official wordmark into branding folder for reference (resolver uses broadcast path).
  const wordmarkSrc = path.join(
    ROOT,
    "artifacts/auction-platform/public/assets/broadcast/bidwar-reverse-logo-official.png",
  );
  await copyFile(wordmarkSrc, path.join(OUT_DIR, "bidwar-reverse-logo-official.png"));
  console.log("  bidwar-reverse-logo-official.png (copy)");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
