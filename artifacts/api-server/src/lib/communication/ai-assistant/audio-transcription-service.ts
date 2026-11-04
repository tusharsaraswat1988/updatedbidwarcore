/**
 * BIDWAR WhatsApp Audio Transcription Service
 *
 * Transcribes incoming WhatsApp voice notes and audio clips into normalized text,
 * enabling voice messages to traverse the exact same semantic intent-routing
 * and operational execution pipeline as text messages.
 *
 * Follows strict resilience contracts:
 * - If transcription succeeds: passes clean text to intent classification.
 * - If audio is silent, unintelligible, or transcription fails: asks the user
 *   politely to repeat or type their query.
 * - NEVER silently substitutes a generic BIDWAR product brochure.
 */

import { logger } from "../../logger";

export interface AudioTranscriptionInput {
  mediaId?: string;
  audioBuffer?: Buffer;
  mimeType?: string;
  raw?: any;
}

export interface AudioTranscriptionResult {
  success: boolean;
  transcript?: string;
  error?: "unintelligible" | "unsupported_format" | "transcription_failed";
}

export class AudioTranscriptionService {
  /**
   * Transcribe an incoming voice note or audio clip.
   */
  public async transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult> {
    // 1. Check if an explicit transcript was provided in the inbound webhook envelope
    // (Common for Meta Speech-to-Text extensions, BSP voice transcription, or test harnesses)
    const directTranscript =
      input.raw?.transcript ??
      input.raw?.transcription ??
      input.raw?.voice?.transcript ??
      input.raw?.audio?.transcript ??
      input.raw?.text;

    if (typeof directTranscript === "string" && directTranscript.trim().length > 0) {
      return {
        success: true,
        transcript: directTranscript.trim(),
      };
    }

    // 2. If Gemini API is configured and audio bytes are available, perform multimodal speech transcription
    if (process.env.GEMINI_API_KEY?.trim() && input.audioBuffer && input.audioBuffer.length > 0) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY.trim() });
        const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

        const base64Audio = input.audioBuffer.toString("base64");
        const mimeType = input.mimeType || "audio/ogg";

        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Audio,
                  },
                },
                {
                  text: "Please transcribe the speech in this audio message accurately. It may be in Hindi, Hinglish, or English. Return ONLY the transcribed text without timestamps, notes, or explanations.",
                },
              ],
            },
          ],
        });

        const transcribed = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (transcribed && transcribed.length > 0) {
          return {
            success: true,
            transcript: transcribed,
          };
        }
      } catch (err) {
        logger.warn({ err }, "AudioTranscriptionService: Multimodal audio transcription failed");
      }
    }

    // 3. Audio note could not be transcribed or is silent/unintelligible
    return {
      success: false,
      error: "unintelligible",
    };
  }

  /**
   * Build polite Hinglish or English clarification when voice note cannot be transcribed.
   */
  public buildUnclearAudioReply(preferredLanguage?: string): string {
    if (preferredLanguage === "english") {
      return "I couldn't clearly hear your voice note. Could you please send it again or type your question in text?";
    }
    return "Aapka voice note theek se clear nahi sunai diya. Kripya dobara voice note bhejein ya text message mein likh kar bataein.";
  }
}

export const audioTranscriptionService = new AudioTranscriptionService();
