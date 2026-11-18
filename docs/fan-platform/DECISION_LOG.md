# BIDWAR Fan Platform — Decision Log

| ID | Topic | Original Proposal | Gap Identified | Revised Decision | Reason | Remaining Uncertainty |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| D07 | Cookie Config | Path=/fan + __Host- prefix | Incompatible | Use subdomain `fan.bidwar.in` | `__Host-` requires `Path=/`. Allows total host isolation. | None |
| D08 | Redis Atomicity | XADD + PUBLISH | Crash window | Lua script (XADD, PUBLISH) | Atomicity ensures consistency for event streaming. | Lua execution latency. |
| D09 | Entitlement Auth | Redis-only | Redis is cache | DB for misses; Reval on WS | DB is authority. Redis invalidation + Reval on WS. | DB load at scale. |
| D10 | Session Rotation | Per-request | Race conditions | Sliding window (30s overlap) | Avoids lock contention. | Storage cleanup. |
| D11 | Redis Retention | 10k Limit | Insufficient | Increase to 360k (1h buffer) | Ensures 1h replay capacity. | Memory usage. |
| D12 | Concurrency Rotation | Blind rotation | Race conditions | Atomic Lua-based rotation | Guarantees single-request win, handles lost requests via grace window. | Latency for losers. |
| D13 | Entitlement Revocation | Ephemeral invalidation | Missed events vulnerability | Versioning + Heartbeat reval | Prevents stale access. | Performance load. |
