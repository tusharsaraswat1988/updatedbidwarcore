# Production Memory Hotfix Report

Date: 2026-06-29

## Scope

This hotfix reduces Render memory pressure without changing existing API contracts. It intentionally preserves the upload memory pipeline already merged to `main` in PR #30.

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

- Registries no longer store full Express `Response` objects; they store minimal write callbacks.
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

PR #30's upload pipeline is preserved:

- Image uploads are limited to 5 MB.
- Raster images are resized inside 1200x1200, rotated from metadata, converted to WebP, and uploaded to Cloudinary.
- SVG and GIF uploads are not raster-optimized to avoid breaking animation/vector behavior.
- Media image uploads above 5 MB are rejected while video media uploads keep the existing 20 MB limit.
- Multer buffers are cleared in `finally` after upload processing.

## Before / After RAM Usage

No live Render heap snapshot was available in this non-production environment, so measured production before/after numbers could not be captured here. The deployed hotfix will emit comparable one-minute memory diagnostics in production logs. Use the first 10 minutes before deploy as baseline and compare against the first 10 minutes after deploy using the logged `rssMb`, `heapUsedMb`, `externalMb`, and `arrayBuffersMb` fields.
