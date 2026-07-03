import { useState } from "react";
import { Check, Copy, Linkedin, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LessonShareBarProps {
  url: string;
  title: string;
}

export function LessonShareBar({ url, title }: LessonShareBarProps) {
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback ignored */
    }
  }

  async function nativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* cancelled */
      }
    } else {
      copyLink();
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy link"}
      </Button>
      <Button type="button" size="sm" variant="outline" className="gap-1.5 md:hidden" onClick={nativeShare}>
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      <Button size="sm" variant="outline" className="hidden md:inline-flex" asChild>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on LinkedIn"
        >
          <Linkedin className="h-4 w-4" />
        </a>
      </Button>
      <Button size="sm" variant="outline" className="hidden md:inline-flex" asChild>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
        >
          𝕏
        </a>
      </Button>
      <Button size="sm" variant="outline" className="hidden md:inline-flex" asChild>
        <a
          href={`https://wa.me/?text=${encodedTitle}%20${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
        >
          WhatsApp
        </a>
      </Button>
    </div>
  );
}
