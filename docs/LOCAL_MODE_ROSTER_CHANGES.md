# Local Mode — Mid-Auction Roster Changes

Analysis of whether players, teams, and categories can be added, edited, or deleted after cloud import — including during a live auction — and what happens on sync back to cloud.

**Status:** Analysis only — no implementation.

**Related:**
- [LOCAL_MODE_AUDIT.md](./LOCAL_MODE_AUDIT.md)
- [FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md](./FULL_FIDELITY_LOCAL_MODE_GAP_ANALYSIS.md)

---

## Executive summary

Local Mode exposes **raw CRUD API routes** for players, teams, and categories. However:

- The **organiser UI is blocked** without local auth (`OrganizerGuard` → cloud auth endpoint).
- **Locally created entities get no `cloudId`** — they are invisible to sync and mirror.
- **Cloud sync is results-only** — updates existing cloud players by `cloudId`; no create/delete for roster changes.
- **No auction-state guards** — you can delete the current player or edit sold status via PATCH without going through auction routes.
- **Re-import is destructive** — wipes roster, bids, and auction session; not a recovery path mid-auction.

**Bottom line:** Roster changes are possible at the API layer but are **unsafe, mostly UI-inaccessible, and do not reconcile with cloud** today.

---

## 1. Can a new player be added after tournament import?

### Answer: **API yes · UI blocked · Sync no**

Local server implements `POST /api/tournaments/:tournamentId/players`:

```28:56:artifacts/bidwar-local/src/server/routes/players.ts
  router.post("/tournaments/:tournamentId/players", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1), categoryId: z.number().int().optional(),
      role: z.string().optional(), city: z.string().optional(),
      basePrice: z.number().int().optional(), status: z.string().optional(),
      jerseyNumber: z.string().optional(), photoUrl: z.string().optional(),
      mobileNumber: z.string().optional(), battingStyle: z.string().optional(),
      bowlingStyle: z.string().optional(), specialization: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    // ... mobile validation ...
    const [row] = await db.insert(playersTable).values({
      tournamentId: tid, name: d.name, categoryId: d.categoryId ?? null,
      role: d.role ?? null, city: d.city ?? null,
      basePrice: d.basePrice ?? 100000, status: d.status ?? "available",
      jerseyNumber: d.jerseyNumber ?? null, photoUrl: d.photoUrl ?? null,
      mobileNumber, battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null, specialization: d.specialization ?? null,
    }).returning();
    res.status(201).json(playerToJson(row));
  });
```

**Gaps vs cloud:**

| Feature | Cloud | Local |
|---------|-------|-------|
| Organiser auth | Required (`isOrganizerOrAdmin`) | None |
| Duplicate name check | Yes | No |
| Duplicate mobile check | Yes | No |
| `cloudId` on create | Auto (cloud PK) | **Not set → NULL** |
| `playerTag`, `isNonPlayingMember`, `email` | Yes | Schema missing |
| Bulk CSV (`POST .../players/bulk`) | Yes | **Not implemented** |
| Photo upload (`POST /api/upload`) | Cloudinary | **Not mounted locally** |

**UI:** Players page requires `OrganizerGuard`:

```201:204:artifacts/auction-platform/src/App.tsx
        <Route path="/tournament/:id/players">
          {(params) => {
            const tid = parseInt(params.id);
            return <OrganizerGuard tournamentId={tid}><Players /></OrganizerGuard>;
```

Photo upload in `PlayerForm` uses `ImageEditorDialog` → `POST /api/upload` (cloud-only).

---

## 2. Can a player be deleted after import?

### Answer: **API yes · Unconditional · Dangerous mid-auction · Sync no**

```109:116:artifacts/bidwar-local/src/server/routes/players.ts
  router.delete("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const pid = parseInt(req.params.playerId);
    if (isNaN(tid) || isNaN(pid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(playersTable).where(
      and(eq(playersTable.id, pid), eq(playersTable.tournamentId, tid))
    );
    res.status(204).send();
  });
```

**No guards for:**

- Player currently on the auction block (`auction_sessions.current_player_id`)
- Sold or retained status (no purse rollback)
- Existing bid rows (orphaned bids — no FK constraints in SQLite setup)
- Cloud propagation (cloud player row unchanged)

If the current player is deleted, `buildAuctionState` silently returns `currentPlayer: null` while session still holds stale `currentPlayerId`:

