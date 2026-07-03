import { eq } from "drizzle-orm";
import { db, adminNotificationSettingsTable } from "@workspace/db";
import type { AdminNotificationSettingsDto } from "./types.js";

const DEFAULT_SETTINGS: AdminNotificationSettingsDto = {
  adminName: "",
  adminEmail: "",
  adminMobile: null,
  emailNotificationsEnabled: true,
  inAppNotificationsEnabled: true,
  liveNotificationsEnabled: true,
  notificationSoundEnabled: false,
  updatedAt: null,
};

function rowToDto(row: typeof adminNotificationSettingsTable.$inferSelect): AdminNotificationSettingsDto {
  return {
    adminName: row.adminName,
    adminEmail: row.adminEmail,
    adminMobile: row.adminMobile,
    emailNotificationsEnabled: row.emailNotificationsEnabled,
    inAppNotificationsEnabled: row.inAppNotificationsEnabled,
    liveNotificationsEnabled: row.liveNotificationsEnabled,
    notificationSoundEnabled: row.notificationSoundEnabled,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export async function getAdminNotificationSettings(): Promise<AdminNotificationSettingsDto> {
  const [row] = await db.select().from(adminNotificationSettingsTable).limit(1);
  if (!row) return DEFAULT_SETTINGS;
  return rowToDto(row);
}

export async function upsertAdminNotificationSettings(
  input: Partial<Omit<AdminNotificationSettingsDto, "updatedAt">>,
): Promise<AdminNotificationSettingsDto> {
  const [existing] = await db.select().from(adminNotificationSettingsTable).limit(1);

  if (!existing) {
    const [created] = await db
      .insert(adminNotificationSettingsTable)
      .values({
        adminName: input.adminName ?? "",
        adminEmail: input.adminEmail ?? "",
        adminMobile: input.adminMobile ?? null,
        emailNotificationsEnabled: input.emailNotificationsEnabled ?? true,
        inAppNotificationsEnabled: input.inAppNotificationsEnabled ?? true,
        liveNotificationsEnabled: input.liveNotificationsEnabled ?? true,
        notificationSoundEnabled: input.notificationSoundEnabled ?? false,
      })
      .returning();
    return rowToDto(created);
  }

  const [updated] = await db
    .update(adminNotificationSettingsTable)
    .set({
      ...(input.adminName !== undefined ? { adminName: input.adminName } : {}),
      ...(input.adminEmail !== undefined ? { adminEmail: input.adminEmail } : {}),
      ...(input.adminMobile !== undefined ? { adminMobile: input.adminMobile } : {}),
      ...(input.emailNotificationsEnabled !== undefined
        ? { emailNotificationsEnabled: input.emailNotificationsEnabled }
        : {}),
      ...(input.inAppNotificationsEnabled !== undefined
        ? { inAppNotificationsEnabled: input.inAppNotificationsEnabled }
        : {}),
      ...(input.liveNotificationsEnabled !== undefined
        ? { liveNotificationsEnabled: input.liveNotificationsEnabled }
        : {}),
      ...(input.notificationSoundEnabled !== undefined
        ? { notificationSoundEnabled: input.notificationSoundEnabled }
        : {}),
    })
    .where(eq(adminNotificationSettingsTable.id, existing.id))
    .returning();

  return rowToDto(updated);
}

export function isValidAdminEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
