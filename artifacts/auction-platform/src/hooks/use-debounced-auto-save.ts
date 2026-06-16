import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSavePhase = "idle" | "pending" | "saving" | "saved" | "blocked" | "error";

type UseDebouncedAutoSaveOptions = {
  isDirty: boolean;
  saveKey: string;
  enabled: boolean;
  delayMs?: number;
  canSave: () => string | null;
  onSave: () => Promise<boolean>;
  onSaved?: () => void;
  onError?: (message: string) => void;
};

export function useDebouncedAutoSave({
  isDirty,
  saveKey,
  enabled,
  delayMs = 900,
  canSave,
  onSave,
  onSaved,
  onError,
}: UseDebouncedAutoSaveOptions) {
  const [phase, setPhase] = useState<AutoSavePhase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const rerunRef = useRef(false);
  const canSaveRef = useRef(canSave);
  const onSaveRef = useRef(onSave);
  const onSavedRef = useRef(onSaved);
  const onErrorRef = useRef(onError);

  canSaveRef.current = canSave;
  onSaveRef.current = onSave;
  onSavedRef.current = onSaved;
  onErrorRef.current = onError;

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const runSave = useCallback(async (options?: { notifySaved?: boolean }): Promise<boolean> => {
    const blockReason = canSaveRef.current();
    if (blockReason) {
      setPhase("blocked");
      return false;
    }

    if (savingRef.current) {
      rerunRef.current = true;
      return false;
    }

    savingRef.current = true;
    setPhase("saving");
    clearSavedTimer();

    try {
      const ok = await onSaveRef.current();
      if (ok) {
        setPhase("saved");
        if (options?.notifySaved !== false) {
          onSavedRef.current?.();
        }
        savedTimerRef.current = setTimeout(() => {
          setPhase("idle");
        }, 2500);
      } else {
        setPhase("error");
      }
      return ok;
    } catch {
      setPhase("error");
      onErrorRef.current?.("Could not save settings.");
      return false;
    } finally {
      savingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void runSave(options);
      }
    }
  }, [clearSavedTimer]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return runSave({ notifySaved: false });
  }, [runSave]);

  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isDirty) {
      return;
    }

    const blockReason = canSaveRef.current();
    if (blockReason) {
      setPhase("blocked");
      return;
    }

    setPhase("pending");

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void runSave();
    }, delayMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isDirty, saveKey, enabled, delayMs, runSave]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearSavedTimer();
  }, [clearSavedTimer]);

  return { phase, saveNow };
}
