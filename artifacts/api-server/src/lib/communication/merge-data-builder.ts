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
import { buildTeamOwnerWelcomeMergeData } from "./team-owner-welcome-merge-data.js";
import { buildPlayerSoldMergeData } from "./player-sold-merge-data.js";

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
  templateKey?: string;
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
    const teamData = await buildTeamOwnerWelcomeMergeData(recipient.entityId);
    return {
      ...base,
      ...teamData,
      email: recipient.email || (teamData.email as string),
    };
  }

  if (recipient.entityType === "player" && recipient.entityId) {
    const [player] = await db
      .select()
      .from(playersTable)
      .where(eq(playersTable.id, recipient.entityId))
      .limit(1);

    if (player) {
      let soldData: Record<string, string> = {};
      if ((player.status === "sold" || recipient.templateKey === "player_sold") && player.teamId && player.tournamentId) {
        soldData = await buildPlayerSoldMergeData({
          playerId: player.id,
          teamId: player.teamId,
          amount: player.soldPrice ?? player.basePrice ?? 0,
          tournamentId: player.tournamentId,
        });
      }

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
        ...soldData,
        payment_link: paymentLink,
        email: recipient.email || player.email || "",
      };
    }
  }

  if (recipient.tournamentId) {
    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, recipient.tournamentId))
      .limit(1);

    if (tournament) {
      base.tournament_name = tournament.name;
      base.auction_name = tournament.name;
      base.auction_date = tournament.auctionDate ?? "";
      base.city = tournament.city ?? "";
      base.venue = tournament.venue ?? "";
      base.organiser_name = tournament.organizerName ?? recipient.name ?? "";
      base.organiser_email = tournament.organizerEmail ?? recipient.email;
      base.organiser_phone = tournament.organizerMobile ?? "";
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
