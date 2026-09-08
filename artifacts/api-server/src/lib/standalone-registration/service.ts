/**
 * Standalone registration domain services.
 * Writes ONLY to sr_* tables — never players / tournaments / global_players.
 */
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  srAuditLogsTable,
  srCategoriesTable,
  srFormFieldsTable,
  srRegistrationsTable,
  srTournamentsTable,
  type SrCategory,
  type SrFormField,
  type SrRegistration,
  type SrTournament,
} from "@workspace/db";
import {
  buildSampleTournamentSeed,
  formatRegistrationId,
  initialRegistrationStatus,
  validateRegistrationPayload,
  type SeedTournamentConfig,
  type ValidateRegistrationInput,
  type ValidatedRegistration,
} from "@workspace/standalone-registration";
import { logger } from "../logger";

export type PublicTournamentConfig = {
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  registrationTitle: string;
  registrationDescription: string | null;
  registrationFee: number;
  currency: string;
  registrationDeadline: string | null;
  contactName: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  termsAndConditions: string | null;
  privacyNotice: string | null;
  successMessage: string | null;
  paymentInstructions: string | null;
  isActive: boolean;
  requireDeclaration: boolean;
  formFields: Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    section: string;
    required: boolean;
    options: string[] | null;
    sortOrder: number;
  }>;
  categories: Array<{
    code: string;
    name: string;
    minAge: number | null;
    maxAge: number | null;
    gender: string | null;
    sortOrder: number;
  }>;
};

function toPublicConfig(
  tournament: SrTournament,
  fields: SrFormField[],
  categories: SrCategory[],
): PublicTournamentConfig {
  return {
    slug: tournament.slug,
    name: tournament.name,
    logoUrl: tournament.logoUrl,
    bannerUrl: tournament.bannerUrl,
    registrationTitle: tournament.registrationTitle,
    registrationDescription: tournament.registrationDescription,
    registrationFee: tournament.registrationFee,
    currency: tournament.currency,
    registrationDeadline: tournament.registrationDeadline?.toISOString() ?? null,
    contactName: tournament.contactName,
    contactMobile: tournament.contactMobile,
    contactEmail: tournament.contactEmail,
    termsAndConditions: tournament.termsAndConditions,
    privacyNotice: tournament.privacyNotice,
    successMessage: tournament.successMessage,
    paymentInstructions: tournament.paymentInstructions,
    isActive: tournament.isActive,
    requireDeclaration: tournament.requireDeclaration,
    formFields: fields
      .filter((f) => f.isActive)
      .map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType,
        section: f.section,
        required: f.required,
        options: f.optionsJson ?? null,
        sortOrder: f.sortOrder,
      })),
    categories: categories
      .filter((c) => c.isActive)
      .map((c) => ({
        code: c.code,
        name: c.name,
        minAge: c.minAge,
        maxAge: c.maxAge,
        gender: c.gender,
        sortOrder: c.sortOrder,
      })),
  };
}

export async function getStandaloneTournamentBySlug(
  slug: string,
): Promise<PublicTournamentConfig | null> {
  const normalized = slug.trim().toLowerCase();
  const [tournament] = await db
    .select()
    .from(srTournamentsTable)
    .where(eq(srTournamentsTable.slug, normalized))
    .limit(1);

  if (!tournament) return null;

  const [fields, categories] = await Promise.all([
    db
      .select()
      .from(srFormFieldsTable)
      .where(eq(srFormFieldsTable.tournamentId, tournament.id))
      .orderBy(asc(srFormFieldsTable.sortOrder)),
    db
      .select()
      .from(srCategoriesTable)
      .where(eq(srCategoriesTable.tournamentId, tournament.id))
      .orderBy(asc(srCategoriesTable.sortOrder)),
  ]);

  return toPublicConfig(tournament, fields, categories);
}

