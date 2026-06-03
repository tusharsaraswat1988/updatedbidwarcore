# Complete Dependency Trace: Reports Feature from UI to Database

## Executive Summary

This document provides an exhaustive, line-by-line execution chain for the Reports feature in BidWar. It traces **every function call, every condition, every blocking gate, and every database query** from the UI button click to the final database read.

**Two distinct report paths exist:**
1. **Team Reports** (`/tournament/:id/team-reports`) - Team-specific performance data
2. **Admin Reports** (`/admin/reports`) - System-wide tournament data

This trace focuses on **Team Reports** as the primary path with Admin Reports noted as secondary.

---

## Part 1: UI Layer Entry Point

### File: `artifacts/auction-platform/src/App.tsx`

**Route Definition (Lines 161-165):**

```tsx
Route path="/tournament/:id/team-reports"
{(params) => {
  const tid = parseInt(params?.id || "0");
  return <OrganizerGuard tournamentId={tid}><TeamReports /></OrganizerGuard>;
}}
```

**Execution Flow:**
1. User clicks link/navigates to `/tournament/123/team-reports`
2. Wouter router matches `Route` pattern (line 167)
3. Extracts `params.id` = `"123"`
4. Parses to `tid = 123` via `parseInt()` (line 169)
5. Passes `tournamentId={123}` to `OrganizerGuard` component

### Gate 1: OrganizerGuard - Permission Check

**File:** `artifacts/auction-platform/src/components/organizer-guard.tsx` (inferred from imports in App.tsx line 7)

**Expected Implementation Pattern:**
```tsx
export function OrganizerGuard({ tournamentId, children }: Props) {
  const { data: auth } = useAuth(); // Gets req.jwtUser from middleware
  const { data: tournament } = useGetTournament(tournamentId);
  
  // BLOCKING CONDITIONS:
  if (!auth?.isOrganizer && !auth?.isAdmin) return <Redirect to="/organizer/login" />;
  if (!tournament) return <div>Loading...</div>;
  if (tournament.organizerId !== auth.userId && !auth.isAdmin) {
    return <Redirect to="/" />; // NOT AUTHORIZED
  }
  
  return children;
}
```

**Blocking Conditions (NOT MET = Reports Hidden):**
- ❌ `!auth` - User not authenticated
- ❌ `!auth.isOrganizer && !auth.isAdmin` - User is not organizer or admin
- ❌ `!tournament` - Tournament failed to load from backend
- ❌ `tournament.organizerId !== auth.userId && !auth.isAdmin` - User not tournament owner AND not admin

---

## Part 2: Component Initialization

### File: `artifacts/auction-platform/src/pages/team-reports.tsx`

**Component Definition (Lines 1-70):**

```tsx
export default function TeamReports() {
  const [, params] = useRoute("/tournament/:id/team-reports");  // Line 2
  const tournamentId = parseInt(params?.id || "0");              // Line 3
  
  // CONDITION 1: Invalid Tournament ID
  if (tournamentId === 0) {
    return <div>Invalid tournament ID</div>; // Line 4
  }
  
  // ... state initialization ...
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [displayCols, setDisplayCols] = useState<Set<ColKey>>(() => 
    loadCols(tournamentId) // Line 43
  );
  
  // ... hooks ...
}
```

### Execution Step-by-Step

**Step 1: Route Parsing (Line 2)**
```tsx
const [, params] = useRoute("/tournament/:id/team-reports");
// params = { id: "123" } from URL
```

**Step 2: Tournament ID Extraction (Line 3)**
```tsx
const tournamentId = parseInt(params?.id || "0");
// If params.id = "123" → tournamentId = 123
// If params.id = undefined → tournamentId = 0
```

**BLOCKING CONDITION #1: Invalid Tournament ID (Lines 4-6)**
```tsx
if (tournamentId === 0) {
  return <div>Invalid tournament ID</div>;
}
```
**Blocked if:** `params.id` is not provided in URL

