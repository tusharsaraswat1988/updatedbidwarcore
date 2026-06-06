import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useAuctionSocket, type ConnectionStatus } from "@/hooks/use-auction-socket";

const labels: Record<ConnectionStatus, string> = {
  connected: "Connected",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

const styles: Record<ConnectionStatus, string> = {
  connected: "bg-green-500/10 text-green-300",
  reconnecting: "bg-amber-500/10 text-amber-300",
  disconnected: "bg-red-500/10 text-red-400",
};

export function LiveConnectionStatus({ tournamentId }: { tournamentId: number }) {
  const { connectionStatus } = useAuctionSocket(tournamentId);
  const Icon =
    connectionStatus === "connected"
      ? Wifi
      : connectionStatus === "reconnecting"
        ? Loader2
        : WifiOff;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${styles[connectionStatus]}`}
    >
      <Icon className={`h-3.5 w-3.5 ${connectionStatus === "reconnecting" ? "animate-spin" : ""}`} />
      {labels[connectionStatus]}
    </span>
  );
}
