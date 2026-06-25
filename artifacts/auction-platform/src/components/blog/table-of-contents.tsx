import { useState, useEffect } from "react";
import { cn } from "../../lib/utils.ts";

interface TocItem {
  id: string;
  title: string;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headings = items
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "0px 0px -60% 0px", threshold: 0 }
    );

    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav className="rounded-xl border border-border bg-card/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        On this page
      </p>
      <ol className="space-y-1.5">
        {items.map(({ id, title }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(id);
              }}
              className={cn(
                "block text-sm leading-snug transition-colors",
                activeId === id
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
