import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, QrCode, MessageCircle, Smartphone, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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

  const savings = parseInt(plan.price.replace(/[₹,]/g, ""), 10) - plan.discountedPrice;

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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none">
            <motion.div
              key="pay-modal"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              ref={modalRef}
              className="pointer-events-auto w-full sm:max-w-sm bg-[#111113] border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

              {/* Header */}
              <div className="relative px-6 pt-5 pb-4 border-b border-white/6">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
                  {plan.label} Plan
                </p>
                <div className="flex items-end gap-3">
                  <p className="text-4xl font-display font-black text-white leading-none">
                    ₹{plan.discountedPrice.toLocaleString("en-IN")}
                  </p>
                  <div className="mb-1 flex flex-col items-start gap-0.5">
                    <span className="text-xs text-white/30 line-through leading-none">
                      {plan.price}
                    </span>
                    <span className="text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-1.5 py-0.5 rounded-full leading-none">
                      Save ₹{savings.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-white/35 mt-1.5">
                  One-time · All taxes included
                </p>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-3 max-h-[70vh] overflow-y-auto">

                {/* Pay via UPI — primary CTA */}
                <a
                  href={upiLink}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all hover:shadow-[0_0_24px_rgba(234,179,8,0.35)]"
                >
                  <Smartphone className="w-4 h-4" />
                  Pay via UPI App
                </a>

                {/* QR Toggle */}
                <button
                  onClick={() => setShowQR(v => !v)}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 hover:text-white/80 transition-colors"
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
                      <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white">
                        <QRCodeSVG
                          value={upiLink}
                          size={180}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                        <p className="text-[10px] text-black/40 text-center font-medium">
                          Scan with any UPI app — PhonePe, GPay, Paytm
                        </p>
                        <button
                          onClick={handleCopyUPI}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/6 border border-black/10 hover:bg-black/10 transition-colors"
                        >
                          {copied
                            ? <Check className="w-3 h-3 text-green-600" />
                            : <Copy className="w-3 h-3 text-black/50" />
                          }
                          <span className="text-[10px] font-mono text-black/60">
                            {copied ? "Copied!" : UPI_ID}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider */}
                <div className="border-t border-white/6 pt-1" />

                {/* After payment note */}
                <p className="text-[11px] text-white/40 text-center leading-relaxed">
                  After payment, share your screenshot on WhatsApp to activate your license.
                </p>

                {/* WhatsApp button */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  Share Screenshot on WhatsApp
                </a>

                {/* Trust line */}
                <p className="text-[11px] text-white/20 text-center pb-1">
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
