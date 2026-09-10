import {
  db,
  communicationAssetsTable,
  communicationTemplatesTable,
  communicationTemplateVersionsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../logger.js";
import {
  TEAM_OWNER_WELCOME_HTML,
  TEAM_OWNER_WELCOME_SUBJECT,
} from "./team-owner-welcome-email-template.js";
import {
  PLAYER_REGISTRATION_HTML,
  PLAYER_REGISTRATION_SUBJECT,
} from "./player-registration-email-template.js";
import {
  PLAYER_SOLD_HTML,
  PLAYER_SOLD_SUBJECT,
} from "./player-sold-email-template.js";
import {
  BADMINTON_MATCH_WIN_HTML,
  BADMINTON_MATCH_WIN_SUBJECT,
} from "./badminton-match-win-email-template.js";
import {
  BADMINTON_MATCH_WIN_OWNER_HTML,
  BADMINTON_MATCH_WIN_OWNER_SUBJECT,
} from "./badminton-match-win-owner-email-template.js";

const DEFAULT_TEMPLATES = [
  {
    name: "Welcome Team Owner",
    internalKey: "welcome_team_owner",
    eventType: "TEAM_OWNER_REGISTERED",
    subject: TEAM_OWNER_WELCOME_SUBJECT,
    htmlBody: TEAM_OWNER_WELCOME_HTML,
  },
  {
    name: "Player Registration",
    internalKey: "player_registration",
    eventType: "PLAYER_REGISTERED",
    subject: PLAYER_REGISTRATION_SUBJECT,
    htmlBody: PLAYER_REGISTRATION_HTML,
  },
  {
    name: "Player Sold",
    internalKey: "player_sold",
    eventType: "PLAYER_SOLD",
    subject: PLAYER_SOLD_SUBJECT,
    htmlBody: PLAYER_SOLD_HTML,
  },
  {
    name: "Organiser — All Teams Credentials",
    internalKey: "organiser_all_teams_credentials",
    eventType: null,
    subject: "All Team Credentials — {{tournament_name}}",
    htmlBody: `<p>Hi {{organiser_name}},</p>
<p>Please find below the complete list of <strong>{{team_count}}</strong> registered teams and owner credentials for <strong>{{tournament_name}}</strong>.</p>
<div style="margin:20px 0;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;">
  <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af;">Common Owner App Link (same for all teams)</p>
  <p style="margin:0;font-size:14px;"><a href="{{owner_app_link}}" style="color:#2563eb;word-break:break-all;">{{owner_app_link}}</a></p>
  <p style="margin:12px 0 0;font-size:13px;color:#374151;">Each team uses its own <strong>Access Code</strong> on this link.</p>
</div>
<p style="margin:16px 0;font-size:14px;color:#4b5563;"><em>Team owners who provided an email address have already received their individual owner panel link by email. You may still share the details below on WhatsApp for quick reference.</em></p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
<p style="margin:0 0 16px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Teams (copy each block to the respective WhatsApp group)</p>
{{teams_credentials_block}}`,
    autoSend: false,
  },
  {
    name: "Welcome Organiser",
    internalKey: "welcome_organiser",
    eventType: "ORGANISER_REGISTERED",
    subject: "Welcome to BidWar, {{organiser_name}}!",
    htmlBody: `<h1>Welcome to BidWar!</h1>
<p>Hi {{organiser_name}},</p>
<p>Your organiser account is ready. <a href="{{login_link}}">Sign in to your dashboard</a> to create your first tournament.</p>`,
  },
  {
    name: "Tournament Created",
    internalKey: "tournament_created",
    eventType: "TOURNAMENT_CREATED",
    subject: "Tournament created: {{tournament_name}}",
    htmlBody: `<h1>Tournament Created</h1>
<p>Hi {{organiser_name}},</p>
<p><strong>{{tournament_name}}</strong> has been created successfully.</p>
<p>Auction date: {{auction_date}}</p>`,
  },
  {
    name: "Badminton Match Win — Player",
    internalKey: "badminton_match_win",
    eventType: "BADMINTON_MATCH_WIN",
    subject: BADMINTON_MATCH_WIN_SUBJECT,
    htmlBody: BADMINTON_MATCH_WIN_HTML,
  },
  {
    name: "Badminton Match Win — Team Owner",
    internalKey: "badminton_match_win_owner",
    eventType: "BADMINTON_MATCH_WIN_OWNER",
    subject: BADMINTON_MATCH_WIN_OWNER_SUBJECT,
    htmlBody: BADMINTON_MATCH_WIN_OWNER_HTML,
  },
];

const DEFAULT_ASSETS = [
  {
    name: "BidWar Logo",
    assetKey: "bidwar_logo",
    assetType: "logo",
    content: "https://bidwar.in/bidwar-primary-logo.png",
    description: "Default BidWar logo for email headers",
  },
  {
    name: "Footer Banner",
    assetKey: "footer_banner",
    assetType: "footer",
    content: '<p style="text-align:center;color:#6b7280;font-size:12px;">© {{current_year}} BidWar. All rights reserved.</p>',
    description: "Default email footer",
  },
  {
    name: "Email Signature",
    assetKey: "email_signature",
    assetType: "signature",
    content: "<p>Best regards,<br/>The BidWar Team</p>",
    description: "Default email signature",
  },
  {
    name: "Brand Primary Color",
    assetKey: "brand_primary_color",
    assetType: "brand_color",
    content: "#2563eb",
    description: "Primary brand color",
  },
  {
    name: "Support Number",
    assetKey: "support_number",
    assetType: "brand_color",
    content: "+91 8707488250",
    description: "Support contact number for merge variable",
  },
];

export async function seedCommunicationDefaults(): Promise<void> {
  for (const asset of DEFAULT_ASSETS) {
    const [existing] = await db
      .select()
      .from(communicationAssetsTable)
      .where(eq(communicationAssetsTable.assetKey, asset.assetKey))
      .limit(1);

    if (!existing) {
      await db.insert(communicationAssetsTable).values(asset);
    }
  }

  for (const tpl of DEFAULT_TEMPLATES) {
    const [existing] = await db
      .select()
      .from(communicationTemplatesTable)
      .where(eq(communicationTemplatesTable.internalKey, tpl.internalKey))
      .limit(1);

    if (existing) {
      if (tpl.internalKey === "welcome_team_owner") {
        await upgradeTeamOwnerWelcomeTemplateIfNeeded(existing);
      }
      if (tpl.internalKey === "player_registration") {
        await upgradePlayerRegistrationTemplateIfNeeded(existing);
      }
      if (tpl.internalKey === "player_sold") {
        await upgradePlayerSoldTemplateIfNeeded(existing);
      }
      if (tpl.internalKey === "badminton_match_win") {
        await upgradeBadmintonMatchWinTemplateIfNeeded(existing);
      }
      if (tpl.internalKey === "badminton_match_win_owner") {
        await upgradeBadmintonMatchWinOwnerTemplateIfNeeded(existing);
      }
      continue;
    }

    const [created] = await db
      .insert(communicationTemplatesTable)
      .values({
        name: tpl.name,
        internalKey: tpl.internalKey,
        eventType: tpl.eventType,
        subject: tpl.subject,
        htmlBody: tpl.htmlBody,
        isActive: true,
        autoSend: true,
        isDraft: "isDraft" in tpl ? Boolean(tpl.isDraft) : false,
        createdBy: "system",
      })
      .returning();

    if (created) {
      await db.insert(communicationTemplateVersionsTable).values({
        templateId: created.id,
        versionNumber: 1,
        subject: tpl.subject,
        htmlBody: tpl.htmlBody,
        createdBy: "system",
        changeNote: "Initial seed",
      });
    }
  }

  logger.info("Communication Center defaults seeded");
  await migratePlayerSelectedToPlayerSold();
  await archiveUnusedStubTemplates();
}

/** Automatically archive unused stub templates so they don't clutter the admin panel. */
async function archiveUnusedStubTemplates(): Promise<void> {
  const UNUSED_STUB_KEYS = [
    "team_credentials",
    "player_unsold",
    "auction_reminder",
    "auction_starting",
    "payment_reminder",
    "tournament_schedule",
    "winner_congratulations",
    "thank_you",
    "reminder",
    "custom_template",
  ];

  for (const key of UNUSED_STUB_KEYS) {
    await db
      .update(communicationTemplatesTable)
      .set({ isArchived: true, isActive: false, updatedAt: new Date() })
      .where(eq(communicationTemplatesTable.internalKey, key));
  }
}

/** Rename legacy player_selected template to player_sold (v2 premium email). */
async function migratePlayerSelectedToPlayerSold(): Promise<void> {
  const [legacy] = await db
    .select()
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.internalKey, "player_selected"))
    .limit(1);

  if (!legacy) return;

  const [alreadyMigrated] = await db
    .select({ id: communicationTemplatesTable.id })
    .from(communicationTemplatesTable)
    .where(eq(communicationTemplatesTable.internalKey, "player_sold"))
    .limit(1);

  if (alreadyMigrated) {
    await db
      .update(communicationTemplatesTable)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(communicationTemplatesTable.id, legacy.id));
    return;
  }

  await db
    .update(communicationTemplatesTable)
    .set({
      name: "Player Sold",
      internalKey: "player_sold",
      eventType: "PLAYER_SOLD",
      subject: PLAYER_SOLD_SUBJECT,
      htmlBody: PLAYER_SOLD_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, legacy.id));

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, legacy.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: legacy.id,
    versionNumber: (latest?.versionNumber ?? 0) + 1,
    subject: PLAYER_SOLD_SUBJECT,
    htmlBody: PLAYER_SOLD_HTML,
    createdBy: "system",
    changeNote: "Renamed player_selected → player_sold (premium v2)",
  });

  logger.info({ templateId: legacy.id }, "Migrated player_selected to player_sold");
}

