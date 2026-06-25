import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

interface UtrHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UtrHelpModal({ open, onOpenChange }: UtrHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#111113] border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <HelpCircle className="w-5 h-5 text-primary" />
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

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-400">Payment Successful</p>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-white/50">Amount:</span> <span className="text-white">₹1,200</span></p>
              <p><span className="text-white/50">Transaction ID:</span> <span className="font-mono text-white/80">T240615183746283</span></p>
              <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-primary/80 mb-0.5">UTR Number</p>
                <p className="font-mono text-base font-bold text-primary">415672839102</p>
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
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      aria-label="What is a UTR number?"
    >
      <HelpCircle className="w-3.5 h-3.5" />
    </button>
  );
}
