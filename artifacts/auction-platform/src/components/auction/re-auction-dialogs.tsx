import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";
import {
  validateFixedReAuctionAmount,
  type ReAuctionStrategyMode,
} from "@workspace/api-base/re-auction-strategy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IndianAmountHint } from "@/components/ui/indian-amount-hint";

export interface ReAuctionTargetPlayer {
  id: number;
  name: string;
  status?: string | null;
  basePrice: number;
  soldPrice?: number | null;
  teamId?: number | null;
}

export type SingleReAuctionStartingMode = "base" | "last_sold" | "custom";

interface PrepareReAuctionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unsoldCount: number;
  tournamentMinBid?: number | null;
  unit: AuctionUnit;
  unitSymbol: string;
  formatAmount: (amount: number | null | undefined) => string;
  isPending: boolean;
  onConfirm: (payload: {
    strategy: ReAuctionStrategyMode;
    fixedAmount?: number;
  }) => Promise<void> | void;
}

export function PrepareReAuctionDialog({
  open,
  onOpenChange,
  unsoldCount,
  tournamentMinBid,
  unit,
  unitSymbol,
  formatAmount,
  isPending,
  onConfirm,
}: PrepareReAuctionDialogProps) {
  const [strategy, setStrategy] = useState<ReAuctionStrategyMode>("keep_existing");
  const [fixedAmount, setFixedAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStrategy("keep_existing");
      setFixedAmount("");
      setErrorMsg(null);
    }
  }, [open]);

  async function handleSubmit() {
    setErrorMsg(null);
    const payload: { strategy: ReAuctionStrategyMode; fixedAmount?: number } = {
      strategy,
    };
    if (strategy === "fixed") {
      const parsed = parseInt(fixedAmount.replace(/,/g, ""), 10);
      const check = validateFixedReAuctionAmount(parsed, tournamentMinBid ?? 0);
      if (!check.ok) {
        setErrorMsg(check.error);
        return;
      }
      payload.fixedAmount = check.amount;
    }
    await onConfirm(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-[#0D1527] border-2 border-white/20 text-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <RotateCcw className="w-4 h-4 text-orange-400" /> Prepare Re-auction
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-white/60">
            Choose how unsold players should enter the re-auction. Player base values in the database are not changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-white/75">
            {unsoldCount} unsold player{unsoldCount !== 1 ? "s" : ""} will return to the available queue.
          </p>

          <RadioGroup
            value={strategy}
            onValueChange={(v) => {
              setStrategy(v as ReAuctionStrategyMode);
              setErrorMsg(null);
            }}
            className="space-y-3"
          >
            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
              <RadioGroupItem value="keep_existing" className="mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Keep Existing Base Values</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Each player opens at their current effective base (category base or player base). No recalculation.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
              <RadioGroupItem value="reset_defaults" className="mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Reset Using Configured Defaults</p>
                <p className="text-xs text-white/60 mt-0.5">
                  Category base if set, otherwise tournament default. Player-selected bases are ignored.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
              <RadioGroupItem value="fixed" className="mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-white">Use Fixed Starting Bid For All</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Every unsold player enters from the same opening amount.
                  </p>
                </div>
                {strategy === "fixed" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="re-auction-fixed" className="text-xs text-white/70">
                      Amount ({unitSymbol})
                    </Label>
                    <Input
                      id="re-auction-fixed"
                      type="number"
                      min={tournamentMinBid ?? 1}
                      step={1000}
                      value={fixedAmount}
                      onChange={(e) => {
                        setFixedAmount(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="h-9 bg-black/60 border-white/20 text-white"
                    />
                    <IndianAmountHint value={fixedAmount} unit={unit} className="text-[10px]" />
                    {tournamentMinBid ? (
                      <p className="text-[10px] text-white/50">
                        Minimum {formatAmount(tournamentMinBid)} (tournament minimum bid)
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>

          {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold"
              disabled={isPending || (strategy === "fixed" && !fixedAmount.trim())}
              onClick={() => void handleSubmit()}
            >
              {isPending ? "Preparing…" : "Bring Unsold Players"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SinglePlayerReAuctionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: ReAuctionTargetPlayer | null;
  previousTeamName?: string | null;
  tournamentMinBid?: number | null;
  unit: AuctionUnit;
  unitSymbol: string;
  formatAmount: (amount: number | null | undefined) => string;
  isPending: boolean;
  onConfirm: (payload: {
    playerId: number;
    startFromBase: boolean;
    startingBid?: number;
  }) => Promise<void> | void;
}

export function SinglePlayerReAuctionDialog({
  open,
  onOpenChange,
  player,
  previousTeamName,
  tournamentMinBid,
  unit,
  unitSymbol,
  formatAmount,
  isPending,
  onConfirm,
}: SinglePlayerReAuctionDialogProps) {
  const hasLastSoldPrice =
    player?.status === "sold" && player.soldPrice != null && player.soldPrice > 0;
  const [mode, setMode] = useState<SingleReAuctionStartingMode>("base");
  const [customAmount, setCustomAmount] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open && player) {
      setMode("base");
      setCustomAmount(String(player.soldPrice ?? player.basePrice ?? ""));
      setErrorMsg(null);
    } else if (!open) {
      setMode("base");
      setCustomAmount("");
      setErrorMsg(null);
    }
  }, [open, player?.id]);

  if (!player) return null;

  async function handleSubmit() {
    if (!player) return;
    setErrorMsg(null);

    if (mode === "custom") {
      const parsed = parseInt(customAmount.replace(/,/g, ""), 10);
      const check = validateFixedReAuctionAmount(
        parsed,
        tournamentMinBid ?? 0,
        "Starting bid",
      );
      if (!check.ok) {
        setErrorMsg(check.error);
        return;
      }
      await onConfirm({
        playerId: player.id,
        startFromBase: true,
        startingBid: check.amount,
      });
      return;
    }

    await onConfirm({
      playerId: player.id,
      startFromBase: mode !== "last_sold",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-[#0D1527] border-2 border-white/20 text-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black flex items-center gap-2 text-white">
            <RotateCcw className="w-4 h-4 text-orange-400" /> Re-auction Player
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-white/60">
            Choose the opening point for <strong className="text-white">{player.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-xl border border-white/15 bg-white/[0.03] p-3 text-xs space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-sm text-white truncate">{player.name}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  player.status === "sold"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "bg-rose-500/15 text-rose-300"
                }`}
              >
                {player.status ?? "unsold"}
              </span>
            </div>
            {hasLastSoldPrice ? (
              <p className="text-white/70">
                Previously sold{previousTeamName ? ` to ${previousTeamName}` : ""} for{" "}
                <span className="font-mono font-bold text-amber-300">
                  {formatAmount(player.soldPrice)}
                </span>
                . Re-auctioning reverses this sale and restores team purse.
              </p>
            ) : (
              <p className="text-white/60">
                Base value:{" "}
                <span className="font-mono font-bold text-white/90">
                  {formatAmount(player.basePrice)}
                </span>
              </p>
            )}
          </div>

          <RadioGroup
            value={mode}
            onValueChange={(v) => {
              setMode(v as SingleReAuctionStartingMode);
              setErrorMsg(null);
            }}
            className="space-y-2.5"
          >
            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
              <RadioGroupItem value="base" className="mt-0.5" />
              <div className="flex-1 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">Start from Base Point</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Open bidding from player&apos;s base value.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-300 shrink-0">
                  {formatAmount(player.basePrice)}
                </span>
              </div>
            </label>

            {hasLastSoldPrice && (
              <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
                <RadioGroupItem value="last_sold" className="mt-0.5" />
                <div className="flex-1 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">Start from Last Sold Point</p>
                    <p className="text-xs text-white/60 mt-0.5">
                      Open bidding from the previous sold price.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-300 shrink-0">
                    {formatAmount(player.soldPrice)}
                  </span>
                </div>
              </label>
            )}

            <label className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/[0.03] p-3 cursor-pointer has-[:checked]:border-orange-500/50 has-[:checked]:bg-orange-500/10">
              <RadioGroupItem value="custom" className="mt-0.5" />
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-semibold text-white">Same / Custom Starting Point</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Specify the exact opening amount for this re-auction.
                  </p>
                </div>
                {mode === "custom" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="single-reauction-custom" className="text-xs text-white/70">
                      Starting Amount ({unitSymbol})
                    </Label>
                    <Input
                      id="single-reauction-custom"
                      type="number"
                      min={tournamentMinBid ?? 1}
                      step={1000}
                      value={customAmount}
                      onChange={(e) => {
                        setCustomAmount(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="h-9 bg-black/60 border-white/20 text-white"
                    />
                    <IndianAmountHint value={customAmount} unit={unit} className="text-[10px]" />
                    {tournamentMinBid ? (
                      <p className="text-[10px] text-white/50">
                        Minimum {formatAmount(tournamentMinBid)} (tournament minimum bid)
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>

          {errorMsg && <p className="text-xs text-rose-400 font-medium">{errorMsg}</p>}

          <div className="flex gap-2 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-white/20 bg-white/5 text-white hover:bg-white/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-bold"
              disabled={isPending || (mode === "custom" && !customAmount.trim())}
              onClick={() => void handleSubmit()}
            >
              {isPending ? "Starting…" : "Start Re-auction"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
