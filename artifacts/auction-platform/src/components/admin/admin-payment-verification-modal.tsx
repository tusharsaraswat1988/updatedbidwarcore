import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, DollarSign, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AdminNotificationItem } from "@/lib/admin-notifications";

export function AdminPaymentVerificationModal({
  open,
  onClose,
  item,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  item: AdminNotificationItem | null;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("5000");
  const [paymentMode, setPaymentMode] = useState<string>("upi");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [adminNote, setAdminNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setPaymentRef("");
      setAdminNote("");
      setPaymentAmount("5000");
      setPaymentMode("upi");
    }
  }, [open, item]);

  if (!item) return null;

  const meta = item.actionMetadata || item.metadata || {};
  const tournamentId = (meta.tournamentId as number) || item.entityId;
  const tournamentName = (meta.tournamentName as string) || item.title;
  const organizerName = (meta.organizerName as string) || "Organizer";
  const organizerMobile = (meta.organizerMobile as string) || "";
  const sport = (meta.sport as string) || "Tournament";
  const requestedModules = (meta.requestedModules as string) || "auction";
  const requestId = meta.requestId as number | undefined;

  async function handleGrantLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) {
      toast({
        title: "Confirmation Required",
        description: "Please check the box confirming manual payment has been received.",
        variant: "destructive",
      });
      return;
    }

    if (!tournamentId) {
      toast({
        title: "Error",
        description: "Tournament ID missing from notification.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/auth/admin/tournaments/${tournamentId}/verify-and-grant-license`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          paymentAmount: paymentAmount ? Number(paymentAmount) : undefined,
          paymentMode,
          paymentRef: paymentRef.trim() || undefined,
          notes: adminNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to verify and grant license");
      }

      toast({
        title: "License Activated Successfully",
        description: `"${tournamentName}" is now active with live production access.`,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      toast({
        title: "Activation Failed",
        description: err instanceof Error ? err.message : "Could not activate license",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="max-w-md bg-card border-border/80 p-6 text-foreground">
        <DialogHeader className="space-y-1 pb-1">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <DialogTitle className="font-display text-lg font-bold">
              Verify Payment & Grant License
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Confirm manual payment receipt before switching tournament from Trial to Live mode.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleGrantLicense} className="space-y-4 pt-1">
          {/* Target details card */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-foreground leading-tight">{tournamentName}</p>
                <p className="text-[11px] text-muted-foreground capitalize mt-0.5">
                  {sport} · Organiser: <span className="text-foreground/90 font-medium">{organizerName}</span>
                </p>
                {organizerMobile && (
                  <p className="text-[11px] text-muted-foreground">Mobile: {organizerMobile}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-500/40 bg-amber-500/10 text-amber-400 shrink-0">
                {requestedModules}
              </Badge>
            </div>
          </div>

          {/* Payment receipt confirmation checkbox */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-start gap-2.5">
            <Checkbox
              id="confirm-payment"
              checked={confirmed}
              onCheckedChange={(v) => setConfirmed(Boolean(v))}
              className="mt-0.5"
            />
            <Label htmlFor="confirm-payment" className="text-xs font-medium text-emerald-300 leading-snug cursor-pointer">
              I confirm that manual payment for this tournament license has been received and verified.
            </Label>
          </div>

          {/* Payment Mode & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent className="dark">
                  <SelectItem value="upi">UPI (GPay/PhonePe/Paytm)</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer (NEFT/IMPS)</SelectItem>
                  <SelectItem value="cash">Cash / Offline</SelectItem>
                  <SelectItem value="waiver">Admin Waiver / Sponsor</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-amt" className="text-xs font-medium">
                Amount (₹)
              </Label>
              <Input
                id="pay-amt"
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="5000"
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* UTR / Transaction Ref */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-ref" className="text-xs font-medium">
              UTR / Transaction Reference (Optional)
            </Label>
            <Input
              id="pay-ref"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. 423984729182 / SBI-NEFT-9832"
              className="h-9 text-xs"
            />
          </div>

          {/* Internal Note */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-note" className="text-xs font-medium">
              Internal Admin Note (Optional)
            </Label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="e.g. Verified with organiser on WhatsApp..."
              className="text-xs resize-none h-16"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || !confirmed}
              className="gap-1.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm &amp; Activate License
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
