import type { globalPlayersTable } from "@workspace/db";

type GlobalPlayerRow = typeof globalPlayersTable.$inferSelect;

/** Public-safe global player fields — no mobile or email. */
export function publicGlobalPlayerSerializer(gp: GlobalPlayerRow) {
  return {
    id: gp.id,
    canonicalName: gp.canonicalName,
    sport: gp.sport,
    defaultRole: gp.defaultRole,
    city: gp.city,
    age: gp.age,
    gender: gp.gender,
    photoUrl: gp.photoUrl,
    createdAt: gp.createdAt.toISOString(),
  };
}

/** Organizer/admin global player — includes contact fields. */
export function privateGlobalPlayerSerializer(gp: GlobalPlayerRow) {
  return {
    ...publicGlobalPlayerSerializer(gp),
    mobileNumber: gp.mobileNumber,
    notes: gp.notes,
    updatedAt: gp.updatedAt.toISOString(),
  };
}

type GlobalPlayerSpecificationDto = {
  specGroupId: number;
  groupName: string;
  value: string;
};

/** Public search result — identity fields only (Sprint 2 sport-neutral search). */
export function publicGlobalPlayerIdentitySearchSerializer(row: {
  id: number;
  name: string;
  city: string | null;
  age: number | null;
  gender: string | null;
  role: string | null;
  photoUrl: string | null;
  globalPlayerId: string | null;
  basePrice: number | null;
  appearanceCount: number;
  sport?: string | null;
  specifications?: GlobalPlayerSpecificationDto[];
}) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    age: row.age,
    gender: row.gender,
    role: row.role,
    photoUrl: row.photoUrl,
    globalPlayerId: row.globalPlayerId,
    basePrice: row.basePrice,
    appearanceCount: row.appearanceCount,
    sport: row.sport ?? null,
    ...(row.specifications?.length ? { specifications: row.specifications } : {}),
  };
}

/** Private identity search — includes mobile. */
export function privateGlobalPlayerIdentitySearchSerializer(row: {
  mobileNumber?: string | null;
} & Parameters<typeof publicGlobalPlayerIdentitySearchSerializer>[0]) {
  return {
    ...publicGlobalPlayerIdentitySearchSerializer(row),
    mobileNumber: row.mobileNumber ?? null,
  };
}

/** Public search result from tournament player dedup query. */
export function publicGlobalPlayerSearchSerializer(row: {
  id: number;
  name: string;
  city: string | null;
  age: number | null;
  gender: string | null;
  role: string | null;
  photoUrl: string | null;
  battingStyle: string | null;
  bowlingStyle: string | null;
  specialization: string | null;
  jerseyNumber: string | null;
  achievements: string | null;
  cricheroUrl: string | null;
  availabilityDates: string | null;
  globalPlayerId: string | null;
  basePrice: number | null;
  appearanceCount: number;
  specifications?: GlobalPlayerSpecificationDto[];
}) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    age: row.age,
    gender: row.gender,
    role: row.role,
    photoUrl: row.photoUrl,
    battingStyle: row.battingStyle,
    bowlingStyle: row.bowlingStyle,
    specialization: row.specialization,
    jerseyNumber: row.jerseyNumber,
    achievements: row.achievements,
    cricheroUrl: row.cricheroUrl,
    availabilityDates: row.availabilityDates,
    globalPlayerId: row.globalPlayerId,
    basePrice: row.basePrice,
    appearanceCount: row.appearanceCount,
    ...(row.specifications?.length ? { specifications: row.specifications } : {}),
  };
}

/** Private search result — includes mobile for organizer prefill. */
export function privateGlobalPlayerSearchSerializer(row: {
  mobileNumber?: string | null;
} & Parameters<typeof publicGlobalPlayerSearchSerializer>[0]) {
  return {
    ...publicGlobalPlayerSearchSerializer(row),
    mobileNumber: row.mobileNumber ?? null,
  };
}
