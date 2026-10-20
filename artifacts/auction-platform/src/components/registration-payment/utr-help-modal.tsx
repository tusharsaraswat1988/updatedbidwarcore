import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

interface UtrHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UtrHelpModal({ open, onOpenChange }: UtrHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="registration-portal sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg text-foreground">
            <HelpCircle className="w-5 h-5 text-foreground" />
            What is a UTR Number?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            UTR (Unique Transaction Reference) is the transaction reference number generated after a successful UPI payment.
          </p>
          <p>
            You can find it in PhonePe, Google Pay, Paytm, BHIM, or your banking app under transaction details.
          </p>

          <div className="rounded-xl border border-border bg-muted p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--reg-success)" }}>Payment Successful</p>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">Amount:</span> <span className="text-foreground">₹1,200</span></p>
              <p><span className="text-muted-foreground">Transaction ID:</span> <span className="font-mono text-foreground">T240615183746283</span></p>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">UTR Number</p>
                <p className="font-mono text-base font-bold text-foreground">415672839102</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground/80">
            Copy this number and paste it into Bidwar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UtrHelpTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center min-w-11 min-h-11 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      aria-label="What is a UTR number?"
    >
      <HelpCircle className="w-5 h-5" />
    </button>
  );
}
