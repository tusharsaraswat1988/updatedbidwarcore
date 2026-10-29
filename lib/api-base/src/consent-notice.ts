/**
 * Centralized, Versioned WhatsApp Consent Notice Definition
 *
 * Implements the BIDWAR WhatsApp Push Consent Notice Specification.
 * All consent collection channels (registration web forms, profile settings,
 * landing pages, team owner invites, scorer portals, and WhatsApp bot flows)
 * MUST reference this centralized notice definition.
 *
 * Note on Legal Status:
 * This implementation provides technical compliance mechanisms (notice versioning,
 * scope bounding, affirmative action capture, verifiable audit records, and withdrawal
 * mechanisms). Qualified Indian legal counsel must review the specific wording,
 * legal basis, and regulatory applicability under DPDP Act 2023.
 */

export const CURRENT_CONSENT_NOTICE_VERSION = "BIDWAR_WA_NOTICE_V1" as const;

export type ConsentScope = "tournament_operational" | "all_tournament_updates";

export interface NoticeLanguageContent {
  title: string;
  summary: string;
  body: string;
  checkboxLabel: string;
  withdrawalInstructions: string;
  privacyLinkText: string;
}

export interface ConsentNoticeSpecification {
  version: typeof CURRENT_CONSENT_NOTICE_VERSION;
  sender: string;
  defaultScope: ConsentScope;
  channels: ("whatsapp")[];
  purposes: {
    operational: string[];
    promotional: string[];
  };
  personalDataUsed: string[];
  privacyPolicyUrl: string;
  /**
   * Designated Grievance / Privacy contact email.
   * UNRESOLVED LEGAL / PRODUCT OWNER BLOCKER: A formal Data Protection Officer
   * or Grievance Officer has not yet been designated in company filings.
   * This placeholder email must be reviewed and confirmed by legal counsel.
   */
  grievanceContactEmail: string;
  content: {
    en: NoticeLanguageContent;
    hi: NoticeLanguageContent;
  };
  botPrompt: {
    hinglish: string;
    hindi: string;
    english: string;
  };
}

export const CONSENT_NOTICE_V1: ConsentNoticeSpecification = {
  version: CURRENT_CONSENT_NOTICE_VERSION,
  sender: "BIDWAR (Sports Management Platform)",
  defaultScope: "tournament_operational",
  channels: ["whatsapp"],
  purposes: {
    operational: [
      "Match schedules, venue directions, and timing updates",
      "Live score announcements and match result alerts",
      "Auction event notifications (player calls, bids, acquisition status)",
      "Team roster assignments and official tournament communications",
    ],
    promotional: [
      "Invitations to future tournaments and championships",
      "Platform feature announcements and organizer newsletters",
    ],
  },
  personalDataUsed: [
    "Full name",
    "Attributed mobile phone number",
    "Tournament and team affiliation",
  ],
  privacyPolicyUrl: "/privacy",
  grievanceContactEmail: "bidwarsupport@gmail.com",
  content: {
    en: {
      title: "WhatsApp Tournament Updates Consent",
      summary: "Receive real-time match updates, schedule changes, and auction alerts on WhatsApp.",
      body: "I authorize BIDWAR to send me tournament-related updates, schedule changes, match notifications, and auction alerts on WhatsApp to my registered mobile number. I understand this consent is completely voluntary, does not affect my tournament participation, and can be withdrawn at any time by replying STOP on WhatsApp or in my profile settings.",
      checkboxLabel: "Receive tournament updates, schedule changes, and auction alerts on WhatsApp (Optional)",
      withdrawalInstructions: "To withdraw consent at any time, reply 'STOP' or 'NO' on WhatsApp, or update your notification preferences in your BIDWAR profile.",
      privacyLinkText: "BIDWAR Privacy Notice",
    },
    hi: {
      title: "व्हाट्सएप टूर्नामेंट अपडेट्स सहमति",
      summary: "व्हाट्सएप पर रियल-टाइम मैच अपडेट, शेड्यूल बदलाव और नीलामी अलर्ट प्राप्त करें।",
      body: "मैं BIDWAR को अपने पंजीकृत मोबाइल नंबर पर टूर्नामेंट अपडेट, मैच शेड्यूल बदलाव और नीलामी अलर्ट व्हाट्सएप पर भेजने की सहमति देता/देती हूँ। मैं समझता/समझती हूँ कि यह सहमति पूरी तरह स्वैच्छिक है, मेरी टूर्नामेंट भागीदारी को प्रभावित नहीं करती है, और इसे व्हाट्सएप पर STOP लिखकर या अपनी प्रोफ़ाइल में कभी भी वापस लिया जा सकता है।",
      checkboxLabel: "व्हाट्सएप पर टूर्नामेंट अपडेट, मैच शेड्यूल और नीलामी अलर्ट प्राप्त करें (वैकल्पिक)",
      withdrawalInstructions: "सहमति वापस लेने के लिए कभी भी व्हाट्सएप पर 'STOP' या 'NO' भेजें, या अपनी BIDWAR प्रोफ़ाइल में सेटिंग बदलें।",
      privacyLinkText: "BIDWAR गोपनीयता सूचना",
    },
  },
  botPrompt: {
    hinglish:
      "Kya aap BidWar se match updates, auction alerts aur tournament notifications WhatsApp pe paana chahte hain?\n\nHan ke liye 'YES' bhejein\nNa ke liye 'NO' bhejein\n\n(Aap kisi bhi samay 'STOP' bhej kar unsubscribe kar sakte hain)",
    hindi:
      "क्या आप BidWar से मैच अपडेट, नीलामी अलर्ट और टूर्नामेंट सूचनाएं व्हाट्सएप पर पाना चाहते हैं?\n\nहाँ के लिए 'YES' भेजें\nना के लिए 'NO' भेजें\n\n(आप किसी भी समय 'STOP' भेजकर अनसब्सक्राइब कर सकते हैं)",
    english:
      "Would you like to receive tournament updates, match alerts, and auction notifications from BidWar on WhatsApp?\n\nReply 'YES' to accept\nReply 'NO' to decline\n\n(You can reply 'STOP' at any time to unsubscribe)",
  },
};

/**
 * Returns the active consent notice specification.
 */
export function getActiveConsentNotice(): ConsentNoticeSpecification {
  return CONSENT_NOTICE_V1;
}

/**
 * Helper to build a localized notice summary text for display.
 */
export function formatConsentNoticeSummary(lang: "en" | "hi" = "en"): string {
  const c = CONSENT_NOTICE_V1.content[lang] || CONSENT_NOTICE_V1.content.en;
  return `${c.title}\n\n${c.body}\n\n${c.withdrawalInstructions}`;
}
