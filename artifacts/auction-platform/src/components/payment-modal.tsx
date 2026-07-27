import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, QrCode, MessageCircle, Smartphone, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AuctionLicenseInfo } from "@/components/auction-license-info";

export interface PaymentPlan {
  label: string;
  price: string;
  discountedPrice: number;
}

interface PaymentModalProps {
  plan: PaymentPlan | null;
  onClose: () => void;
}

const UPI_ID = "pinelabs.stq4617963@pineaxis";

export function PaymentModal({ plan, onClose }: PaymentModalProps) {
  // Default QR open on desktop (≥640px), collapsed on mobile
  const [showQR, setShowQR] = useState(() => typeof window !== "undefined" && window.innerWidth >= 640);
  const [copied, setCopied] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard: Escape to close + Tab focus trap
  useEffect(() => {
    if (!plan) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    // Move focus into modal on open
    const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [plan, onClose]);

  // Reset state when plan changes (new plan opened)
  useEffect(() => {
    setShowQR(typeof window !== "undefined" && window.innerWidth >= 640);
    setCopied(false);
  }, [plan?.label]);

  if (!plan) return null;

  const upiLink = `upi://pay?pa=${UPI_ID}&pn=BidWar&am=${plan.discountedPrice}&tn=${encodeURIComponent(plan.label + " Plan")}&cu=INR`;

  const waText = encodeURIComponent(
    `Hi BidWar Team, I have completed payment for ${plan.label} Plan. Sharing payment screenshot below.`
  );
  const waLink = `https://wa.me/918707488250?text=${waText}`;

  const originalPrice = parseInt(plan.price.replace(/[₹,]/g, ""), 10);
  const savings = Number.isFinite(originalPrice) ? originalPrice - plan.discountedPrice : 0;
  const hasSavings = savings > 0;

  function handleCopyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <AnimatePresence>
      {plan && (
        <>
          {/* Backdrop */}
          <motion.div
            key="pay-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="lovable-home fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
            <motion.div
              key="pay-modal"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              ref={modalRef}
              className="panel pointer-events-auto flex w-full max-h-[92vh] sm:max-h-[85vh] flex-col overflow-hidden rounded-t-2xl sm:max-w-[22rem] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full shrink-0 bg-[image:var(--gradient-gold)]" />

              {/* Header */}
              <div className="relative shrink-0 border-b border-white/8 px-5 pb-3 pt-4">
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {plan.label} Plan
                </p>
                <div className="flex items-end gap-2.5">
                  <p className="text-3xl font-display font-black leading-none text-foreground">
                    ₹{plan.discountedPrice.toLocaleString("en-IN")}
                  </p>
                  {hasSavings && (
                    <div className="mb-0.5 flex flex-col items-start gap-0.5">
                      <span className="text-xs leading-none text-muted-foreground line-through">
                        {plan.price}
                      </span>
                      <span className="rounded-full border border-green-400/20 bg-green-400/10 px-1.5 py-0.5 text-[10px] font-bold leading-none text-green-400">
                        Save ₹{savings.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  One-time · All taxes included
                </p>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-5 py-4">

                <AuctionLicenseInfo variant="checkout" />

                {/* Pay via UPI — primary CTA */}
                <a
                  href={upiLink}
                  className="gold-button gold-button-hover flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm active:scale-[0.98]"
                >
                  <Smartphone className="w-4 h-4" />
                  Pay via UPI App
                </a>

                {/* QR Toggle */}
                <button
                  onClick={() => setShowQR(v => !v)}
                  className="ghost-button ghost-button-hover flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs normal-case"
                >
                  <QrCode className="w-4 h-4" />
                  {showQR ? "Hide QR Code" : "Show QR Code"}
                </button>

                {/* QR Code panel */}
                <AnimatePresence initial={false}>
                  {showQR && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col items-center gap-2.5 rounded-xl bg-white p-3">
                        <QRCodeSVG
                          value={upiLink}
                          size={140}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                        <p className="text-center text-[10px] font-medium text-black/40">
                          Scan with any UPI app — PhonePe, GPay, Paytm
                        </p>
                        <button
                          onClick={handleCopyUPI}
                          className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/6 px-3 py-1.5 transition-colors hover:bg-black/10"
                        >
                          {copied
                            ? <Check className="w-3 h-3 text-green-600" />
                            : <Copy className="w-3 h-3 text-black/50" />
                          }
                          <span className="font-mono text-[10px] text-black/60">
                            {copied ? "Copied!" : UPI_ID}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="border-t border-white/8 pt-0.5" />

                {/* After payment note */}
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  After payment, share your screenshot on WhatsApp to activate your license.
                </p>

                {/* WhatsApp button */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  Share Screenshot on WhatsApp
                </a>

                {/* Trust line */}
                <p className="pb-0.5 text-center text-[11px] text-muted-foreground/60">
                  License activation usually completed within minutes.
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
