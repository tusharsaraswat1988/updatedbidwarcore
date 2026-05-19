/**
 * Generates icon assets required by electron-builder.
 * Creates assets/icon.png (256x256, used for Linux AppImage + as source)
 *   assets/icon.ico  (Windows — PNG-in-ICO, Vista+ format)
 *   assets/icon.icns (macOS — minimal ICNS with ic08 slot)
 *
 * Uses only Node.js built-ins (zlib, fs, crypto). No npm packages needed.
 * For production, replace assets/icon.png with a proper 1024x1024 source.
 */

import { deflateSync } from "zlib";
import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../assets");
mkdirSync(assetsDir, { recursive: true });

// BidWar yellow — #EAB308  RGB(234, 179, 8)
const R = 234, G = 179, B = 8, A = 255;

// ── CRC32 (needed for PNG chunks) ────────────────────────────────────────────
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.allocUnsafe(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

function makePng(size) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8,  8);  // bit depth
  ihdr.writeUInt8(6,  9);  // colour type: RGBA
  ihdr.writeUInt8(0, 10);  // compression
  ihdr.writeUInt8(0, 11);  // filter
  ihdr.writeUInt8(0, 12);  // interlace

  // Raw scanline data: filter byte 0x00 + RGBA per pixel
  const raw = Buffer.allocUnsafe(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const p = row + 1 + x * 4;
      raw[p] = R; raw[p + 1] = G; raw[p + 2] = B; raw[p + 3] = A;
    }
  }

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── ICO builder (Vista+ PNG-in-ICO) ──────────────────────────────────────────
function buildIco(pngData) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(1, 4); // count = 1

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);                    // width  0 → 256
  entry.writeUInt8(0, 1);                    // height 0 → 256
  entry.writeUInt8(0, 2);                    // color count (0 = true colour)
  entry.writeUInt8(0, 3);                    // reserved
  entry.writeUInt16LE(1, 4);                 // colour planes
  entry.writeUInt16LE(32, 6);               // bits per pixel
  entry.writeUInt32LE(pngData.length, 8);   // image data size
  entry.writeUInt32LE(22, 12);              // offset of image data (6 header + 16 entry)

  return Buffer.concat([header, entry, pngData]);
}

// ── ICNS builder (ic08 = 256x256 PNG slot) ───────────────────────────────────
function buildIcns(pngData) {
  const magic = Buffer.from("icns");
  const type  = Buffer.from("ic08"); // 256x256 PNG
  const chunkLen = Buffer.allocUnsafe(4);
  chunkLen.writeUInt32BE(8 + pngData.length, 0); // type(4) + length-field(4) + data
  const totalLen = Buffer.allocUnsafe(4);
  totalLen.writeUInt32BE(8 + 8 + pngData.length, 0); // magic(4) + total-len(4) + chunk
  return Buffer.concat([magic, totalLen, type, chunkLen, pngData]);
}

// ── Generate ──────────────────────────────────────────────────────────────────
const png256 = makePng(256);

writeFileSync(resolve(assetsDir, "icon.png"),  png256);
writeFileSync(resolve(assetsDir, "icon.ico"),  buildIco(png256));
writeFileSync(resolve(assetsDir, "icon.icns"), buildIcns(png256));

console.log(`Generated assets/icon.png  (${png256.length} bytes, 256x256 RGBA)`);
console.log(`Generated assets/icon.ico  (PNG-in-ICO, Vista+ format)`);
console.log(`Generated assets/icon.icns (ic08 / 256x256 PNG slot)`);
console.log("Replace with production 1024x1024 artwork before shipping.");
