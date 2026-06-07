import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LED_CODE_TITLE =
  "LED screen code — open the Big Screen on your projector laptop and enter this when prompted";

export function AuctionCodeBadge({
  code,
  className,
  title = LED_CODE_TITLE,
}: {
  code: string;
  className?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — clipboard may be blocked on insecure context
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? "Copied to clipboard" : title}
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold tracking-widest transition-all",
        "cursor-pointer active:scale-[0.98]",
        copied
          ? "border-green-500/50 bg-green-500/15 text-green-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
        className,
      )}
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" />
          <span>Copied</span>
        </>
      ) : (
        <span>{code}</span>
      )}
    </button>
  );
}
