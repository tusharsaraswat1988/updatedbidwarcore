import fs from 'node:fs';
import path from 'node:path';

// Read ADMIN_PASSWORD from .env
const envContent = fs.readFileSync('.env', 'utf8');
let adminPassword = '';
for (const line of envContent.split(/\r?\n/)) {
  if (line.trim().startsWith('ADMIN_PASSWORD=')) {
    adminPassword = line.trim().slice('ADMIN_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
  }
}

const API_BASE = 'http://127.0.0.1:8085/api';

async function fetchJson(endpoint, options = {}, cookies = '') {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(cookies ? { Cookie: cookies } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data, headers: res.headers, setCookies };
}

function extractAuthCookie(headerOrList) {
  const str = Array.isArray(headerOrList) ? headerOrList.join(', ') : String(headerOrList || '');
  const matches = [...str.matchAll(/bidwar_auth=([^;,\s]+)/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const val = matches[i][1];
    if (val && val !== 'null' && val.length > 10) {
      return `bidwar_auth=${val}`;
    }
  }
  return '';
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('BIDWAR LOCAL E2E LIFECYCLE VERIFICATION');
  console.log('====================================================\n');

  // 1. Admin Login
  console.log('Step 1: Authenticating as Master Admin...');
  const adminLoginRes = await fetchJson('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: adminPassword }),
  });
  console.log('Admin login set-cookie headers:', adminLoginRes.headers.get('set-cookie'));
  const adminCookie = extractAuthCookie(adminLoginRes.headers.get('set-cookie') || adminLoginRes.setCookies);
  console.log('Extracted cookie:', adminCookie.slice(0, 30) + '...');
  if (!adminLoginRes.ok) {
    throw new Error(`Admin login failed: ${adminLoginRes.status} ${JSON.stringify(adminLoginRes.data)}`);
  }
  console.log('✓ Master Admin authenticated successfully.\n');

  // 2. Create Disposable Test Tournament
  const testTournamentName = `Disposable Lifecycle Test ${Date.now()}`;
  console.log(`Step 2: Creating disposable test tournament "${testTournamentName}"...`);
  const createTournRes = await fetchJson('/auth/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify({
      name: testTournamentName,
      sport: 'cricket',
      city: 'Mumbai',
      venue: 'Wankhede Local Test Grounds',
      basePurse: 10000000,
      minBid: 100000,
      auctionEnabled: true,
      scoringEnabled: true,
      playerRegistrationMode: 'auction',
    }),
  }, adminCookie);

  if (!createTournRes.ok) {
    throw new Error(`Tournament creation failed: ${createTournRes.status} ${JSON.stringify(createTournRes.data)}`);
  }
  const tid = createTournRes.data.id;
  console.log(`✓ Created disposable tournament ID: ${tid} | Name: "${testTournamentName}"`);

  // Grant active license to test tournament
  const licenseRes = await fetchJson(`/auth/admin/tournaments/${tid}/set-license-status`, {
    method: 'POST',
    body: JSON.stringify({ status: 'active', reason: 'E2E testing license activation' }),
  }, adminCookie);
  console.log(`✓ Granted active license status: ${licenseRes.ok} (status ${licenseRes.status})\n`);

  // 3. Organizer Login for this tournament
  console.log(`Step 3: Logging in as Organizer for tournament #${tid}...`);
  const orgLoginRes = await fetchJson(`/auth/organizer/${tid}/login`, {
    method: 'POST',
    body: JSON.stringify({ password: adminPassword }),
  });
  if (!orgLoginRes.ok) {
    throw new Error(`Organizer login failed: ${orgLoginRes.status} ${JSON.stringify(orgLoginRes.data)}`);
  }
  const orgCookie = extractAuthCookie(orgLoginRes.headers.get('set-cookie') || orgLoginRes.setCookies);
  console.log('✓ Organizer session established.\n');

  // Verify tournament serializer reflects officialActivatedAt = null
  const tournDetail = await fetchJson(`/tournaments/${tid}`, {}, orgCookie);
  console.log(`✓ Pre-activation officialActivatedAt in serializer: ${tournDetail.data.officialActivatedAt}`);
  if (tournDetail.data.officialActivatedAt !== null) {
    throw new Error('Assertion failed: new tournament must have officialActivatedAt = null');
  }

  // 4. Create Teams
  console.log('Step 4: Creating test teams...');
  const team1Res = await fetchJson(`/tournaments/${tid}/teams`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Alpha Strikers',
      shortCode: 'ALS',
      ownerName: 'Alice Owner',
      ownerMobile: '9876500001',
      purse: 10000000,
    }),
  }, orgCookie);
  const team2Res = await fetchJson(`/tournaments/${tid}/teams`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Beta Titans',
      shortCode: 'BTT',
      ownerName: 'Bob Owner',
      ownerMobile: '9876500002',
      purse: 10000000,
    }),
  }, orgCookie);
  if (!team1Res.ok || !team2Res.ok) {
    throw new Error(`Team creation failed: ${JSON.stringify(team1Res.data)} ${JSON.stringify(team2Res.data)}`);
  }
  const team1 = team1Res.data;
  const team2 = team2Res.data;
  console.log(`✓ Team 1: ${team1.name} (ID ${team1.id}) | Team 2: ${team2.name} (ID ${team2.id})`);

  // 5. Create Players
  console.log('Step 5: Creating test players in pool...');
  const p1Res = await fetchJson(`/tournaments/${tid}/players`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Player One',
      mobileNumber: '9876510001',
      role: 'Batsman',
      basePrice: 1000000,
    }),
  }, orgCookie);
  const p2Res = await fetchJson(`/tournaments/${tid}/players`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Player Two',
      mobileNumber: '9876510002',
      role: 'Bowler',
      basePrice: 1000000,
    }),
  }, orgCookie);
  const p3Res = await fetchJson(`/tournaments/${tid}/players`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Player Three',
      mobileNumber: '9876510003',
      role: 'All-Rounder',
      basePrice: 1000000,
    }),
  }, orgCookie);
  if (!p1Res.ok || !p2Res.ok || !p3Res.ok) {
    throw new Error(`Player creation failed: ${JSON.stringify(p1Res.data)} ${JSON.stringify(p2Res.data)} ${JSON.stringify(p3Res.data)}`);
  }
  const p1 = p1Res.data;
  const p2 = p2Res.data;
  const p3 = p3Res.data;
  console.log(`✓ Players created: ${p1.name} (ID ${p1.id}), ${p2.name} (ID ${p2.id}), ${p3.name} (ID ${p3.id})\n`);

  // ====================================================
  // PHASE 4A: RESET DATA (BEFORE ACTIVATION)
  // ====================================================
  console.log('--- PHASE 4A: TESTING RESET DATA BEFORE ACTIVATION ---');
  // Start auction
  await fetchJson(`/tournaments/${tid}/auction/start`, { method: 'POST' }, orgCookie);
  // Next player: Player One
  await fetchJson(`/tournaments/${tid}/auction/next-player`, {
    method: 'POST',
    body: JSON.stringify({ playerId: p1.id }),
  }, orgCookie);

  // Start timer to allow bidding
  await fetchJson(`/tournaments/${tid}/auction/start-timer`, {
    method: 'POST',
    body: JSON.stringify({ seconds: 60 }),
  }, orgCookie);

  // Bids on Player One
  await fetchJson(`/tournaments/${tid}/auction/bid`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team1.id, amount: 1200000 }),
  }, orgCookie);
  await fetchJson(`/tournaments/${tid}/auction/bid`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team2.id, amount: 1500000 }),
  }, orgCookie);

  // Sell Player One to Team 2 via manual-sell
  const soldRes = await fetchJson(`/tournaments/${tid}/auction/manual-sell`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team2.id, amount: 1500000, reason: 'Trial auction sale' }),
  }, orgCookie);
  if (!soldRes.ok) {
    throw new Error(`Trial manual-sell failed: ${soldRes.status} ${JSON.stringify(soldRes.data)}`);
  }
  console.log(`✓ Sold ${p1.name} to ${team2.name} for 1,500,000 in trial auction.`);

  // Verify operational data exists
  const checkP1 = await fetchJson(`/tournaments/${tid}/players/${p1.id}`, {}, orgCookie);
  if (checkP1.data.status !== 'sold' || checkP1.data.teamId !== team2.id) {
    throw new Error(`Assertion failed: Player One should be marked sold before reset (status: ${checkP1.data.status}, teamId: ${checkP1.data.teamId})`);
  }

  // EXECUTE UNIFIED RESET DATA (1st time)
  console.log('Triggering POST /reset-data (Pre-Activation Trial Reset #1)...');
  const reset1Res = await fetchJson(`/tournaments/${tid}/reset-data`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'E2E local trial reset validation #1' }),
  }, orgCookie);

  if (!reset1Res.ok) {
    throw new Error(`Reset Data failed: ${reset1Res.status} ${JSON.stringify(reset1Res.data)}`);
  }
  console.log('✓ Reset Data executed successfully:', reset1Res.data.counts);

  // Assert operational data was cleared
  const checkP1AfterReset = await fetchJson(`/tournaments/${tid}/players/${p1.id}`, {}, orgCookie);
  if (checkP1AfterReset.data.status !== 'available' || checkP1AfterReset.data.teamId !== null) {
    throw new Error(`Assertion failed: Player One status is "${checkP1AfterReset.data.status}", expected "available"`);
  }
  console.log('✓ Verified: Player One status returned to "available" with null teamId.');

  const checkTeamsAfterReset = await fetchJson(`/tournaments/${tid}/teams`, {}, orgCookie);
  const team2State = checkTeamsAfterReset.data.find(t => t.id === team2.id);
  if (team2State.purseUsed !== 0) {
    throw new Error(`Assertion failed: Team 2 purseUsed is ${team2State.purseUsed}, expected 0`);
  }
  console.log('✓ Verified: Team purseUsed fully restored to 0.');

  // Repeat Reset Data a second time (verify repeatability and idempotency)
  console.log('Triggering POST /reset-data (Repeatability Validation #2)...');
  const reset2Res = await fetchJson(`/tournaments/${tid}/reset-data`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'E2E local trial reset validation #2 (idempotency check)' }),
  }, orgCookie);
  if (!reset2Res.ok) {
    throw new Error(`Repeat Reset Data failed: ${reset2Res.status}`);
  }
  console.log('✓ Reset Data repeatability verified (unlimited resets during trial mode).\n');

  // ====================================================
  // PHASE 4B: ACTIVATE LIVE TRANSITION
  // ====================================================
  console.log('--- PHASE 4B: TESTING ACTIVATE LIVE TRANSITION ---');
  // Generate some new trial operational data on Player Two
  await fetchJson(`/tournaments/${tid}/auction/start`, { method: 'POST' }, orgCookie);
  await fetchJson(`/tournaments/${tid}/auction/next-player`, {
    method: 'POST',
    body: JSON.stringify({ playerId: p2.id }),
  }, orgCookie);
  await fetchJson(`/tournaments/${tid}/auction/start-timer`, {
    method: 'POST',
    body: JSON.stringify({ seconds: 60 }),
  }, orgCookie);
  await fetchJson(`/tournaments/${tid}/auction/bid`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team1.id, amount: 2000000 }),
  }, orgCookie);
  await fetchJson(`/tournaments/${tid}/auction/manual-sell`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team1.id, amount: 2000000, reason: 'Trial sale before activation' }),
  }, orgCookie);
  console.log(`✓ Placed trial bid and sold ${p2.name} to ${team1.name} before activation.`);

  // Trigger Activate Live
  console.log('Triggering POST /activate-live...');
  const activateRes = await fetchJson(`/tournaments/${tid}/activate-live`, {
    method: 'POST',
    body: JSON.stringify({
      confirmation: true,
      reason: 'E2E local verification official live activation',
    }),
  }, orgCookie);

  if (!activateRes.ok) {
    throw new Error(`Activate Live failed: ${activateRes.status} ${JSON.stringify(activateRes.data)}`);
  }
  console.log('✓ Activate Live succeeded!');
  console.log(`  officialActivatedAt: ${activateRes.data.officialActivatedAt}`);
  console.log(`  Cleanup counts:`, activateRes.data.cleanup);

  // Verify automated final trial cleanup cleared Player Two
  const checkP2AfterActivation = await fetchJson(`/tournaments/${tid}/players/${p2.id}`, {}, orgCookie);
  if (checkP2AfterActivation.data.status !== 'available') {
    throw new Error(`Assertion failed: Player Two should be available after automated cleanup, got ${checkP2AfterActivation.data.status}`);
  }
  console.log('✓ Verified: Automated final trial data cleanup reset Player Two to available.');

  // Test Activate Live Retry / Idempotency
  console.log('Testing Activate Live retry / idempotency...');
  const activateRetryRes = await fetchJson(`/tournaments/${tid}/activate-live`, {
    method: 'POST',
    body: JSON.stringify({ confirmation: true }),
  }, orgCookie);
  if (!activateRetryRes.ok || activateRetryRes.data.alreadyActivated !== true) {
    throw new Error('Assertion failed: Activate Live retry should return alreadyActivated: true');
  }
  console.log('✓ Verified: Activate Live is idempotent on retry (returns alreadyActivated: true).\n');

  // ====================================================
  // PHASE 4C: POST-ACTIVATION LOCKOUT VERIFICATION
  // ====================================================
  console.log('--- PHASE 4C: POST-ACTIVATION RESTRICTIONS & LOCKOUTS ---');
  // Attempt 1: POST /reset-data must be rejected with 403
  console.log('Attempting POST /reset-data on activated tournament...');
  const blockedResetRes = await fetchJson(`/tournaments/${tid}/reset-data`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Malicious or accidental reset attempt' }),
  }, orgCookie);
  console.log(`  Response: HTTP ${blockedResetRes.status} | Code: ${blockedResetRes.data.code}`);
  if (blockedResetRes.status !== 403 || blockedResetRes.data.code !== 'RESET_AFTER_ACTIVATION_LOCKED') {
    throw new Error(`Assertion failed: Reset Data must be 403 RESET_AFTER_ACTIVATION_LOCKED, got ${blockedResetRes.status}`);
  }
  console.log('✓ Verified: POST /reset-data is permanently BLOCKED with HTTP 403.');

  // Attempt 2: Legacy endpoint POST /auction/reset-trial must also be rejected with 403
  console.log('Attempting legacy POST /auction/reset-trial on activated tournament...');
  const blockedLegacyResetRes = await fetchJson(`/tournaments/${tid}/auction/reset-trial`, {
    method: 'POST',
    body: JSON.stringify({ resetContext: 'organizer' }),
  }, orgCookie);
  console.log(`  Response: HTTP ${blockedLegacyResetRes.status} | Code: ${blockedLegacyResetRes.data.code}`);
  if (blockedLegacyResetRes.status !== 403 || blockedLegacyResetRes.data.code !== 'RESET_AFTER_ACTIVATION_LOCKED') {
    throw new Error(`Assertion failed: Legacy reset-trial must be 403 RESET_AFTER_ACTIVATION_LOCKED, got ${blockedLegacyResetRes.status}`);
  }
  console.log('✓ Verified: Legacy reset-trial endpoint is permanently BLOCKED with HTTP 403.\n');

  // ====================================================
  // PHASE 4D: LIVE PRODUCTION AUCTION OPERATIONS
  // ====================================================
  console.log('--- PHASE 4D: LIVE PRODUCTION AUCTION OPERATIONS ---');
  // Start official live auction
  await fetchJson(`/tournaments/${tid}/auction/start`, { method: 'POST' }, orgCookie);
  // Next player: Player Three
  await fetchJson(`/tournaments/${tid}/auction/next-player`, {
    method: 'POST',
    body: JSON.stringify({ playerId: p3.id }),
  }, orgCookie);
  // Start timer
  await fetchJson(`/tournaments/${tid}/auction/start-timer`, {
    method: 'POST',
    body: JSON.stringify({ seconds: 60 }),
  }, orgCookie);
  // Place live bid
  await fetchJson(`/tournaments/${tid}/auction/bid`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team1.id, amount: 3500000 }),
  }, orgCookie);
  // Sell Player Three live via manual-sell
  const liveSoldRes = await fetchJson(`/tournaments/${tid}/auction/manual-sell`, {
    method: 'POST',
    body: JSON.stringify({ teamId: team1.id, amount: 3500000, reason: 'Live official sale' }),
  }, orgCookie);
  if (!liveSoldRes.ok) {
    throw new Error(`Live sale failed: ${liveSoldRes.status} ${JSON.stringify(liveSoldRes.data)}`);
  }
  console.log(`✓ Successfully conducted live official sale of ${p3.name} to ${team1.name} for 3,500,000.`);

  const checkP3Live = await fetchJson(`/tournaments/${tid}/players/${p3.id}`, {}, orgCookie);
  if (checkP3Live.data.status !== 'sold' || checkP3Live.data.soldPrice !== 3500000) {
    throw new Error('Assertion failed: Player Three should be sold for 3,500,000');
  }
  console.log('✓ Verified: Live official operational state persists correctly.\n');

  // Verify tournament serializer reflects sealed timestamp
  const tournFinal = await fetchJson(`/tournaments/${tid}`, {}, orgCookie);
  console.log(`✓ Final tournament status: "${tournFinal.data.status}"`);
  console.log(`✓ Final officialActivatedAt: "${tournFinal.data.officialActivatedAt}"`);

  console.log('\n====================================================');
  console.log('ALL E2E LIFECYCLE TESTS PASSED 100%!');
  console.log(`Tested Tournament ID: ${tid}`);
  console.log('====================================================\n');
}

runE2ETests().catch(err => {
  console.error('\n❌ E2E TEST RUNNER FAILED:', err);
  process.exit(1);
});
