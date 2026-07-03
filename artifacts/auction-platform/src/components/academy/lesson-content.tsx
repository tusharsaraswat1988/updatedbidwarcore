import { memo, type ReactNode } from "react";
import type { LessonHeading } from "@/lib/academy-headings";
import type { AcademyContentFormat } from "@/lib/academy-public";

function renderMarkdownParagraph(text: string, headings: LessonHeading[]) {
  const headingByText = new Map(headings.map((h) => [h.text, h.id]));
  const lines = text.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 text-muted-foreground">
          {listItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }
    const h = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (h) {
      flushList();
      const textContent = h[1]!;
      const id = headingByText.get(textContent);
      const Tag = trimmed.startsWith("###") ? "h3" : "h2";
      elements.push(
        <Tag
          key={`h-${elements.length}`}
          id={id}
          className={`scroll-mt-24 font-bold text-foreground ${Tag === "h2" ? "text-xl mt-8 mb-3" : "text-lg mt-6 mb-2"}`}
        >
          {textContent}
        </Tag>,
      );
      continue;
    }
    const bullet = trimmed.match(/^[-*•]\s+(.+)$/);
    if (bullet) {
      listItems.push(bullet[1]!);
      continue;
    }
    flushList();
    elements.push(
      <p key={`p-${elements.length}`} className="text-muted-foreground leading-relaxed mb-4">
        {trimmed}
      </p>,
    );
  }
  flushList();
  return elements;
}

interface LessonContentProps {
  content: string | null;
  format: AcademyContentFormat;
  headings?: LessonHeading[];
}

export const LessonContent = memo(function LessonContent({ content, format, headings = [] }: LessonContentProps) {
  if (!content?.trim()) {
    return <p className="text-muted-foreground">No written notes for this lesson yet.</p>;
  }

  if (format === "html") {
    return (
      <div
        className="prose prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:text-foreground prose-p:text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  if (format === "markdown") {
    return <div className="space-y-1">{renderMarkdownParagraph(content, headings)}</div>;
  }

  return (
    <div className="space-y-4">
      {content.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {para.trim()}
        </p>
      ))}
    </div>
  );
});
