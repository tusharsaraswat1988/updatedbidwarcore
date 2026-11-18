# BIDWAR Fan Platform — Redis Realtime Architecture

## Redis Realtime Strategy
- **Event Distribution:**
  - **Atomic Persistence:** Lua script `(XADD, PUBLISH)` ensures atomic stream append and broadcast to WebSocket nodes.
  - **Broadcast:** Pub/Sub notifies all WebSocket nodes of new events.
- **Reliability & Recovery:**
  - **Retention:** `MAXLEN` = 360,000 (1 hour buffer at 100 events/sec). *Assumption: Validated during P2 load testing.*
  - **Replay:** Clients disconnected or requiring full re-sync query events from `lastEventId` via `XREAD`. If `cursor < retainedEvents`, client initiates a fresh full snapshot fetch from Redis `SET` key.
  - **Snapshots:** Snapshot taken every 5 minutes, 10m TTL.
  - **Redis Outage:** Fallback to PostgreSQL API with rate limiting.
- **Node Behaviour:**
  - WebSocket nodes subscribe to Pub/Sub. Upon event receipt, if local sequence gap is detected, node triggers a full snapshot fetch from Redis snapshot store, followed by stream replay.
