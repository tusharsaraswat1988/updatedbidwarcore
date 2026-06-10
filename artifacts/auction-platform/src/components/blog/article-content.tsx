import { type Block } from "@workspace/blog-data";
import { Lightbulb, AlertTriangle, Info } from "lucide-react";
import { cn } from "../../lib/utils.ts";

/**
 * Renders inline markup:  **bold**, _italic_, `code`, and [text](url)
 */
function InlineText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns: Array<{ re: RegExp; render: (match: string, inner: string, href?: string) => React.ReactNode }> = [
    {
      re: /\*\*(.+?)\*\*/,
      render: (_, inner) => <strong key={key++} className="font-semibold text-foreground">{inner}</strong>,
    },
    {
      re: /_(.+?)_/,
      render: (_, inner) => <em key={key++}>{inner}</em>,
    },
    {
      re: /`([^`]+)`/,
      render: (_, inner) => (
        <code key={key++} className="text-xs font-mono bg-card/80 border border-border rounded px-1 py-0.5 text-yellow-300">
          {inner}
        </code>
      ),
    },
    {
      re: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (_, inner, href) => (
        <a key={key++} href={href} className="text-primary underline underline-offset-2 hover:no-underline" target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}>
          {inner}
        </a>
      ),
    },
  ];

  while (remaining) {
    let earliest: { index: number; length: number; node: React.ReactNode } | null = null;

    for (const { re, render } of patterns) {
      const m = remaining.match(re);
      if (m && m.index !== undefined) {
        if (earliest === null || m.index < earliest.index) {
          earliest = {
            index: m.index,
            length: m[0].length,
            node: render(m[0], m[1], m[2]),
          };
        }
      }
    }

    if (!earliest) {
      parts.push(remaining);
      break;
    }

    if (earliest.index > 0) {
      parts.push(remaining.slice(0, earliest.index));
    }
    parts.push(earliest.node);
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return <>{parts}</>;
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 id={block.id} className="text-xl md:text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
          <InlineText text={block.text ?? ""} />
        </h2>
      );

    case "h3":
      return (
        <h3 id={block.id} className="text-lg font-semibold text-foreground mt-7 mb-3 scroll-mt-24">
          <InlineText text={block.text ?? ""} />
        </h3>
      );

    case "p":
      return (
        <p className="text-muted-foreground leading-relaxed mb-4">
          <InlineText text={block.text ?? ""} />
        </p>
      );

    case "ul":
      return (
        <ul className="space-y-2 mb-4 pl-1">
          {(block.items ?? []).map((item, i) => (
            <li key={i} className="flex gap-2 text-muted-foreground leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="space-y-2 mb-4 pl-1">
          {(block.items ?? []).map((item, i) => (
            <li key={i} className="flex gap-3 text-muted-foreground leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span><InlineText text={item} /></span>
            </li>
          ))}
        </ol>
      );

    case "steps":
      return (
        <div className="mb-6">
          {block.heading && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              {block.heading}
            </p>
          )}
          <ol className="space-y-3">
            {(block.items ?? []).map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-primary text-black text-xs font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  <InlineText text={item} />
                </p>
              </li>
            ))}
          </ol>
        </div>
      );

    case "tip":
      return (
        <div className="my-5 flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <Lightbulb className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            {block.heading && (
              <p className="text-sm font-semibold text-emerald-400 mb-1">{block.heading}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              <InlineText text={block.text ?? ""} />
            </p>
          </div>
        </div>
      );

    case "warning":
      return (
        <div className="my-5 flex gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
          <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            {block.heading && (
              <p className="text-sm font-semibold text-orange-400 mb-1">{block.heading}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              <InlineText text={block.text ?? ""} />
            </p>
          </div>
        </div>
      );

    case "callout":
      return (
        <div className="my-5 flex gap-3 rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
          <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            {block.heading && (
              <p className="text-sm font-semibold text-blue-400 mb-1">{block.heading}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              <InlineText text={block.text ?? ""} />
            </p>
          </div>
        </div>
      );

    case "hr":
      return <hr className="my-8 border-border" />;

    default:
      return null;
  }
}

interface ArticleContentProps {
  blocks: Block[];
  className?: string;
}

export function ArticleContent({ blocks, className }: ArticleContentProps) {
  return (
    <div className={cn("max-w-none", className)}>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}
