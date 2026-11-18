# BIDWAR Fan Platform — API Contracts

## Detailed DTO Examples

| Module | Licensed DTO (Full Details) | Trial DTO (Public Summary) |
| :--- | :--- | :--- |
| **Discovery** | `[{ "slug": "v-league", "name": "Varanasi League", "status": "LIVE" }]` | (Same as Licensed) |
| **Overview** | `{ "slug": "...", "full": { "teams": [...], "venue": "..." } }` | `{ "slug": "...", "status": "LIVE", "summary": "Ongoing tournament" }` |
| **Auction** | `{ "currentBid": 500, "history": [{ "bid": 400 }] }` | `{ "status": "LIVE", "summary": "Bidding active, 10 items sold" }` |
| **Cricket Score** | `{ "score": "120/2", "scorecard": {...} }` | `{ "status": "LIVE", "summary": "15 overs completed, 120 runs" }` |
| **Badminton Score** | `{ "score": "21-18, 15-21, 5-2", "set": 3 }` | `{ "status": "LIVE", "summary": "Set 3 in progress" }` |
| **Fixtures** | `{ "matches": [{ "time": "14:00", "opponent": "Team B" }] }` | `{ "summary": "5 matches scheduled today" }` |
| **Teams/Players** | `{ "teams": [{ "name": "Team A", "players": [...] }] }` | `{ "summary": "10 teams participating" }` |
| **Stats** | `{ "topScorer": "P1", "leaderboard": [...] }` | `{ "summary": "Stats hidden" }` |
| **Streaming** | `{ "embedUrl": "https://trusted-provider.com/..." }` | `{ "status": "LIVE", "message": "Stream availability pending" }` |

- **WebSocket Reauth:** Token provided on handshake. Reconnection automatically triggers entitlement check via `EntitlementEngine.verify`.
