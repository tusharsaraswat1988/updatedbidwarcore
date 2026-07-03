import { memo } from "react";
import type { LessonHeading } from "@/lib/academy-headings";

interface LessonTableOfContentsProps {
  headings: LessonHeading[];
}

export const LessonTableOfContents = memo(function LessonTableOfContents({
  headings,
}: LessonTableOfContentsProps) {
  if (headings.length < 2) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="rounded-xl border border-border bg-card/30 p-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
    >
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        On this page
      </h2>
      <ol className="space-y-2 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "pl-3" : undefined}>
            <a
              href={`#${h.id}`}
              className="text-muted-foreground hover:text-primary transition-colors line-clamp-2"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
});
