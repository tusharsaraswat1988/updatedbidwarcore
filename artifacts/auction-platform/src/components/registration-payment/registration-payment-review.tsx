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
import { CheckCircle2, XCircle, Loader2, ExternalLink, Image as ImageIcon, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegistrationPaymentReviewProps {
  tournamentId: number;
  playerId: number;
  playerName: string;
  registrationFee?: number | null;
  utrNumber?: string | null;
  paymentScreenshotUrl?: string | null;
  registrationPaymentStatus?: RegistrationPaymentStatus | null;
  statusControl?: ReactNode;
  onPreviewScreenshot?: (url: string, title?: string) => void;
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
  onPreviewScreenshot,
}: RegistrationPaymentReviewProps) {
  const qc = useQueryClient();
  const approve = useApproveRegistrationPayment();
  const reject = useRejectRegistrationPayment();
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState(false);
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

  async function handleCopyUtr() {
    if (!utrNumber) return;
    await navigator.clipboard.writeText(utrNumber);
    setCopiedUtr(true);
    setTimeout(() => setCopiedUtr(false), 1500);
  }

  const isPending = registrationPaymentStatus === "pending";
  const isApproved = registrationPaymentStatus === "approved";
  const isRejected = registrationPaymentStatus === "rejected";

  const statusBorderClass = isPending
    ? "border-amber-300 bg-amber-50/50"
    : isApproved
      ? "border-emerald-200 bg-emerald-50/40"
      : isRejected
        ? "border-rose-200 bg-rose-50/40"
        : "border-border bg-slate-50/60";

  return (
    <div className={cn("ops-payment rounded-lg border p-2.5 transition-colors", statusBorderClass)}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <p className="ops-detail__label text-[11px] font-bold uppercase tracking-wider text-slate-700 m-0">
            Registration Payment
          </p>
          <PaymentStatusBadge status={registrationPaymentStatus} compact />
        </div>
        {statusControl}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {feeLabel ? (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Fee:</span>
            <span className="tabular-nums font-bold text-slate-900">{feeLabel}</span>
          </div>
        ) : null}

        {utrNumber ? (
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">UTR:</span>
            <span className="font-mono text-xs font-semibold text-slate-800 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
              {utrNumber}
            </span>
            <button
              type="button"
              onClick={handleCopyUtr}
              className="text-slate-400 hover:text-slate-700 p-0.5 transition-colors cursor-pointer"
              title="Copy UTR number"
              aria-label="Copy UTR number"
            >
              {copiedUtr ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        ) : null}

        {/* Screenshot preview button / thumbnail */}
        {paymentScreenshotUrl ? (
          <div className="flex items-center gap-2 ml-auto">
            {onPreviewScreenshot ? (
              <button
                type="button"
                onClick={() => onPreviewScreenshot(paymentScreenshotUrl, `Payment Receipt — ${playerName}`)}
                className="group relative flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border border-slate-300 bg-white hover:bg-slate-50 hover:border-amber-400 text-slate-700 transition-all cursor-pointer shadow-2xs"
                title="View payment screenshot"
              >
                <img
                  src={paymentScreenshotUrl}
                  alt={`Proof for ${playerName}`}
                  className="w-5 h-5 rounded object-cover border border-slate-200"
                />
                <span className="text-[11px] font-semibold text-slate-800">View Receipt</span>
              </button>
            ) : (
              <a
                href={paymentScreenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ops-payment__link inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Receipt
              </a>
            )}
          </div>
        ) : null}

        {/* Action buttons (Approve / Reject) */}
        {isPending ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2.5 text-xs font-bold text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 hover:text-emerald-900 cursor-pointer shadow-2xs"
              disabled={busy}
              onClick={() => void handleAction("approve")}
            >
              {approve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2.5 text-xs font-bold text-rose-700 bg-rose-50 border-rose-300 hover:bg-rose-100 hover:text-rose-900 cursor-pointer shadow-2xs"
              disabled={busy}
              onClick={() => void handleAction("reject")}
            >
              {reject.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
              Reject
            </Button>
          </div>
        ) : null}
      </div>

      {actionError ? <p className="text-xs text-rose-600 mt-1 font-medium">{actionError}</p> : null}
    </div>
  );
}
