import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 3500 }: Props) {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => onDismissRef.current(), durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed left-4 right-4 z-[80] pointer-events-none safe-bottom"
          style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto max-w-md rounded-2xl border border-[#3f3f46] bg-[#18181b]/95 px-4 py-3.5 shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold text-[#e4e4e7] text-center leading-snug">{message}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
