# BIDWAR Fan Platform — Traceability Matrix

| Req ID | Description | Primary Doc | Acceptance Criteria | Verification Method/Test | Phase | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| B01 | Redis Fan-out | REDIS_REALTIME | Atomic Pub/Sub + Streams | Load test events per sec | P1 | Open |
| B02 | Redis Reliability | REDIS_REALTIME | Durability, snapshotting | Replay test (cursor gap) | P1 | Open |
| B03 | Revocation | SYSTEM_ARCH | 5m reval, DB authority | Force license change | P0 | Open |
| B04 | Session Security | SECURITY_THREAT | 30s overlap rotation | Concurrent rotation test | P0 | Open |
| B05 | API Contracts | API_CONTRACTS | Trial vs Licensed DTOs | Endpoint DTO validation | P0 | Open |
| B06 | Deployment | SYSTEM_ARCH | `/fan/*` routing isolation | Edge proxy test | P0 | Open |
| B07 | Security | SECURITY_THREAT | CSRF, Session Fixation | Security audit (automated) | P0 | Open |
| B08 | UI/UX | UI_UX_BRIEF | Theme switching, Audio ctrl | Manual browser audit | P0 | Open |
| B09 | Traceability | TRACEABILITY | Full coverage | Audit requirement map | P0 | Open |
