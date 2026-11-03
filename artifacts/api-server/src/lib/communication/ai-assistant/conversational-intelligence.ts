/**
 * BIDWAR Conversational Intelligence Module
 *
 * Implements intent classification, emotional awareness, language intelligence,
 * context continuity, role statement handling, and controlled backend profile
 * modifications in accordance with BIDWAR architecture and security contracts.
 */

import { db, membersTable, playersTable, organizersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger, maskPhoneNumber } from "../../logger";
import type { LanguagePreference, DeliveredTopicSummary } from "./session-manager";
import type { ResolvedIdentity } from "../conversation-router";

export type ConversationalIntentType =
  | "NAME_CHANGE_REQUEST"
  | "EXPLICIT_LANGUAGE_PREFERENCE"
  | "ROLE_OR_IDENTITY_CLAIM"
  | "FOLLOW_UP"
  | "APPRECIATION"
  | "EMOTIONAL_FRUSTRATION"
  | "EMOTIONAL_CONFUSION"
  | "GENUINE_FAQ"
  | "GENERAL_CONVERSATION";

export interface IntentDetectionResult {
  intent: ConversationalIntentType;
  confidence: number;
  extractedName?: string;
  explicitLanguage?: LanguagePreference;
  emotionalTone?: "frustration" | "confusion" | "appreciation" | "urgency" | "disappointment" | "neutral";
  details?: string;
}

export class ConversationalIntelligenceService {
  /**
   * Detect explicit language switch requests.
   */
  public detectExplicitLanguage(text: string): LanguagePreference | null {
    const clean = text.trim();
    if (
      /\b(?:talk\s+in\s+hindi|speak\s+(?:in\s+)?hindi|hindi\s+mein\s+(?:baat|batao|explain|bolo|kaho)|hindi\s+me\s+(?:baat|batao|explain|bolo)|hindi\s+bolo|switch\s+to\s+hindi|hindi\s+please)\b/i.test(clean) ||
      /^hindi$/i.test(clean)
    ) {
      return "hindi";
    }
    if (
      /\b(?:talk\s+in\s+english|speak\s+(?:in\s+)?english|english\s+mein\s+(?:baat|batao|explain|bolo)|ab\s+english\s+mein|in\s+english|switch\s+to\s+english|english\s+please)\b/i.test(clean) ||
      /^english$/i.test(clean)
    ) {
      return "english";
    }
    if (
      /\b(?:talk\s+in\s+hinglish|hinglish\s+mein|hinglish\s+me|switch\s+to\s+hinglish)\b/i.test(clean) ||
      /^hinglish$/i.test(clean)
    ) {
      return "hinglish";
    }
    return null;
  }

  /**
   * Infer natural language of utterance if no explicit preference is set.
   */
  public inferNaturalLanguage(text: string): LanguagePreference {
    const hindiWords = /\b(?:hai|karein|karna|chahiye|aap|karo|batao|dhanyawad|shukriya|mujhe|kaise|nahi|mera|aur|kya|haan|kaun|kab|kyun|bahut|bekar|dikkat|samajh|ek|bhi|tha|thi|the|hoga|ho|gaya|gayi|gaye|raha|rahi|rahe)\b/i;
    const englishWords = /\b(?:the|is|are|how|what|when|where|please|change|explain|feature|tournament|scoring|auction|price|pricing|details|register|setup)\b/i;

    const hasHindi = hindiWords.test(text);
    const hasEnglish = englishWords.test(text);

    if (hasHindi && hasEnglish) return "hinglish";
    if (hasHindi) return "hinglish"; // Prefer conversational Hinglish for modern Indian WhatsApp users
    return "english";
  }

