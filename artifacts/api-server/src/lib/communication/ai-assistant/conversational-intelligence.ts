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
  | "AUCTION_OVERVIEW_QUERY"
  | "TEAM_PURCHASE_QUERY"
  | "PLAYER_PERSONAL_QUERY"
  | "TEAM_OWNER_PERSONAL_QUERY"
  | "PLAYER_LOOKUP_QUERY"
  | "ACCESS_CODE_QUERY"
  | "LIVE_SCORE_QUERY"
  | "AFFIRMATION_CONFIRMATION"
  | "NEXT_MATCH_FOLLOWUP"
  | "GENERAL_CONVERSATION";

export interface IntentDetectionResult {
  intent: ConversationalIntentType;
  confidence: number;
  extractedName?: string;
  extractedPlayerName?: string;
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
   * Extract player name from player lookup queries (e.g. "Rohit Sharma ka auction status batao").
   */
  public extractPlayerName(text: string): string | undefined {
    const clean = text.trim();
    if (/\b(?:mera|meri|mujhe|main|team|teams|kaunsi|kis|abhi|live|bpl)\b/i.test(clean.split(/\s+/)[0])) {
      return undefined;
    }
    const match = clean.match(/^([A-Za-z][A-Za-z\s.'-]{2,40}?)\s+(?:ka|ki|ke)?\s*(?:auction\s+status|bidding|status|profile|kitne\s+mein\s+bika)\b/i);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!/^(?:mera|meri|mujhe|main|kis|kaunsi|abhi|live|tournament|match|team)$/i.test(name)) {
        return name;
      }
    }
    return undefined;
  }

  /**
   * Core Conversational Intent Classification.
   * Operational requests (Auction, Scoring, Access Code, Personal Status) take strict
   * precedence over generic product FAQs.
   */
  public detectIntent(
    text: string,
    historyLength: number = 0,
    preferredLanguage?: LanguagePreference
  ): IntentDetectionResult {
    const clean = text.trim();

    // 1. Access Code Request (Security Sensitive!)
    if (
      /\b(?:access\s*code|passcode|secret\s*code|team\s*code|login\s*code|owner\s*code|pin)\b/i.test(clean) &&
      /\b(?:batao|chahiye|kya\s+hai|de\s+do|provide|share|tell|show|get|code)\b/i.test(clean)
    ) {
      return {
        intent: "ACCESS_CODE_QUERY",
        confidence: 0.98,
      };
    }

    // 2. Affirmation / Confirmation (e.g. "Haan", "Yes", "Sahi hai", "Hanji", "Wahi")
    if (
      /^(?:haan|ha|han|hanji|haanji|yes|yeah|yup|sahi|sahi\s+hai|wahi|right|correct|sure|theek\s+hai|ha\s+bhai)$/i.test(clean) ||
      /\b(?:haan\s+wahi|sahi\s+hai\s+wahi|haan\s+batao|yes\s+please)\b/i.test(clean)
    ) {
      return {
        intent: "AFFIRMATION_CONFIRMATION",
        confidence: 0.95,
      };
    }

    // 3. Next Match Follow-up ("Aur dusre match ka?", "Dusra match", "Next match")
    if (
      /\b(?:dusre\s+match|dusra\s+match|next\s+match|other\s+match|agla\s+match)\b/i.test(clean)
    ) {
      return {
        intent: "NEXT_MATCH_FOLLOWUP",
        confidence: 0.95,
      };
    }

    // 4. Player Personal Inquiry ("Mera auction status kya hai?", "Mujhe kis team ne kharida?", "Meri bidding kitne mein hui?", "Main sold hua ya unsold?")
    if (
      /\b(?:mera\s+auction\s+status|mera\s+player\s+profile|mera\s+status|mera\s+sold\s+price|meri\s+bidding|main\s+sold\s+hua|main\s+unsold\s+raha|main\s+bik\s+gaya|mujhe\s+kis(?:i|\s+team\s+ne|\s+ne)\s+(?:kharida|liya)|mujhe\s+kitne\s+mein\s+(?:kharida|liya|bika))\b/i.test(clean) ||
      (/\b(?:mera|meri)\b/i.test(clean) && /\b(?:auction\s+status|sold\s+price|bidding\s+amount|player\s+profile)\b/i.test(clean))
    ) {
      return {
        intent: "PLAYER_PERSONAL_QUERY",
        confidence: 0.95,
      };
    }

    // 5. Team Owner Personal Inquiry ("Meri team ne kitne players kharide?", "Mere paas kitna purse bacha hai?", "Meri team ke players kaun hain?", "Meri team ka auction status")
    if (
      /\b(?:meri\s+team\s+ne\s+kitne\s+players|mere\s+paas\s+kitna\s+purse|meri\s+team\s+ke\s+players|meri\s+team\s+ka\s+auction\s+status|meri\s+team\s+ne\s+kitni\s+bidding|meri\s+team\s+ka\s+purse|mera\s+purse\s+kitna|meri\s+team\s+ka\s+budget)\b/i.test(clean) ||
      (/\b(?:meri\s+team|mere\s+paas)\b/i.test(clean) && /\b(?:purse\s+bacha|budget\s+bacha|players\s+kharide|kitni\s+bidding)\b/i.test(clean))
    ) {
      return {
        intent: "TEAM_OWNER_PERSONAL_QUERY",
        confidence: 0.95,
      };
    }

    // 6. Team-wise Purchases Inquiry ("Kaunsi team ne kitne players kharide?", "Kaunsi team ne kitne players liye?")
    if (
      /\b(?:kaunsi\s+team\s+ne\s+kitne|kis\s+team\s+ne\s+kitne|teams\s+ne\s+kitne\s+players|team\s*wise\s+purchases|team\s*wise\s+players)\b/i.test(clean) ||
      (/\b(?:kaunsi\s+team|kis\s+team|teams)\b/i.test(clean) && /\b(?:players\s+(?:kharide|liye)|purchase|squad)\b/i.test(clean))
    ) {
      return {
        intent: "TEAM_PURCHASE_QUERY",
        confidence: 0.92,
      };
    }

    // 7. Player Lookup Query ("Rohit Sharma ka auction status batao", "<Player> ka status batao")
    const extractedPlayer = this.extractPlayerName(clean);
    if (extractedPlayer && /\b(?:auction|status|bidding|bika|kharida|sold|unsold)\b/i.test(clean)) {
      return {
        intent: "PLAYER_LOOKUP_QUERY",
        confidence: 0.92,
        extractedPlayerName: extractedPlayer,
      };
    }

    // 8. Live Score Query ("Kanpur mein chal rahe BPL ka score batao", "Live score kya hai?", "Score batao", "scor batao", "skor")
    if (
      /\b(?:score|scores|scor|skor|live\s+score|match\s+ka\s+score|score\s+batao|kya\s+score\s+hai|live\s+match)\b/i.test(clean)
    ) {
      return {
        intent: "LIVE_SCORE_QUERY",
        confidence: 0.92,
      };
    }

    // 9. Auction Overview Query ("Abhi auction mein kya chal raha hai?", "Kitne players sold ho chuke hain?", "Auction live hai kya?", "Auction mein kitne players remaining hain?")
    if (
      /\b(?:auction\s+mein\s+kya\s+chal\s+raha|kitne\s+players\s+sold|kitne\s+players\s+bik|auction\s+live\s+hai\s+kya|auction\s+status|remaining\s+players|unsold\s+players|sold\s+players|auction\s+update|auction\s+kaisa\s+chal\s+raha)\b/i.test(clean) ||
      (/\bauction\b/i.test(clean) && /\b(?:kya\s+chal|status|kitne|live|chal\s+raha|remaining|sold|unsold)\b/i.test(clean))
    ) {
      return {
        intent: "AUCTION_OVERVIEW_QUERY",
        confidence: 0.92,
      };
    }

    // 10. Name Change / Profile Modification Intent
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

    // 11. Explicit Language Switch Intent
    const explicitLang = this.detectExplicitLanguage(clean);
    if (explicitLang) {
      return {
        intent: "EXPLICIT_LANGUAGE_PREFERENCE",
        confidence: 0.98,
        explicitLanguage: explicitLang,
      };
    }

    // 12. Role / Identity Statement Intent
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

    // 13. Follow-Up Continuity Intent ("Aur batao", "explain more", "what else?")
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

    // 14. Appreciation Intent
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

    // 15. Emotional Frustration & Complaint Intent
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

    // 16. Emotional Confusion Intent
    if (
      /\b(?:kuch\s+samajh\s+nahi\s+aa\s+raha|samajh\s+nahi\s+aaya|confused|so\s+confusing|how\s+to\s+start)\b/i.test(clean)
    ) {
      return {
        intent: "EMOTIONAL_CONFUSION",
        confidence: 0.88,
        emotionalTone: "confusion",
      };
    }

    // 17. Genuine FAQ Inquiry (Direct question on what is BidWar / features / pricing)
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
