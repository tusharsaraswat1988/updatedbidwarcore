import { MessageCircle } from "lucide-react";

/**
 * WhatsApp Float — fixed-position quick-contact button.
 * Static CSS only (no framer-motion) — mounted after hydration by the page.
 */
export function WhatsAppFloat() {
  return (
    <a
      href="https://wa.me/918707488250?text=Hi%2C%20I%20want%20to%20run%20a%20sports%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20up%3F"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      data-analytics="whatsapp_float"
      className="fixed bottom-6 right-6 z-50 group flex items-center gap-3"
    >
      <span className="hidden sm:block bg-card border border-border text-xs font-semibold text-foreground px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
        Chat with us on WhatsApp
      </span>
      <div className="w-14 h-14 rounded-full flex items-center justify-center bg-green-500 hover:bg-green-600 transition-colors">
        <MessageCircle className="w-6 h-6 text-white fill-white" aria-hidden />
      </div>
    </a>
  );
}
