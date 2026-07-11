# Database Boot Baseline — Staging

> Observation only. No application code or environment variable changes.  
> Collected: **2026-07-11** (UTC)  
> Service: **bidwar-staging** (`srv-d992mo57vvec73evcmgg`) only  
> Build: `08a8b51` (`develop`)  
> Method: `POST /v1/services/{id}/restart` → wait for new `database_startup_summary` log → `GET /api/auth/admin/diagnostics/startup`

Raw capture: `artifacts/staging-boot-baseline.json`

---

## Scope

| Item | Value |
|------|--------|
| Environment | staging |
| Base URL | https://bidwar-staging.onrender.com |
| Samples | 5 cold-ish process restarts |
| Production | **not touched** |

Each cycle waited for a **new** `database_startup_summary` log line after restart (log totals cross-checked against Diagnostics; all 5 matched).

---

## Summary statistics (n=5)

| Metric | Min | Max | Avg |
|--------|-----|-----|-----|
| System C execution time (ms) | 4319 | 5202 | 4748 |
| System D execution time (ms) | 598 | 700 | 641 |
| Total database boot time (ms) | 5800 | 6897 | 6340 |
| Memory RSS (MB) | 254.8 | 279.6 | 269.7 |
| Memory heap used (MB) | 162.2 | 187.3 | 177.1 |

Notes:

- Total database boot time is wall-clock overlap of Systems C and D (not a simple sum).
- Startup DDL batches were **33** on every sample; startup failures were **0** on every sample.
- Captures were taken ~26–46s after process listen (Diagnostics `process.uptimeSeconds`).

---

## Per-cycle Diagnostics capture

| # | System C (ms) | System D (ms) | Total boot (ms) | RSS (MB) | Heap used (MB) | DB pool (total/idle/waiting) | Pool status | Redis | SSE |
|---|---------------|---------------|-----------------|----------|----------------|------------------------------|-------------|-------|-----|
| 1 | 4723 | 609 | 6213 | 279.6 | 187.3 | 10 / 10 / 0 | pool_idle | ready | idle (0 clients) |
| 2 | 4398 | 695 | 5998 | 254.8 | 162.3 | 10 / 10 / 0 | pool_idle | ready | idle (0 clients) |
| 3 | 5098 | 604 | 6793 | 259.5 | 162.2 | 10 / 10 / 0 | pool_idle | ready | idle (0 clients) |
| 4 | 4319 | 598 | 5800 | 278.4 | 186.7 | 2 / 2 / 0 | pool_idle | ready | idle (0 clients) |
| 5 | 5202 | 700 | 6897 | 276.3 | 187.0 | 10 / 10 / 0 | pool_idle | ready | idle (0 clients) |

### Redis (all cycles)

| Field | Value |
|-------|--------|
| configured | true |
| status | ready |
| commandClientStatus | ready |
| subscriberClientStatus | ready |

### SSE (all cycles)

| Field | Value |
|-------|--------|
| status | idle |
| auctionClients | 0 |
| scoringClients | 0 |
| badmintonClients | 0 |
| totalClients | 0 |

### Database identity (masked)

| Field | Value |
|-------|--------|
| hostMasked | `ep-****.****.ap-southeast-1.aws.neon.tech` |
| databaseName | neondb |
| sslModePresent | true |

---

## Cycle timestamps (UTC)

| # | Restart requested | Startup log | Diagnostics captured | Uptime at capture (s) |
|---|-------------------|-------------|----------------------|------------------------|
| 1 | 2026-07-11T13:55:31Z | 2026-07-11T13:56:02Z | ~13:56:10Z | 26 |
| 2 | 2026-07-11T13:56:10Z | 2026-07-11T13:56:38Z | ~13:56:50Z | 29 |
| 3 | 2026-07-11T13:56:50Z | 2026-07-11T13:57:18Z | ~13:57:30Z | 30 |
| 4 | 2026-07-11T13:57:30Z | 2026-07-11T13:57:56Z | ~13:58:20Z | 46 |
| 5 | 2026-07-11T13:58:20Z | 2026-07-11T13:58:54Z | ~13:59:07Z | 28 |

Exact ISO timestamps are in `artifacts/staging-boot-baseline.json`.

---

## Interpretation (baseline only)

1. **System C dominates boot** (~4.3–5.2s); System D is consistently sub-second (~0.6–0.7s).
2. **Total DB boot** sits ~5.8–6.9s on this staging Neon + free Render instance.
3. **Memory** after boot is ~255–280 MB RSS with heap ~162–187 MB.
4. **Redis** came up ready on every sample; **SSE** had no clients (idle) as expected for an unattended restart baseline.
5. **Pool** was idle with no waiters; total connections were usually 10 (one sample at 2 — early post-boot sampling variance).

This file is a **staging baseline** for later comparison after database governance / healer changes. It is not a production measurement.

---

## Constraints respected

- Operated only on `bidwar-staging` / `srv-d992mo57vvec73evcmgg`
- No application code changes
- No environment variable modifications
- No production deploy or restart