async function upgradePlayerSoldTemplateIfNeeded(existing: {
  id: string;
  htmlBody: string;
  subject: string;
}): Promise<void> {
  const alreadyV2 =
    existing.htmlBody.includes("YOU HAVE BEEN SOLD TO") &&
    existing.subject.includes("Welcome to {{team_name}}") &&
    !existing.htmlBody.includes("{{#celebration_gif}}") &&
    !existing.htmlBody.includes("View Tournament");
  if (alreadyV2) return;

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, existing.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await db
    .update(communicationTemplatesTable)
    .set({
      name: "Player Sold",
      eventType: "PLAYER_SOLD",
      subject: PLAYER_SOLD_SUBJECT,
      htmlBody: PLAYER_SOLD_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, existing.id));

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: existing.id,
    versionNumber: nextVersion,
    subject: PLAYER_SOLD_SUBJECT,
    htmlBody: PLAYER_SOLD_HTML,
    createdBy: "system",
    changeNote: "Player sold email v2.1 — emoji celebration, remove View Tournament CTA",
  });

  logger.info({ templateId: existing.id, version: nextVersion }, "Player sold template upgraded to v2");
}

async function upgradePlayerRegistrationTemplateIfNeeded(existing: {
  id: string;
  htmlBody: string;
}): Promise<void> {
  const hasSeparatedDateRows =
    existing.htmlBody.includes("Tournament / Match Dates") &&
    existing.htmlBody.includes(">Auction Date<");
  const hasPremiumLayout =
    existing.htmlBody.includes("Support BidWar") ||
    existing.htmlBody.includes("What happens next?");
  // Re-seed when premium layout is missing, or when auction/match dates are still merged.
  if (hasPremiumLayout && hasSeparatedDateRows) return;

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, existing.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await db
    .update(communicationTemplatesTable)
    .set({
      subject: PLAYER_REGISTRATION_SUBJECT,
      htmlBody: PLAYER_REGISTRATION_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, existing.id));

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: existing.id,
    versionNumber: nextVersion,
    subject: PLAYER_REGISTRATION_SUBJECT,
    htmlBody: PLAYER_REGISTRATION_HTML,
    createdBy: "system",
    changeNote:
      "Player registration email — separate Auction Date and Tournament / Match Dates",
  });

  logger.info(
    { templateId: existing.id, version: nextVersion },
    "Player registration template upgraded",
  );
}

