# BIDWAR Fan Platform — Decisions and Open Questions

## Decisions
- Unified Shell: React-based, independently deployable SPA.
- Routing: Path-based `/fan/:publicSlug` behind reverse proxy.
- Data Access: Strict projection layer via Public API Gateway using DTOs.
- Realtime: Redis Streams for durable event fan-out.
- Foundation: Homepage/Design moved to P0.

## Open Questions
- **Auth Model:** Specific storage mechanism for Public Sessions.
- **Streaming:** Final list of approved stream providers for CSP.
- **Scalability:** Load testing methodology for WebSocket concurrency limits.
- **Redis Streams:** Specific retention policies.
