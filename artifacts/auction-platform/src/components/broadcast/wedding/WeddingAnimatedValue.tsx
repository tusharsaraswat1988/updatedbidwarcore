import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface WeddingAnimatedValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: string | number;
  className?: string;
  style?: React.CSSProperties;
  flashColor?: string;
}

/**
 * WeddingAnimatedValue
 * High-performance, dignified number transition for television scorebugs.
 *
 * Guarantees:
 * - Stable geometry with tabular numerals (`tabular-nums`) to prevent layout shift.
 * - Subtle vertical roll transition (0.2s) without disruptive motion.
 * - Respects prefers-reduced-motion.
 * - SSR safe.
 */
export function WeddingAnimatedValue({
  value,
  className = "",
  style,
  flashColor,
  ...rest
}: WeddingAnimatedValueProps) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, []);

  const hasChanged = prevValueRef.current !== value;
  useEffect(() => {
    prevValueRef.current = value;
  }, [value]);

  if (reducedMotion) {
    return (
      <span
        className={`wedding-animated-value tabular-nums select-none ${className}`}
        style={style}
        {...rest}
      >
        {value}
      </span>
    );
  }

  return (
    <span
      className={`wedding-animated-value relative inline-flex items-baseline overflow-hidden tabular-nums select-none ${className}`}
      style={{ verticalAlign: "baseline", ...style }}
      {...rest}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={String(value)}
          initial={{ y: hasChanged ? 8 : 0, opacity: hasChanged ? 0.35 : 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block tabular-nums"
          style={{
            color: flashColor && hasChanged ? flashColor : undefined,
          }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