async function upgradeBadmintonMatchWinTemplateIfNeeded(existing: {
  id: string;
  htmlBody: string;
  subject: string;
}): Promise<void> {
  const alreadyCurrent =
    existing.htmlBody.includes("Support BidWar") &&
    existing.htmlBody.includes("Player Match Win") &&
    existing.subject.includes("{{player_name}}");
  if (alreadyCurrent) return;

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, existing.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await db
    .update(communicationTemplatesTable)
    .set({
      name: "Badminton Match Win — Player",
      eventType: "BADMINTON_MATCH_WIN",
      subject: BADMINTON_MATCH_WIN_SUBJECT,
      htmlBody: BADMINTON_MATCH_WIN_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, existing.id));

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: existing.id,
    versionNumber: nextVersion,
    subject: BADMINTON_MATCH_WIN_SUBJECT,
    htmlBody: BADMINTON_MATCH_WIN_HTML,
    createdBy: "system",
    changeNote: "Badminton player match-win email v2 — player-specific template",
  });

  logger.info(
    { templateId: existing.id, version: nextVersion },
    "Badminton match win player template upgraded",
  );
}

async function upgradeBadmintonMatchWinOwnerTemplateIfNeeded(existing: {
  id: string;
  htmlBody: string;
  subject: string;
}): Promise<void> {
  const alreadyCurrent =
    existing.htmlBody.includes("Support BidWar") &&
    existing.htmlBody.includes("FRANCHISE WIN") &&
    existing.subject.includes("{{team_name}} just won");
  if (alreadyCurrent) return;

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, existing.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await db
    .update(communicationTemplatesTable)
    .set({
      name: "Badminton Match Win — Team Owner",
      eventType: "BADMINTON_MATCH_WIN_OWNER",
      subject: BADMINTON_MATCH_WIN_OWNER_SUBJECT,
      htmlBody: BADMINTON_MATCH_WIN_OWNER_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, existing.id));

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: existing.id,
    versionNumber: nextVersion,
    subject: BADMINTON_MATCH_WIN_OWNER_SUBJECT,
    htmlBody: BADMINTON_MATCH_WIN_OWNER_HTML,
    createdBy: "system",
    changeNote: "Badminton team-owner match-win email v1",
  });

  logger.info(
    { templateId: existing.id, version: nextVersion },
    "Badminton match win owner template upgraded",
  );
}

