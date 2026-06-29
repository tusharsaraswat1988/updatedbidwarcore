import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import {
  db,
  playersTable,
  teamsTable,
  tournamentsTable,
  brandingSettingsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { buildPublicUrl, getPublicOrigin } from "../runtime-env.js";
import { buildPlayerRegistrationMergeData } from "./player-registration-merge-data.js";

function appUrl(): string {
  return process.env.APP_URL?.trim() || getPublicOrigin();
}

export async function buildMergeDataForRecipient(recipient: {
  name: string | null;
  email: string;
  role: string;
  entityType?: string;
  entityId?: number;
  tournamentId?: number;
}): Promise<Record<string, unknown>> {
  const base: Record<string, unknown> = {
    email: recipient.email,
    current_year: String(new Date().getFullYear()),
    app_url: appUrl(),
    support_number: "+91 8707488250",
  };

  const [branding] = await db
    .select({
      brandName: brandingSettingsTable.brandName,
      poweredByText: brandingSettingsTable.poweredByText,
    })
    .from(brandingSettingsTable)
    .limit(1);

  base.brand_name = branding?.brandName ?? "BidWar";
  base.powered_by_text = branding?.poweredByText ?? "Powered by BidWar";

  if (recipient.entityType === "team" && recipient.entityId) {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(eq(teamsTable.id, recipient.entityId))
      .limit(1);

    if (team) {
      const [tournament] = await db
        .select()
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, team.tournamentId))
        .limit(1);

      const loginLink = buildPublicUrl(ownerJoinPath(team.tournamentId, team.id));

      return {
        ...base,
        owner_name: team.ownerName ?? recipient.name,
        team_name: team.name,
        tournament_name: tournament?.name ?? "",
        auction_name: tournament?.name ?? "",
        auction_date: tournament?.auctionDate ?? "",
        login_link: loginLink,
        team_budget: team.purse != null ? String(team.purse) : "",
        email: team.ownerEmail ?? recipient.email,
      };
    }
  }

  if (recipient.entityType === "player" && recipient.entityId) {
    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, recipient.entityId))
      .limit(1);

    if (player) {
      const registrationData = await buildPlayerRegistrationMergeData(player.id);
      let paymentLink = "";
      if (player.registrationPaymentStatus === "pending") {
        const [tournament] = await db
          .select({
            id: tournamentsTable.id,
            auctionCode: tournamentsTable.auctionCode,
          })
          .from(tournamentsTable)
          .where(eq(tournamentsTable.id, player.tournamentId))
          .limit(1);
        if (tournament) {
          paymentLink = `${appUrl()}/register/${tournament.auctionCode ?? tournament.id}`;
        }
      }
      return {
        ...base,
        ...registrationData,
        payment_link: paymentLink,
      };
    }
  }

  if (recipient.role === "team_owner") {
    return {
      ...base,
      owner_name: recipient.name,
      login_link: appUrl(),
    };
  }

  if (recipient.role === "player") {
    return {
      ...base,
      player_name: recipient.name,
      login_link: appUrl(),
    };
  }

  if (recipient.role === "organiser") {
    return {
      ...base,
      organiser_name: recipient.name,
      login_link: appUrl(),
    };
  }

  return {
    ...base,
    owner_name: recipient.name,
    player_name: recipient.name,
    organiser_name: recipient.name,
    login_link: appUrl(),
  };
}

export async function refreshJobMergeData(job: {
  mergeData?: Record<string, unknown> | null;
  entityType?: string | null;
  entityId?: number | null;
  tournamentId?: number | null;
  recipients: Array<{
    recipientName: string | null;
    recipientEmail: string | null;
    recipientRole: string | null;
    isPrimary: boolean;
  }>;
}): Promise<Record<string, unknown>> {
  const primary = job.recipients.find((r) => r.isPrimary) ?? job.recipients[0];
  if (!primary?.recipientEmail) {
    return { ...(job.mergeData ?? {}) };
  }

  if (job.entityType && job.entityId) {
    return buildMergeDataForRecipient({
      name: primary.recipientName,
      email: primary.recipientEmail,
      role: primary.recipientRole ?? "custom",
      entityType: job.entityType,
      entityId: job.entityId,
      tournamentId: job.tournamentId ?? undefined,
    });
  }

  return { ...(job.mergeData ?? {}), email: primary.recipientEmail };
}