```128:131:artifacts/bidwar-local/src/server/routes/auction.ts
    if (session.currentPlayerId) {
      const [p] = await db.select().from(playersTable).where(eq(playersTable.id, session.currentPlayerId));
      if (p) currentPlayer = playerToJson(p);
    }
```

---

## 3. Can a player be edited after import?

### Answer: **API yes · Broad PATCH · Only partial fields sync**

```69:106:artifacts/bidwar-local/src/server/routes/players.ts
  router.patch("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      categoryId: z.number().int().nullable().optional(),
      teamId: z.number().int().nullable().optional(),
      basePrice: z.number().int().min(0).optional(),
      soldPrice: z.number().int().min(0).nullable().optional(),
      status: z.enum(["available","sold","unsold","retained"]).optional(),
      photoUrl: z.string().url().nullable().optional(),
      // ... more fields ...
    });
    // ... no auth, no auction-state checks ...
    const [row] = await db.update(playersTable).set({ ...updates, updatedAt: new Date().toISOString() })
      .where(and(eq(playersTable.id, pid), eq(playersTable.tournamentId, tid))).returning();
    res.json(playerToJson(row));
  });
```

Cloud sync only pushes `status`, `teamCloudId`, `soldPrice` for players **with `cloudId`**. Name, category, photo, etc. are **never synced**.

Cloud PATCH has audit logging, critical-edit reasons, retained purse sync — none of that exists locally.

---

## 4. Can a player be added while auction is actively running?

### Answer: **API yes · No auction-status guard · Eligible for nomination**

Player POST has no check on tournament or session status. New players default to `status: "available"`.

`next-player` selects from available players — newly inserted rows are included:

```310:326:artifacts/bidwar-local/src/server/routes/auction.ts
    const baseConditions = [eq(playersTable.tournamentId, tid), eq(playersTable.status, "available")];
    // ...
    if (playerId) {
      selectedPlayerId = playerId;
    } else if (mode === "random") {
      const available = activeCatIds && activeCatIds.length > 0
        ? await db.select().from(playersTable).where(and(...baseConditions, inArray(...)))
        : await db.select().from(playersTable).where(and(...baseConditions));
      if (available.length > 0) selectedPlayerId = available[Math.floor(Math.random() * available.length)].id;
    } else {
      const [next] = await query.where(and(...baseConditions)).orderBy(asc(playersTable.id)).limit(1);
      if (next) selectedPlayerId = next.id;
    }
```

Manual nomination `{ playerId: N }` works for any local ID.

**Operator panel** has no inline add-player — changes go through Players page (auth-blocked).

**Mirror to cloud** cannot show locally-created current player (`cloudId` is null):

```24:28:artifacts/bidwar-local/src/server/mirror.ts
      if (session.currentPlayerId) {
        const [player] = await db.select({ cloudId: playersTable.cloudId }).from(playersTable).where(eq(playersTable.id, session.currentPlayerId));
        currentPlayerCloudId = player?.cloudId ?? null;
      }
```

---

## 5. What happens if that player must later sync back to cloud?

### Answer: **Excluded from sync · Data permanently divergent**

Local `sync-to-cloud` filters to players with `cloudId`:

```193:206:artifacts/bidwar-local/src/server/routes/local.ts
    const playerResults = players
      .filter(p => p.cloudId)
      .map(p => {
        const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
        return { cloudId: p.cloudId!, status: p.status, teamCloudId: team?.cloudId ?? null, soldPrice: p.soldPrice ?? null };
      });

    const bidPayload = bids.map(b => {
      const player = players.find(p => p.id === b.playerId);
      const team = teams.find(t => t.id === b.teamId);
      return { playerCloudId: player?.cloudId ?? 0, teamCloudId: team?.cloudId ?? 0, amount: b.amount, timestamp: b.timestamp };
    }).filter(b => b.playerCloudId > 0 && b.teamCloudId > 0);
```

Cloud receiver **only UPDATEs** existing rows — no INSERT or DELETE:

```514:521:artifacts/api-server/src/routes/tournaments.ts
  for (const p of playerResults) {
    await db.update(playersTable).set({
      status: p.status,
      teamId: p.teamCloudId ?? null,
      soldPrice: p.soldPrice ?? null,
    }).where(and(eq(playersTable.id, p.cloudId), eq(playersTable.tournamentId, id)));
    playersUpdated++;
  }
```

**If a locally-added player is sold offline:** sale exists in SQLite only; cloud roster and reports remain wrong.

