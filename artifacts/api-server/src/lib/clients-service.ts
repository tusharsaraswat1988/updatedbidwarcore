import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";

export type ClientRow = typeof clientsTable.$inferSelect;

const DEFAULT_SEEDS = [
  { name: "Vyapari Network", clientType: "brand", displayOrder: 0 },
  { name: "Rotary Shine", clientType: "organisation", displayOrder: 1 },
  { name: "SJMAA (St. John's Marhauli Alumni Association)", clientType: "organisation", displayOrder: 2 },
  { name: "Lions Diamond Varanasi", clientType: "organisation", displayOrder: 3 },
  { name: "Heritage Hospitals", clientType: "brand", displayOrder: 4 },
  { name: "Good Morning", clientType: "brand", displayOrder: 5 },
  { name: "Live VNS Studio", clientType: "brand", displayOrder: 6 },
  { name: "KV Tech Media", clientType: "brand", displayOrder: 7 },
];

function isInternalCwpEntity(name: string): boolean {
  const lower = (name || "").toLowerCase();
  return lower.includes("cwp detailer") || lower.includes("cwp motor") || lower.includes("detailer's and motors");
}

/** Active clients for public landing page — same query as GET /api/clients. */
export async function listActive(): Promise<ClientRow[]> {
  try {
    let rows = await db
      .select()
      .from(clientsTable)
      .where(eq(clientsTable.active, true))
      .orderBy(asc(clientsTable.displayOrder), asc(clientsTable.createdAt));

    if (rows.length === 0) {
      // Lazy auto-seed if table is empty
      await seedDefaultsIfEmpty();
      rows = await db
        .select()
        .from(clientsTable)
        .where(eq(clientsTable.active, true))
        .orderBy(asc(clientsTable.displayOrder), asc(clientsTable.createdAt));
    }

    return rows.filter((r) => !isInternalCwpEntity(r.name));
  } catch (err) {
    console.error("[clients-service] listActive error:", err);
    return [];
  }
}

/** All clients for admin panel */
export async function listAll(): Promise<ClientRow[]> {
  try {
    const rows = await db
      .select()
      .from(clientsTable)
      .orderBy(asc(clientsTable.displayOrder), asc(clientsTable.createdAt));

    if (rows.length === 0) {
      await seedDefaultsIfEmpty();
      return db
        .select()
        .from(clientsTable)
        .orderBy(asc(clientsTable.displayOrder), asc(clientsTable.createdAt));
    }

    return rows;
  } catch (err) {
    console.error("[clients-service] listAll error:", err);
    return [];
  }
}

export async function seedDefaultsIfEmpty(): Promise<void> {
  try {
    const count = await db.select().from(clientsTable).limit(1);
    if (count.length === 0) {
      await db.insert(clientsTable).values(
        DEFAULT_SEEDS.map((s) => ({
          name: s.name,
          clientType: s.clientType,
          displayOrder: s.displayOrder,
          active: true,
        })),
      );
    }
  } catch (err) {
    console.error("[clients-service] seedDefaultsIfEmpty error:", err);
  }
}

export const clientsService = {
  listActive,
  listAll,
  seedDefaultsIfEmpty,
};
