import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL is missing!');
  process.exit(1);
}

// Safety check: Dev Neon host only
if (!dbUrl.includes('ep-hidden-band-aogw7hho')) {
  console.error('CRITICAL SAFETY REFUSAL: Target database is NOT Dev Neon (ep-hidden-band-aogw7hho)!');
  process.exit(1);
}

const TEST_TID = 999999;
const TIER1_NAMESPACE = 1001; // Tournament Lifecycle (Reset / Activate / Auction)
const TIER2_NAMESPACE = 1002; // Cricket Scoring Match
const TIER3_NAMESPACE = 1003; // Badminton Scoring Match

async function runConcurrencyLockTests() {
  console.log('====================================================');
  console.log('DEV NEON REAL POSTGRESQL CONCURRENCY LOCK TEST');
  console.log('====================================================');
  console.log(`Target Database: Dev Neon (ep-hidden-band-aogw7hho)`);
  console.log(`Test Tournament ID: ${TEST_TID}\n`);

  const clientA = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const clientB = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  await clientA.connect();
  await clientB.connect();
  console.log('✓ Established 2 independent physical PostgreSQL client connections.\n');

  try {
    // ----------------------------------------------------
    // TEST 1: Tier 1 Shared Concurrency
    // Multiple auction mutations (bids, next-player) can acquire shared locks concurrently
    // ----------------------------------------------------
    console.log('TEST 1: Testing Tier 1 Shared lock coexistence (concurrent auction bids)...');
    await clientA.query('BEGIN');
    await clientB.query('BEGIN');

    await clientA.query('SELECT pg_advisory_xact_lock_shared($1, $2)', [TIER1_NAMESPACE, TEST_TID]);
    console.log('  Client A acquired Tier 1 Shared Lock (1001, tid)');

    const resB1 = await clientB.query('SELECT pg_try_advisory_xact_lock_shared($1, $2) AS acquired', [TIER1_NAMESPACE, TEST_TID]);
    const acquiredB1 = resB1.rows[0].acquired;
    console.log(`  Client B try_advisory_xact_lock_shared result: ${acquiredB1}`);

    if (acquiredB1 !== true) {
      throw new Error('Assertion failed: Concurrent Tier 1 Shared locks must both succeed!');
    }
    console.log('✓ PASS: Concurrent shared locks coexist without blocking.\n');

    await clientA.query('COMMIT');
    await clientB.query('COMMIT');

    // ----------------------------------------------------
    // TEST 2: Tier 1 Exclusive Lock Blocks Shared Lock
    // Reset Data / Activate Live exclusively blocks concurrent auction operations
    // ----------------------------------------------------
    console.log('TEST 2: Testing Tier 1 Exclusive Lock exclusivity against Shared Lock...');
    await clientA.query('BEGIN');
    await clientB.query('BEGIN');

    // Client A acquires EXCLUSIVE lifecycle lock (Reset Data or Activate Live)
    await clientA.query('SELECT pg_advisory_xact_lock($1, $2)', [TIER1_NAMESPACE, TEST_TID]);
    console.log('  Client A acquired Tier 1 Exclusive Lock (1001, tid) [Reset Data / Activate Live in progress]');

    // Client B attempts to acquire SHARED auction mutation lock (e.g. concurrent bid / sell)
    const resB2 = await clientB.query('SELECT pg_try_advisory_xact_lock_shared($1, $2) AS acquired', [TIER1_NAMESPACE, TEST_TID]);
    const acquiredB2 = resB2.rows[0].acquired;
    console.log(`  Client B try_advisory_xact_lock_shared result: ${acquiredB2} (expected: false)`);

    if (acquiredB2 !== false) {
      throw new Error('Assertion failed: Tier 1 Exclusive Lock must block Tier 1 Shared Lock!');
    }
    console.log('✓ PASS: Tier 1 Exclusive Lock strictly blocks auction mutations during Reset Data / Activate Live.');

    // Client A commits, ending the reset transaction
    await clientA.query('COMMIT');
    console.log('  Client A transaction committed (Exclusive Lock released)');

    // Client B retries after commit
    const resB2Retry = await clientB.query('SELECT pg_try_advisory_xact_lock_shared($1, $2) AS acquired', [TIER1_NAMESPACE, TEST_TID]);
    const acquiredB2Retry = resB2Retry.rows[0].acquired;
    console.log(`  Client B retry try_advisory_xact_lock_shared result: ${acquiredB2Retry} (expected: true)`);

    if (acquiredB2Retry !== true) {
      throw new Error('Assertion failed: Shared lock must succeed once exclusive lock is committed!');
    }
    console.log('✓ PASS: Shared lock immediately succeeds once Exclusive Lock transaction commits.\n');
    await clientB.query('COMMIT');

    // ----------------------------------------------------
    // TEST 3: Namespace Independence (Tier 1 vs Tier 2 vs Tier 3)
    // Tier 1 Auction lock must NOT block Tier 2 Cricket match lock or Tier 3 Badminton match lock
    // ----------------------------------------------------
    console.log('TEST 3: Testing namespace independence across distinct modules...');
    await clientA.query('BEGIN');
    await clientB.query('BEGIN');

    // Client A holds Exclusive Tier 1 Lock (1001, tid)
    await clientA.query('SELECT pg_advisory_xact_lock($1, $2)', [TIER1_NAMESPACE, TEST_TID]);
    console.log('  Client A acquired Tier 1 Exclusive Lock (1001, tid)');

    // Client B acquires Tier 2 Exclusive Lock for Cricket Match (1002, tid)
    const resB3Cricket = await clientB.query('SELECT pg_try_advisory_xact_lock($1, $2) AS acquired', [TIER2_NAMESPACE, TEST_TID]);
    const acquiredB3Cricket = resB3Cricket.rows[0].acquired;
    console.log(`  Client B try Tier 2 Cricket Match Lock (1002, tid) result: ${acquiredB3Cricket} (expected: true)`);

    // Client B acquires Tier 3 Exclusive Lock for Badminton Match (1003, tid)
    const resB3Badminton = await clientB.query('SELECT pg_try_advisory_xact_lock($1, $2) AS acquired', [TIER3_NAMESPACE, TEST_TID]);
    const acquiredB3Badminton = resB3Badminton.rows[0].acquired;
    console.log(`  Client B try Tier 3 Badminton Match Lock (1003, tid) result: ${acquiredB3Badminton} (expected: true)`);

    if (acquiredB3Cricket !== true || acquiredB3Badminton !== true) {
      throw new Error('Assertion failed: Namespaces 1001, 1002, 1003 must be fully orthogonal!');
    }
    console.log('✓ PASS: Multi-module namespace isolation verified: Auction locks do not block Scoring locks.\n');

    await clientA.query('COMMIT');
    await clientB.query('COMMIT');

    // ----------------------------------------------------
    // TEST 4: Lock Release On Rollback
    // ----------------------------------------------------
    console.log('TEST 4: Testing lock release on transaction rollback...');
    await clientA.query('BEGIN');
    await clientA.query('SELECT pg_advisory_xact_lock($1, $2)', [TIER1_NAMESPACE, TEST_TID]);
    console.log('  Client A acquired Tier 1 Exclusive Lock (1001, tid)');
    await clientA.query('ROLLBACK');
    console.log('  Client A transaction rolled back');

    await clientB.query('BEGIN');
    const resB4 = await clientB.query('SELECT pg_try_advisory_xact_lock($1, $2) AS acquired', [TIER1_NAMESPACE, TEST_TID]);
    const acquiredB4 = resB4.rows[0].acquired;
    console.log(`  Client B try_advisory_xact_lock after rollback: ${acquiredB4} (expected: true)`);
    if (acquiredB4 !== true) {
      throw new Error('Assertion failed: Lock must be released on ROLLBACK!');
    }
    console.log('✓ PASS: Advisory xact lock reliably released on ROLLBACK.\n');
    await clientB.query('COMMIT');

    console.log('====================================================');
    console.log('ALL REAL POSTGRESQL ADVISORY LOCK TESTS PASSED 100%');
    console.log('====================================================');
  } finally {
    await clientA.end();
    await clientB.end();
  }
}

runConcurrencyLockTests().catch((err) => {
  console.error('❌ POSTGRESQL CONCURRENCY LOCK TEST FAILED:', err);
  process.exit(1);
});