**Re-import is not recovery** — it deletes everything for the tournament:

```110:115:artifacts/bidwar-local/src/server/routes/local.ts
    await db.delete(teamsTable).where(eq(teamsTable.tournamentId, localTid));
    await db.delete(playersTable).where(eq(playersTable.tournamentId, localTid));
    await db.delete(categoriesTable).where(eq(categoriesTable.tournamentId, localTid));
    await db.delete(bidsTable).where(eq(bidsTable.tournamentId, localTid));
    await db.delete(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, localTid));
```

---

## 6. How are cloudId mappings handled for locally-created players?

| Event | Behaviour |
|-------|-----------|
| **Import from cloud** | Cloud PK → `players.cloud_id`; new local auto-increment `id` |
| **Local POST player** | `cloud_id` left **NULL** |
| **Local POST team/category** | Same — no `cloud_id` |
| **Sync to cloud** | Uses `cloudId` as cloud `players.id`; NULL rows skipped |
| **Mirror to cloud** | `currentPlayerCloudId = player?.cloudId ?? null` |

Import mapping (evidence):

```117:157:artifacts/bidwar-local/src/server/routes/local.ts
    const teamIdMap = new Map<number, number>();
    for (const team of teams) {
      const [inserted] = await db.insert(teamsTable).values({
        // ...
        cloudId: team.id,
      }).returning();
      teamIdMap.set(team.id, inserted.id);
    }
    // ... categories same pattern ...
    for (const player of players) {
      const localCatId = player.categoryId ? catIdMap.get(player.categoryId) ?? null : null;
      const localTeamId = player.teamId ? teamIdMap.get(player.teamId) ?? null : null;
      await db.insert(playersTable).values({
        // ...
        cloudId: player.id,
      });
    }
```

Schema allows nullable `cloud_id`:

```26:26:lib/db-local/src/schema/players.ts
  cloudId: integer("cloud_id"),
```

**There is no provisional UUID, backfill, or remap mechanism** for locally-created entities.

---

## 7. Can locally-created teams be added?

### Answer: **API yes · Sync no · Owner links won't map to cloud**

```48:76:artifacts/bidwar-local/src/server/routes/teams.ts
  router.post("/tournaments/:tournamentId/teams", async (req, res) => {
    // ...
    const [row] = await db.insert(teamsTable).values({
      tournamentId: tid, name: d.name, shortCode: d.shortCode, ownerName: d.ownerName,
      ownerMobile, color: d.color ?? "#3B82F6",
      logoUrl: d.logoUrl ?? null, purse: d.purse ?? 10000000, accessCode: d.accessCode ?? null,
    }).returning();
    res.status(201).json(teamToJson(row));
  });
```

No `cloudId` on insert. Sync only updates purse for teams with `cloudId`:

```200:200:artifacts/bidwar-local/src/server/routes/local.ts
    const teamPurses = teams.filter(t => t.cloudId).map(t => ({ cloudId: t.cloudId!, purseUsed: t.purseUsed }));
```

---

## 8. Can categories be added or modified?

### Answer: **API yes · Full CRUD · Never syncs to cloud**

Local categories router: `GET`, `POST`, `PATCH`, `DELETE` at `artifacts/bidwar-local/src/server/routes/categories.ts`.

- No `cloudId` on create
- No auth
- No referential check on delete (players may reference deleted `categoryId`)
- Cloud sync payload includes **no categories**

---

## 9. Schema changes required for true offline roster management

| Gap | Required change |
|-----|-----------------|
| Local-only entities invisible to cloud | `local_uuid TEXT UNIQUE` + `origin TEXT ('cloud'\|'local')` on players/teams/categories |
| No roster change log | `roster_events` table: `{ entityType, entityLocalId, entityCloudId, op, payload, createdAt, syncedAt }` |
| Sync is results-only | New cloud endpoint `POST .../sync-roster-deltas` (create/update/delete) |
| ID remap after cloud create | Backfill `cloudId` from sync response `{ localUuid → cloudId }` |
| Unsafe mid-auction deletes | Soft delete (`deleted_at`); block if current player or sold/retained |
| Category/team delete integrity | FK or app guard when players reference entity |
| Missing player fields | Add `player_tag`, `player_tag_team_id`, `is_non_playing_member`, `email` to local schema |
| Photo upload offline | Local media store + `POST /api/upload/local` or `/media` |
| Roster mutation auth | Organiser session or PIN on all mutating roster routes |
| Bid integrity | FK on `bids.player_id`; block hard-delete if bids exist |

