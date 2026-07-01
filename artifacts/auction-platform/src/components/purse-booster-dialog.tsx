import { useState } from "react";
import {
  useApplyPurseBooster,
  getGetTeamPursesQueryKey,
  getGetAuctionStateQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";
import { useToast } from "@/hooks/use-toast";
import { replayPurseBoosterLed } from "@/lib/replay-purse-booster-led";

type TeamOption = { id: number; name: string; shortCode: string };

export function PurseBoosterDialog({
  open,
  onOpenChange,
  tournamentId,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: number;
  teams: TeamOption[];
}) {
  const queryClient = useQueryClient();
  const applyBooster = useApplyPurseBooster();
  const { toast } = useToast();

  const [target, setTarget] = useState<"single" | "all">("single");
  const [teamId, setTeamId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replayingLed, setReplayingLed] = useState(false);

  const parsedAmount = parseInt(amount.replace(/\D/g, ""), 10);
  const canSubmit =
    isAuditReasonValid(reason) &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    (target === "all" || !!teamId) &&
    !applyBooster.isPending;

  async function handleApply() {
    setError(null);
    if (!canSubmit) return;

    try {
      await applyBooster.mutateAsync({
        tournamentId,
        data: {
          target,
          teamId: target === "single" ? parseInt(teamId, 10) : undefined,
          amount: parsedAmount,
          reason: reason.trim(),
          showOnLed: true,
        },
      });

      await queryClient.invalidateQueries({ queryKey: getGetTeamPursesQueryKey(tournamentId) });
      await queryClient.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });

      const teamLabel =
        target === "all"
          ? "All teams"
          : teams.find((team) => String(team.id) === teamId)?.name ?? "Team";
      toast({
        title: "Purse booster applied",
        description: `+₹${parsedAmount.toLocaleString("en-IN")} added for ${teamLabel}. LED notice sent.`,
      });

      setAmount("");
      setReason("");
      setTeamId("");
      setTarget("single");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply purse booster");
    }
  }

  async function handleReplayLed() {
    setError(null);
    setReplayingLed(true);
    try {
      await replayPurseBoosterLed(tournamentId);
      await queryClient.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      toast({
        title: "LED animation replayed",
        description: "The last purse booster panel is live on the LED screen for 10 seconds.",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to replay LED animation");
    } finally {
      setReplayingLed(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>💰 Purse Booster</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>Target</Label>
            <Select value={target} onValueChange={(v) => setTarget(v as "single" | "all")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single team</SelectItem>
                <SelectItem value="all">All teams</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === "single" && (
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.shortCode || team.name} — {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="booster-amount">Amount (₹)</Label>
            <Input
              id="booster-amount"
              inputMode="numeric"
              placeholder="e.g. 500000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <AuditReasonField
            value={reason}
            onChange={setReason}
            label="Reason (required for audit)"
            placeholder="e.g. Committee approval for sponsor top-up"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleReplayLed()}
            disabled={applyBooster.isPending || replayingLed}
          >
            {replayingLed ? "Showing…" : "Show on LED again"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applyBooster.isPending}>
              Cancel
            </Button>
            <Button onClick={() => void handleApply()} disabled={!canSubmit}>
              {applyBooster.isPending ? "Applying…" : "Apply Booster"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
