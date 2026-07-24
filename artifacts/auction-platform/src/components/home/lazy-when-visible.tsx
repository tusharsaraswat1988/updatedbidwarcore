import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Reserved space while waiting / loading — prevents CLS. */
  minHeight?: string;
  /** Start loading this many px before the section enters the viewport. */
  rootMargin?: string;
};

/**
 * Progressive section loader: keeps below-fold code out of the critical path.
 * Mounts (and thus triggers React.lazy imports) only when near the viewport.
 */
export function LazyWhenVisible({
  children,
  minHeight = "24rem",
  rootMargin = "200px 0px",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={{ minHeight: visible ? undefined : minHeight }}>
      {visible ? (
        <Suspense
          fallback={
            <div
              className="w-full border-t border-border/20 bg-background"
              style={{ minHeight }}
              aria-hidden
            />
          }
        >
          {children}
        </Suspense>
      ) : (
        <div
          className="w-full border-t border-border/20 bg-background"
          style={{ minHeight }}
          aria-hidden
        />
      )}
    </div>
  );
}
