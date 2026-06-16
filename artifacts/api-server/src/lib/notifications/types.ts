/** Supported notification channels. */
export type NotificationChannel = "email" | "sms" | "whatsapp";

/** Delivery status stored in notification_logs. */
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

/**
 * All notification event types. Initial events are wired; others are reserved
 * for future handlers without changing the core service API.
 */
export const NOTIFICATION_EVENT_TYPES = [
  "ORGANISER_REGISTERED",
  "TOURNAMENT_CREATED",
  "PLAYER_REGISTERED",
  "TOURNAMENT_APPROVED",
  "TEAM_OWNER_REGISTERED",
  "OWNER_CREDENTIALS_SENT",
  "OWNER_CREDENTIALS_RESET",
  "AUCTION_STARTED",
  "AUCTION_COMPLETED",
  "POST_AUCTION_REPORT",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export type ProviderSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  stub?: boolean;
  raw?: unknown;
};

export type OrganiserRegisteredPayload = {
  organizerId: number;
  name: string;
  email: string | null;
  mobile: string;
};

export type TournamentCreatedPayload = {
  tournamentId: number;
  tournamentName: string;
  sport: string;
  auctionCode: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  venue: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  organizerMobile: string | null;
  organizerId: number | null;
};

export type PlayerRegisteredPayload = {
  playerId: number;
  playerName: string;
  email: string;
  photoUrl: string | null;
  tournamentId: number;
  tournamentName: string;
  tournamentLogoUrl: string | null;
  paymentPending: boolean;
  bidwarLogoUrl?: string | null;
  brandName?: string;
  poweredByText?: string;
};

export type NotificationPayloadMap = {
  ORGANISER_REGISTERED: OrganiserRegisteredPayload;
  TOURNAMENT_CREATED: TournamentCreatedPayload;
  PLAYER_REGISTERED: PlayerRegisteredPayload;
  TOURNAMENT_APPROVED: Record<string, unknown>;
  TEAM_OWNER_REGISTERED: Record<string, unknown>;
  OWNER_CREDENTIALS_SENT: Record<string, unknown>;
  OWNER_CREDENTIALS_RESET: Record<string, unknown>;
  AUCTION_STARTED: Record<string, unknown>;
  AUCTION_COMPLETED: Record<string, unknown>;
  POST_AUCTION_REPORT: Record<string, unknown>;
};

export type SendNotificationOptions = {
  /** Bypass deduplication (used for admin resend). */
  skipDedup?: boolean;
  /** Parent log id when resending from admin UI. */
  resendOfLogId?: number;
};
