import sharp from "sharp";
import type { Sharp } from "sharp";

/** Disable libvips operation cache — native memory lives outside V8 heap (RSS). */
export function configureSharpMemory(): void {
  sharp.cache(false);
  const threads = Number(process.env.SHARP_CONCURRENCY ?? "2");
  if (Number.isFinite(threads) && threads > 0) {
    sharp.concurrency(threads);
  }
}

export async function sharpToBuffer(
  input: sharp.SharpInput,
  transform: (pipeline: Sharp) => Sharp,
): Promise<Buffer> {
  const pipeline = sharp(input, { failOn: "none" });
  try {
    return await transform(pipeline).toBuffer();
  } finally {
    await pipeline.destroy();
  }
}

export async function sharpMetadata(input: sharp.SharpInput): Promise<sharp.Metadata> {
  const pipeline = sharp(input, { failOn: "none" });
  try {
    return await pipeline.metadata();
  } finally {
    await pipeline.destroy();
  }
}
