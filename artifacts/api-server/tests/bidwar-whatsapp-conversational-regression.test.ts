import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ConversationRouter } from "../src/lib/communication/conversation-router";
import * as commSender from "../src/lib/comm-sender";
import { db, membersTable, playersTable } from "@workspace/db";
import {
  guestAssistantService,
  conversationalIntelligence,
  audioTranscriptionService,
} from "../src/lib/communication/ai-assistant";

describe("BIDWAR WhatsApp AI — Conversational Intent & Anti-Repetition Regression Suite (P0)", () => {
  const router = new ConversationRouter();
  const MEMBER_MOBILE = "919876500001";
  const GUEST_MOBILE = "919876500099";

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GEMINI_API_KEY = "mock-key";
    process.env.GEMINI_MODEL = "gemini-2.5-flash";
    process.env.AI_ASSISTANT_ENABLED = "true";
    process.env.WHATSAPP_PROVIDER = "mock";
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();

    vi.spyOn(router, "isMessageAlreadyProcessed").mockResolvedValue(false);
    vi.spyOn(router, "recordProcessedInboundMessage").mockResolvedValue();
    vi.spyOn(commSender, "sendWhatsApp").mockResolvedValue({ success: true });

    // Mock db.insert and db.delete for session memory resilience
    vi.spyOn(db, "insert").mockImplementation((() => ({
      values: () => ({
        onConflictDoUpdate: async () => {},
        returning: async () => [{ id: 1, createdAt: new Date() }],
      }),
    })) as any);

    vi.spyOn(db, "delete").mockImplementation((() => ({
      where: async () => {},
    })) as any);
  });

  afterEach(() => {
    process.env = originalEnv;
    guestAssistantService.resetRateLimit();
    vi.restoreAllMocks();
  });

  // ─── 1. Profile Update Intent ("Change my name to Shanu", "Mera naam Shanu kar do") ─────────────
  describe("1. Profile Update Intent", () => {
    it("classifies 'Change my name to Shanu' as NAME_CHANGE_REQUEST and extracts 'Shanu'", () => {
      const result = conversationalIntelligence.detectIntent("Change my name to Shanu");
      expect(result.intent).toBe("NAME_CHANGE_REQUEST");
      expect(result.extractedName).toBe("Shanu");
    });

    it("classifies 'Mera naam Shanu kar do' as NAME_CHANGE_REQUEST and extracts 'Shanu'", () => {
      const result = conversationalIntelligence.detectIntent("Mera naam Shanu kar do");
      expect(result.intent).toBe("NAME_CHANGE_REQUEST");
      expect(result.extractedName).toBe("Shanu");
    });

    it("classifies 'Update my name to Tushar Saraswat' as NAME_CHANGE_REQUEST and extracts 'Tushar Saraswat'", () => {
      const result = conversationalIntelligence.detectIntent("Update my name to Tushar Saraswat");
      expect(result.intent).toBe("NAME_CHANGE_REQUEST");
      expect(result.extractedName).toBe("Tushar Saraswat");
    });

    it("classifies 'Change my name' without target name and prompts for desired name", async () => {
      const result = conversationalIntelligence.detectIntent("Change my name");
      expect(result.intent).toBe("NAME_CHANGE_REQUEST");
      expect(result.extractedName).toBeUndefined();

      const identity: any = {
        kind: "member",
        member: { id: 1, isMobileVerified: true, accountStatus: "active" },
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: MEMBER_MOBILE,
        from: `whatsapp:+${MEMBER_MOBILE}`,
        text: "Change my name",
        identity,
      });

      expect(reply.text).toContain("Aap apna naya naam kya rakhna chahte hain?");
    });

    it("executes database mutation and confirms 'Done, Shanu! Aapka naam successfully update ho gaya hai.'", async () => {
      let updateExecuted = false;
      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            if (data.displayName === "Shanu") {
              updateExecuted = true;
            }
          },
        }),
      })) as any);

      const identity: any = {
        kind: "member",
        member: {
          id: 42,
          displayName: "Old Name",
          primaryMobile: MEMBER_MOBILE,
          isMobileVerified: true,
          accountStatus: "active",
        },
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: MEMBER_MOBILE,
        from: `whatsapp:+${MEMBER_MOBILE}`,
        text: "Change my name to Shanu",
        identity,
      });

      expect(updateExecuted).toBe(true);
      expect(reply.text).toContain("Done, Shanu! Aapka naam successfully update ho gaya hai.");
      expect(reply.text).not.toContain("BidWar sports auction aur scoring par aapka sawal mila hai");
    });

    it("fails closed without claiming success when database mutation throws an error", async () => {
      vi.spyOn(db, "update").mockImplementation((() => ({
        set: () => ({
          where: async () => {
            throw new Error("Neon Postgres connection timeout");
          },
        }),
      })) as any);

      const identity: any = {
        kind: "member",
        member: {
          id: 42,
          displayName: "Old Name",
          primaryMobile: MEMBER_MOBILE,
          isMobileVerified: true,
          accountStatus: "active",
        },
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: MEMBER_MOBILE,
        from: `whatsapp:+${MEMBER_MOBILE}`,
        text: "Change my name to Shanu",
        identity,
      });

      expect(reply.text).toContain("technical error");
      expect(reply.text).not.toContain("successfully update ho gaya");
      expect(reply.text).not.toContain("Done, Shanu!");
    });

    it("rejects guest name change without claiming success and provides signup guidance", async () => {
      const identity: any = {
        kind: "guest",
        mobile: GUEST_MOBILE,
        displayName: "Guest",
      };

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Change my name to Shanu",
        identity,
      });

      expect(reply.text).toContain("registered BidWar account se linked nahi hai");
      expect(reply.text).not.toContain("Done, Shanu!");
      expect(reply.text).not.toContain("successfully update");
    });
  });

  // ─── 2. Casual Conversation & Bot Feedback Intent ──────────────────────────────
  describe("2. Casual Conversation & Bot Feedback Intent", () => {
    it("handles 'Kya haal-chaal?' with a natural Hindi/Hinglish casual response", async () => {
      const result = conversationalIntelligence.detectIntent("Kya haal-chaal?");
      expect(result.intent).toBe("CASUAL_CONVERSATION");

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Kya haal-chaal?",
      });

      expect(reply.text).toContain("Main badhiya hoon bhai! Tum sunao, kya haal hai?");
      expect(reply.text).not.toContain("• Real-time player bidding");
      expect(reply.text).not.toContain("Pricing: Free Trial");
    });

    it("handles 'Hi' as a natural warm greeting without dumping the brochure", async () => {
      const result = conversationalIntelligence.detectIntent("Hi");
      expect(result.intent).toBe("GREETING");

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Hi",
      });

      expect(reply.text).toMatch(/Hello bhai!|Kaise ho/i);
      expect(reply.text).not.toContain("• 1080p LED display");
      expect(reply.text).not.toContain("• Pricing: Free Trial");
    });

    it("handles 'Bhai aur batao' as a natural casual conversational inquiry", async () => {
      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Bhai aur batao",
      });

      expect(reply.text).toContain("Sab badhiya bhai!");
      expect(reply.text).not.toContain("BidWar sports auction aur scoring par aapka sawal mila hai");
    });

    it("acknowledges bot repetition feedback 'Bhai tumhare paas koi aur response nahi hai kya?' with self-aware humor", async () => {
      const result = conversationalIntelligence.detectIntent("Bhai tumhare paas koi aur response nahi hai kya?");
      expect(result.intent).toBe("BOT_FEEDBACK_REPETITION");

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "Bhai tumhare paas koi aur response nahi hai kya?",
      });

      expect(reply.text).toContain("Haha, sahi pakda bhai 😅");
      expect(reply.text).toContain("Main baar-baar wahi information repeat kar raha tha");
      expect(reply.text).not.toContain("• Real-time player bidding");
    });
  });

  // ─── 3. Audio / Voice Message Transcription Pathway ────────────────────────────
  describe("3. Audio / Voice Message Pathway", () => {
    it("processes voice message 'Kya haal-chaal?' via transcription into casual conversation", async () => {
      let dispatchedReply = "";
      vi.spyOn(commSender, "sendWhatsApp").mockImplementation(async (_to: string, body: string) => {
        dispatchedReply = body;
        return { success: true };
      });

      await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "",
        type: "audio",
        raw: {
          type: "audio",
          audio: { id: "media_audio_001", mime_type: "audio/ogg; codecs=opus" },
          transcript: "Kya haal-chaal?",
        },
      });

      expect(dispatchedReply).toContain("Main badhiya hoon bhai! Tum sunao, kya haal hai?");
      expect(dispatchedReply).not.toContain("BidWar sports auction aur scoring par aapka sawal mila hai");
    });

    it("processes voice message 'Mera naam Shanu kar do' into profile update execution", async () => {
      let updateExecuted = false;
      vi.spyOn(db, "update").mockImplementation((() => ({
        set: (data: any) => ({
          where: async () => {
            if (data.displayName === "Shanu") {
              updateExecuted = true;
            }
          },
        }),
      })) as any);

      vi.spyOn(router, "resolveIdentity").mockResolvedValue({
        kind: "member",
        member: {
          id: 77,
          displayName: "Old Player",
          primaryMobile: MEMBER_MOBILE,
          isMobileVerified: true,
          accountStatus: "active",
        },
      } as any);

      let dispatchedReply = "";
      vi.spyOn(commSender, "sendWhatsApp").mockImplementation(async (_to: string, body: string) => {
        dispatchedReply = body;
        return { success: true };
      });

      await router.processInboundMessage({
        from: MEMBER_MOBILE,
        channel: "whatsapp",
        text: "",
        type: "audio",
        raw: {
          type: "audio",
          transcript: "Mera naam Shanu kar do",
        },
      });

      expect(updateExecuted).toBe(true);
      expect(dispatchedReply).toContain("Done, Shanu! Aapka naam successfully update ho gaya hai.");
    });

    it("returns polite voice clarification when audio is unintelligible without sending brochure", async () => {
      let dispatchedReply = "";
      vi.spyOn(commSender, "sendWhatsApp").mockImplementation(async (_to: string, body: string) => {
        dispatchedReply = body;
        return { success: true };
      });

      // No transcript and no buffer provided
      await router.processInboundMessage({
        from: GUEST_MOBILE,
        channel: "whatsapp",
        text: "",
        type: "audio",
        raw: {
          type: "audio",
          audio: { id: "corrupt_audio_id" },
        },
      });

      expect(dispatchedReply).toContain("Aapka voice note theek se clear nahi sunai diya");
      expect(dispatchedReply).not.toContain("• Real-time player bidding");
      expect(dispatchedReply).not.toContain("• 1080p LED display");
    });
  });

  // ─── 4. Operational Scoring & Genuine Product Inquiries ─────────────────────────
  describe("4. Operational Scoring & Genuine Product Inquiries", () => {
    it("routes 'BPL ka score batao' to LIVE_SCORE_QUERY and not a generic brochure", async () => {
      const result = conversationalIntelligence.detectIntent("BPL ka score batao");
      expect(result.intent).toBe("LIVE_SCORE_QUERY");

      const mockTourneys = [
        {
          id: 4,
          name: "BidWar Premier League",
          city: "Kanpur",
          status: "active",
          sport: "cricket",
        },
      ];

      vi.spyOn(db, "select").mockImplementation((() => ({
        from: () => ({
          where: () => ({
            limit: () => mockTourneys,
          }),
          limit: () => mockTourneys,
        }),
      })) as any);

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "BPL ka score batao",
      });

      // Should return either the live matches or confirmation/schedule, NEVER the pricing brochure
      expect(reply.text).not.toContain("Pricing: Free Trial (2 teams), Starter");
      expect(reply.text).not.toContain("1080p LED stage display aur OBS live streaming");
    });

    it("routes 'BidWar kya hai?' to GENUINE_FAQ and returns the authoritative overview brochure", async () => {
      const result = conversationalIntelligence.detectIntent("BidWar kya hai?");
      expect(result.intent).toBe("GENUINE_FAQ");

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "BidWar kya hai?",
      });

      expect(reply.text).toContain("BidWar");
      expect(reply.text).toContain("player bidding");
    });

    it("routes short unintelligible queries ('asdf') to UNKNOWN_UNCLEAR with clarifying question", async () => {
      const result = conversationalIntelligence.detectIntent("asdf");
      expect(result.intent).toBe("UNKNOWN_UNCLEAR");

      const reply = await guestAssistantService.handleMessage({
        mobile: GUEST_MOBILE,
        from: `whatsapp:+${GUEST_MOBILE}`,
        text: "asdf",
      });

      expect(reply.text).toContain("Bhai, main samajh nahi paaya. Thoda aur bataoge?");
      expect(reply.text).not.toContain("• Real-time player bidding aur team owner");
    });
  });

  // ─── 5. Anti-Repetition Proof (Distinct Responses for Distinct Intents) ─────────
  describe("5. Distinct Intent Routing Proof", () => {
    it("proves that diverse intents do not all collapse into the same generic brochure", async () => {
      const testCases = [
        { text: "Change my name to Shanu", expectedIntent: "NAME_CHANGE_REQUEST" },
        { text: "Mera naam Shanu kar do", expectedIntent: "NAME_CHANGE_REQUEST" },
        { text: "Kya haal-chaal?", expectedIntent: "CASUAL_CONVERSATION" },
        { text: "Hi", expectedIntent: "GREETING" },
        { text: "Bhai aur batao", expectedIntent: "CASUAL_CONVERSATION" },
        { text: "Bhai tumhare paas koi aur response nahi hai kya?", expectedIntent: "BOT_FEEDBACK_REPETITION" },
        { text: "BidWar kya hai?", expectedIntent: "GENUINE_FAQ" },
        { text: "asdf", expectedIntent: "UNKNOWN_UNCLEAR" },
      ];

      const detectedIntents = testCases.map((tc) => ({
        text: tc.text,
        detected: conversationalIntelligence.detectIntent(tc.text).intent,
        expected: tc.expectedIntent,
      }));

      for (const item of detectedIntents) {
        expect(item.detected).toBe(item.expected);
      }

      // Check responses are not identical
      const r1 = await guestAssistantService.handleMessage({ mobile: GUEST_MOBILE, from: `+${GUEST_MOBILE}`, text: "Kya haal-chaal?" });
      const r2 = await guestAssistantService.handleMessage({ mobile: GUEST_MOBILE, from: `+${GUEST_MOBILE}`, text: "Bhai tumhare paas koi aur response nahi hai kya?" });
      const r3 = await guestAssistantService.handleMessage({ mobile: GUEST_MOBILE, from: `+${GUEST_MOBILE}`, text: "asdf" });

      expect(r1.text).not.toEqual(r2.text);
      expect(r1.text).not.toEqual(r3.text);
      expect(r2.text).not.toEqual(r3.text);
    });
  });
});
