/**
 * Guest Conversation Session Manager
 *
 * Implements lightweight multi-turn conversational memory for WhatsApp guests.
 * Reuses the existing `botSessionsTable` (pendingAction = "guest_ai_session")
 * for a zero-migration, crash-resilient session store.
 */

import { db, botSessionsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger, maskPhoneNumber } from "../../logger";

export interface GuestChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export type LanguagePreference = "hindi" | "english" | "hinglish";

export interface DeliveredTopicSummary {
  pricingDelivered?: boolean;
  featuresOverviewDelivered?: boolean;
  signupUrlDelivered?: boolean;
  supportContactDelivered?: boolean;
  lastTopic?: string;
}

export interface GuestLeadData {
  name?: string;
  sport?: string;
  teamCount?: string;
  city?: string;
  tournamentDate?: string;
  mobile?: string;
  notes?: string;
}

export interface PendingEntityConfirmation {
  candidateTournamentId: number;
  candidateName: string;
  candidateCity?: string | null;
  pendingIntent: string;
  originalQuery: string;
}

export interface GuestSessionPayload {
  messages: GuestChatMessage[];
  leadCaptured?: boolean;
  leadInquiryId?: number;
  leadData?: GuestLeadData;
  languagePreference?: LanguagePreference;
  deliveredSummary?: DeliveredTopicSummary;
  confirmedTournamentId?: number;
  confirmedTournamentName?: string;
  confirmedTournamentCity?: string;
  confirmedMatchId?: number;
  pendingEntityConfirmation?: PendingEntityConfirmation;
}

