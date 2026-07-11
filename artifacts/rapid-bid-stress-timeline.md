# Rapid bid stress timeline (reproduce_vnbl_stale_http)

- passed: **false**

## Failure

VNBL repro: client leader 1 != server 2 after stale HTTP ACK (gate off)

## Window around first permanent lock (t=8401)

```json
[
  {
    "t": 8401,
    "kind": "permanent_lock",
    "teamId": 1,
    "detail": "Wrong isLeading after stale HTTP (client=1 server=2) held past BID_ACK_TIMEOUT_MS",
    "eventVersion": 1
  }
]
```

## Full timeline

| t (ms) | kind | team | version | value | detail |
|-------:|------|-----:|--------:|-------|--------|
| 0 | sse_bid | 1 | 1 | 100000 | sse_applied |
| 0 | sse_bid | 1 | 1 |  | A_sse_v1 |
| 100 | sse_bid | 2 | 2 | 125000 | sse_applied |
| 100 | isLeading | 2 | 2 | true | B_correct_leader |
| 400 | http_ack | 1 | 1 |  | stale_A_http_after_B_sse |
| 8401 | permanent_lock | 1 | 1 |  | Wrong isLeading after stale HTTP (client=1 server=2) held past BID_ACK_TIMEOUT_MS |
