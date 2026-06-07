import type { NotificationEventType } from "../types";
import { organiserWelcomeEmail } from "./organiser-welcome";
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
      auctionCode: String(params.auctionCode),
      auctionDate: params.auctionDate as string | null,
      auctionTime: params.auctionTime as string | null,
      venue: params.venue as string | null,
      organizerName: params.organizerName as string | null,
      appUrl: String(params.appUrl),
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
