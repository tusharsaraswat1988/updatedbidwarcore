import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildUpiPaymentUrl, type PaymentVerificationMethod } from "@workspace/api-base/registration-payment";
import { formatIndianRupee } from "@/lib/format";
import { CompactScreenshotUpload } from "./compact-screenshot-upload";
import { UtrHelpModal, UtrHelpTrigger } from "./utr-help-modal";
import { RegLabel } from "@/components/registration/registration-chrome";

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

  const upiLink = buildUpiPaymentUrl(upiId, registrationFee, tournamentName);
  const showUtr = verificationMethod === "utr" || verificationMethod === "utr_and_screenshot";
  const showScreenshot = verificationMethod === "screenshot" || verificationMethod === "utr_and_screenshot";
  const amountLabel = formatIndianRupee(registrationFee);

  return (
    <div className="reg-fields">
      <div>
        <p className="reg-kicker">Amount due</p>
        <p className="reg-pay-amount">{amountLabel}</p>
      </div>

      <ol className="reg-pay-steps">
        <li>
          <span>1</span>
          <p>Pay {amountLabel} with any UPI app. Use the button below, or scan the QR code.</p>
        </li>
        <li>
          <span>2</span>
          <p>
            {showUtr && showScreenshot
              ? "Enter the UTR from your payment receipt and upload a screenshot."
              : showUtr
                ? "Enter the UTR or reference number from your UPI app."
                : "Upload a screenshot of the completed payment."}
          </p>
        </li>
        <li>
          <span>3</span>
          <p>Submit this form. Payment stays pending until the organizer verifies it. A successful UPI payment alone does not complete registration.</p>
        </li>
      </ol>

      <Button asChild className="w-full min-h-12 text-base font-bold">
        <a href={upiLink}>Pay {amountLabel}</a>
      </Button>

      <div className="reg-qr" role="img" aria-label={`UPI QR code for ${amountLabel}`}>
        <QRCodeSVG value={upiLink} size={168} level="M" bgColor="#ffffff" fgColor="#1a1a2e" />
        <p className="reg-hint text-center">Scan with PhonePe, Google Pay, Paytm, or another UPI app.</p>
        <p className="reg-upi">UPI ID <strong>{upiId}</strong></p>
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
            aria-describedby="register-utr-hint"
            className="font-mono tracking-wide"
          />
          <p id="register-utr-hint" className="reg-hint">
            Use the reference shown in your UPI app after the payment succeeds.
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

      <UtrHelpModal open={utrHelpOpen} onOpenChange={setUtrHelpOpen} />
    </div>
  );
}