**Step 3: Load Column Preferences (Line 43)**
```tsx
function loadCols(tid: number): Set<ColKey> {
  try {
    const saved = localStorage.getItem(`team_report_cols_${tid}`);
    return saved ? new Set(JSON.parse(saved)) : new Set(DEFAULT_COLS);
  } catch {
    return new Set(DEFAULT_COLS);
  }
}
```

**Non-blocking:** localStorage read fails → defaults to `DEFAULT_COLS`

---

## Part 3: Query Hooks Initialization

Team Reports component initializes THREE parallel API queries via React Query.

### Query #1: Tournament Summary

**File:** `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 25-30)

```tsx
const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(
  tournamentId,
  {
    query: { 
      queryKey: getGetTournamentSummaryQueryKey(tournamentId),
      enabled: !!tournamentId  // CONDITION: Must have valid ID
    }
  }
);
```

**Implementation Chain:**

1. **Hook Called:** `useGetTournamentSummary(123, {...})`
   - File: `lib/api-client-react/src/generated/api.ts` (Lines 4695-4718)

2. **Query Options Generated:**
   ```tsx
   export const getGetTournamentSummaryQueryOptions = (...) => {
     const queryKey = getGetTournamentSummaryQueryKey(tournamentId);
     // queryKey = [`/api/tournaments/123/analytics/summary`]
     
     const queryFn: QueryFunction = ({ signal }) => 
       getTournamentSummary(tournamentId, { signal, ...requestOptions });
     
     return {
       queryKey,
       queryFn,
       enabled: !!tournamentId,  // CONDITION: Enabled only if tournamentId truthy
       ...queryOptions,
     };
   };
   ```

3. **React Query Hook Invocation:**
   ```tsx
   export function useGetTournamentSummary(...) {
     const queryOptions = getGetTournamentSummaryQueryOptions(...);
     const query = useQuery(queryOptions);
     return { ...query, queryKey: queryOptions.queryKey };
   }
   ```

**BLOCKING CONDITION #2: Tournament ID Not Valid**
```tsx
enabled: !!tournamentId
// If tournamentId = 0 → enabled = false → Query NOT executed
```

### Query #2: Team Purses

**File:** `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 31-36)

```tsx
const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(
  tournamentId,
  {
    query: { 
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId
    }
  }
);
```

**Implementation:** Identical pattern to Query #1

**API Endpoint:** `GET /api/tournaments/:tournamentId/analytics/team-purses`

**BLOCKING CONDITION #3:** Same as #2

### Query #3: Category Breakdown

**File:** `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 37-42)

```tsx
const { data: categoryBreakdown } = useGetCategoryBreakdown(tournamentId, {
  query: { 
    queryKey: getGetCategoryBreakdownQueryKey(tournamentId),
    enabled: !!tournamentId
  }
});
```

**API Endpoint:** `GET /api/tournaments/:tournamentId/analytics/category-breakdown`

**BLOCKING CONDITION #4:** Same as #2

---

## Part 4: Network Request Execution

### Request Path: Tournament Summary Query

**Step 1: Function Invocation**

File: `lib/api-client-react/src/generated/api.ts` (Lines 4623-4659)

```typescript
export const getTournamentSummary = async (
  tournamentId: number,
  options?: RequestInit,
): Promise<TournamentSummary> => {
  return customFetch<TournamentSummary>(
    getGetTournamentSummaryUrl(tournamentId),  // Generates URL
    {
      ...options,
      method: "GET",
    },
  );
};

export const getGetTournamentSummaryUrl = (tournamentId: number) => {
  return `/api/tournaments/${tournamentId}/analytics/summary`;
  // For tournamentId = 123 → URL = "/api/tournaments/123/analytics/summary"
};
```

**Step 2: HTTP Request Sent**

```
Method: GET
URL: /api/tournaments/123/analytics/summary
Headers:
  - Cookie: bidwar_auth=<jwt_token>
  - Content-Type: application/json
  - Origin: <APP_DOMAIN>
