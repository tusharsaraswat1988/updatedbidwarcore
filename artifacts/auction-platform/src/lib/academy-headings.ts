import type { AcademyContentFormat } from "@/lib/academy-public";

export type LessonHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractLessonHeadings(content: string | null, format: AcademyContentFormat): LessonHeading[] {
  if (!content?.trim()) return [];

  const headings: LessonHeading[] = [];
  const usedIds = new Set<string>();

  const push = (text: string, level: 2 | 3) => {
    const base = slugifyHeading(text) || `section-${headings.length + 1}`;
    let id = base;
    let n = 2;
    while (usedIds.has(id)) {
      id = `${base}-${n++}`;
    }
    usedIds.add(id);
    headings.push({ id, text: text.trim(), level });
  };

  if (format === "html") {
    const re = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = re.exec(content))) {
      const text = match[2]!.replace(/<[^>]+>/g, "").trim();
      if (text) push(text, Number(match[1]) as 2 | 3);
    }
    return headings;
  }

  for (const line of content.split("\n")) {
    const md = line.match(/^#{2,3}\s+(.+)$/);
    if (md) {
      push(md[1]!, line.startsWith("###") ? 3 : 2);
    }
  }

  return headings;
}
