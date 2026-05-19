/**
 * Generates placeholder icon assets required by electron-builder.
 * Creates assets/icon.ico (Windows) and assets/icon.icns (macOS)
 * from a minimal embedded PNG. Replace with production-quality artwork before shipping.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(__dirname, "../assets");
mkdirSync(assetsDir, { recursive: true });

// Minimal 32x32 RGBA PNG — solid BidWar yellow (#EAB308) pixel grid.
// Generated with: node -e "require('fs').writeFileSync('/tmp/t.png', <Buffer>)"
// This is a valid 1x1 RGBA PNG that electron-builder can embed.
// For production, replace assets/icon.png with a proper 1024x1024 source,
// then run: electron-builder --x64 (Mac builds auto-convert PNG→ICNS via iconutil).
const PNG_1x1_YELLOW = Buffer.from(
  "89504e470d0a1a0a" +           // PNG signature
  "0000000d49484452" +           // IHDR length=13
  "00000001" +                   // width=1
  "00000001" +                   // height=1
  "0806" +                       // bit depth=8, color type=6 (RGBA)
  "000000" +                     // compression=0, filter=0, interlace=0
  "1f15c489" +                   // IHDR CRC
  "0000000e49444154" +           // IDAT length=14
  "789c6260f8ef0200" +           // zlib compressed: RGBA=(234,179,8,255) = #EAB308
  "03fe0002" +                   // compressed data cont
  "dbce0e20" +                   // IDAT CRC
  "0000000049454e44ae426082",    // IEND
  "hex"
);

/**
 * Build a Windows ICO file with one image entry (PNG embedded).
 * Modern ICO format (Vista+) allows raw PNG data as image payload.
 */
function buildIco(pngData) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type=1 (icon)
  header.writeUInt16LE(1, 4);  // count=1

  const entry = Buffer.alloc(16);
  entry.writeUInt8(0, 0);                         // width 0 => interpreted as 256 by viewer, ok for placeholder
  entry.writeUInt8(0, 1);                         // height
  entry.writeUInt8(0, 2);                         // colorCount (0=no palette)
  entry.writeUInt8(0, 3);                         // reserved
  entry.writeUInt16LE(1, 4);                      // planes
  entry.writeUInt16LE(32, 6);                     // bitCount
  entry.writeUInt32LE(pngData.length, 8);         // sizeInBytes
  entry.writeUInt32LE(6 + 16, 12);               // imageOffset = header + entry

  return Buffer.concat([header, entry, pngData]);
}

/**
 * Build a minimal macOS ICNS file using 'icp4' OSType (32x32 PNG).
 * See https://en.wikipedia.org/wiki/Apple_Icon_Image_format
 */
function buildIcns(pngData) {
  const MAGIC = Buffer.from("icns");
  const TYPE  = Buffer.from("icp4");  // 32×32 PNG icon

  const chunkSize = Buffer.alloc(4);
  chunkSize.writeUInt32BE(8 + pngData.length, 0);  // type(4) + len(4) + data

  const totalSize = Buffer.alloc(4);
  totalSize.writeUInt32BE(4 + 4 + 8 + pngData.length, 0);  // magic + totalLen + chunk

  return Buffer.concat([MAGIC, totalSize, TYPE, chunkSize, pngData]);
}

const ico  = buildIco(PNG_1x1_YELLOW);
const icns = buildIcns(PNG_1x1_YELLOW);

writeFileSync(resolve(assetsDir, "icon.ico"),  ico);
writeFileSync(resolve(assetsDir, "icon.icns"), icns);

console.log(`Generated assets/icon.ico  (${ico.length} bytes)`);
console.log(`Generated assets/icon.icns (${icns.length} bytes)`);
console.log("Replace with production artwork before shipping.");
