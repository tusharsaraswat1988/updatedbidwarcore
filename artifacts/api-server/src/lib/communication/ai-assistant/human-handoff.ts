/**
 * BidWar WhatsApp Human Handoff & Support Escalation Handler
 *
 * Detects visitor intent to speak with a human support agent or request a phone call,
 * and formats a polite, direct handoff card with verified BidWar support channels.
 */

import { SUPPORT_CONTACT } from "./knowledgebase";

const HANDOFF_PATTERNS = [
  // English phrases
  /\b(?:talk|speak|chat)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|agent|representative|expert|team|manager|someone)\b/i,
  /\b(?:call\s+me|call\s+back|phone\s+call|call\s+on\s+phone)\b/i,
  /\b(?:real\s+person|live\s+agent|human\s+support|customer\s+support|customer\s+care)\b/i,
  /\b(?:speak\s+with\s+executive|contact\s+support)\b/i,

  // Hindi / Hinglish phrases
  /\b(?:kisi\s+se\s+baat\s+karni\s+hai|mujhe\s+baat\s+karni\s+hai|baat\s+karni\s+hai)\b/i,
  /\b(?:kisi\s+se\s+baat\s+karwao|human\s+se\s+baat|agent\s+se\s+baat|team\s+se\s+baat)\b/i,
  /\b(?:call\s+karo|phone\s+karo|call\s+pe\s+baat|phone\s+pe\s+baat)\b/i,
  /\b(?:number\s+chahiye|support\s+number|contact\s+number\s+do|sampark\s+karna\s+hai)\b/i,
  /\b(?:mujhe\s+call\s+karein|direct\s+baat\s+karni\s+hai)\b/i,
];

export class HumanHandoffService {
  /**
   * Determine if user is requesting escalation or direct human assistance.
   */
  public isHandoffRequested(text: string): boolean {
    if (!text || text.trim() === "") return false;
    return HANDOFF_PATTERNS.some((pattern) => pattern.test(text));
  }

  /**
   * Generate authoritative human handoff message with verified contact channels.
   */
  public buildHandoffReply(userQuery: string): string {
    const isHindi = /(?:hai|karein|karna|chahiye|aap|karo|batao|dhanyawad|shukriya)/i.test(userQuery);

    if (isHindi) {
      return [
        "Aapka sawal note kar liya gaya hai. BidWar se judne aur aapke interest ke liye bahut shukriya!",
        "",
        "Aap hamare sports tournament team se directly connect kar sakte hain:",
        `📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}`,
        `💬 WhatsApp Direct Link: ${SUPPORT_CONTACT.whatsappUrl}`,
        `📧 Email: ${SUPPORT_CONTACT.email}`,
        `🏢 Office: ${SUPPORT_CONTACT.officeAddress}`,
        "",
        "Aap directly upar diye gaye number par WhatsApp message ya call kar sakte hain. Hamare experts aapse turant connect karke aapke tournament setup aur live demo me poori sahayata karenge.",
      ].join("\n");
    }

    return [
      "Thank you for reaching out and for your interest in BidWar! We truly appreciate your inquiry.",
      "",
      "You can connect directly with our tournament operations team:",
      `📞 Call / WhatsApp: ${SUPPORT_CONTACT.phone}`,
      `💬 WhatsApp Direct Link: ${SUPPORT_CONTACT.whatsappUrl}`,
      `📧 Email: ${SUPPORT_CONTACT.email}`,
      `🏢 Office: ${SUPPORT_CONTACT.officeAddress}`,
      "",
      "Our team is available to assist you with tournament setup, pricing consultation, and scheduling a live demo.",
    ].join("\n");
  }
}

export const humanHandoff = new HumanHandoffService();
