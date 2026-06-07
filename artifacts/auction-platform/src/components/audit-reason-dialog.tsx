import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";

type AuditReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function AuditReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
}: AuditReasonDialogProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  async function handleConfirm() {
    if (!isAuditReasonValid(reason)) return;
    await onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          <AuditReasonField value={reason} onChange={setReason} />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              disabled={loading || !isAuditReasonValid(reason)}
              onClick={() => void handleConfirm()}
            >
              {loading ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
