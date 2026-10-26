import { useState, type ReactNode } from "react";
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
  statusControl?: ReactNode;
}

export function RegistrationPaymentReview({
  tournamentId,
  playerId,
  playerName,
  registrationFee,
  utrNumber,
  paymentScreenshotUrl,
  registrationPaymentStatus,
  statusControl,
}: RegistrationPaymentReviewProps) {
  const qc = useQueryClient();
  const approve = useApproveRegistrationPayment();
  const reject = useRejectRegistrationPayment();
  const [actionError, setActionError] = useState<string | null>(null);
  const busy = approve.isPending || reject.isPending;
  const feeLabel = registrationFee != null && registrationFee > 0
    ? `₹${registrationFee.toLocaleString("en-IN")}`
    : null;

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
    <div className="ops-payment">
      <p className="ops-detail__label">Registration payment</p>
      <div className="ops-payment__facts">
        {feeLabel ? (
          <span>
            <span className="ops-payment__meta">Fee</span>
            <span className="tabular-nums font-medium">{feeLabel}</span>
          </span>
        ) : null}
        {utrNumber ? (
          <span className="min-w-0">
            <span className="ops-payment__meta">UTR</span>
            <span className="font-mono text-xs">{utrNumber}</span>
          </span>
        ) : null}
        <PaymentStatusBadge status={registrationPaymentStatus} compact />
        {statusControl}
        {paymentScreenshotUrl ? (
          <a
            href={paymentScreenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ops-payment__link inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            Screenshot
          </a>
        ) : null}
        {registrationPaymentStatus === "pending" ? (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs text-emerald-300"
              disabled={busy}
              onClick={() => void handleAction("approve")}
            >
              {approve.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs text-rose-300"
              disabled={busy}
              onClick={() => void handleAction("reject")}
            >
              {reject.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Reject
            </Button>
          </>
        ) : null}
      </div>
      {paymentScreenshotUrl ? (
        <a href={paymentScreenshotUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit">
          <img src={paymentScreenshotUrl} alt={`Payment proof for ${playerName}`} className="ops-payment__shot" />
        </a>
      ) : null}
      {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
    </div>
  );
}