async function upgradeTeamOwnerWelcomeTemplateIfNeeded(existing: {
  id: string;
  htmlBody: string;
  subject: string;
}): Promise<void> {
  const hasBrandedLayout =
    existing.htmlBody.includes("Support BidWar") &&
    existing.htmlBody.includes("Registered Mobile") &&
    existing.htmlBody.includes("Important Instructions for Team Owners");
  if (hasBrandedLayout) return;

  const [latest] = await db
    .select({ versionNumber: communicationTemplateVersionsTable.versionNumber })
    .from(communicationTemplateVersionsTable)
    .where(eq(communicationTemplateVersionsTable.templateId, existing.id))
    .orderBy(desc(communicationTemplateVersionsTable.versionNumber))
    .limit(1);

  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  await db
    .update(communicationTemplatesTable)
    .set({
      subject: TEAM_OWNER_WELCOME_SUBJECT,
      htmlBody: TEAM_OWNER_WELCOME_HTML,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplatesTable.id, existing.id));

  await db.insert(communicationTemplateVersionsTable).values({
    templateId: existing.id,
    versionNumber: nextVersion,
    subject: TEAM_OWNER_WELCOME_SUBJECT,
    htmlBody: TEAM_OWNER_WELCOME_HTML,
    createdBy: "system",
    changeNote:
      "Team owner welcome email — BidWar branded theme, mobile for login & coordinator contact",
  });

  logger.info(
    { templateId: existing.id, version: nextVersion },
    "Team owner welcome template upgraded to branded v2",
  );
}

