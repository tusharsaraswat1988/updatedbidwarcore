/**
 * Badminton-specific adapter: scoring public registration → TMS draw entry.
 *
 * Generic registration never calls draw APIs. This module maps
 * `players.category_id` (auction `categories`) to `badminton_categories`
 * by exact name in the same tournament, then creates `badminton_registrations`
 * when the mapping is unambiguous and the existing TMS rules allow it.
 */
import { and, count, eq, inArray } from "drizzle-orm";
import {
  badmintonCategoriesTable,
  badmintonRegistrationsTable,
  categoriesTable,
  db,
  playersTable,
  type BadmintonCategory,
  type BadmintonPlayer,
} from "@workspace/db";
import { validateBadmintonCategoryEntry } from "../badminton-registration-validation";

export type BadmintonCategoryNameMatch =
  | { kind: "none" }
  | { kind: "exact"; category: Pick<BadmintonCategory, "id" | "name" | "matchType" | "gender" | "maxPlayers"> }
  | { kind: "ambiguous" };

export type BadmintonScoringRegistrationSkipReason =
  | "no_category"
  | "no_auction_category"
  | "no_match"
  | "ambiguous"
  | "doubles_partner_required"
  | "validation_failed"
  | "already_registered";

export type BadmintonScoringRegistrationOutcome =
  | {
      status: "created";
      registrationId: number;
      badmintonCategoryId: number;
    }
  | {
      status: "skipped";
      reason: BadmintonScoringRegistrationSkipReason;
      message: string;
      code?: string;
    };

export function matchBadmintonCategoryByExactName(
  auctionCategoryName: string | null | undefined,
  badmintonCategories: Array<Pick<BadmintonCategory, "id" | "name" | "matchType" | "gender" | "maxPlayers">>,
): BadmintonCategoryNameMatch {
  const name = auctionCategoryName?.trim() ?? "";
  if (!name) return { kind: "none" };
  const matches = badmintonCategories.filter((c) => c.name.trim() === name);
  if (matches.length === 0) return { kind: "none" };
  if (matches.length > 1) return { kind: "ambiguous" };
  return { kind: "exact", category: matches[0] };
}

export function decideBadmintonScoringRegistration(input: {
  auctionCategoryName: string | null | undefined;
  badmintonCategories: Array<Pick<BadmintonCategory, "id" | "name" | "matchType" | "gender" | "maxPlayers">>;
  badmintonPlayer: Pick<BadmintonPlayer, "id" | "gender">;
  acceptedCount: number;
  existingPlayerIdsInCategory: number[];
}): BadmintonScoringRegistrationOutcome | { status: "create"; badmintonCategoryId: number } {
  const match = matchBadmintonCategoryByExactName(
    input.auctionCategoryName,
    input.badmintonCategories,
  );
  if (match.kind === "none") {
    return {
      status: "skipped",
      reason: input.auctionCategoryName?.trim() ? "no_match" : "no_category",
      message: input.auctionCategoryName?.trim()
        ? "No badminton category matches this division name. Use Add Entry."
        : "No category selected. Use Add Entry after assigning a division.",
    };
  }
  if (match.kind === "ambiguous") {
    return {
      status: "skipped",
      reason: "ambiguous",
      message: "Multiple badminton categories share this division name. Use Add Entry.",
    };
  }

  const category = match.category;
  const isDoubles = category.matchType === "doubles" || category.matchType === "mixed_doubles";
  if (isDoubles) {
    return {
      status: "skipped",
      reason: "doubles_partner_required",
      message: "Doubles entries need a partner. Use Add Entry to complete registration.",
      code: "DOUBLES_PARTNER_REQUIRED",
    };
  }

  const entryValidation = validateBadmintonCategoryEntry(
    category,
    input.badmintonPlayer,
    null,
    input.acceptedCount,
  );
  if (!entryValidation.ok) {
    return {
      status: "skipped",
      reason: "validation_failed",
      message: entryValidation.error,
      code: entryValidation.code,
    };
  }

  if (input.existingPlayerIdsInCategory.includes(input.badmintonPlayer.id)) {
    return {
      status: "skipped",
      reason: "already_registered",
      message: "Player already has an entry in this badminton category.",
      code: "DUPLICATE_CATEGORY_ENTRY",
    };
  }

  return { status: "create", badmintonCategoryId: category.id };
}

export type BadmintonScoringRegistrationDeps = {
  loadCanonicalPlayer: (
    playerId: number,
    tournamentId: number,
  ) => Promise<{ categoryId: number | null } | null>;
  loadAuctionCategory: (
    categoryId: number,
    tournamentId: number,
  ) => Promise<{ id: number; name: string } | null>;
  loadBadmintonCategories: (
    tournamentId: number,
  ) => Promise<Array<Pick<BadmintonCategory, "id" | "name" | "matchType" | "gender" | "maxPlayers">>>;
  countAcceptedRegistrations: (tournamentId: number, categoryId: number) => Promise<number>;
  loadExistingRegistrations: (
    tournamentId: number,
    categoryId: number,
  ) => Promise<Array<{ player1Id: number; player2Id: number | null }>>;
  insertRegistration: (values: {
    tournamentId: number;
    categoryId: number;
    player1Id: number;
    status: "accepted";
    metaJson: Record<string, unknown>;
  }) => Promise<{ id: number }>;
};

