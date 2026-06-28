# Production Memory Hotfix Report

Date: 2026-06-28

## Scope

This hotfix reduces Render memory pressure without changing existing API contracts. Existing upload endpoints and JSON responses remain unchanged.

## Redis

- `REDIS_URL` enables ioredis command and subscriber clients.
- Auction operator locks use Redis when available and fall back to in-memory locks if Redis is missing or fails.
- Auction SSE events use Redis pub/sub when available and fall back to local process fan-out if Redis fails.
- Redis failures are logged as warnings before the in-memory fallback is used.

## SSE Cleanup Audit

Audited SSE endpoints:

- `/api/tournaments/:tournamentId/auction/events`
- `/api/tournaments/:tournamentId/scoring/events`
- Badminton `/stream`

Changes made:

- Registries no longer store full Express `Response` objects; they store minimal write closures.
- Close handlers remove clients immediately.
- Close listeners remove themselves during cleanup.
- Heartbeat timers are cleared on disconnect and on write failure.
- Active SSE connection counts are logged every minute by memory diagnostics.

## Memory Diagnostics

Every minute the API logs:

- RSS
- Heap used
- Heap total
- External
- ArrayBuffers
- Auction/scoring/badminton/total SSE connection counts

A warning is emitted when RSS exceeds 400 MB.

## Upload Audit

The current default upload path intentionally still uses `multer.memoryStorage()` for backward compatibility.

Code inspection proof:

- Multer buffers are only passed into `cloudinary.uploader.upload_stream(...).end(buffer)`.
- No module-level arrays, caches, or registries store `req.file` or `req.file.buffer`.
- Each upload route now clears `req.file.buffer` and removes `req.file` in `finally`, releasing the request-scoped buffer reference after Cloudinary finishes or fails.
- Cloudinary streams are scoped inside per-request promises and are not retained after callback resolution/rejection.
- The new streaming path pipes through Sharp only when `UPLOAD_STREAMING=true`; Sharp stream instances are per-request pipeline locals and are released when the pipeline settles.

## Future Streaming Implementation

A second upload implementation is present behind `UPLOAD_STREAMING=true` and is disabled by default. It uses:

- Busboy multipart parsing
- Sharp stream rotation for non-SVG/non-GIF image uploads
- Cloudinary `upload_stream`

The endpoint URLs and response bodies remain unchanged.

## Before / After RAM Usage

No live Render heap snapshot was available in this non-production environment, so measured production before/after numbers could not be captured here. The deployed hotfix will emit comparable one-minute memory diagnostics in production logs. Use the first 10 minutes before deploy as baseline and compare against the first 10 minutes after deploy using the logged `rssMb`, `heapUsedMb`, `externalMb`, and `arrayBuffersMb` fields.
