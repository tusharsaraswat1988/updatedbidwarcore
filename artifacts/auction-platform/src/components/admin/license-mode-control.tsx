import { AlertTriangle, BadgeCheck, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LicenseStatus = "trial" | "active" | "completed";

const modes: Array<{
  id: LicenseStatus;
  label: string;
  description: string;
  icon: typeof AlertTriangle;
  activeClass: string;
  idleClass: string;
}> = [
  {
    id: "trial",
    label: "Trial",
    description: "Trial mode",
    icon: AlertTriangle,
    activeClass: "border-amber-500/60 bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/40",
    idleClass: "border-border/60 bg-muted/10 text-muted-foreground",
  },
  {
    id: "active",
    label: "Live",
    description: "Full auction",
    icon: BadgeCheck,
    activeClass: "border-green-500/60 bg-green-500/15 text-green-300 ring-1 ring-green-500/40",
    idleClass: "border-border/60 bg-muted/10 text-muted-foreground",
  },
  {
    id: "completed",
    label: "Completed",
    description: "Auction ended",
    icon: Check,
    activeClass: "border-blue-500/60 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/40",
    idleClass: "border-border/60 bg-muted/10 text-muted-foreground",
  },
];

export function LicenseModeControl({
  licenseStatus,
  isMaster,
  actionLoading,
  onSwitchToTrial,
  onSwitchToLive,
  onEndAuction,
}: {
  licenseStatus: string;
  isMaster: boolean;
  actionLoading: string | null;
  onSwitchToTrial: () => void;
  onSwitchToLive: () => void;
  onEndAuction: () => void;
}) {
  const current = (licenseStatus === "active" || licenseStatus === "completed" ? licenseStatus : "trial") as LicenseStatus;
  const currentMode = modes.find((m) => m.id === current)!;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Auction licence mode</div>
        <p className="mt-1 text-sm text-white">
          Currently in <span className="font-semibold text-primary">{currentMode.label}</span> mode
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isCurrent = mode.id === current;
          return (
            <div
              key={mode.id}
              className={cn(
                "rounded-lg border px-2 py-3 text-center transition-colors",
                isCurrent ? mode.activeClass : mode.idleClass,
              )}
            >
              <Icon className={cn("mx-auto h-4 w-4", isCurrent ? "" : "opacity-50")} />
              <div className={cn("mt-1 text-sm font-semibold", isCurrent ? "" : "opacity-70")}>{mode.label}</div>
              <div className="mt-0.5 text-[10px] opacity-80">{mode.description}</div>
              {isCurrent && (
                <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider">Current</div>
              )}
            </div>
          );
        })}
      </div>

      {isMaster && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Change mode</div>
          <div className="flex flex-wrap gap-2">
            {current !== "trial" && (
              <Button
                size="sm"
                variant="outline"
                className="border-amber-500/40 text-amber-400"
                disabled={!!actionLoading}
                onClick={onSwitchToTrial}
              >
                {actionLoading === "Switch to Trial" ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-3.5 w-3.5" />
                )}
                Switch to Trial
              </Button>
            )}
            {current !== "active" && (
              <Button
                size="sm"
                variant="outline"
                className="border-green-500/40 text-green-400"
                disabled={!!actionLoading}
                onClick={onSwitchToLive}
              >
                {actionLoading === "Switch to Live" ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BadgeCheck className="mr-2 h-3.5 w-3.5" />
                )}
                Switch to Live
              </Button>
            )}
            {current !== "completed" && (
              <Button
                size="sm"
                variant="outline"
                className="border-blue-500/40 text-blue-400"
                disabled={!!actionLoading}
                onClick={onEndAuction}
              >
                {actionLoading === "End auction" ? (
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="mr-2 h-3.5 w-3.5" />
                )}
                End auction
              </Button>
            )}
            {current === "completed" && (
              <p className="text-xs text-muted-foreground">No licence changes available — auction is completed.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