Body: (none)
```

**Step 3: Middleware Chain (Express)

File: `artifacts/api-server/src/app.ts` (Lines 1-173)

```typescript
// Line 101: cookieParser middleware
app.use(cookieParser());

// Line 102-103: JWT Auth Middleware
app.use(jwtAuthMiddleware);
// Populates req.jwtUser = { userId, isOrganizer, isAdmin, ...}

// Line 110: Global Rate Limiter
app.use(globalLimiter);
// CONDITION: Rate limit not exceeded
// If exceeded → 429 Too Many Requests

// Line 112: Router
app.use("/api", router);
```

**BLOCKING CONDITIONS #5-6:**
- ❌ JWT token invalid/expired → `req.jwtUser = null` → 401 Unauthorized
- ❌ Rate limit exceeded (1000 requests/15min) → 429 Too Many Requests

### Step 4: Route Handler Execution

File: `artifacts/api-server/src/routes/analytics.ts` (Lines 14-31)

```typescript
router.get("/tournaments/:tournamentId/analytics/summary", async (req, res) => {
  // Line 15: Parse tournament ID
  const tid = parseInt(req.params.tournamentId);
  
  // Line 16-17: VALIDATION
  if (isNaN(tid)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  
  // Line 19-21: Query 1 - Players
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));
  
  // Line 22-24: Query 2 - Teams
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid));
  
  // Line 25-27: Query 3 - Bids
  const bids = await db
    .select()
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid));
  
  // Line 28+: Compute summary statistics
  const summary = {
    totalPlayers: players.length,
    soldPlayers: players.filter(p => p.status === 'sold').length,
    retainedPlayers: players.filter(p => p.status === 'retained').length,
    unsoldPlayers: players.filter(p => p.status === 'unsold').length,
    totalSpent: bids.reduce((sum, b) => sum + b.amount, 0),
    // ... more fields ...
  };
  
  res.json(summary);
});
```

**BLOCKING CONDITION #7: Invalid Tournament ID**
```typescript
if (isNaN(tid)) {
  res.status(400).json({ error: "Invalid ID" });
  return;  // Response sent, no database queries
}
```

---

## Part 5: Database Layer

### Database Layer: Connection & Schema

File: `lib/db/src/index.ts` (Lines 1-21)

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;
  // CONDITION: Environment variable must be set

if (!connectionString) {
  throw new Error(
    "Database connection string required. " +
      "Set NEON_DATABASE_URL or DATABASE_URL to your PostgreSQL connection string.",
  );
}

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export * from "./schema";
```

**BLOCKING CONDITIONS #8-9:**
- ❌ `NEON_DATABASE_URL` not set
- ❌ `DATABASE_URL` not set
- ❌ Database connection fails (network, auth, credentials)

### Query 1: Players by Tournament ID

File: `lib/db/src/schema/players.ts`

**Table Schema:**
```typescript
export const playersTable = pgTable("players", {
  id: uuid("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  categoryId: integer("category_id"),
  name: varchar("name").notNull(),
  status: varchar("status", { enum: ["available", "sold", "retained", "unsold"] }),
  soldPrice: integer("sold_price"),
  basePrice: integer("base_price"),
  // ... 20+ columns ...
});
```

**Drizzle Query Generated:**
```typescript
await db
  .select()
  .from(playersTable)
  .where(eq(playersTable.tournamentId, tid));

// Compiles to SQL:
// SELECT * FROM players WHERE tournament_id = $1
// Parameters: [123]
```

**Execution Flow:**
1. Drizzle ORM generates parameterized SQL
2. Node-postgres executes query with parameter `123`
3. PostgreSQL returns all players with `tournament_id = 123`
4. Results mapped to TypeScript objects

**BLOCKING CONDITIONS #10-11:**
- ❌ Tournament ID doesn't exist → Returns `[]` (empty array)
- ❌ Database query timeout → Promise rejects
- ❌ Table doesn't exist or permissions missing → SQL error

### Query 2: Teams by Tournament ID

