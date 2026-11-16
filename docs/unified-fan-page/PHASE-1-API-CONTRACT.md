# PHASE 1 — API CONTRACT: FAN DISCOVERY & TOURNAMENT CONTEXT

> **Document 4 of 9:** Public API Schemas & Service Contracts  
> **Repository:** BidWar Core Platform  
> **Status:** API Specification Contract — Approved for Documentation Only  
> **Canonical Target:** `docs/unified-fan-page/PHASE-1-API-CONTRACT.md`  

---

## 1. WHY THE EXISTING `GET /api/tournaments` CANNOT BE USED FOR FAN DISCOVERY

The Phase 0 architecture audit verified:
1. `GET /api/tournaments` executes `db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt)`.
2. It has **no pagination** (returns the entire database table in one payload).
3. It has **no search filters** (cannot filter by name, city, or organizer).
4. It has **no sport filter** (cannot return cricket-only or badminton-only).
5. It has **no live-state detection** (cannot sort active live tournaments to the top).
6. It has **no visibility controls** (returns private corporate/internal test tournaments to anyone).

**Contract Mandate:** We must specify a dedicated, high-performance public discovery endpoint: `GET /api/fan/tournaments`.

---

## 2. ENDPOINT 1: UNIVERSAL TOURNAMENT DISCOVERY (`GET /api/fan/tournaments`)

### A. HTTP Request Specification
- **Method:** `GET`
- **Path:** `/api/fan/tournaments`
- **Authentication:** None (Public Spectator Access)
- **Rate Limit:** 60 requests/minute per IP (uses existing Express rate limiter)
- **Cache-Control:** `public, max-age=15, stale-while-revalidate=45`

### B. Zod Query Parameters Validation Schema

```typescript
import { z } from "zod";

export const fanDiscoveryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  sport: z.enum(["all", "cricket", "badminton", "football", "other"]).default("all"),
  status: z.enum(["all", "live", "upcoming", "completed"]).default("all"),
  module: z.enum(["all", "auction", "scoring", "both"]).default("all"),
  city: z.string().trim().max(100).optional(),
  featured: z.preprocess((val) => val === "true" || val === "1", z.boolean().optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["live_first", "upcoming_date", "newest", "name"]).default("live_first"),
});

export type FanDiscoveryQueryParams = z.infer<typeof fanDiscoveryQuerySchema>;
```

### C. TypeScript Response Schema

```typescript
export interface FanDiscoveryCardDto {
  id: number;
  name: string;
  code: string | null;
  sport: string;
  city: string | null;
  venue: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  status: "setup" | "active" | "completed";
  auctionDate: string | null;
  auctionTime: string | null;
  matchDates: string | null;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  productMode: "auction_only" | "scoring_only" | "both";
  isLive: boolean;
  liveType?: "auction" | "scoring" | null;
  liveSnippet?: string | null; // e.g. "Lot 14: Rohit Sharma · Bid ₹1.8 Cr" or "Team A 165/4 (18.2 ov)"
  teamsCount?: number;
  featured?: boolean;
}

export interface FanDiscoveryResponseDto {
  items: FanDiscoveryCardDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    liveCount: number;
    upcomingTodayCount: number;
  };
}
```

### D. Live-State Resolution Semantics
A tournament is classified as `isLive: true` if:
1. **Auction Live:** An auction session is actively in progress (`status === 'active'` with an active player on the auction block).
2. **Scoring Live:** At least one match in `scoring_matches` for this tournament has `status === 'live'`.
3. If both are active, `liveType: 'auction'` takes precedence for the thumbnail snippet due to bid urgency.

### E. Database Query Performance Optimization
To ensure sub-50ms query response times:
1. Query uses parameterized SQL with index hints.
2. Search uses multi-column ILIKE matching on `name`, `city`, and `organizer_name`.
3. Strict pagination (`LIMIT :limit OFFSET :offset`) prevents unbounded memory consumption.
4. Composite index recommended on `tournamentsTable`: `(status, sport, auction_enabled, scoring_enabled)`.

---

## 3. ENDPOINT 2: TOURNAMENT FAN CONTEXT (`GET /api/tournaments/:id/fan/context`)

### A. HTTP Request Specification
- **Method:** `GET`
- **Path:** `/api/tournaments/:id/fan/context`
- **Authentication:** None (Public)
- **Cache-Control:** `public, max-age=10, stale-while-revalidate=20`

### B. TypeScript Response Schema

```typescript
export interface TournamentFanContextDto {
  tournament: {
    id: number;
    name: string;
    sport: string;
    auctionCode: string | null;
    city: string | null;
    venue: string | null;
    organizerName: string | null;
    logoUrl: string | null;
    sponsorLogos: unknown;
    mainBannerUrl: string | null;
    mainBannerEnabled: boolean;
    mainBannerFit: string | null;
    status: string;
    auctionDate: string | null;
    auctionTime: string | null;
    matchDates: string | null;
    auctionEnabled: boolean;
    scoringEnabled: boolean;
    productMode: "auction_only" | "scoring_only" | "both";
    scoringPhase: string;
    features: Record<string, unknown>;
  };
  liveState: {
    isAuctionLive: boolean;
    auctionOnBlockPlayer?: {
      id: number;
      name: string;
      currentBid: number;
      leadingTeamName?: string;
    } | null;
    isMatchLive: boolean;
    activeMatch?: {
      id: number;
      homeTeamName: string;
      awayTeamName: string;
      scoreline?: string;
      status: string;
    } | null;
    recommendedTab: "auction" | "scoring";
  };
}
```

### C. Recommended Tab Logic
The backend context resolver evaluates:
- If `auctionEnabled && isAuctionLive` -> `recommendedTab = "auction"`.
- If `scoringEnabled && isMatchLive && !isAuctionLive` -> `recommendedTab = "scoring"`.
- If both are live -> `recommendedTab = "auction"`.
- If neither is live -> evaluates tournament dates vs today's date; defaults to `scoring` if match today, else `auction`.

---

## 4. ERROR RESPONSES & CONTRACT SPECIFICATIONS

All error responses strictly adhere to standard BidWar REST error schemas:

| HTTP Status | Error Code | Description | Example Payload |
|---|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Invalid query parameter (e.g. limit > 50). | `{"error": "Validation failed", "issues": [{"field": "limit", "message": "Max 50"}]}` |
| `404 Not Found` | `TOURNAMENT_NOT_FOUND` | Tournament ID or code does not exist. | `{"error": "Tournament not found", "tournamentId": 9999}` |
| `403 Forbidden` | `PRIVATE_TOURNAMENT` | Tournament is private and requires PIN. | `{"error": "This tournament is private", "code": "REQUIRES_AUTH"}` |
| `429 Too Many Requests`| `RATE_LIMIT_EXCEEDED`| Rate limit exceeded by IP. | `{"error": "Too many requests, please retry in 60s"}` |

---

*End of API Contract (Document 4 of 9).*
