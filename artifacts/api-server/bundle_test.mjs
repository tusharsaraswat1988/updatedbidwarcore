import { build } from 'esbuild';

async function bundle() {
  await build({
    entryPoints: ['run_test.ts'],
    outfile: 'run_test.mjs',
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['ioredis', 'sharp'],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`
    }
  });
  console.log("Bundled successfully!");
}

bundle().catch(console.error);
