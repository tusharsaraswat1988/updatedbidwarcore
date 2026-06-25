# Phase 3 — Server-Side Event Replay

## Problem

Brief SSE disconnect could miss bid/sold events between reconnect attempts.

## Solution

Ring buffer of last **500 events** per tournament in Redis (`LPUSH` + `LTRIM`) or in-memory for dev.

## SSE reconnect flow

Browser `EventSource` automatically sends `Last-Event-ID` header on reconnect.

```
GET /auction/events
Last-Event-ID: 138
```

Server logic (`auction.ts` SSE handler):

1. Parse `Last-Event-ID` → `afterVersion`
2. `getEventsAfter(tournamentId, afterVersion)` from buffer
3. If gap ≤ buffer size → replay missed events in order
4. If gap > 500 or buffer incomplete → send full `auction_state` snapshot

## Frame format

```
id: 139
data: {"type":"bid","version":139,...}

id: 140
data: {"type":"bid","version":140,...}
```

## Initial connect

No `Last-Event-ID` → single full snapshot with current version.

## Buffer storage

| Key | Structure |
|-----|-----------|
| `auction:events:{tournamentId}` | Redis LIST, newest first, max 500 |
| `auction:version:{tournamentId}` | Redis STRING counter |

## Client

No custom reconnect code required — native `EventSource` Last-Event-ID + server replay handles gap fill before live stream resumes.

## Recovery window

500 events at 1 bid/sec ≈ **8+ minutes** of replay coverage per tournament.