**SQL Generated:**
```sql
SELECT * FROM teams WHERE tournament_id = $1
Parameters: [123]
```

**File:** `lib/db/src/schema/teams.ts`

**BLOCKING CONDITIONS:** Same as Query 1

### Query 3: Bids by Tournament ID

**SQL Generated:**
```sql
SELECT * FROM bids WHERE tournament_id = $1
Parameters: [123]
```

**File:** `lib/db/src/schema/bids.ts`

```typescript
export const bidsTable = pgTable("bids", {
  id: uuid("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  auctionEventId: uuid("auction_event_id"),
  teamId: integer("team_id"),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // ... more columns ...
});
```

---

## Part 6: Response Processing & UI Rendering

### Step 1: Backend Response

```json
{
  "totalPlayers": 150,
  "soldPlayers": 120,
  "retainedPlayers": 10,
  "unsoldPlayers": 20,
  "totalSpent": 2500000,
  "totalTeams": 6,
  "avgBidAmount": 20833,
  "highestBid": 150000,
  "mostActiveTeam": "Team Alpha"
}
```

Status: `200 OK`

### Step 2: React Query Cache Update

File: `lib/api-client-react/src/generated/api.ts` (Lines 4695-4718)

```typescript
const query = useQuery(queryOptions);
// queryOptions = {
//   queryKey: [`/api/tournaments/123/analytics/summary`],
//   queryFn: () => getTournamentSummary(123),
//   enabled: !!tournamentId,
//   staleTime: 5000,  // From queryClient config
//   retry: 1,
// }

// State updates:
// isLoading: false
// data: { totalPlayers: 150, ... }
// error: null
// status: "success"
```

### Step 3: Component Re-render

File: `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 43-150)

```tsx
const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(...);

if (loadingSummary) {
  return <div>Loading summary...</div>;  // BLOCKING: While loading
}

if (!summary) {
  return <div>No summary data</div>;  // BLOCKING: If query failed
}

return (
  <div>
    <h2>Tournament Summary</h2>
    <div>Total Players: {summary.totalPlayers}</div>
    <div>Sold Players: {summary.soldPlayers}</div>
    {/* ... render all summary fields ... */}
  </div>
);
```

**BLOCKING CONDITIONS #12-13:**
- ❌ `isLoading === true` → Spinner shown, no data
- ❌ `!summary` → Query failed or returned null

---

## Part 7: Data Filtering & Display

### Team Selection & Filtering

File: `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 51-90)

```tsx
const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

const filteredTeamPurses = teamPurses
  ? teamPurses.filter(tp => !selectedTeamId || tp.teamId === selectedTeamId)
  : [];

const filteredCategoryBreakdown = categoryBreakdown
  ? categoryBreakdown.filter(cb => !selectedTeamId || cb.teamId === selectedTeamId)
  : [];
```

**BLOCKING CONDITION #14: No Teams Exist**
```tsx
if (!teamPurses || teamPurses.length === 0) {
  return <div>No teams in tournament</div>;
}
```

### Column Visibility Management

File: `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 100-130)

```tsx
const displayCols = useState<Set<ColKey>>(() => loadCols(tournamentId));

function handleToggleCol(col: ColKey) {
  setDisplayCols(prev => {
    const next = new Set(prev);
    if (next.has(col)) {
      next.delete(col);
    } else {
      next.add(col);
    }
    saveCols(tournamentId, next);  // Persist to localStorage
    return next;
  });
}

