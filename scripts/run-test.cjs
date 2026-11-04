const { spawnSync } = require('child_process');
const fs = require('fs');

const testFile = process.argv[2] || 'artifacts/api-server/src/verify-phase3-3-resilience.ts';
console.log(`Executing test runner for: ${testFile}`);

// Load .env manually so we can safely point to isolated bidwar_test_scratch
let envVars = {};
try {
  const envText = fs.readFileSync('.env', 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      envVars[k] = v;
    }
  }
} catch {}

const raw = envVars['NEON_DATABASE_URL'] || envVars['DATABASE_URL'] || process.env.DATABASE_URL || '';
let testUrl = '';
let directTestUrl = '';
if (raw) {
  const u = new URL(raw);
  u.pathname = '/bidwar_test_scratch';
  testUrl = u.toString();
  directTestUrl = testUrl.replace('-pooler.', '.');
}

const childEnv = {
  ...envVars,
  ...process.env,
  NODE_ENV: 'development',
  PORT: '5000',
  DATABASE_URL: testUrl,
  NEON_DATABASE_URL: testUrl,
  DIRECT_DATABASE_URL: directTestUrl,
};

const res = spawnSync(
  'node',
  ['artifacts/api-server/node_modules/tsx/dist/cli.mjs', testFile],
  {
    stdio: 'inherit',
    env: childEnv,
  }
);

process.exit(res.status ?? 0);
