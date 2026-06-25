import { Copy, MessageCircle, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type ShareButtonsProps = {
  url: string;
  shareText: string;
  compact?: boolean;
};

export function ShareButtons({ url, shareText, compact }: ShareButtonsProps) {
  const { toast } = useToast();
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;

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
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-border" onClick={() => void nativeShare()}>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 border-border" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" className="gap-1.5 border-border" onClick={() => void copyLink()}>
        <Copy className="h-3.5 w-3.5" />
        Copy link
      </Button>
      <Button type="button" size="sm" variant="outline" className="gap-1.5 border-border" asChild>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      </Button>
      <Button type="button" size="sm" variant="outline" className="gap-1.5 border-border" onClick={() => void nativeShare()}>
        <Share2 className="h-3.5 w-3.5" />
        Share
      </Button>
    </div>
  );
}
