import { useCallback, useEffect, useRef, useState } from "react";

export type AutoSavePhase = "idle" | "pending" | "saving" | "saved" | "blocked" | "error";

export type SaveResult = boolean | { ok: boolean; error?: string };

type UseDebouncedAutoSaveOptions = {
  isDirty: boolean;
  saveKey: string;
  enabled: boolean;
  delayMs?: number;
  canSave: () => string | null;
  onSave: () => Promise<SaveResult>;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const runSave = useCallback(async (options?: { notifyUser?: boolean }): Promise<boolean> => {
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
      const res = await onSaveRef.current();
      const ok = typeof res === "boolean" ? res : res.ok;
      const errorMsg = typeof res === "object" && !res.ok ? res.error : undefined;

      if (ok) {
        setErrorMessage(null);
        setPhase("saved");
        if (options?.notifyUser !== false) {
          onSavedRef.current?.();
        }
        savedTimerRef.current = setTimeout(() => {
          setPhase("idle");
        }, 2500);
      } else {
        const msg = errorMsg || "Could not save settings. Please try again.";
        setErrorMessage(msg);
        setPhase("error");
        if (options?.notifyUser !== false) {
          onErrorRef.current?.(msg);
        }
      }
      return ok;
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ||
        (err as Error)?.message ||
        "Could not save settings. Please try again.";
      setErrorMessage(msg);
      setPhase("error");
      if (options?.notifyUser !== false) {
        onErrorRef.current?.(msg);
      }
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
    return runSave({ notifyUser: false });
  }, [runSave]);

  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isDirty) {
      setErrorMessage(null);
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

  return { phase, errorMessage, saveNow };
}
