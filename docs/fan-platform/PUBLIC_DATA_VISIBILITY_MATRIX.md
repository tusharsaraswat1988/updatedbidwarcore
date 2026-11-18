# BIDWAR Fan Platform — Public Data Visibility Matrix

| Feature | Trial Tournament | Licensed Tournament |
| :--- | :--- | :--- |
| Tournament Name/Status | Visible | Visible |
| Live Auction Status | Basic Summary | Full Realtime |
| Auction Bids/History | **Hidden** | Visible |
| Live Match Score | Basic | Full Realtime |
| Player/Team Profile | **Basic Identity Only** | Full Detail |
| Fixtures/Standings | **Basic** | Full Detail |
| Detailed Statistics | **Hidden** | Visible |
| Streaming | Basic | Full Access |

## Entitlement Logic
- **Unverified/Trial:** Data returned by public API must be strictly filtered/truncated.
- **Licensed:** Full dataset permitted via specific authorised roles, verified against `tournament_entitlement` state.
- **Redis Invalidation:** Any change in entitlement status must trigger an immediate event on the Redis `auth_invalidation` channel to force WebSocket reconnection/authorization check.
