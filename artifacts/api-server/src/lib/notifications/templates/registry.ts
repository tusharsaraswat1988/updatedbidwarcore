import type { NotificationEventType } from "../types";
import { organiserWelcomeEmail } from "./organiser-welcome";
import { playerRegisteredEmail } from "./player-registered";
import { tournamentCreatedEmail } from "./tournament-created";

export type EmailTemplateResult = {
  subject: string;
  html: string;
};

export type EmailTemplateRenderer = (params: Record<string, unknown>) => EmailTemplateResult;

/**
 * Registry maps event types to email template renderers.
 * Add new templates here without modifying NotificationService core logic.
 */
const EMAIL_TEMPLATE_REGISTRY: Partial<Record<NotificationEventType, EmailTemplateRenderer>> = {
  ORGANISER_REGISTERED: (params) =>
    organiserWelcomeEmail({
      name: String(params.name ?? "Organiser"),
      appUrl: String(params.appUrl),
    }),
  TOURNAMENT_CREATED: (params) =>
    tournamentCreatedEmail({
      tournamentName: String(params.tournamentName),
      sport: String(params.sport),
      auctionCode: params.auctionCode as string | null,
      auctionDate: params.auctionDate as string | null,
      auctionTime: params.auctionTime as string | null,
      venue: params.venue as string | null,
      organizerName: params.organizerName as string | null,
      appUrl: String(params.appUrl),
      tournamentId: params.tournamentId as number | null | undefined,
      logoUrl: params.logoUrl as string | null | undefined,
      brandName: params.brandName as string | undefined,
    }),
  PLAYER_REGISTERED: (params) =>
    playerRegisteredEmail({
      playerName: String(params.playerName),
      photoUrl: params.photoUrl as string | null,
      tournamentName: String(params.tournamentName),
      tournamentLogoUrl: params.tournamentLogoUrl as string | null,
      paymentPending: Boolean(params.paymentPending),
      appUrl: String(params.appUrl),
      bidwarLogoUrl: params.bidwarLogoUrl as string | null | undefined,
      brandName: params.brandName as string | undefined,
      poweredByText: params.poweredByText as string | undefined,
    }),
};

export function renderEmailTemplate(
  eventType: NotificationEventType,
  params: Record<string, unknown>,
): EmailTemplateResult | null {
  const renderer = EMAIL_TEMPLATE_REGISTRY[eventType];
  if (!renderer) return null;
  return renderer(params);
}

export function hasEmailTemplate(eventType: NotificationEventType): boolean {
  return eventType in EMAIL_TEMPLATE_REGISTRY;
}
