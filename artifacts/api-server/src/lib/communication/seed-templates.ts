import {
  db,
  communicationAssetsTable,
  communicationTemplatesTable,
  communicationTemplateVersionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger.js";

const DEFAULT_TEMPLATES = [
  {
    name: "Welcome Team Owner",
    internalKey: "welcome_team_owner",
    eventType: "TEAM_OWNER_REGISTERED",
    subject: "Welcome to {{tournament_name}} — {{team_name}}",
    htmlBody: `<h1>Welcome, {{owner_name}}!</h1>
<p>Your team <strong>{{team_name}}</strong> has been registered for <strong>{{tournament_name}}</strong>.</p>
<p>Use the link below to access your team owner dashboard:</p>
<p><a href="{{login_link}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Open Team Dashboard</a></p>
<p>If you have questions, contact us at {{support_number}}.</p>`,
  },
  {
    name: "Team Credentials",
    internalKey: "team_credentials",
    eventType: "OWNER_CREDENTIALS_SENT",
    subject: "Your {{team_name}} login credentials",
    htmlBody: `<h1>Team Login Credentials</h1>
<p>Hello {{owner_name}},</p>
<p>Your credentials for <strong>{{team_name}}</strong>:</p>
<ul><li>Email: {{email}}</li><li>Login: <a href="{{login_link}}">{{login_link}}</a></li></ul>`,
  },
  {
    name: "Player Registration",
    internalKey: "player_registration",
    eventType: "PLAYER_REGISTERED",
    subject: "Registration confirmed — {{tournament_name}}",
    htmlBody: `<h1>Registration Confirmed</h1>
<p>Hi {{player_name}},</p>
<p>You are registered for <strong>{{tournament_name}}</strong>.</p>
{{#payment_link}}<p><a href="{{payment_link}}">Complete payment</a></p>{{/payment_link}}`,
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
    name: "Player Selected",
    internalKey: "player_selected",
    eventType: "PLAYER_SELECTED",
    subject: "Congratulations {{player_name}} — selected for {{team_name}}!",
    htmlBody: `<h1>You've been selected!</h1>
<p>Hi {{player_name}}, you have been selected by <strong>{{team_name}}</strong> for {{amount}}.</p>`,
  },
  {
    name: "Player Unsold",
    internalKey: "player_unsold",
    eventType: "PLAYER_UNSOLD",
    subject: "Auction update — {{tournament_name}}",
    htmlBody: `<p>Hi {{player_name}}, you were not sold in the latest auction round. Stay tuned for updates.</p>`,
  },
  {
    name: "Auction Reminder",
    internalKey: "auction_reminder",
    eventType: "AUCTION_REMINDER",
    subject: "Reminder: {{auction_name}} on {{auction_date}}",
    htmlBody: `<h1>Auction Reminder</h1>
<p>The auction <strong>{{auction_name}}</strong> is scheduled for {{auction_date}}.</p>`,
  },
  {
    name: "Auction Starting",
    internalKey: "auction_starting",
    eventType: "AUCTION_STARTED",
    subject: "{{auction_name}} is starting now!",
    htmlBody: `<h1>Auction Live</h1>
<p>The auction for <strong>{{tournament_name}}</strong> is starting. <a href="{{login_link}}">Join now</a>.</p>`,
  },
  {
    name: "Payment Reminder",
    internalKey: "payment_reminder",
    eventType: "PAYMENT_REMINDER",
    subject: "Payment reminder — {{tournament_name}}",
    htmlBody: `<p>Hi {{player_name}}, please complete your payment of {{amount}}. <a href="{{payment_link}}">Pay now</a>.</p>`,
  },
  {
    name: "Tournament Schedule",
    internalKey: "tournament_schedule",
    eventType: "TOURNAMENT_SCHEDULE",
    subject: "Match schedule — {{tournament_name}}",
    htmlBody: `<h1>Match Schedule</h1>
<p>Your next match is on {{match_date}}.</p>`,
  },
  {
    name: "Winner Congratulations",
    internalKey: "winner_congratulations",
    eventType: "WINNER_CONGRATULATIONS",
    subject: "Congratulations — {{tournament_name}} Champions!",
    htmlBody: `<h1>🏆 Champions!</h1>
<p>Congratulations {{team_name}} on winning {{tournament_name}}!</p>`,
  },
  {
    name: "Thank You",
    internalKey: "thank_you",
    eventType: "THANK_YOU",
    subject: "Thank you — {{tournament_name}}",
    htmlBody: `<p>Thank you for being part of {{tournament_name}}. We hope to see you again!</p>`,
  },
  {
    name: "Reminder",
    internalKey: "reminder",
    eventType: "REMINDER",
    subject: "Reminder — {{tournament_name}}",
    htmlBody: `<p>This is a friendly reminder about {{tournament_name}}.</p>`,
  },
  {
    name: "Custom Template",
    internalKey: "custom_template",
    eventType: null,
    subject: "Message from {{organiser_name}}",
    htmlBody: `<p>Hello {{owner_name}},</p><p>Your custom message here.</p>`,
    isDraft: true,
  },
];

const DEFAULT_ASSETS = [
  {
    name: "BidWar Logo",
    assetKey: "bidwar_logo",
    assetType: "logo",
    content: "https://bidwar.in/logo.png",
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
    content: "+91 98765 43210",
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

    if (existing) continue;

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
}
