import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import {
  Bell,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Smartphone,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface NotificationLog {
  id: number;
  eventType: string;
  channel: string;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientMobile: string | null;
  tournamentId: number | null;
  organizerId: number | null;
  status: string;
  subject: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface TournamentOption {
  id: number;
  name: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    sent: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    skipped: "bg-muted/20 text-muted-foreground",
  };
  return (
    <Badge className={`text-[10px] uppercase ${map[status] ?? "bg-muted/20 text-muted-foreground"}`}>
      {status}
    </Badge>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "email") {
    return (
      <Badge className="bg-violet-500/20 text-violet-300 text-[10px] gap-1">
        <Mail className="w-2.5 h-2.5" />
        Email
      </Badge>
    );
  }
  if (channel === "whatsapp") {
    return (
      <Badge className="bg-green-600/20 text-green-300 text-[10px] gap-1">
        <Wifi className="w-2.5 h-2.5" />
        WhatsApp
      </Badge>
    );
  }
  if (channel === "sms") {
    return (
      <Badge className="bg-blue-500/20 text-blue-400 text-[10px] gap-1">
        <Smartphone className="w-2.5 h-2.5" />
        SMS
      </Badge>
    );
  }
  return <Badge className="bg-muted/20 text-muted-foreground text-[10px]">{channel}</Badge>;
}

function formatRecipient(log: NotificationLog): string {
  if (log.recipientName) return log.recipientName;
  if (log.recipientEmail) return log.recipientEmail;
  if (log.recipientMobile) return log.recipientMobile;
  return "—";
}

function formatEventLabel(eventType: string): string {
  return eventType
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminNotificationCenter() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [tournaments, setTournaments] = useState<TournamentOption[]>([]);

  const [eventFilter, setEventFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (eventFilter !== "all") params.set("eventType", eventFilter);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tournamentFilter !== "all") params.set("tournamentId", tournamentFilter);

      const res = await fetch(`/api/auth/admin/notifications?${params}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json() as { items: NotificationLog[]; total: number };
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, channelFilter, statusFilter, tournamentFilter]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void fetchLogs();
  }, [isLoggedIn, fetchLogs]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void (async () => {
      try {
        const res = await fetch("/api/auth/admin/tournaments");
        if (res.ok) {
          const data = await res.json() as TournamentOption[];
          setTournaments(data.map((t) => ({ id: t.id, name: t.name })));
        }
      } catch {
        /* non-critical */
      }
    })();
  }, [isLoggedIn]);

  const handleResend = async (logId: number) => {
    setResendingId(logId);
    try {
      const res = await fetch(`/api/auth/admin/notifications/${logId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        alert(err.error ?? "Resend failed");
        return;
      }
      await fetchLogs();
    } finally {
      setResendingId(null);
    }
  };

  const filteredLogs = search.trim()
    ? logs.filter((log) => {
        const q = search.toLowerCase();
        return (
          log.eventType.toLowerCase().includes(q) ||
          (log.recipientName?.toLowerCase().includes(q) ?? false) ||
          (log.recipientEmail?.toLowerCase().includes(q) ?? false) ||
          (log.recipientMobile?.includes(q) ?? false) ||
          (log.subject?.toLowerCase().includes(q) ?? false)
        );
      })
    : logs;

  if (isLoading) {
    return (
      <AdminShell>
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  if (!isLoggedIn) return null;

  return (
    <AdminShell>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notification Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Audit history for email, SMS, and WhatsApp notifications
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void fetchLogs()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search recipient..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="ORGANISER_REGISTERED">Organiser registered</SelectItem>
                  <SelectItem value="TOURNAMENT_CREATED">Tournament created</SelectItem>
                  <SelectItem value="TOURNAMENT_APPROVED">Tournament approved</SelectItem>
                  <SelectItem value="AUCTION_STARTED">Auction started</SelectItem>
                  <SelectItem value="AUCTION_COMPLETED">Auction completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tournamentFilter} onValueChange={setTournamentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tournament" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tournaments</SelectItem>
                  {tournaments.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="text-sm text-muted-foreground">
          Showing {filteredLogs.length} of {total} notifications
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No notifications found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{formatEventLabel(log.eventType)}</div>
                          {log.tournamentId && (
                            <div className="text-xs text-muted-foreground">Tournament #{log.tournamentId}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{formatRecipient(log)}</div>
                          {log.recipientEmail && log.recipientName && (
                            <div className="text-xs text-muted-foreground">{log.recipientEmail}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChannelBadge channel={log.channel} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={log.status} />
                          {log.errorMessage && (
                            <div className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={log.errorMessage}>
                              {log.errorMessage}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDateTime(log.sentAt ?? log.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            disabled={resendingId === log.id}
                            onClick={() => void handleResend(log.id)}
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${resendingId === log.id ? "animate-spin" : ""}`} />
                            Resend
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
