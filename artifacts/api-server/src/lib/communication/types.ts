export type {
  CommunicationChannel,
  CommunicationJobStatus,
  CommunicationPendingReason,
} from "@workspace/db";

export type CreateJobInput = {
  channel?: "email";
  templateInternalKey?: string;
  templateId?: string;
  tournamentId?: number | null;
  triggeredByEvent?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  recipientRole?: string | null;
  mergeData?: Record<string, unknown>;
  idempotencyKey: string;
  parentJobId?: string | null;
  sentBy?: "system" | "admin" | "bulk";
  createdByAdmin?: string | null;
  bulkCampaignId?: string | null;
  skipAutoQueue?: boolean;
};

export type JobListFilters = {
  status?: string;
  statuses?: string[];
  pendingReason?: string;
  tournamentId?: number;
  templateId?: string;
  templateInternalKey?: string;
  recipientRole?: string;
  channel?: string;
  search?: string;
  sentBy?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

export type DashboardStats = {
  totalEmails: number;
  sentToday: number;
  pending: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  readyToSend: number;
  topTemplates: Array<{ templateKey: string; templateName: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    recipientEmail: string | null;
    recipientName: string | null;
    status: string | null;
    createdAt: string;
  }>;
  graphData: Array<{ date: string; sent: number; failed: number; pending: number }>;
};

export type BulkRecipientFilter = {
  type:
    | "players"
    | "selected_players"
    | "unsold_players"
    | "men"
    | "women"
    | "team_owners"
    | "organisers"
    | "sponsors"
    | "operators"
    | "team"
    | "player"
    | "organiser_teams_credentials"
    | "tournament"
    | "custom_emails"
    | "csv";
  tournamentId?: number;
  teamId?: number;
  playerId?: number;
  emails?: string[];
  csvEmails?: string[];
};

export const KNOWN_MERGE_VARIABLES = [
  "team_name",
  "owner_name",
  "player_name",
  "tournament_name",
  "auction_name",
  "auction_date",
  "match_date",
  "login_link",
  "password",
  "email",
  "phone",
  "payment_link",
  "support_number",
  "organiser_name",
  "sponsor_name",
  "amount",
  "team_budget",
  "current_year",
  "app_url",
  "brand_name",
  "powered_by_text",
  "owner_app_link",
  "teams_credentials_block",
  "team_count",
] as const;
