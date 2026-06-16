import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useApproveRegistrationPayment,
  useRejectRegistrationPayment,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "./payment-status-badge";
import type { RegistrationPaymentStatus } from "@workspace/api-base/registration-payment";
import { CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";

interface RegistrationPaymentReviewProps {
  tournamentId: number;
  playerId: number;
  playerName: string;
  registrationFee?: number | null;
  utrNumber?: string | null;
  paymentScreenshotUrl?: string | null;
  registrationPaymentStatus?: RegistrationPaymentStatus | null;
}

export function RegistrationPaymentReview({
  tournamentId,
  playerId,
  playerName,
  registrationFee,
  utrNumber,
  paymentScreenshotUrl,
  registrationPaymentStatus,
}: RegistrationPaymentReviewProps) {
  const qc = useQueryClient();
  const approve = useApproveRegistrationPayment();
  const reject = useRejectRegistrationPayment();
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = approve.isPending || reject.isPending;

  async function handleAction(action: "approve" | "reject") {
    setActionError(null);
    try {
      if (action === "approve") {
        await approve.mutateAsync({ tournamentId, playerId });
      } else {
        await reject.mutateAsync({ tournamentId, playerId });
      }
      qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string } })?.data?.error ?? "Action failed";
      setActionError(msg);
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Registration Payment
        </p>
        <PaymentStatusBadge status={registrationPaymentStatus} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {registrationFee != null && registrationFee > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Registration Fee</p>
            <p className="font-semibold">₹{registrationFee.toLocaleString("en-IN")}</p>
          </div>
        )}
        {utrNumber && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">UTR Number</p>
            <p className="font-mono text-xs">{utrNumber}</p>
          </div>
        )}
      </div>

      {paymentScreenshotUrl && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Payment Screenshot</p>
          <a
            href={paymentScreenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View screenshot
          </a>
          <div className="mt-2 max-w-[200px] rounded-lg border border-border overflow-hidden">
            <img src={paymentScreenshotUrl} alt={`Payment proof for ${playerName}`} className="w-full h-auto" />
          </div>
        </div>
      )}

      {registrationPaymentStatus === "pending" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5 bg-green-600 hover:bg-green-700"
            disabled={busy}
            onClick={() => void handleAction("approve")}
          >
            {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10"
            disabled={busy}
            onClick={() => void handleAction("reject")}
          >
            {reject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
            Reject
          </Button>
        </div>
      )}

      {actionError && <p className="text-xs text-destructive">{actionError}</p>}
    </div>
  );
}
