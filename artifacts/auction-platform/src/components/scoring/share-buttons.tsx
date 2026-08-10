import { Copy, MessageCircle, Share2 } from "lucide-react";
import { BtnSecondary, btnCompactClass } from "@/components/badminton/page-chrome";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ShareButtonsProps = {
  url: string;
  shareText: string;
  compact?: boolean;
};

export function ShareButtons({ url, shareText, compact }: ShareButtonsProps) {
  const { toast } = useToast();
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const sizeClass = compact ? cn(btnCompactClass, "h-8 min-h-8") : btnCompactClass;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" });
    }
  }

  async function nativeShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareText, url });
        return;
      } catch {
        // user cancelled or unsupported
      }
    }
    void copyLink();
  }

  if (compact) {
    return (
      <div className="flex gap-2">
        <BtnSecondary className={sizeClass} onClick={() => void nativeShare()}>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </BtnSecondary>
        <BtnSecondary href={whatsappHref} className={sizeClass}>
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </BtnSecondary>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <BtnSecondary className={sizeClass} onClick={() => void copyLink()}>
        <Copy className="h-3.5 w-3.5" />
        Copy link
      </BtnSecondary>
      <BtnSecondary href={whatsappHref} className={sizeClass}>
        <MessageCircle className="h-3.5 w-3.5" />
        WhatsApp
      </BtnSecondary>
      <BtnSecondary className={sizeClass} onClick={() => void nativeShare()}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </BtnSecondary>
    </div>
  );
}
