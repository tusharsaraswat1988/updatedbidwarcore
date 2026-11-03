/**
 * BidWar WhatsApp Guest Lead Capture Service
 *
 * Extracts prospective organizer details from WhatsApp conversations and
 * records them into `contactInquiriesTable`, triggering admin notifications.
 * Guards against duplicate lead submissions within the active session.
 */

import { db, contactInquiriesTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { notifyAdminContactFormSubmission } from "../../admin-notifications/triggers.js";
import { logger, maskPhoneNumber } from "../../logger";
import { sessionManager, type GuestLeadData } from "./session-manager";

const SPORT_PATTERNS = [
  /\b(cricket|football|kabaddi|badminton|basketball|volleyball|tennis|esports|bgmi|freefire)\b/i,
];

const TEAM_COUNT_PATTERNS = [
  /\b([2-9]|[12][0-9]|30)\s*(?:[a-zA-Z]+\s+)?(?:teams?|teame?|tims?|franchises?)\b/i,
  /\b(?:teams?|teame?)\s*(?:count|hai|hain)?\s*[:=-]?\s*([2-9]|[12][0-9]|30)\b/i,
];

const NAME_PATTERNS = [
  /(?:my\s+name\s+is|i\s+am|myself|this\s+is)\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
  /(?:mera\s+naam)\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
  /(?:naam\s+hai)\s+([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
  /(?:name\s*[:=-]\s*)([a-zA-Z]{2,20}(?:\s+[a-zA-Z]{2,20})?)/i,
];

const CITY_PATTERNS = [
  /\b(?:in|from|at|near|city\s*[:=-]?)\s+([a-zA-Z]{3,20})\b/i,
  /\b([a-zA-Z]{3,20})\s+(?:me|mein|se)\b/i,
];

const TOURNAMENT_DATE_PATTERNS = [
  /\b(?:in\s+)?(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(next\s+month|next\s+week|agle\s+mahine|is\s+mahine)\b/i,
  /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b/i,
];

export class LeadCaptureService {
  /**
   * Extract potential organizer lead parameters from a message string.
   */
  public extractLeadData(text: string, existingLead: GuestLeadData = {}): GuestLeadData {
    const updated: GuestLeadData = { ...existingLead };

    // 1. Sport
    for (const pat of SPORT_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        updated.sport = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        break;
      }
    }

    // 2. Team Count
    for (const pat of TEAM_COUNT_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        updated.teamCount = match[1].trim();
        break;
      }
    }

    // 3. Name
    for (const pat of NAME_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        let candidate = match[1].trim();
        candidate = candidate.replace(/\s+(?:hai|h|hun|hu)$/i, "").trim();
        if (!/^(hi|hello|namaste|yes|no|bidwar|demo|help)$/i.test(candidate)) {
          updated.name = candidate;
          break;
        }
      }
    }

    // 4. City
    for (const pat of CITY_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (!/^(bidwar|india|delhi|mumbai|auction|scoring|tournament|support|sports)$/i.test(candidate) ||
            /^(delhi|mumbai|varanasi|lucknow|pune|bangalore|kolkata|jaipur|hyderabad|ahmedabad|chennai)$/i.test(candidate)) {
          updated.city = candidate;
          break;
        }
      }
    }

    // 5. Date
    for (const pat of TOURNAMENT_DATE_PATTERNS) {
      const match = text.match(pat);
      if (match && match[1]) {
        updated.tournamentDate = match[1].trim();
        break;
      }
    }

    return updated;
  }

  /**
   * Determine if the extracted data meets the criteria for a qualified lead.
   */
  public isQualifiedLead(lead: GuestLeadData): boolean {
    // A lead is qualified if:
    // (a) They gave a name AND either sport or team count or city, OR
    // (b) They gave a sport AND team count (e.g. "cricket auction for 8 teams")
    const hasName = Boolean(lead.name && lead.name.length >= 2);
    const hasSport = Boolean(lead.sport);
    const hasTeamCount = Boolean(lead.teamCount);
    const hasCity = Boolean(lead.city);

    return (hasName && (hasSport || hasTeamCount || hasCity)) || (hasSport && hasTeamCount);
  }

  /**
   * Check if a lead has already been recorded for this mobile in the last 24 hours.
   */
  public async isDuplicateLead(mobile: string): Promise<boolean> {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [existing] = await db
        .select({ id: contactInquiriesTable.id })
        .from(contactInquiriesTable)
        .where(
          and(
            eq(contactInquiriesTable.phone, mobile),
            eq(contactInquiriesTable.source, "whatsapp_guest_assistant"),
            gt(contactInquiriesTable.createdAt, twentyFourHoursAgo)
          )
        )
        .limit(1);

      return Boolean(existing);
    } catch (err) {
      logger.warn({ err, mobile: maskPhoneNumber(mobile) }, "LeadCaptureService: isDuplicateLead check failed, defaulting to false");
      return false;
    }
  }

  /**
   * Save a qualified lead into contact_inquiries and trigger admin notifications.
   */
  public async recordLead(
    mobile: string,
    lead: GuestLeadData,
    summary: string
  ): Promise<{ captured: boolean; inquiryId?: number }> {
    try {
      // 1. Check idempotency / duplication
      const isDup = await this.isDuplicateLead(mobile);
      if (isDup) {
        logger.info(
          { mobile: maskPhoneNumber(mobile) },
          "LeadCaptureService: Lead already recorded in last 24 hours (idempotent skip)"
        );
        return { captured: false };
      }

      const fullName = lead.name?.trim() || "WhatsApp Visitor";
      const email = `${mobile}@whatsapp.bidwar.in`;
      const sport = lead.sport?.trim() || "Sports Auction";
      const teamCount = lead.teamCount?.trim() || "Unspecified";
      const city = lead.city?.trim() || "Not provided";
      const date = lead.tournamentDate?.trim() || "Not specified";

      const subject = `WhatsApp Lead: ${sport} (${teamCount} teams) - ${city}`;
      const messageContent = [
        `Lead captured via WhatsApp Assistant:`,
        `• Mobile: +${mobile}`,
        `• Name: ${fullName}`,
        `• Primary Sport: ${sport}`,
        `• Number of Teams: ${teamCount}`,
        `• City/Location: ${city}`,
        `• Preferred Date: ${date}`,
        `\nRecent Conversation Excerpt:\n${summary.slice(0, 1000)}`,
      ].join("\n");

      const [created] = await db
        .insert(contactInquiriesTable)
        .values({
          fullName,
          email,
          phone: mobile,
          inquiryType: "demo",
          subject,
          message: messageContent,
          consent: "granted",
          status: "new",
          source: "whatsapp_guest_assistant",
        })
        .returning({ id: contactInquiriesTable.id, createdAt: contactInquiriesTable.createdAt });

      if (created) {
        // Mark session
        await sessionManager.markLeadCaptured(mobile, created.id, lead);

        const referenceId = `WA${String(created.id).padStart(6, "0")}`;
        const submittedAt = created.createdAt?.toISOString() ?? new Date().toISOString();

        // Trigger existing admin notifications
        try {
          notifyAdminContactFormSubmission({
            inquiryId: created.id,
            referenceId,
            name: fullName,
            email,
            mobile,
            subject,
            message: messageContent,
            inquiryType: "demo",
            submittedAt,
          });
        } catch (notifErr) {
          logger.warn({ notifErr, referenceId }, "Lead saved but admin notification trigger failed");
        }

        logger.info(
          { inquiryId: created.id, mobile: maskPhoneNumber(mobile), sport, teamCount },
          "LeadCaptureService: Successfully recorded prospective organizer lead"
        );

        return { captured: true, inquiryId: created.id };
      }
    } catch (err) {
      logger.error({ err, mobile: maskPhoneNumber(mobile) }, "LeadCaptureService: Error saving lead");
    }

    return { captured: false };
  }
}

export const leadCaptureService = new LeadCaptureService();