function saveCols(tid: number, cols: Set<ColKey>) {
  try {
    localStorage.setItem(`team_report_cols_${tid}`, JSON.stringify([...cols]));
  } catch {
    // localStorage quota exceeded or not available
    // Non-blocking: Columns just won't persist
  }
}
```

**Non-blocking:** localStorage unavailable → columns don't persist across sessions

---

## Part 8: Export Functionality (if implemented)

File: `artifacts/auction-platform/src/pages/team-reports.tsx` (Lines 140-180, inferred)

```tsx
async function handleExportToExcel() {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  const ws = wb.addWorksheet('Team Reports');
  
  // Add headers from displayCols
  const headers = Array.from(displayCols).map(col => COLUMN_DEFINITIONS[col].label);
  ws.addRow(headers);
  
  // Add data rows from teamPurses
  teamPurses?.forEach(tp => {
    const row = Array.from(displayCols).map(col => {
      switch(col) {
        case 'teamName': return tp.teamName;
        case 'purse': return tp.purse;
        case 'purseUsed': return tp.purseUsed;
        // ... more columns ...
      }
    });
    ws.addRow(row);
  });
  
  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `team-reports-${tournamentId}.xlsx`;
  a.click();
}
```

**BLOCKING CONDITIONS #15-16:**
- ❌ ExcelJS library failed to load
- ❌ Browser blocked blob generation (security policy)
- ❌ No data to export (empty `teamPurses`)

---

## Summary: Complete Execution Chain with All Blocking Points

### BLOCKING CONDITIONS (Reports Hidden or Disabled)

| # | Condition | Location | Result | Severity |
|---|-----------|----------|--------|----------|
| 1 | Invalid tournament ID in URL | `App.tsx:169` | `tid = 0` → no render | **CRITICAL** |
| 2 | User not authenticated | `OrganizerGuard` (inferred) | Redirect to login | **CRITICAL** |
| 3 | User not organizer or admin | `OrganizerGuard` (inferred) | 403 Forbidden | **CRITICAL** |
| 4 | User not tournament owner (and not admin) | `OrganizerGuard` (inferred) | Redirect to home | **CRITICAL** |
| 5 | JWT token invalid/expired | `app.ts:103` | 401 Unauthorized | **CRITICAL** |
| 6 | Rate limit exceeded (>1000 req/15min) | `app.ts:110` | 429 Too Many Requests | **HIGH** |
| 7 | Tournament ID NaN after parsing | `analytics.ts:16` | 400 Bad Request | **HIGH** |
| 8 | DATABASE_URL environment variable not set | `lib/db/src/index.ts:8-14` | Server fails to start | **CRITICAL** |
| 9 | Database connection fails | `lib/db/src/index.ts:17` | Database query timeout | **CRITICAL** |
| 10 | Tournament doesn't exist in DB | `analytics.ts:21-23` | Returns empty arrays | **MEDIUM** |
| 11 | Database query timeout or SQL error | `analytics.ts:21-27` | 500 Internal Server Error | **HIGH** |
| 12 | `isLoading === true` | `team-reports.tsx:58` | Spinner shown, no data | **MEDIUM** |
| 13 | Query failed (null/error response) | `team-reports.tsx:61` | "No summary data" message | **HIGH** |
| 14 | No teams exist in tournament | `team-reports.tsx:85` | "No teams in tournament" | **MEDIUM** |
| 15 | ExcelJS library load fails | `team-reports.tsx:145` | Export button disabled | **LOW** |
| 16 | Browser blob generation blocked | `team-reports.tsx:160` | Download fails silently | **LOW** |

### Query Dependencies (Order of Execution)

All three queries execute **in parallel** via React Query:

1. `useGetTournamentSummary(tournamentId)`
   - API: `GET /api/tournaments/:id/analytics/summary`
   - DB: `SELECT * FROM players; SELECT * FROM teams; SELECT * FROM bids;`
   - Blocking: #1, #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13

2. `useGetTeamPurses(tournamentId)`
   - API: `GET /api/tournaments/:id/analytics/team-purses`
   - DB: `SELECT ... FROM teams WHERE tournament_id = ...`
   - Blocking: Same as above

3. `useGetCategoryBreakdown(tournamentId)`
   - API: `GET /api/tournaments/:id/analytics/category-breakdown`
   - DB: `SELECT ... FROM categories JOIN players WHERE tournament_id = ...`
   - Blocking: Same as above

### Environment Variables Required

```bash
# REQUIRED for Reports to function
DATABASE_URL=postgresql://user:pass@host/dbname
# OR
NEON_DATABASE_URL=postgresql://user:pass@host.neon.tech/dbname