async function defaultLoadCanonicalPlayer(playerId: number, tournamentId: number) {
  const [row] = await db
    .select({
      categoryId: playersTable.categoryId,
    })
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tournamentId)))
    .limit(1);
  return row ?? null;
}

async function defaultLoadAuctionCategory(categoryId: number, tournamentId: number) {
  const [row] = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
    })
    .from(categoriesTable)
    .where(and(eq(categoriesTable.id, categoryId), eq(categoriesTable.tournamentId, tournamentId)))
    .limit(1);
  return row ?? null;
}

async function defaultLoadBadmintonCategories(tournamentId: number) {
  return db
    .select({
      id: badmintonCategoriesTable.id,
      name: badmintonCategoriesTable.name,
      matchType: badmintonCategoriesTable.matchType,
      gender: badmintonCategoriesTable.gender,
      maxPlayers: badmintonCategoriesTable.maxPlayers,
    })
    .from(badmintonCategoriesTable)
    .where(eq(badmintonCategoriesTable.tournamentId, tournamentId));
}

async function defaultCountAcceptedRegistrations(tournamentId: number, categoryId: number) {
  const [row] = await db
    .select({ acceptedCount: count() })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, categoryId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );
  return Number(row?.acceptedCount ?? 0);
}

async function defaultLoadExistingRegistrations(tournamentId: number, categoryId: number) {
  return db
    .select({
      player1Id: badmintonRegistrationsTable.player1Id,
      player2Id: badmintonRegistrationsTable.player2Id,
    })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, categoryId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        inArray(badmintonRegistrationsTable.status, ["accepted", "pending", "withdrawn"]),
      ),
    );
}

async function defaultInsertRegistration(
  values: Parameters<BadmintonScoringRegistrationDeps["insertRegistration"]>[0],
) {
  const [reg] = await db
    .insert(badmintonRegistrationsTable)
    .values(values)
    .returning({ id: badmintonRegistrationsTable.id });
  if (!reg) throw new Error("Failed to create badminton registration");
  return reg;
}

const defaultDeps: BadmintonScoringRegistrationDeps = {
  loadCanonicalPlayer: defaultLoadCanonicalPlayer,
  loadAuctionCategory: defaultLoadAuctionCategory,
  loadBadmintonCategories: defaultLoadBadmintonCategories,
  countAcceptedRegistrations: defaultCountAcceptedRegistrations,
  loadExistingRegistrations: defaultLoadExistingRegistrations,
  insertRegistration: defaultInsertRegistration,
};

/**
 * Create a TMS registration for a scoring-mode badminton player when mapping is safe.
 * Never copies `players.category_id` onto `badminton_registrations.category_id`.
 */
export async function adaptScoringPlayerToBadmintonRegistration(
  input: {
    tournamentId: number;
    canonicalPlayerId: number;
    badmintonPlayer: Pick<BadmintonPlayer, "id" | "gender">;
  },
  deps: BadmintonScoringRegistrationDeps = defaultDeps,
): Promise<BadmintonScoringRegistrationOutcome> {
  const canonical = await deps.loadCanonicalPlayer(input.canonicalPlayerId, input.tournamentId);
  if (!canonical?.categoryId) {
    return {
      status: "skipped",
      reason: "no_category",
      message: "No category selected. Use Add Entry after assigning a division.",
    };
  }

  const auctionCategory = await deps.loadAuctionCategory(canonical.categoryId, input.tournamentId);
  if (!auctionCategory) {
    return {
      status: "skipped",
      reason: "no_auction_category",
      message: "Assigned division was not found. Use Add Entry.",
    };
  }

  const badmintonCategories = await deps.loadBadmintonCategories(input.tournamentId);
  const match = matchBadmintonCategoryByExactName(auctionCategory.name, badmintonCategories);
  if (match.kind !== "exact") {
    return decideBadmintonScoringRegistration({
      auctionCategoryName: auctionCategory.name,
      badmintonCategories,
      badmintonPlayer: input.badmintonPlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    }) as BadmintonScoringRegistrationOutcome;
  }

  const acceptedCount = await deps.countAcceptedRegistrations(input.tournamentId, match.category.id);
  const existingRegs = await deps.loadExistingRegistrations(input.tournamentId, match.category.id);
  const existingPlayerIds = existingRegs.flatMap((r) =>
    [r.player1Id, r.player2Id].filter((id): id is number => id != null),
  );

  const decision = decideBadmintonScoringRegistration({
    auctionCategoryName: auctionCategory.name,
    badmintonCategories,
    badmintonPlayer: input.badmintonPlayer,
    acceptedCount,
    existingPlayerIdsInCategory: existingPlayerIds,
  });

  if (decision.status !== "create") return decision;

  const created = await deps.insertRegistration({
    tournamentId: input.tournamentId,
    categoryId: decision.badmintonCategoryId,
    player1Id: input.badmintonPlayer.id,
    status: "accepted",
    metaJson: {
      source: "scoring_registration",
      auctionCategoryId: auctionCategory.id,
      auctionCategoryName: auctionCategory.name,
    },
  });

  return {
    status: "created",
    registrationId: created.id,
    badmintonCategoryId: decision.badmintonCategoryId,
  };
}
