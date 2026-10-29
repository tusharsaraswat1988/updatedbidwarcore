import { useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildUpiPaymentUrl, type PaymentVerificationMethod } from "@workspace/api-base/registration-payment";
import { formatIndianRupee } from "@/lib/format";
import { CompactScreenshotUpload } from "./compact-screenshot-upload";
import { UtrHelpModal, UtrHelpTrigger } from "./utr-help-modal";
import { RegLabel } from "@/components/registration/registration-chrome";
import { Copy, Check, Smartphone, QrCode } from "lucide-react";

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
  const [utrHelpOpen, setUtrHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const upiLink = buildUpiPaymentUrl(upiId, registrationFee, tournamentName);
  const showUtr = verificationMethod === "utr" || verificationMethod === "utr_and_screenshot";
  const showScreenshot = verificationMethod === "screenshot" || verificationMethod === "utr_and_screenshot";
  const amountLabel = formatIndianRupee(registrationFee);

  const handleCopyUpi = useCallback(() => {
    if (!upiId) return;
    void navigator.clipboard.writeText(upiId.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [upiId]);

  return (
    <div className="space-y-5">
      {/* Amount Due Card */}
      <div className="rounded-xl border border-border/80 bg-gradient-to-br from-card to-muted/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount Due</span>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{amountLabel}</div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 w-fit">
          <span>Verified by organizer after submission</span>
        </div>
      </div>

      {/* Payment Instructions Overview */}
      <div className="rounded-lg bg-muted/40 border border-border/60 p-3.5 text-xs sm:text-sm text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground">How to complete your payment:</p>
        <ol className="list-decimal pl-4 space-y-1 text-xs leading-relaxed">
          <li>Pay <strong>{amountLabel}</strong> using the mobile UPI button or by scanning the QR code below.</li>
          <li>Note down the 12-digit transaction UTR number or take a payment screenshot.</li>
          <li>Enter the verification details below. Then complete the declaration below and submit this registration.</li>
        </ol>
      </div>

      {/* Option 1: Mobile UPI App */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">Option 1: Pay directly in UPI App</span>
          <span className="text-[11px] text-muted-foreground font-medium">(Mobile)</span>
        </div>
        <Button
          asChild
          variant="outline"
          className="w-full min-h-12 border-primary/50 hover:bg-primary/5 text-foreground hover:text-foreground text-base font-semibold shadow-2xs group cursor-pointer"
        >
          <a href={upiLink}>
            <Smartphone className="w-4 h-4 mr-2 text-primary shrink-0 transition-transform group-hover:scale-110" />
            <span>Open UPI App to Pay ({amountLabel})</span>
          </a>
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          Tap to launch PhonePe, Google Pay, Paytm, or BHIM on this phone
        </p>
      </div>

      {/* Option 2: QR Code & Copy UPI ID */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center gap-2">
          <QrCode className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">Option 2: Scan QR or transfer using UPI ID</span>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-border bg-white dark:bg-card/90 shadow-2xs gap-3">
          <div className="p-2.5 bg-white rounded-lg shadow-2xs border border-slate-100">
            <QRCodeSVG value={upiLink} size={160} level="M" bgColor="#ffffff" fgColor="#0f172a" />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Scan with PhonePe, Google Pay, Paytm, CRED, or your bank app
          </p>

          {/* 1-tap Copy UPI ID */}
          <div className="flex items-center justify-between w-full max-w-sm px-3.5 py-2 rounded-lg bg-muted/60 border border-border/80">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase font-medium text-muted-foreground shrink-0">UPI ID:</span>
              <span className="font-mono text-xs sm:text-sm font-bold text-foreground truncate select-all">{upiId}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyUpi}
              className="h-7 px-2.5 text-xs font-medium shrink-0 ml-2 cursor-pointer"
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
      </div>

      {/* Payment Proof Details */}
      <div className="space-y-4 pt-3 border-t border-border/70">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Payment Verification Proof</h3>
          <span className="text-xs text-muted-foreground font-medium">Required for verification</span>
        </div>

        {showUtr && (
          <div className="reg-field">
            <div className="flex items-center gap-1.5">
              <div className="flex-1">
                <RegLabel htmlFor="register-utr" marker="required">UTR or reference number</RegLabel>
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
              className="font-mono tracking-wide"
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
