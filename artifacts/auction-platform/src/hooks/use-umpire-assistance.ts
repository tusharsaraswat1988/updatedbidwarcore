import { useCallback, useEffect, useRef, useState } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  deriveUmpireAssistance,
  deriveVoiceAssistPrompts,
  type UmpireAssistanceSnapshot,
} from "@workspace/badminton-core";

const VOICE_KEY = "badminton:umpire-voice-assist:v1";

export function useVoiceAssistSetting() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { enabled, toggle };
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function useVoiceAssist(
  snapshot: UmpireAssistanceSnapshot,
  enabled: boolean,
) {
  const lastSpokenRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;
    const prompts = deriveVoiceAssistPrompts(snapshot);
    if (prompts.length === 0) return;
    const key = prompts.join("|");
    if (key === lastSpokenRef.current) return;
    lastSpokenRef.current = key;
    speak(prompts.join(". "));
  }, [enabled, snapshot]);
}

export function useUmpireAssistance(state: BadmintonMatchState) {
  const [courtChangeAcknowledged, setCourtChangeAcknowledged] = useState(false);
  const [readyToScore, setReadyToScore] = useState(true);
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const [readyConfirmReason, setReadyConfirmReason] = useState<
    "interval" | "court_change" | "timeout" | null
  >(null);
  const prevInIntervalRef = useRef(state.inInterval);
  const prevTimeoutRef = useRef(state.activeTimeout);
  const intervalKeyRef = useRef("");

  const intervalKey = `${state.currentGame}:${state.leftScore}:${state.rightScore}`;

  useEffect(() => {
    if (intervalKeyRef.current !== intervalKey) {
      intervalKeyRef.current = intervalKey;
      setCourtChangeAcknowledged(false);
    }
  }, [intervalKey]);

  useEffect(() => {
    if (prevInIntervalRef.current && !state.inInterval) {
      setReadyToScore(false);
      setShowReadyConfirm(true);
      setReadyConfirmReason("interval");
    }
    prevInIntervalRef.current = state.inInterval;
  }, [state.inInterval]);

  useEffect(() => {
    if (prevTimeoutRef.current && !state.activeTimeout) {
      setReadyToScore(false);
      setShowReadyConfirm(true);
      setReadyConfirmReason("timeout");
    }
    prevTimeoutRef.current = state.activeTimeout;
  }, [state.activeTimeout]);

  const snapshot = deriveUmpireAssistance(state, {
    courtChangeAcknowledged,
    readyToScore,
  });

  const confirmReady = useCallback(() => {
    setReadyToScore(true);
    setShowReadyConfirm(false);
    setReadyConfirmReason(null);
  }, []);

  const markCourtChangeAcknowledged = useCallback(() => {
    setCourtChangeAcknowledged(true);
    setReadyToScore(false);
    setShowReadyConfirm(true);
    setReadyConfirmReason("court_change");
  }, []);

  return {
    snapshot,
    courtChangeAcknowledged,
    markCourtChangeAcknowledged,
    readyToScore,
    showReadyConfirm,
    readyConfirmReason,
    confirmReady,
  };
}