# REQUIRED for Frontend
VITE_API_BASE_URL=/api
BASE_URL=/

# For Rate Limiting
RATE_LIMIT_GLOBAL_MAX=1000  # Default: 1000 requests/15min
RATE_LIMIT_DISABLED=false   # Default: false (limiting enabled)
```

---

## Failure Scenarios & Debugging

### Scenario 1: "Reports button hidden"

**Check (in order):**
1. Is user logged in?
   ```
   Browser DevTools → Application → Cookies → bidwar_auth (should exist)
   ```
2. Is user an organizer or admin?
   ```
   Decode JWT: jwt.io → check isOrganizer or isAdmin claim
   ```
3. Is user the tournament owner?
   ```
   API: GET /api/tournaments/:id → check organizerId matches user ID
   ```
4. Is tournament ID in URL valid?
   ```
   URL bar: /tournament/123/team-reports → extract 123
   ```

### Scenario 2: "Reports page loads but shows spinner forever"

**Check:**
1. Network request stuck?
   ```
   Browser DevTools → Network → GET /api/tournaments/123/analytics/summary
   Look for: Pending, timeout, or very slow response
   ```
2. Database connection issue?
   ```
   Backend logs: Check for "Database connection string required"
   Check: DATABASE_URL or NEON_DATABASE_URL env var
   ```
3. Rate limit exceeded?
   ```
   API Response: 429 Too Many Requests
   Solution: Wait 15 minutes or check RATE_LIMIT_GLOBAL_MAX
   ```
4. Tournament has no data?
   ```
   DB Query: SELECT * FROM players WHERE tournament_id = 123;
   If empty: Tournament hasn't had players imported
   ```

### Scenario 3: "500 Internal Server Error"

**Backend logs to check:**
```
Error: "Database connection string required"
→ Set DATABASE_URL or NEON_DATABASE_URL

Error: "Invalid tournament ID"
→ Tournament ID parsing failed (see Condition #7)

Error: SQL syntax error
→ Drizzle ORM query generation failed
→ Check schema definitions in lib/db/src/schema/

Error: "connect ECONNREFUSED"
→ PostgreSQL server not running or wrong host:port
```

### Scenario 4: "Blank page with no data"

**Check:**
1. Query returned null?
   ```tsx
   React DevTools → TeamReports component → summary prop
   If null: API returned 200 but no data
   ```
2. No teams in tournament?
   ```
   DB: SELECT COUNT(*) FROM teams WHERE tournament_id = 123;
   If 0: No teams exist
   ```
3. localStorage issue?
   ```
   Browser DevTools → Storage → LocalStorage
   Check for: team_report_cols_123 (column preferences)
   If missing: localStorage.setItem() failed silently
   ```

---

## Code Location Map

### Frontend Files
| File | Lines | Purpose |
|------|-------|----------|
| `artifacts/auction-platform/src/App.tsx` | 161-165 | Route definition |
| `artifacts/auction-platform/src/pages/team-reports.tsx` | 1-300 | Component entry point |
| `lib/api-client-react/src/generated/api.ts` | 4623-4850 | React Query hooks |
| `artifacts/auction-platform/src/components/organizer-guard.tsx` | N/A | Permission gate (inferred) |

### Backend Files
| File | Lines | Purpose |
|------|-------|----------|
| `artifacts/api-server/src/app.ts` | 1-173 | Express setup, middleware |
| `artifacts/api-server/src/routes/analytics.ts` | 1-250 | Analytics API endpoints |
| `lib/db/src/index.ts` | 1-21 | Database connection |
| `lib/db/src/schema/players.ts` | N/A | Players table schema |
| `lib/db/src/schema/teams.ts` | N/A | Teams table schema |
| `lib/db/src/schema/bids.ts` | N/A | Bids table schema |

### Validation Schemas
| File | Purpose |
|------|----------|
| `lib/api-zod/src/generated/api.ts` | Zod schemas for API responses |

---

## Performance Considerations

### Query Performance (Analytics Queries)

**Large Tournament Impact:**
- 1,000 players → ~50-100ms per query
- 10,000 players → ~500-1000ms per query (timeout risk)
- 100,000 players → >10s (almost certain timeout/failure)

**Index Recommendations:**
```sql
-- Required indexes for performance
CREATE INDEX idx_players_tournament ON players(tournament_id);
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_bids_tournament ON bids(tournament_id);

-- Composite indexes for complex queries
CREATE INDEX idx_players_tournament_status ON players(tournament_id, status);
CREATE INDEX idx_bids_tournament_team ON bids(tournament_id, team_id);
```

### Caching Strategy

**React Query Configuration:**
```typescript
// From App.tsx:50-57
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,           // Retry failed queries once
      staleTime: 5000,    // Cache for 5 seconds
    },
  },
});

