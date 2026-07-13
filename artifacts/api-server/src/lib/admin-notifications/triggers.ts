import type { Organizer, Tournament } from "@workspace/db";
import { sendAdminNotificationAsync } from "./notification-service.js";

export function notifyAdminOrganiserRegistered(organizer: Organizer): void {
  sendAdminNotificationAsync("NEW_ORGANISER_REGISTERED", {
    organizerId: organizer.id,
    name: organizer.name,
    email: organizer.email,
    mobile: organizer.mobile,
    company: null,
    registeredAt: organizer.createdAt?.toISOString() ?? new Date().toISOString(),
  });
}

export function notifyAdminTournamentCreated(tournament: Tournament): void {
  sendAdminNotificationAsync("NEW_TOURNAMENT_CREATED", {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    sport: tournament.sport,
    organizerName: tournament.organizerName,
    organizerId: tournament.organizerId,
    city: tournament.city ?? null,
    createdAt: tournament.createdAt?.toISOString() ?? new Date().toISOString(),
  });
}

export function notifyAdminContactFormSubmission(params: {
  inquiryId: number;
  referenceId: string;
  name: string;
  email: string;
  mobile: string | null;
  subject: string;
  message: string;
  inquiryType: string;
  submittedAt: string;
}): void {
  sendAdminNotificationAsync("CONTACT_FORM_SUBMISSION", params);
}
