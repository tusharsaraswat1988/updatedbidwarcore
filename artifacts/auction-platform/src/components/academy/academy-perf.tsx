import { lazy, memo, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

/** Mount children only when near the viewport — keeps below-fold JS off the critical path. */
export function DeferredMount({
  children,
  rootMargin = "240px",
  minHeight,
  fallback = null,
}: {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} style={minHeight ? { minHeight } : undefined}>
      {visible ? children : fallback}
    </div>
  );
}

export function LazySectionFallback({ className = "h-32" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/20 ${className}`} aria-hidden="true" />;
}

export function lazyAcademy<T extends React.ComponentType<object>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(factory);
}

export const Memoized = memo;
