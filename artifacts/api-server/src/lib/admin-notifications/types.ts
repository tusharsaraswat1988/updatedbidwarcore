export const ADMIN_NOTIFICATION_PRIORITIES = ["info", "warning", "critical"] as const;
export type AdminNotificationPriority = (typeof ADMIN_NOTIFICATION_PRIORITIES)[number];

export const ADMIN_NOTIFICATION_CATEGORIES = [
  "Registration",
  "Tournament",
  "Contact",
  "Auction",
  "Payment",
  "Support",
  "Printer",
  "System",
] as const;
export type AdminNotificationCategory = (typeof ADMIN_NOTIFICATION_CATEGORIES)[number];

export const ADMIN_NOTIFICATION_EVENT_TYPES = [
  "NEW_ORGANISER_REGISTERED",
  "NEW_TOURNAMENT_CREATED",
  "CONTACT_FORM_SUBMISSION",
  "EMAIL_SEND_FAILED",
  "MISSING_CONFIGURATION",
  "DATABASE_FAILURE",
  "NOTIFICATION_SERVICE_FAILURE",
  "BACKGROUND_JOB_FAILURE",
] as const;

export type AdminNotificationEventType = (typeof ADMIN_NOTIFICATION_EVENT_TYPES)[number];

export type NewOrganiserRegisteredPayload = {
  organizerId: number;
  name: string;
  email: string | null;
  mobile: string;
  company?: string | null;
  registeredAt: string;
};

export type NewTournamentCreatedPayload = {
  tournamentId: number;
  tournamentName: string;
  sport: string;
  organizerName: string | null;
  organizerId: number | null;
  city: string | null;
  createdAt: string;
};

export type ContactFormSubmissionPayload = {
  inquiryId: number;
  referenceId: string;
  name: string;
  email: string;
  mobile: string | null;
  subject: string;
  message: string;
  inquiryType: string;
  submittedAt: string;
};

export type EmailSendFailedPayload = {
  context: string;
  recipient?: string | null;
  error: string;
  originalEventType?: string | null;
};

export type MissingConfigurationPayload = {
  missingKeys: string[];
  context: string;
};

export type SystemFailurePayload = {
  context: string;
  error: string;
  details?: Record<string, unknown>;
};

export type AdminNotificationPayloadMap = {
  NEW_ORGANISER_REGISTERED: NewOrganiserRegisteredPayload;
  NEW_TOURNAMENT_CREATED: NewTournamentCreatedPayload;
  CONTACT_FORM_SUBMISSION: ContactFormSubmissionPayload;
  EMAIL_SEND_FAILED: EmailSendFailedPayload;
  MISSING_CONFIGURATION: MissingConfigurationPayload;
  DATABASE_FAILURE: SystemFailurePayload;
  NOTIFICATION_SERVICE_FAILURE: SystemFailurePayload;
  BACKGROUND_JOB_FAILURE: SystemFailurePayload;
};

export type AdminNotificationSettingsDto = {
  adminName: string;
  adminEmail: string;
  adminMobile: string | null;
  emailNotificationsEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  liveNotificationsEnabled: boolean;
  notificationSoundEnabled: boolean;
  updatedAt: string | null;
};

export type AdminNotificationDto = {
  id: number;
  type: AdminNotificationEventType;
  title: string;
  message: string;
  priority: AdminNotificationPriority;
  category: AdminNotificationCategory;
  entityType: string | null;
  entityId: number | null;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
};

/** SSE payload when a new admin notification is created. */
export type AdminNotificationCreatedPayload = {
  notification: {
    id: number;
    title: string;
    message: string;
    priority: AdminNotificationPriority;
    type: AdminNotificationEventType;
    category: AdminNotificationCategory;
    actionUrl: string | null;
    createdAt: string;
    isRead: boolean;
  };
  unreadCount: number;
};