export async function ensureStandaloneTournamentSeed(
  seed: SeedTournamentConfig,
): Promise<SrTournament> {
  const [existing] = await db
    .select()
    .from(srTournamentsTable)
    .where(eq(srTournamentsTable.slug, seed.slug))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(srTournamentsTable)
    .values({
      slug: seed.slug,
      name: seed.name,
      registrationTitle: seed.registrationTitle,
      registrationDescription: seed.registrationDescription,
      registrationFee: seed.registrationFee,
      currency: seed.currency,
      registrationIdPrefix: seed.registrationIdPrefix,
      contactName: seed.contactName,
      contactMobile: seed.contactMobile,
      contactEmail: seed.contactEmail,
      termsAndConditions: seed.termsAndConditions,
      privacyNotice: seed.privacyNotice,
      successMessage: seed.successMessage,
      paymentInstructions: seed.paymentInstructions,
      isActive: seed.isActive,
      allowDuplicateRegistrations: seed.allowDuplicateRegistrations,
      nextRegistrationSeq: 1,
    })
    .returning();

  if (seed.formFields.length > 0) {
    await db.insert(srFormFieldsTable).values(
      seed.formFields.map((f) => ({
        tournamentId: created.id,
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType,
        section: f.section,
        required: f.required,
        optionsJson: f.optionsJson,
        sortOrder: f.sortOrder,
        isActive: f.isActive,
      })),
    );
  }

  if (seed.categories.length > 0) {
    await db.insert(srCategoriesTable).values(
      seed.categories.map((c) => ({
        tournamentId: created.id,
        code: c.code,
        name: c.name,
        minAge: c.minAge,
        maxAge: c.maxAge,
        gender: c.gender,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
    );
  }

  logger.info(
    { slug: created.slug, tournamentId: created.id },
    "standalone-registration: seeded tournament config",
  );

  return created;
}

/** Dev convenience — seeds sample slug if missing. Engine stays reusable. */
export async function ensureSampleTournament(slug = "bpl"): Promise<SrTournament> {
  return ensureStandaloneTournamentSeed(buildSampleTournamentSeed(slug));
}

async function allocateRegistrationId(tournamentId: number, prefix: string): Promise<string> {
  const seq = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(srTournamentsTable)
      .set({
        nextRegistrationSeq: sql`${srTournamentsTable.nextRegistrationSeq} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(srTournamentsTable.id, tournamentId))
      .returning({ nextSeq: srTournamentsTable.nextRegistrationSeq });

    if (!row?.nextSeq || !Number.isInteger(row.nextSeq)) {
      throw new Error("Failed to allocate registration sequence");
    }
    // nextSeq is the value AFTER increment; allocated sequence is nextSeq - 1.
    return row.nextSeq - 1;
  });

  const formatted = formatRegistrationId(prefix, seq);
  if (!formatted.ok) {
    throw new Error(formatted.error);
  }
  return formatted.registrationId;
}

function categoryEligible(
  category: SrCategory,
  age: number,
  gender: string,
): boolean {
  if (category.minAge != null && age < category.minAge) return false;
  if (category.maxAge != null && age > category.maxAge) return false;
  if (category.gender && category.gender !== gender) return false;
  return true;
}

export type CreateRegistrationResult =
  | {
      ok: true;
      registration: SrRegistration;
      registrationFee: number;
      currency: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
      issues?: Array<{ field: string; message: string }>;
      existingRegistrationId?: string;
    };

export async function createStandaloneRegistration(input: {
  slug: string;
  payload: ValidateRegistrationInput;
  ipAddress?: string | null;
}): Promise<CreateRegistrationResult> {
  const slug = input.slug.trim().toLowerCase();
  const [tournament] = await db
    .select()
    .from(srTournamentsTable)
    .where(eq(srTournamentsTable.slug, slug))
    .limit(1);

  if (!tournament) {
    return { ok: false, status: 404, error: "Tournament registration not found." };
  }
  if (!tournament.isActive) {
    return { ok: false, status: 403, error: "Registration is currently closed." };
  }
  if (
    tournament.registrationDeadline &&
    tournament.registrationDeadline.getTime() < Date.now()
  ) {
    return { ok: false, status: 403, error: "Registration deadline has passed." };
  }

  const validated = validateRegistrationPayload(input.payload, {
    requireDeclaration: tournament.requireDeclaration,
  });
  if (!validated.ok) {
    return {
      ok: false,
      status: 400,
      error: "Validation failed",
      issues: validated.issues,
    };
  }

  const data: ValidatedRegistration = validated.data;

  let categoryId: number | null = null;
  if (data.categoryCode) {
    const [category] = await db
      .select()
      .from(srCategoriesTable)
      .where(
        and(
          eq(srCategoriesTable.tournamentId, tournament.id),
          eq(srCategoriesTable.code, data.categoryCode),
          eq(srCategoriesTable.isActive, true),
        ),
      )
      .limit(1);
    if (!category) {
      return {
        ok: false,
        status: 400,
        error: "Invalid category",
        issues: [{ field: "categoryCode", message: "Selected category is not available." }],
      };
    }
    if (!categoryEligible(category, data.calculatedAge, data.gender)) {
      return {
        ok: false,
        status: 400,
        error: "Not eligible for selected category",
        issues: [
          {
            field: "categoryCode",
            message: "Player age/gender does not match the selected category.",
          },
        ],
      };
    }
    categoryId = category.id;
  }

  if (!tournament.allowDuplicateRegistrations) {
    const [existing] = await db
      .select({
        registrationId: srRegistrationsTable.registrationId,
      })
      .from(srRegistrationsTable)
      .where(
        and(
          eq(srRegistrationsTable.tournamentId, tournament.id),
          eq(srRegistrationsTable.mobile, data.mobile),
        ),
      )
      .limit(1);

    if (existing) {
      return {
        ok: false,
        status: 409,
        error: "A registration with this mobile number already exists for this tournament.",
        existingRegistrationId: existing.registrationId,
      };
    }
  }

  const registrationId = await allocateRegistrationId(
    tournament.id,
    tournament.registrationIdPrefix,
  );
  const status = initialRegistrationStatus(tournament.registrationFee);

  try {
    const [created] = await db
      .insert(srRegistrationsTable)
      .values({
        registrationId,
        tournamentId: tournament.id,
        playerName: data.playerName,
        parentName: data.parentName,
        dateOfBirth: data.dateOfBirth,
        calculatedAge: data.calculatedAge,
        gender: data.gender,
        mobile: data.mobile,
        whatsapp: data.whatsapp,
        email: data.email,
        address: data.address,
        city: data.city,
        state: data.state,
        playingRole: data.playingRole,
        battingStyle: data.battingStyle,
        bowlingStyle: data.bowlingStyle,
        cricketExperience: data.cricketExperience,
        previousTournamentExperience: data.previousTournamentExperience,
        jerseySize: data.jerseySize,
        preferredJerseyNumber: data.preferredJerseyNumber,
        categoryId,
        cricketDataJson: {
          playingRole: data.playingRole,
          battingStyle: data.battingStyle,
          bowlingStyle: data.bowlingStyle,
        },
        fieldValuesJson: data.fieldValues,
        status,
        declarationAccepted: data.declarationAccepted,
      })
      .returning();

    await db.insert(srAuditLogsTable).values({
      tournamentId: tournament.id,
      registrationPk: created.id,
      registrationId: created.registrationId,
      actorType: "public",
      action: "registration.created",
      detailsJson: {
        status: created.status,
        calculatedAge: created.calculatedAge,
        fee: tournament.registrationFee,
      },
      ipAddress: input.ipAddress ?? null,
    });

    logger.info(
      {
        registrationId: created.registrationId,
        tournamentSlug: tournament.slug,
        status: created.status,
      },
      "standalone-registration: registration created",
    );

    return {
      ok: true,
      registration: created,
      registrationFee: tournament.registrationFee,
      currency: tournament.currency,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/uq_sr_registrations_tournament_mobile|duplicate key/i.test(message)) {
      return {
        ok: false,
        status: 409,
        error: "A registration with this mobile number already exists for this tournament.",
      };
    }
    logger.error({ err, slug }, "standalone-registration: create failed");
    throw err;
  }
}

export async function getStandaloneRegistrationByPublicId(
  registrationId: string,
): Promise<
  | {
      registration: SrRegistration;
      tournament: Pick<
        SrTournament,
        "slug" | "name" | "registrationFee" | "currency" | "contactName" | "contactMobile" | "contactEmail" | "successMessage"
      >;
    }
  | null
> {
  const normalized = registrationId.trim().toUpperCase();
  const [row] = await db
    .select({
      registration: srRegistrationsTable,
      tournamentSlug: srTournamentsTable.slug,
      tournamentName: srTournamentsTable.name,
      registrationFee: srTournamentsTable.registrationFee,
      currency: srTournamentsTable.currency,
      contactName: srTournamentsTable.contactName,
      contactMobile: srTournamentsTable.contactMobile,
      contactEmail: srTournamentsTable.contactEmail,
      successMessage: srTournamentsTable.successMessage,
    })
    .from(srRegistrationsTable)
    .innerJoin(
      srTournamentsTable,
      eq(srRegistrationsTable.tournamentId, srTournamentsTable.id),
    )
    .where(eq(srRegistrationsTable.registrationId, normalized))
    .limit(1);

  if (!row) return null;

  return {
    registration: row.registration,
    tournament: {
      slug: row.tournamentSlug,
      name: row.tournamentName,
      registrationFee: row.registrationFee,
      currency: row.currency,
      contactName: row.contactName,
      contactMobile: row.contactMobile,
      contactEmail: row.contactEmail,
      successMessage: row.successMessage,
    },
  };
}

export function serializePublicRegistration(
  registration: SrRegistration,
  tournament: {
    slug: string;
    name: string;
    registrationFee: number;
    currency: string;
    contactName: string | null;
    contactMobile: string | null;
    contactEmail: string | null;
    successMessage: string | null;
  },
) {
  return {
    registrationId: registration.registrationId,
    status: registration.status,
    playerName: registration.playerName,
    dateOfBirth: registration.dateOfBirth,
    calculatedAge: registration.calculatedAge,
    gender: registration.gender,
    mobile: registration.mobile,
    email: registration.email,
    city: registration.city,
    state: registration.state,
    playingRole: registration.playingRole,
    battingStyle: registration.battingStyle,
    bowlingStyle: registration.bowlingStyle,
    jerseySize: registration.jerseySize,
    preferredJerseyNumber: registration.preferredJerseyNumber,
    createdAt: registration.createdAt.toISOString(),
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      registrationFee: tournament.registrationFee,
      currency: tournament.currency,
      contactName: tournament.contactName,
      contactMobile: tournament.contactMobile,
      contactEmail: tournament.contactEmail,
      successMessage: tournament.successMessage,
    },
  };
}