const MAX_TURNS = 8; // Max 8 messages (4 user + 4 assistant turns)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class SessionManager {
  /**
   * Load active guest session for a normalized phone number.
   * If session is expired or does not exist, returns empty state.
   */
  public async getSession(mobile: string): Promise<GuestSessionPayload> {
    try {
      const [session] = await db
        .select()
        .from(botSessionsTable)
        .where(
          and(
            eq(botSessionsTable.mobile, mobile),
            eq(botSessionsTable.pendingAction, "guest_ai_session"),
            gt(botSessionsTable.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!session || !session.pendingData) {
        return { messages: [], leadCaptured: false };
      }

      const parsed = JSON.parse(session.pendingData) as GuestSessionPayload;
      return {
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
        leadCaptured: Boolean(parsed.leadCaptured),
        leadInquiryId: parsed.leadInquiryId,
        leadData: parsed.leadData,
        languagePreference: parsed.languagePreference,
        deliveredSummary: parsed.deliveredSummary,
        confirmedTournamentId: parsed.confirmedTournamentId,
        confirmedTournamentName: parsed.confirmedTournamentName,
        confirmedTournamentCity: parsed.confirmedTournamentCity,
        confirmedMatchId: parsed.confirmedMatchId,
        pendingEntityConfirmation: parsed.pendingEntityConfirmation,
      };
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to parse guest session, initializing fresh session"
      );
      return { messages: [], leadCaptured: false };
    }
  }

  /**
   * Set or update explicit language preference for a mobile user.
   */
  public async setLanguagePreference(
    mobile: string,
    languagePreference: LanguagePreference
  ): Promise<GuestSessionPayload> {
    const current = await this.getSession(mobile);
    const payload: GuestSessionPayload = {
      ...current,
      languagePreference,
    };
    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to persist language preference"
      );
    }
    return payload;
  }

  /**
   * Set confirmed tournament context for multi-turn conversations.
   */
  public async setConfirmedTournament(
    mobile: string,
    tournamentId: number,
    tournamentName: string,
    city?: string | null
  ): Promise<GuestSessionPayload> {
    const current = await this.getSession(mobile);
    const payload: GuestSessionPayload = {
      ...current,
      confirmedTournamentId: tournamentId,
      confirmedTournamentName: tournamentName,
      confirmedTournamentCity: city ?? undefined,
      pendingEntityConfirmation: undefined, // Clear pending clarification once confirmed
    };
    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to persist confirmed tournament"
      );
    }
    return payload;
  }

  /**
   * Store pending entity confirmation (e.g. "Kya aap Kanpur ke BPL ki baat kar rahe hain?").
   */
  public async setPendingEntityConfirmation(
    mobile: string,
    confirmation: PendingEntityConfirmation | undefined
  ): Promise<GuestSessionPayload> {
    const current = await this.getSession(mobile);
    const payload: GuestSessionPayload = {
      ...current,
      pendingEntityConfirmation: confirmation,
    };
    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to persist pending entity confirmation"
      );
    }
    return payload;
  }

  /**
   * Update delivered summary (for anti-repetition tracking).
   */
  public async updateDeliveredSummary(
    mobile: string,
    summary: Partial<DeliveredTopicSummary>
  ): Promise<GuestSessionPayload> {
    const current = await this.getSession(mobile);
    const payload: GuestSessionPayload = {
      ...current,
      deliveredSummary: {
        ...current.deliveredSummary,
        ...summary,
      },
    };
    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to persist delivered summary"
      );
    }
    return payload;
  }

  /**
   * Append a new user + assistant exchange to the session and refresh 24h TTL.
   */
  public async appendTurn(
    mobile: string,
    userText: string,
    assistantText: string,
    detectedLead?: Partial<GuestLeadData>,
    extra?: {
      languagePreference?: LanguagePreference;
      topic?: string;
      deliveredSummary?: Partial<DeliveredTopicSummary>;
      confirmedTournamentId?: number;
      confirmedTournamentName?: string;
      confirmedTournamentCity?: string;
      confirmedMatchId?: number;
      pendingEntityConfirmation?: PendingEntityConfirmation;
    }
  ): Promise<GuestSessionPayload> {
    const current = await this.getSession(mobile);
    const now = new Date().toISOString();

    const updatedMessages: GuestChatMessage[] = [
      ...current.messages,
      { role: "user", content: userText, timestamp: now },
      { role: "assistant", content: assistantText, timestamp: now },
    ];

    // Clamp to last MAX_TURNS messages
    const clampedMessages = updatedMessages.slice(-MAX_TURNS);

    const mergedLeadData: GuestLeadData = {
      ...current.leadData,
      ...detectedLead,
    };

    // Auto-detect delivered knowledge to avoid repetitive marketing dumps
    const hasPricing =
      /₹\s*[0-9]|Starter|Pro|Free Trial \(2 teams\)|per-tournament|price/i.test(assistantText);
    const hasFeatures =
      /1080p LED|OBS Live|real-time player bidding|Operator Console|scoring module/i.test(assistantText);
    const hasSignupUrl =
      /bidwar\.in\/organizer\?tab=signup/i.test(assistantText);
    const hasContact =
      /\+91\s*8707488250|bidwarsupport@gmail\.com/i.test(assistantText);

    const updatedSummary: DeliveredTopicSummary = {
      pricingDelivered: (current.deliveredSummary?.pricingDelivered || hasPricing) ?? false,
      featuresOverviewDelivered: (current.deliveredSummary?.featuresOverviewDelivered || hasFeatures) ?? false,
      signupUrlDelivered: (current.deliveredSummary?.signupUrlDelivered || hasSignupUrl) ?? false,
      supportContactDelivered: (current.deliveredSummary?.supportContactDelivered || hasContact) ?? false,
      lastTopic: extra?.topic || current.deliveredSummary?.lastTopic || "General",
      ...extra?.deliveredSummary,
    };

    const payload: GuestSessionPayload = {
      messages: clampedMessages,
      leadCaptured: current.leadCaptured,
      leadInquiryId: current.leadInquiryId,
      leadData: Object.keys(mergedLeadData).length > 0 ? mergedLeadData : undefined,
      languagePreference: extra?.languagePreference || current.languagePreference,
      deliveredSummary: updatedSummary,
      confirmedTournamentId: extra?.confirmedTournamentId ?? current.confirmedTournamentId,
      confirmedTournamentName: extra?.confirmedTournamentName ?? current.confirmedTournamentName,
      confirmedTournamentCity: extra?.confirmedTournamentCity ?? current.confirmedTournamentCity,
      confirmedMatchId: extra?.confirmedMatchId ?? current.confirmedMatchId,
      pendingEntityConfirmation:
        extra?.pendingEntityConfirmation !== undefined
          ? extra.pendingEntityConfirmation
          : current.pendingEntityConfirmation,
    };

    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to persist session turn to db, continuing with in-memory payload"
      );
    }

    return payload;
  }

  /**
   * Record that a lead has been successfully saved to contact_inquiries.
   */
  public async markLeadCaptured(
    mobile: string,
    inquiryId: number,
    leadData: GuestLeadData
  ): Promise<void> {
    const current = await this.getSession(mobile);
    const payload: GuestSessionPayload = {
      ...current,
      leadCaptured: true,
      leadInquiryId: inquiryId,
      leadData: {
        ...current.leadData,
        ...leadData,
      },
    };

    const sessionData = JSON.stringify(payload);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    try {
      await db
        .insert(botSessionsTable)
        .values({
          mobile,
          pendingAction: "guest_ai_session",
          pendingData: sessionData,
          expiresAt,
        })
        .onConflictDoUpdate({
          target: botSessionsTable.mobile,
          set: {
            pendingAction: "guest_ai_session",
            pendingData: sessionData,
            expiresAt,
          },
        });
    } catch (err) {
      logger.warn(
        { err, mobile: maskPhoneNumber(mobile) },
        "SessionManager: Failed to update lead captured in bot_sessions"
      );
    }
  }

  /**
   * Clear session (e.g. on explicit opt-out or session reset).
   */
  public async clearSession(mobile: string): Promise<void> {
    try {
      await db
        .delete(botSessionsTable)
        .where(
          and(
            eq(botSessionsTable.mobile, mobile),
            eq(botSessionsTable.pendingAction, "guest_ai_session")
          )
        );
    } catch (err) {
      logger.warn({ err, mobile: maskPhoneNumber(mobile) }, "SessionManager: Error clearing session");
    }
  }
}

export const sessionManager = new SessionManager();
