import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildUpiPaymentUrl, type PaymentVerificationMethod } from "@workspace/api-base/registration-payment";
import { formatIndianRupee } from "@/lib/format";
import { CompactScreenshotUpload } from "./compact-screenshot-upload";
import { UtrHelpModal, UtrHelpTrigger } from "./utr-help-modal";
import { RegLabel } from "@/components/registration/registration-chrome";
import { cn } from "@/lib/utils";
import {
  Copy,
  Check,
  Smartphone,
  QrCode,
  ChevronDown,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

interface RegistrationPaymentFormSectionProps {
  registrationFee: number;
  upiId: string;
  verificationMethod: PaymentVerificationMethod;
  utrNumber: string;
  paymentScreenshotUrl: string;
  onUtrChange: (value: string) => void;
  onScreenshotChange: (url: string, publicId?: string) => void;
  tournamentName?: string;
  disabled?: boolean;
}

export function RegistrationPaymentFormSection({
  registrationFee,
  upiId,
  verificationMethod,
  utrNumber,
  paymentScreenshotUrl,
  onUtrChange,
  onScreenshotChange,
  tournamentName,
  disabled,
}: RegistrationPaymentFormSectionProps) {
  const [qrExpanded, setQrExpanded] = useState(false);
  const [utrHelpOpen, setUtrHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const upiLink = buildUpiPaymentUrl(upiId, registrationFee, tournamentName);
  const showUtr = verificationMethod === "utr" || verificationMethod === "utr_and_screenshot";
  const showScreenshot = verificationMethod === "screenshot" || verificationMethod === "utr_and_screenshot";
  const amountLabel = formatIndianRupee(registrationFee, "rupee");

  const handleCopyUpi = useCallback(async () => {
    if (!upiId) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId.trim());
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = upiId.trim();
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [upiId]);

  return (
    <div className="space-y-4">
      {/* 2.A: Payment Summary */}
      <div className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-2xs">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Registration Fee
          </span>
          <div className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {amountLabel}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Verified by tournament organizer</span>
          </div>
        </div>
        <div className="shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary-foreground border border-primary/25">
            One-time payment
          </span>
        </div>
      </div>

      {/* 2.B: Primary Payment Action */}
      <div className="space-y-2">
        <a
          href={upiLink}
          role="button"
          aria-label={`Pay ${amountLabel} via UPI`}
          className={cn(
            "w-full min-h-[54px] sm:min-h-[56px] px-5 py-3.5 rounded-xl text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg active:scale-[0.99] transition-all select-none cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            disabled && "pointer-events-none opacity-50 shadow-none cursor-not-allowed"
          )}
          style={{ backgroundColor: "#0e1e38" }}
        >
          <Smartphone className="w-5 h-5 text-white/90 group-hover:scale-110 transition-transform shrink-0" />
          <span>Pay {amountLabel} via UPI</span>
          <ArrowUpRight className="w-4 h-4 text-white/70 group-hover:text-white group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
        </a>
        <p className="text-xs text-muted-foreground text-center leading-normal px-2">
          Tap to pay with PhonePe, Google Pay, Paytm, BHIM, or any UPI app.
        </p>
      </div>

      {/* 2.C: Alternative Payment Method — Collapsed by default on mobile */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setQrExpanded(prev => !prev)}
          aria-expanded={qrExpanded}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-muted/30 transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">
                Pay using QR code
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {qrExpanded ? "Scan or copy UPI ID" : "Tap to display QR code or copy UPI ID"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
              {qrExpanded ? "Hide" : "Show"}
            </span>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                qrExpanded && "rotate-180"
              )}
            />
          </div>
        </button>

        {qrExpanded && (
          <div className="px-4 pb-4 pt-1 border-t border-border/60 flex flex-col items-center gap-3 animate-in fade-in-50 duration-150">
            <div className="p-3 bg-white rounded-xl shadow-2xs border border-slate-200 mt-2">
              <QRCodeSVG
                value={upiLink}
                size={168}
                level="M"
                bgColor="#ffffff"
                fgColor="#0f172a"
                aria-label="UPI QR Code"
              />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-xs">
              Scan with PhonePe, Google Pay, Paytm, CRED, or your bank app
            </p>

            {/* Complete UPI ID — Never visually truncated */}
            <div className="flex items-center justify-between w-full max-w-sm px-3.5 py-2.5 rounded-lg bg-muted/60 border border-border/80 gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  UPI ID
                </span>
                <span className="font-mono text-xs sm:text-sm font-bold text-foreground break-all select-all block">
                  {upiId}
                </span>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCopyUpi}
                className="h-8 px-3 text-xs font-semibold shrink-0 cursor-pointer"
                aria-label="Copy UPI ID"
              >
                {copied ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Copied
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 3: Short Supporting Instruction */}
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-center sm:text-left pt-1">
        Complete your payment using UPI, then submit your payment verification details below.
      </p>

      {/* 4: Payment Verification Details */}
      <div className="space-y-3.5 pt-2 border-t border-border/70">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Payment Verification Details</h3>
          <span className="text-xs text-muted-foreground font-medium">Required for approval</span>
        </div>

        {showUtr && (
          <div className="reg-field">
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <RegLabel htmlFor="register-utr" marker="required">UTR or Reference Number</RegLabel>
              </div>
              <UtrHelpTrigger onClick={() => setUtrHelpOpen(true)} />
            </div>
            <Input
              id="register-utr"
              type="text"
              value={utrNumber}
              onChange={e => onUtrChange(e.target.value.replace(/\s/g, ""))}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. 415672839102"
              aria-describedby="register-utr-hint"
              className="font-mono tracking-wide min-h-[46px]"
            />
            <p id="register-utr-hint" className="reg-hint">
              Enter the 12-digit transaction ID or reference number shown in your UPI app receipt.
            </p>
          </div>
        )}

        {showScreenshot && (
          <CompactScreenshotUpload
            value={paymentScreenshotUrl}
            onChange={onScreenshotChange}
            disabled={disabled}
          />
        )}
      </div>

      <UtrHelpModal open={utrHelpOpen} onOpenChange={setUtrHelpOpen} />
    </div>
  );
}
