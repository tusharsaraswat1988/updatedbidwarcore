import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, QrCode, MessageCircle, Smartphone, Copy, Check, Landmark, ShieldCheck } from "lucide-react";
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

const BANK_DETAILS = {
  accountName: "CWPDETAILERS AND MOTORS",
  accountNumber: "42105505194",
  ifsc: "SBIN0001773",
  bankName: "State Bank of India (SBI)",
  branch: "Bhelupura, Varanasi",
};

export function PaymentModal({ plan, onClose }: PaymentModalProps) {
  const [method, setMethod] = useState<"upi" | "bank">("upi");
  const [showQR, setShowQR] = useState(() => typeof window !== "undefined" && window.innerWidth >= 640);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isDesktop = typeof window !== "undefined" && window.innerWidth >= 640;

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
    setMethod("upi");
    setShowQR(typeof window !== "undefined" && window.innerWidth >= 640);
    setCopiedUpi(false);
    setCopiedField(null);
  }, [plan?.label]);

  if (!plan) return null;

  const upiLink = `upi://pay?pa=${UPI_ID}&pn=BidWar&am=${plan.discountedPrice}&tn=${encodeURIComponent(plan.label + " Plan")}&cu=INR`;

  const waText = encodeURIComponent(
    `Hi BidWar Team, I have transferred ₹${plan.discountedPrice} for the ${plan.label} Plan (${method === "upi" ? "via UPI" : "via Bank Transfer"}). Sharing payment screenshot below for license activation.`
  );
  const waLink = `https://wa.me/918707488250?text=${waText}`;

  const originalPrice = parseInt(plan.price.replace(/[₹,]/g, ""), 10);
  const savings = Number.isFinite(originalPrice) ? originalPrice - plan.discountedPrice : 0;
  const hasSavings = savings > 0;

  function handleCopyUPI() {
    navigator.clipboard.writeText(UPI_ID).then(() => {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    });
  }

  function handleCopy(text: string, fieldName: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
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
              className="panel pointer-events-auto flex w-full max-h-[94vh] sm:max-h-[90vh] flex-col overflow-hidden rounded-t-2xl sm:max-w-[24rem] sm:rounded-2xl shadow-2xl border border-primary/20"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full shrink-0 bg-[image:var(--gradient-gold)]" />

              {/* Header */}
              <div className="relative shrink-0 border-b border-white/8 px-5 pb-3 pt-4 bg-black/40">
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/8 hover:text-foreground cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>

                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {plan.label} Tournament License
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
                        Save 25% (₹{savings.toLocaleString("en-IN")})
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  One-time · Pay once per tournament · All screens included
                </p>
              </div>

              {/* Payment Method Tabs */}
              <div className="flex border-b border-white/8 bg-black/20 p-1.5 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setMethod("upi")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    method === "upi"
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  UPI / QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("bank")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                    method === "bank"
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  Bank Transfer (NEFT)
                </button>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3.5">
                <AuctionLicenseInfo variant="checkout" />

                {method === "upi" ? (
                  <div className="space-y-2.5">
                    {/* On Desktop: Show QR prominently. On Mobile: Show button + expandable QR */}
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-3.5 text-black">
                      <QRCodeSVG
                        value={upiLink}
                        size={150}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                      <p className="text-center text-[11px] font-semibold text-neutral-700">
                        Scan with Google Pay, PhonePe, Paytm, or BHIM
                      </p>
                      <button
                        type="button"
                        onClick={handleCopyUPI}
                        className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-neutral-100 px-3 py-1.5 transition-colors hover:bg-neutral-200 cursor-pointer"
                      >
                        {copiedUpi ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-neutral-600" />
                        )}
                        <span className="font-mono text-xs text-neutral-800">
                          {copiedUpi ? "UPI ID Copied!" : UPI_ID}
                        </span>
                      </button>
                    </div>

                    {/* Mobile Direct App Link */}
                    <div className="sm:hidden">
                      <a
                        href={upiLink}
                        className="gold-button gold-button-hover flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold"
                      >
                        <Smartphone className="w-4 h-4" />
                        Tap to Pay via Installed UPI App
                      </a>
                    </div>
                  </div>
                ) : (
                  /* Bank Transfer View */
                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-black/40 p-3.5 text-xs">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Account Name</span>
                      <span className="font-semibold text-foreground">{BANK_DETAILS.accountName}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">Account Number</span>
                        <span className="font-mono font-bold text-foreground text-sm">{BANK_DETAILS.accountNumber}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(BANK_DETAILS.accountNumber, "acc")}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px] font-mono cursor-pointer"
                      >
                        {copiedField === "acc" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedField === "acc" ? "Copied" : "Copy"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div>
                        <span className="text-[10px] uppercase font-mono text-muted-foreground block">IFSC Code</span>
                        <span className="font-mono font-bold text-foreground text-sm">{BANK_DETAILS.ifsc}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(BANK_DETAILS.ifsc, "ifsc")}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 hover:bg-white/15 text-[11px] font-mono cursor-pointer"
                      >
                        {copiedField === "ifsc" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiedField === "ifsc" ? "Copied" : "Copy"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground">Bank & Branch</span>
                      <span className="text-muted-foreground text-right text-[11px]">{BANK_DETAILS.bankName}, {BANK_DETAILS.branch}</span>
                    </div>
                  </div>
                )}

                {/* WhatsApp verification CTA */}
                <div className="space-y-2 pt-1">
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                    After payment, send screenshot on WhatsApp for instant license activation.
                  </p>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
                  >
                    <MessageCircle className="w-4 h-4 fill-white" />
                    Share Screenshot on WhatsApp (+91 8707488250)
                  </a>
                  <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/80 pt-0.5 font-mono">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Instant Activation · Official GST Invoice on Request</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