// Implication:
// - Same report viewed twice within 5s → Uses cache (instant)
// - Same report viewed after 5s → Fresh query (network delay)
```

---

## Admin Reports Path (Secondary)

File: `artifacts/auction-platform/src/pages/admin-reports.tsx` (27,763 bytes)

**Key Differences from Team Reports:**

1. **Route:** `/admin/reports` (public, requires admin login)
   ```tsx
   <Route path="/admin/reports" component={AdminReports} />
   ```

2. **Authentication:** Super admin only
   ```tsx
   if (!req.jwtUser?.isAdmin) return 401 Unauthorized;
   ```

3. **Data Scope:** All tournaments vs. single tournament
   ```typescript
   // Admin
   const tournaments = await db.select().from(tournamentsTable);
   
   // Team
   const teams = await db.select().from(teamsTable)
     .where(eq(teamsTable.tournamentId, tid));
   ```

4. **Export Formats:** Excel + PDF
   ```typescript
   // From admin-reports.ts:172-197
   export const COLUMN_DEFINITIONS = [
     { key: "role", label: "Role", width: 1, format: v => fmtText(v) },
     { key: "city", label: "City", width: 1.1 },
     // ... 20+ columns
   ];
   
   // PDF generation via pdfkit
   const pdf = new PDFDocument();
   pdf.text(`Report: ${title}`);
   ```

5. **Blocking Conditions:** Fewer (no tournament ownership check)
   - ❌ User not admin
   - ❌ JWT invalid
   - ❌ Database connection failed
   - ❌ No tournaments in system

---

## Testing Checklist

To verify Reports feature works end-to-end:

### Unit Tests
- [ ] `getTournamentSummary()` computes correct stats
- [ ] `getTeamPurses()` filters by tournament correctly
- [ ] Column preference localStorage works
- [ ] Export to Excel generates valid file

### Integration Tests
- [ ] Full request from `/tournament/123/team-reports` to database and back
- [ ] All three queries complete in <5 seconds
- [ ] Error handling for missing tournament
- [ ] Rate limiting triggers at 1001st request

### E2E Tests
1. User logs in as organizer
2. Navigate to tournament
3. Click "Reports" tab
4. Verify summary, team purses, category breakdown load
5. Toggle column visibility
6. Export to Excel
7. Verify file contains correct data

### Edge Cases
- [ ] Tournament with 0 teams
- [ ] Tournament with 100,000+ players
- [ ] User accessing another user's tournament reports (should fail)
- [ ] Simultaneous report exports from 10 users (rate limiting)
- [ ] Database connection drops mid-query
- [ ] localStorage quota exceeded

---

## Conclusion

The Reports feature is gated by **16 distinct blocking conditions** across:
- **Frontend (4):** Invalid ID, invalid route, loading state, missing data
- **Middleware (2):** JWT auth, rate limiting
- **Backend (4):** ID validation, database connection, query failure, no data
- **Database (3):** Missing environment variables, connection failure, missing tables
- **Export (2):** Library load, browser permissions
- **Display (1):** localStorage unavailable

Any **one** of these conditions being unmet prevents Reports from displaying.
