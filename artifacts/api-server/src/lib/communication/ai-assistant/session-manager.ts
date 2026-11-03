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

export interface GuestLeadData {
  name?: string;
  sport?: string;
  teamCount?: string;
  city?: string;
  tournamentDate?: string;
  mobile?: string;
  notes?: string;
}

export interface GuestSessionPayload {
  messages: GuestChatMessage[];
  leadCaptured?: boolean;
  leadInquiryId?: number;
  leadData?: GuestLeadData;
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
   * Append a new user + assistant exchange to the session and refresh 24h TTL.
   */
  public async appendTurn(
    mobile: string,
    userText: string,
    assistantText: string,
    detectedLead?: Partial<GuestLeadData>
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

    const payload: GuestSessionPayload = {
      messages: clampedMessages,
      leadCaptured: current.leadCaptured,
      leadInquiryId: current.leadInquiryId,
      leadData: Object.keys(mergedLeadData).length > 0 ? mergedLeadData : undefined,
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