---

## 10. Recommended safest architecture

### Principles

1. **Separate roster sync from auction results sync** — current sync handles outcomes only.
2. **Never hard-delete during live auction** — soft-delete + state guards.
3. **Every local-created entity gets `localUuid` before sync** — cloud assigns `cloudId` on reconcile.
4. **Two-phase cloud sync:** roster reconcile first, then auction results.

### Add player

```
Organiser adds player
  → INSERT players (origin='local', localUuid=uuid(), cloudId=NULL, status='available')
  → INSERT roster_events (op='create', payload=full snapshot)
  → Optional: require auction pause before roster mutation
  → On sync: cloud creates player → returns cloudId → UPDATE local cloudId
```

- Block if tournament completed
- Offline photos → local `/media/` path, not Cloudinary URL

### Delete player

```
DELETE request
  → IF session.currentPlayerId = playerId → 409
  → IF status IN ('sold','retained') → 409
  → IF bids exist → soft-delete (deleted_at)
  → roster_events (op='delete')
  → On sync: cloud delete/soft-delete by cloudId
```

### Edit player

```
PATCH request
  → IF auction active AND player is current → allow only non-critical fields (photo, mobile)
  → IF changing status/soldPrice/teamId → 409 (use auction routes)
  → IF critical edit on cloud player → require reason + roster_event
  → On sync: metadata via roster delta; outcomes via existing playerResults
```

Critical during live auction: `basePrice`, `categoryId`, `status`, `teamId`.

### Re-sync to cloud (full pipeline)

```
Phase 1 — Roster reconcile
  POST /api/tournaments/:cloudId/sync-roster
  { creates: [{ localUuid, ... }], updates: [{ cloudId, ... }], deletes: [{ cloudId }] }
  Response: { mappings: [{ localUuid, cloudId }] }

Phase 2 — Backfill local cloudId from mappings

Phase 3 — Auction results (existing)
  POST /api/tournaments/:cloudId/sync
  { playerResults, teamPurses, bids }

Phase 4 — Mark export token used (existing)
```

**Do not use re-import mid-auction** — destructive wipe of roster, bids, and session.

**Conflict policy:** Cloud authoritative for pre-export roster; local wins for `origin='local'`; manual merge for duplicate mobile.

---

## Capability matrix

| Capability | Local API | UI (today) | Safe mid-auction | Syncs to cloud |
|------------|-----------|------------|------------------|----------------|
| Add player | ✅ | ❌ (auth) | ⚠️ no guards | ❌ |
| Delete player | ✅ | ❌ (auth) | ❌ | ❌ |
| Edit player | ✅ | ❌ (auth) | ⚠️ unrestricted | Partial (status/price only, cloudId required) |
| Add team | ✅ | ❌ (auth) | ⚠️ | ❌ |
| Add/edit/delete category | ✅ | ❌ (auth) | ⚠️ | ❌ |
| Bulk CSV import | ❌ | ❌ | — | — |
| Photo upload | ❌ | ❌ | — | — |

---

## Key files

| Concern | Path |
|---------|------|
| Local player CRUD | `artifacts/bidwar-local/src/server/routes/players.ts` |
| Local team CRUD | `artifacts/bidwar-local/src/server/routes/teams.ts` |
| Local category CRUD | `artifacts/bidwar-local/src/server/routes/categories.ts` |
| Import (destructive) | `artifacts/bidwar-local/src/server/routes/local.ts` |
| Sync to cloud | `artifacts/bidwar-local/src/server/routes/local.ts` |
| Cloud sync receiver | `artifacts/api-server/src/routes/tournaments.ts` |
| Mirror (display only) | `artifacts/bidwar-local/src/server/mirror.ts` |
| Auction next-player | `artifacts/bidwar-local/src/server/routes/auction.ts` |
| Local SQLite schema | `lib/db-local/src/setup.ts`, `lib/db-local/src/schema/*` |
| Cloud player CRUD (reference) | `artifacts/api-server/src/routes/players.ts` |
| Players UI | `artifacts/auction-platform/src/pages/players.tsx` |
| Organiser guard | `artifacts/auction-platform/src/components/organizer-guard.tsx` |

---

## Next step

Implement roster delta sync and auction-state guards only after approval of the architecture in §10. Until then, **discourage mid-auction roster changes in Local Mode** — data loss on cloud sync is guaranteed for any locally-created entity.
