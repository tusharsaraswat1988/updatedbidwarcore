import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, QrCode, IndianRupee } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { buildUpiPaymentUrl, type PaymentVerificationMethod } from "@workspace/api-base/registration-payment";
import { CompactScreenshotUpload } from "./compact-screenshot-upload";
import { UtrHelpModal, UtrHelpTrigger } from "./utr-help-modal";

interface RegistrationPaymentFormSectionProps {
  registrationFee: number;
  upiId: string;
  verificationMethod: PaymentVerificationMethod;
  utrNumber: string;
  paymentScreenshotUrl: string;
  onUtrChange: (value: string) => void;
  onScreenshotChange: (url: string) => void;
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
  const [showQr, setShowQr] = useState(() => typeof window !== "undefined" && window.innerWidth >= 640);
  const [utrHelpOpen, setUtrHelpOpen] = useState(false);

  const upiLink = buildUpiPaymentUrl(upiId, registrationFee, tournamentName);
  const showUtr = verificationMethod === "utr" || verificationMethod === "utr_and_screenshot";
  const showScreenshot = verificationMethod === "screenshot" || verificationMethod === "utr_and_screenshot";

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary/80">Registration Fee</p>
            <p className="text-2xl font-display font-black text-white flex items-center gap-1 mt-0.5">
              <IndianRupee className="w-5 h-5" />
              {registrationFee.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <a
          href={upiLink}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Smartphone className="w-4 h-4" />
          Pay Now
        </a>

        <button
          type="button"
          onClick={() => setShowQr(v => !v)}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 hover:text-white/80 transition-colors sm:hidden"
        >
          <QrCode className="w-4 h-4" />
          {showQr ? "Hide QR Code" : "Show QR Code"}
        </button>

        <div className="hidden sm:flex flex-col items-center gap-2 p-4 rounded-xl bg-white">
          <QRCodeSVG value={upiLink} size={160} level="M" bgColor="#ffffff" fgColor="#000000" />
          <p className="text-[10px] text-black/40 text-center font-medium">
            Scan with any UPI app — PhonePe, GPay, Paytm
          </p>
        </div>

        <AnimatePresence initial={false}>
          {showQr && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden sm:hidden"
            >
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white">
                <QRCodeSVG value={upiLink} size={160} level="M" bgColor="#ffffff" fgColor="#000000" />
                <p className="text-[10px] text-black/40 text-center font-medium">
                  Scan with any UPI app
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground text-center">
          Complete the payment and submit the details below.
        </p>

        {showUtr && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>
                UTR Number <span className="text-destructive">*</span>
              </Label>
              <UtrHelpTrigger onClick={() => setUtrHelpOpen(true)} />
            </div>
            <input
              type="text"
              value={utrNumber}
              onChange={e => onUtrChange(e.target.value.replace(/\s/g, ""))}
              placeholder="e.g. 415672839102"
              disabled={disabled}
              className="flex h-11 sm:h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
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
      </CardContent>
    </Card>
  );
}
