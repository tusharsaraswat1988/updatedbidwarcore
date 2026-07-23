# Badminton Phase-1 Tournament Validation Report

Generated: 2026-07-22T11:49:26.366Z
API: http://127.0.0.1:8080 · Tournament: 5

## Phase-2 recommendation

**CONDITIONAL GO** — CONDITIONAL GO — Phase-1 correctness holds. Proceed to Phase-2 incremental projection only behind a feature flag with shadow-compare (incremental vs replay) before cutover.

## Scenarios

| Scenario | Result |
|----------|--------|
| 100 consecutive points | PASS |
| 500 consecutive points | PASS |
| Match rollback / undo | PASS |
| Game completed | PASS |
| Match completed | PASS |
| Snapshot matches replay after completion | PASS |
| Service change | PASS |
| Rotation updates | PASS |
| Doubles positioning present | PASS |
| Doubles snapshot/replay consistent | PASS |
| SSE reconnect during scoring | PASS |
| Browser refresh during live match | PASS |
| Multiple LED viewers converge | PASS |
| SSE order never violated | PASS |
| LED converges to replay | PASS |
| Cross-match SSE isolation (match-scoped subscribe) | PASS |
| Multiple umpire tablets — only one lock owner | PASS |
| No duplicate event sequences | PASS |
| Replay checksum equals sync snapshot | PASS |
| Golden replay unit tests | PASS |
| Realtime sync unit tests | PASS |

## Correctness issues
_None_

## Race conditions
_None detected_

## Replay inconsistencies
_None — snapshot score fields matched replay checksums_

## Performance

```json
{
  "100 consecutive points": {
    "wall": {
      "n": 100,
      "avg": 1226.381479999999,
      "p95": 1304.0487999999896,
      "p99": 1617.5404000000008,
      "max": 1621.8477999999996,
      "min": 1091.146799999995
    },
    "t4_to_sse": {
      "n": 100,
      "avg": 1130.9519180000002,
      "p95": 1203.1142,
      "p99": 1519.0365,
      "max": 1534.6997,
      "min": 1002.9238
    },
    "replayGrowth": [
      {
        "points": 1,
        "eventCount": 2,
        "replayMs": 427.67600000009406
      },
      {
        "points": 10,
        "eventCount": 11,
        "replayMs": 417.671800000011
      },
      {
        "points": 20,
        "eventCount": 21,
        "replayMs": 431.9024999999674
      },
      {
        "points": 30,
        "eventCount": 31,
        "replayMs": 420.405299999984
      },
      {
        "points": 40,
        "eventCount": 41,
        "replayMs": 417.70059999998193
      },
      {
        "points": 50,
        "eventCount": 51,
        "replayMs": 431.0516999999527
      },
      {
        "points": 60,
        "eventCount": 61,
        "replayMs": 513.6955000000307
      },
      {
        "points": 70,
        "eventCount": 71,
        "replayMs": 413.999199999962
      },
      {
        "points": 80,
        "eventCount": 81,
        "replayMs": 430.5542000000132
      },
      {
        "points": 90,
        "eventCount": 91,
        "replayMs": 414.0424999999814
      },
      {
        "points": 100,
        "eventCount": 101,
        "replayMs": 413.36330000008456
      }
    ]
  }
}
```