  /**
   * Extract target name from name-change requests.
   */
  public extractRequestedName(text: string): string | undefined {
    const patterns = [
      /(?:please\s+)?(?:change|update|set)\s+(?:my\s+)?name\s+(?:in\s+(?:the\s+)?(?:db|database)\s+)?to\s+([A-Za-z][A-Za-z\s.'-]{1,50})/i,
      /(?:mera\s+)?naam\s+(?:badal\s+kar|change\s+karke|update\s+karke)?\s*([A-Za-z][A-Za-z\s.'-]{1,50})\s+(?:kar\s+do|rakh\s+do)/i,
      /(?:change|update)\s+name\s+to\s+([A-Za-z][A-Za-z\s.'-]{1,50})/i,
      /naam\s+([A-Za-z][A-Za-z\s.'-]{1,50})\s+karna\s+hai/i,
    ];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const cleanName = match[1]
          .replace(/\b(?:in\s+db|in\s+database|please|kripya|kar\s+do|in\s+profile)\b/gi, "")
          .trim()
          .replace(/[.,;!?]+$/, "")
          .trim();
        if (cleanName.length >= 2 && !/^(?:db|database|name|mera|kripya)$/i.test(cleanName)) {
          return cleanName;
        }
      }
    }
    return undefined;
  }

  /**
   * Core Conversational Intent Classification.
   */
  public detectIntent(
    text: string,
    historyLength: number = 0,
    preferredLanguage?: LanguagePreference
  ): IntentDetectionResult {
    const clean = text.trim();

    // 1. Name Change / Profile Modification Intent
    if (
      /\b(?:change\s+my\s+name|update\s+my\s+name|change\s+name\s+in\s+db|naam\s+badal|naam\s+change|naam\s+update)\b/i.test(clean) ||
      /\bname\s+in\s+db\b/i.test(clean)
    ) {
      const extractedName = this.extractRequestedName(clean);
      return {
        intent: "NAME_CHANGE_REQUEST",
        confidence: 0.95,
        extractedName,
      };
    }

    // 2. Explicit Language Switch Intent
    const explicitLang = this.detectExplicitLanguage(clean);
    if (explicitLang) {
      return {
        intent: "EXPLICIT_LANGUAGE_PREFERENCE",
        confidence: 0.98,
        explicitLanguage: explicitLang,
      };
    }

    // 3. Role / Identity Statement Intent
    if (
      /\b(?:i\s+am\s+(?:the\s+)?(?:owner|founder|creator|boss|admin|ceo)\s+of\s+bidwar)\b/i.test(clean) ||
      /\b(?:main\s+bidwar\s+ka\s+(?:owner|founder|malik)\s+hoon)\b/i.test(clean) ||
      /\b(?:i\s+am\s+(?:an?\s+)?(?:tournament\s+)?organizer|main\s+organizer\s+hoon)\b/i.test(clean)
    ) {
      return {
        intent: "ROLE_OR_IDENTITY_CLAIM",
        confidence: 0.9,
      };
    }

    // 4. Follow-Up Continuity Intent ("Aur batao", "explain more", "what else?")
    if (
      /\b(?:aur\s+batao|explain\s+more|what\s+else|uske\s+baare\s+mein\s+batao|tell\s+me\s+more|more\s+details|aage\s+batao|aur\s+kya\s+hai|wahi\s+jo\s+maine\s+pehle\s+bola|nahi,?\s*mera\s+matlab|ab\s+kya\s+karna\s+hai)\b/i.test(clean) ||
      /^aur\s+batao\??$/i.test(clean) ||
      /^what\s+else\??$/i.test(clean) ||
      /^more\??$/i.test(clean) ||
      /^aur\??$/i.test(clean)
    ) {
      return {
        intent: "FOLLOW_UP",
        confidence: 0.92,
      };
    }

    // 5. Appreciation Intent
    if (
      /\b(?:thanks,?\s*ho\s+gaya|thanks\s+a\s+lot|thank\s+you|bahut\s+shukriya|shukriya|dhanyawad|thanks\s+ho\s+gaya|done\s+thanks|awesome\s+thanks)\b/i.test(clean) ||
      /^thanks\??$/i.test(clean) ||
      /^thank\s+you\??$/i.test(clean) ||
      /^shukriya\??$/i.test(clean)
    ) {
      return {
        intent: "APPRECIATION",
        confidence: 0.95,
        emotionalTone: "appreciation",
      };
    }

    // 6. Emotional Frustration & Complaint Intent
    if (
      /\b(?:problem\s+aa\s+rahi\s+hai|bahut\s+bekar\s+experience|bekar\s+experience|kuch\s+kaam\s+nahi\s+kar\s+raha|error\s+aa\s+raha\s+hai|dimag\s+kharab|worst\s+experience|very\s+frustrated|not\s+working|stuck|pareshan)\b/i.test(clean)
    ) {
      const isDisappointment = /\b(?:bekar\s+experience|worst\s+experience)\b/i.test(clean);
      return {
        intent: "EMOTIONAL_FRUSTRATION",
        confidence: 0.92,
        emotionalTone: isDisappointment ? "disappointment" : "frustration",
      };
    }

    // 7. Emotional Confusion Intent
    if (
      /\b(?:kuch\s+samajh\s+nahi\s+aa\s+raha|samajh\s+nahi\s+aaya|confused|so\s+confusing|how\s+to\s+start)\b/i.test(clean)
    ) {
      return {
        intent: "EMOTIONAL_CONFUSION",
        confidence: 0.88,
        emotionalTone: "confusion",
      };
    }

    // 8. Genuine FAQ Inquiry (Direct question on what is BidWar / features / pricing)
    if (
      /\b(?:what\s+is\s+bidwar|bidwar\s+kya\s+hai|features\s+kya\s+hain|what\s+are\s+the\s+features|pricing\s+kya\s+hai|what\s+is\s+the\s+pricing|plans\s+batao|rate\s+kya\s+hai|how\s+much\s+does\s+it\s+cost)\b/i.test(clean)
    ) {
      return {
        intent: "GENUINE_FAQ",
        confidence: 0.9,
      };
    }

    return {
      intent: "GENERAL_CONVERSATION",
      confidence: 0.7,
      emotionalTone: "neutral",
    };
  }

  /**
   * Handle Name Change / Profile Modification Request.
   * Strictly enforces backend authorization and persistence checks.
   * Confirms ONLY after database write succeeds. Never gives Gemini DB access.
   */
  public async handleProfileModification(params: {
    mobile: string;
    text: string;
    identity: ResolvedIdentity;
    requestedName?: string;
    preferredLanguage?: LanguagePreference;
  }): Promise<{ handled: boolean; replyText: string; success: boolean }> {
    const { mobile, identity, requestedName, preferredLanguage } = params;
    const isEnglish = preferredLanguage === "english";

    if (!requestedName || requestedName.trim() === "") {
      const replyText = isEnglish
        ? "What name would you like to update to? Please reply with your desired name (for example: 'Please change my name to Tushar')."
        : "Aap apna naya naam kya rakhna chahte hain? Kripya batayein (jaise: 'Mera naam Tushar kar do').";
      return { handled: true, replyText, success: false };
    }

    const cleanName = requestedName.trim();

    // 1. Verified Canonical Member
    if (identity.kind === "member") {
      if (!identity.member.isMobileVerified) {
        logger.warn(
          { mobile: maskPhoneNumber(mobile) },
          "ProfileModification: Member mobile is unverified; rejecting name update request"
        );
        const replyText = isEnglish
          ? "Your mobile number is not verified on your BidWar account. For account security, please log in at https://bidwar.in to verify and update your profile."
          : "Aapka mobile number verify nahi hai. Security reasons se name change karne ke liye kripya https://bidwar.in par login karke profile settings se update karein.";
        return { handled: true, replyText, success: false };
      }

      if (identity.member.accountStatus !== "active") {
        const replyText = isEnglish
          ? `Your account is currently inactive (${identity.member.accountStatus}). Please contact support at bidwarsupport@gmail.com.`
          : `Aapka account active nahi hai (${identity.member.accountStatus}). Kripya bidwarsupport@gmail.com par sampark karein.`;
        return { handled: true, replyText, success: false };
      }

      // Controlled backend mutation
      try {
        const firstName = cleanName.split(" ")[0] ?? cleanName;
        await db
          .update(membersTable)
          .set({
            displayName: cleanName,
            firstName,
            updatedAt: new Date(),
          })
          .where(eq(membersTable.id, identity.member.id));

        logger.info(
          { memberId: identity.member.id, mobile: maskPhoneNumber(mobile), newName: cleanName },
          "ProfileModification: Member name updated successfully in database"
        );

        const replyText = isEnglish
          ? `Your name has been successfully updated to "${cleanName}" in your BidWar profile. You can see the change on the https://bidwar.in portal.`
          : `Aapka name successfully update ho kar "${cleanName}" save ho gaya hai. Aap ise bidwar.in portal par dekh sakte hain.`;

        return { handled: true, replyText, success: true };
      } catch (err) {
        logger.error(
          { err, mobile: maskPhoneNumber(mobile) },
          "ProfileModification: Database error updating member name"
        );
        const replyText = isEnglish
          ? "We encountered an issue saving your name update. Please try again in a few moments or contact support at +91 8707488250."
          : "Aapka naam update karne mein technical error aaya. Kripya thodi der baad koshish karein ya hamare support (+91 8707488250) se sampark karein.";
        return { handled: true, replyText, success: false };
      }
    }

    // 2. Legacy Target (Player or Organizer)
    if (identity.kind === "legacy") {
      if (identity.isAmbiguous || identity.targets.length !== 1) {
        const replyText = isEnglish
          ? "Multiple tournament records match this phone number. For data consistency, please log in at https://bidwar.in to manage your profile or reach our support team at +91 8707488250."
          : "Aapke number se ek se zyada records linked hain. Profile name update karne ke liye kripya https://bidwar.in par login karein ya hamare support (+91 8707488250) par call karein.";
        return { handled: true, replyText, success: false };
      }

      const target = identity.targets[0];
      try {
        if (target.type === "player") {
          await db
            .update(playersTable)
            .set({ name: cleanName })
            .where(eq(playersTable.id, target.id));
        } else if (target.type === "organizer") {
          await db
            .update(organizersTable)
            .set({ name: cleanName })
            .where(eq(organizersTable.id, target.id));
        }

        logger.info(
          { targetType: target.type, targetId: target.id, newName: cleanName },
          "ProfileModification: Legacy target name updated successfully"
        );

        const replyText = isEnglish
          ? `Your name has been successfully updated to "${cleanName}" in your tournament profile.`
          : `Aapka name successfully update ho kar "${cleanName}" save ho gaya hai. Aap ise bidwar.in portal par dekh sakte hain.`;
        return { handled: true, replyText, success: true };
      } catch (err) {
        logger.error(
          { err, targetId: target.id },
          "ProfileModification: Error updating legacy target name"
        );
        const replyText = isEnglish
          ? "We could not complete your name update due to a database error. Please contact support at +91 8707488250."
          : "Name update karne mein samasya aayi. Kripya hamare support (+91 8707488250) se sampark karein.";
        return { handled: true, replyText, success: false };
      }
    }

    // 3. Guest (Unauthenticated public user)
    const replyText = isEnglish
      ? "You are connected as a guest, and no registered BidWar account was found for this phone number. If you already have an account, please message from your registered phone number or sign up free at https://bidwar.in/organizer?tab=signup."
      : "Aap abhi ek guest user ke roop mein jude hain aur is number par koi registered BidWar account nahi mila. Agar aapka account hai toh kripya apne registered phone number se message karein, ya naya account banane ke liye https://bidwar.in/organizer?tab=signup par jayein.";
    return { handled: true, replyText, success: false };
  }

  /**
   * Handle Role or Identity Statements ("I am owner of BidWar").
   * Acknowledges naturally without privilege escalation or dumping the brochure.
   */
  public handleRoleStatement(preferredLanguage?: LanguagePreference): string {
    if (preferredLanguage === "english") {
      return "Understood! As the BidWar assistant, how can I assist you today with tournaments, auctions, or sports scoring?";
    }
    return "Aapka swagat hai! Main BidWar assistant hoon. Bataiye aaj tournaments, auctions ya scoring mein aapki kya sahayata kar sakta hoon?";
  }

  /**
   * Build Empathetic & Action-Oriented Response for emotional signals.
   */
  public buildEmotionalResponse(params: {
    intent: ConversationalIntentType;
    text: string;
    preferredLanguage?: LanguagePreference;
  }): string {
    const { intent, text, preferredLanguage } = params;
    const isEnglish = preferredLanguage === "english";

    if (intent === "APPRECIATION") {
      if (isEnglish) {
        return "You're very welcome! Feel free to ask if you need help with any other tournament setup or live scoring step.";
      }
      return "Bahut badhiya! Agar aage kisi step mein help chahiye ho toh bataiyega.";
    }

    if (intent === "EMOTIONAL_FRUSTRATION") {
      // Differentiate between bad experience vs setup trouble
      const isBadExperience = /\b(?:bekar\s+experience|worst\s+experience)\b/i.test(text);

      if (isBadExperience) {
        if (isEnglish) {
          return "I'm truly sorry you had a disappointing experience. I want to understand exactly what went wrong so we can resolve it for you. Could you share what specific issue occurred?";
        }
        return "Sorry, aapko aisa experience mila. Main samajhna chahta hoon ki exactly kya problem hui, taaki uska sahi solution nikal sakein.";
      }

      // Setup trouble / technical hurdle
      if (isEnglish) {
        return "I understand. Setting up a tournament can have several steps, so let's walk through it together step by step. Which screen or step are you currently on?";
      }
      return "Samajh raha hoon. Tournament setup mein dikkat aa rahi hai toh chaliye ek-ek step check karte hain. Aap abhi kis screen par hain?";
    }

    if (intent === "EMOTIONAL_CONFUSION") {
      if (isEnglish) {
        return "No worries at all! Let's simplify this. Are you looking to run a Player Auction or manage Live Match Scoring?";
      }
      return "Fikar mat kijiye, hum aasan shabdon mein samajhte hain. Aapko Player Auction karana hai ya Match Scoring setup karni hai?";
    }

    return "";
  }
}

export const conversationalIntelligence = new ConversationalIntelligenceService();
