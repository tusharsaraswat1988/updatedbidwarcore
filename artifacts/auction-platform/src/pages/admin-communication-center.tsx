import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { EmailRichEditor } from "@/components/communication/email-rich-editor";
import {
  Activity,
  Archive,
  BarChart3,
  Copy,
  FileText,
  Image,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TabKey =
  | "dashboard"
  | "templates"
  | "pending"
  | "sent"
  | "drafts"
  | "logs"
  | "assets"
  | "settings"
  | "bulk";

function tabFromPath(path: string): TabKey {
  const segment = path.split("/").pop() ?? "dashboard";
  const valid: TabKey[] = ["dashboard", "templates", "pending", "sent", "drafts", "logs", "assets", "settings", "bulk"];
  return valid.includes(segment as TabKey) ? (segment as TabKey) : "dashboard";
}

interface Template {
  id: string;
  name: string;
  internalKey: string;
  subject: string;
  htmlBody: string;
  footerHtml: string | null;
  signatureHtml: string | null;
  isActive: boolean;
  autoSend: boolean;
  isDraft: boolean;
  isArchived: boolean;
  eventType: string | null;
  currentVersion: number;
}

interface CommJob {
  id: string;
  status: string;
  pendingReason: string | null;
  subject: string | null;
  htmlBody: string | null;
  templateInternalKey: string | null;
  tournamentId: number | null;
  triggeredByEvent: string | null;
  retryCount: number;
  sentAt: string | null;
  createdAt: string;
  sentBy: string;
  recipient: {
    recipientName: string | null;
    recipientEmail: string | null;
    recipientRole: string | null;
  } | null;
}

interface DashboardData {
  totalEmails: number;
  sentToday: number;
  pending: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  readyToSend: number;
  topTemplates: Array<{ templateKey: string; templateName: string; count: number }>;
  recentActivity: Array<{ id: string; action: string; recipientEmail: string | null; recipientName: string | null; status: string | null; createdAt: string }>;
  graphData: Array<{ date: string; sent: number; failed: number; pending: number }>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    ready_to_send: "bg-blue-500/20 text-blue-400",
    queued: "bg-indigo-500/20 text-indigo-300",
    processing: "bg-purple-500/20 text-purple-300",
    delivered: "bg-green-500/20 text-green-400",
    opened: "bg-emerald-500/20 text-emerald-300",
    clicked: "bg-teal-500/20 text-teal-300",
    failed: "bg-red-500/20 text-red-400",
    cancelled: "bg-muted/20 text-muted-foreground",
    draft: "bg-slate-500/20 text-slate-300",
  };
  return (
    <Badge className={`text-[10px] uppercase ${map[status] ?? "bg-muted/20 text-muted-foreground"}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function AdminCommunicationCenter() {
  const { isLoggedIn, isLoading, isMaster } = useAdminPageGuard();
  const [location, navigate] = useLocation();
  const [tab, setTab] = useState<TabKey>(() => tabFromPath(location));

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<CommJob[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, unknown>>>([]);
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true });
  const [testEmail, setTestEmail] = useState("");
  const [viewJob, setViewJob] = useState<CommJob | null>(null);
  const [editRecipient, setEditRecipient] = useState<{ jobId: string; email: string; name: string } | null>(null);

  const [bulkTemplateId, setBulkTemplateId] = useState("");
  const [bulkFilterType, setBulkFilterType] = useState("players");
  const [bulkTournamentId, setBulkTournamentId] = useState("");
  const [bulkRecipients, setBulkRecipients] = useState<Array<{ name: string | null; email: string; role: string }>>([]);
  const [tournaments, setTournaments] = useState<Array<{ id: number; name: string }>>([]);

  const apiBase = "/api/auth/admin/communication-center";

  const fetchDashboard = useCallback(async () => {
    const res = await fetch(`${apiBase}/dashboard`, { credentials: "include" });
    if (res.ok) setDashboard(await res.json());
  }, [apiBase]);

  const fetchTemplates = useCallback(async (drafts = false) => {
    const res = await fetch(`${apiBase}/templates?includeDrafts=${drafts}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.templates ?? []);
    }
  }, [apiBase]);

  const fetchJobs = useCallback(async (opts?: { status?: string; statuses?: string[]; pending?: boolean }) => {
    const params = new URLSearchParams({ limit: "100" });
    if (opts?.status) params.set("status", opts.status);
    if (opts?.statuses) params.set("statuses", opts.statuses.join(","));
    if (opts?.pending) params.set("pendingReason", "email_missing");
    if (search) params.set("search", search);
    if (statusFilter !== "all" && !opts?.status && !opts?.statuses) params.set("status", statusFilter);

    const res = await fetch(`${apiBase}/jobs?${params}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setJobs(data.jobs ?? []);
    }
  }, [apiBase, search, statusFilter]);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (search) params.set("search", search);
    const res = await fetch(`${apiBase}/logs?${params}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs ?? []);
    }
  }, [apiBase, search]);

  const fetchAssets = useCallback(async () => {
    const res = await fetch(`${apiBase}/assets`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setAssets(data.assets ?? []);
    }
  }, [apiBase]);

  const loadTab = useCallback(async (t: TabKey) => {
    setLoading(true);
    try {
      if (t === "dashboard") await fetchDashboard();
      else if (t === "templates") await fetchTemplates(false);
      else if (t === "drafts") await fetchTemplates(true);
      else if (t === "pending") await fetchJobs({ statuses: ["pending", "ready_to_send", "draft"] });
      else if (t === "sent") await fetchJobs({ statuses: ["delivered", "opened", "clicked", "failed", "queued", "processing"] });
      else if (t === "logs") await fetchLogs();
      else if (t === "assets") await fetchAssets();
      else if (t === "bulk") {
        await fetchTemplates(false);
        const tRes = await fetch("/api/tournaments", { credentials: "include" });
        if (tRes.ok) {
          const tData = await tRes.json();
          setTournaments(Array.isArray(tData) ? tData.map((x: { id: number; name: string }) => ({ id: x.id, name: x.name })) : []);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, fetchTemplates, fetchJobs, fetchLogs, fetchAssets]);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadTab(tab);
  }, [isLoggedIn, tab, loadTab]);

  const changeTab = (t: TabKey) => {
    setTab(t);
    navigate(`/admin/communication/${t}`);
  };

  const sendJob = async (jobId: string) => {
    await fetch(`${apiBase}/jobs/${jobId}/send`, { method: "POST", credentials: "include" });
    void loadTab(tab);
  };

  const sendAllReady = async () => {
    await fetch(`${apiBase}/jobs/bulk-send`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allReady: true }),
    });
    void loadTab(tab);
  };

  const retryFailed = async () => {
    await fetch(`${apiBase}/jobs/retry-failed`, { method: "POST", credentials: "include" });
    void loadTab(tab);
  };

  const saveTemplate = async () => {
    if (!editingTemplate && !templateForm.name) return;
    const url = editingTemplate
      ? `${apiBase}/templates/${editingTemplate.id}`
      : `${apiBase}/templates`;
    const method = editingTemplate ? "PUT" : "POST";
    await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...templateForm, isDraft: false }),
    });
    setEditingTemplate(null);
    setShowTemplateDialog(false);
    void loadTab("templates");
  };

  const sendTestEmail = async () => {
    if (!editingTemplate || !testEmail) return;
    await fetch(`${apiBase}/templates/${editingTemplate.id}/test`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });
  };

  const previewBulkRecipients = async () => {
    const res = await fetch(`${apiBase}/bulk/preview-recipients`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: bulkFilterType,
        tournamentId: bulkTournamentId ? Number(bulkTournamentId) : undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setBulkRecipients(data.recipients ?? []);
    }
  };

  const queueBulk = async () => {
    await fetch(`${apiBase}/bulk/queue`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: bulkTemplateId,
        filter: { type: bulkFilterType, tournamentId: Number(bulkTournamentId) },
        sendImmediately: true,
      }),
    });
    changeTab("sent");
  };

  if (isLoading || !isLoggedIn) {
    return (
      <AdminShell title="Communication Center">
        <div className="space-y-4 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Communication Center">
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Communication Center</h1>
            <p className="text-sm text-muted-foreground">Recipient & job-based email engine — nothing gets lost</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recipient, email, template..."
                className="w-64 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void loadTab(tab)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => void loadTab(tab)}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => changeTab(v as TabKey)}>
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="dashboard"><BarChart3 className="mr-1 h-3.5 w-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="templates"><FileText className="mr-1 h-3.5 w-3.5" />Templates</TabsTrigger>
            <TabsTrigger value="pending"><Mail className="mr-1 h-3.5 w-3.5" />Pending</TabsTrigger>
            <TabsTrigger value="sent"><Send className="mr-1 h-3.5 w-3.5" />Sent</TabsTrigger>
            <TabsTrigger value="drafts"><Archive className="mr-1 h-3.5 w-3.5" />Drafts</TabsTrigger>
            <TabsTrigger value="bulk"><Copy className="mr-1 h-3.5 w-3.5" />Bulk</TabsTrigger>
            <TabsTrigger value="logs"><Activity className="mr-1 h-3.5 w-3.5" />Logs</TabsTrigger>
            <TabsTrigger value="assets"><Image className="mr-1 h-3.5 w-3.5" />Assets</TabsTrigger>
            <TabsTrigger value="settings"><Settings className="mr-1 h-3.5 w-3.5" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            {loading || !dashboard ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total Emails", value: dashboard.totalEmails },
                    { label: "Sent Today", value: dashboard.sentToday },
                    { label: "Pending", value: dashboard.pending },
                    { label: "Ready to Send", value: dashboard.readyToSend },
                    { label: "Delivered", value: dashboard.delivered },
                    { label: "Failed", value: dashboard.failed },
                    { label: "Opened", value: dashboard.opened },
                    { label: "Bounced", value: dashboard.bounced },
                  ].map((s) => (
                    <Card key={s.label}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{s.value}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader><CardTitle className="text-base">Communication Graph (14 days)</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.graphData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="sent" fill="#22c55e" name="Sent" />
                          <Bar dataKey="failed" fill="#ef4444" name="Failed" />
                          <Bar dataKey="pending" fill="#eab308" name="Pending" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-base">Top Templates</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {dashboard.topTemplates.map((t) => (
                          <div key={t.templateKey} className="flex justify-between text-sm">
                            <span>{t.templateName}</span>
                            <Badge variant="secondary">{t.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dashboard.recentActivity.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{a.action}</TableCell>
                            <TableCell className="text-xs">{a.recipientName ?? a.recipientEmail ?? "—"}</TableCell>
                            <TableCell>{a.status ? <StatusBadge status={a.status} /> : "—"}</TableCell>
                            <TableCell className="text-xs">{formatDate(a.createdAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between">
              <h2 className="text-lg font-semibold">Email Templates</h2>
              {isMaster && (
                <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: "", internalKey: "", subject: "", htmlBody: "", autoSend: true, isActive: true }); setShowTemplateDialog(true); }}>
                  New Template
                </Button>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Auto Send</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.filter((t) => !t.isDraft).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="font-mono text-xs">{t.internalKey}</TableCell>
                        <TableCell>{t.autoSend ? "ON" : "OFF"}</TableCell>
                        <TableCell>{t.isActive ? <Badge className="bg-green-500/20 text-green-400">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                        <TableCell>v{t.currentVersion}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingTemplate(t); setTemplateForm({ name: t.name, internalKey: t.internalKey, subject: t.subject, htmlBody: t.htmlBody, autoSend: t.autoSend, isActive: t.isActive }); setShowTemplateDialog(true); }}>
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={() => void sendAllReady()}><Send className="mr-1 h-4 w-4" />Send All Ready</Button>
              <Button variant="outline" onClick={() => void retryFailed()}><RotateCcw className="mr-1 h-4 w-4" />Retry Failed</Button>
            </div>
            <JobsTable jobs={jobs} onSend={sendJob} onView={setViewJob} onEditRecipient={(j) => setEditRecipient({ jobId: j.id, email: j.recipient?.recipientEmail ?? "", name: j.recipient?.recipientName ?? "" })} />
          </TabsContent>

          <TabsContent value="sent">
            <div className="mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Filter status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <JobsTable jobs={jobs} onSend={sendJob} onView={setViewJob} showSent />
          </TabsContent>

          <TabsContent value="drafts">
            <JobsTable jobs={templates.filter((t) => t.isDraft).map((t) => ({
              id: t.id,
              status: "draft",
              pendingReason: null,
              subject: t.subject,
              htmlBody: t.htmlBody,
              templateInternalKey: t.internalKey,
              tournamentId: null,
              triggeredByEvent: null,
              retryCount: 0,
              sentAt: null,
              createdAt: "",
              sentBy: "admin",
              recipient: null,
            }))} onSend={() => {}} onView={() => {}} />
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Bulk Communication</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label>Tournament</Label>
                    <Select value={bulkTournamentId} onValueChange={setBulkTournamentId}>
                      <SelectTrigger><SelectValue placeholder="Select tournament" /></SelectTrigger>
                      <SelectContent>
                        {tournaments.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Recipient Filter</Label>
                    <Select value={bulkFilterType} onValueChange={setBulkFilterType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="players">All Players</SelectItem>
                        <SelectItem value="selected_players">Selected Players</SelectItem>
                        <SelectItem value="unsold_players">Unsold Players</SelectItem>
                        <SelectItem value="men">Men</SelectItem>
                        <SelectItem value="women">Women</SelectItem>
                        <SelectItem value="team_owners">Team Owners</SelectItem>
                        <SelectItem value="organisers">Organisers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Template</Label>
                    <Select value={bulkTemplateId} onValueChange={setBulkTemplateId}>
                      <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void previewBulkRecipients()}>Preview Recipients</Button>
                  <Button onClick={() => void queueBulk()} disabled={!bulkTemplateId || bulkRecipients.length === 0}>
                    Queue {bulkRecipients.length} Emails
                  </Button>
                </div>
                {bulkRecipients.length > 0 && (
                  <p className="text-sm text-muted-foreground">{bulkRecipients.length} recipients selected</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={String(l.id)}>
                        <TableCell className="text-xs">{String(l.action)}</TableCell>
                        <TableCell className="text-xs">{String(l.recipientEmail ?? l.recipientName ?? "—")}</TableCell>
                        <TableCell className="text-xs">{String(l.previousStatus ?? "")} → {String(l.newStatus ?? "")}</TableCell>
                        <TableCell className="text-xs">{String(l.createdBy ?? "—")}</TableCell>
                        <TableCell className="text-xs">{formatDate(String(l.createdAt))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Key</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Content</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map((a) => (
                      <TableRow key={String(a.id)}>
                        <TableCell>{String(a.name)}</TableCell>
                        <TableCell className="font-mono text-xs">{String(a.assetKey)}</TableCell>
                        <TableCell>{String(a.assetType)}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">{String(a.content)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>Communication Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>Email delivery uses the queue worker with exponential retry (max 5 attempts).</p>
                <p>Configure <code>EMAIL_ENABLED</code>, <code>RESEND_API_KEY</code>, and <code>MAIL_FROM</code> in environment variables.</p>
                <p>Worker poll interval: <code>COMMUNICATION_WORKER_POLL_MS</code> (default 5000ms).</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? `Edit: ${editingTemplate.name}` : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div><Label>Name</Label><Input value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Internal Key</Label><Input value={templateForm.internalKey} onChange={(e) => setTemplateForm((f) => ({ ...f, internalKey: e.target.value }))} disabled={!!editingTemplate} /></div>
            </div>
            <div><Label>Subject</Label><Input value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={templateForm.autoSend} onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, autoSend: v }))} /><Label>Auto Send</Label></div>
              <div className="flex items-center gap-2"><Switch checked={templateForm.isActive} onCheckedChange={(v) => setTemplateForm((f) => ({ ...f, isActive: v }))} /><Label>Active</Label></div>
            </div>
            <EmailRichEditor value={templateForm.htmlBody} onChange={(html) => setTemplateForm((f) => ({ ...f, htmlBody: html }))} previewSubject={templateForm.subject} />
            {editingTemplate && (
              <div className="flex gap-2">
                <Input placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
                <Button variant="outline" onClick={() => void sendTestEmail()}>Send Test</Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTemplateDialog(false); setEditingTemplate(null); }}>Cancel</Button>
            <Button onClick={() => void saveTemplate()} disabled={!isMaster}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewJob} onOpenChange={() => setViewJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Email Preview</DialogTitle></DialogHeader>
          {viewJob && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Subject: {viewJob.subject}</p>
              <div className="max-h-96 overflow-auto rounded border bg-white p-4 text-black" dangerouslySetInnerHTML={{ __html: viewJob.htmlBody ?? "" }} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRecipient} onOpenChange={() => setEditRecipient(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Recipient</DialogTitle></DialogHeader>
          {editRecipient && (
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={editRecipient.name} onChange={(e) => setEditRecipient((r) => r ? { ...r, name: e.target.value } : null)} /></div>
              <div><Label>Email</Label><Input value={editRecipient.email} onChange={(e) => setEditRecipient((r) => r ? { ...r, email: e.target.value } : null)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={async () => {
              if (!editRecipient) return;
              await fetch(`${apiBase}/jobs/${editRecipient.jobId}/recipient`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ recipientEmail: editRecipient.email, recipientName: editRecipient.name }),
              });
              setEditRecipient(null);
              void loadTab(tab);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function JobsTable({
  jobs,
  onSend,
  onView,
  onEditRecipient,
  showSent,
}: {
  jobs: CommJob[];
  onSend: (id: string) => void;
  onView: (job: CommJob) => void;
  onEditRecipient?: (job: CommJob) => void;
  showSent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell>
                  <div className="text-sm font-medium">{j.recipient?.recipientName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{j.recipient?.recipientEmail ?? "No email"}</div>
                </TableCell>
                <TableCell className="text-xs">{j.recipient?.recipientRole ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono">{j.templateInternalKey ?? "—"}</TableCell>
                <TableCell className="text-xs">{formatDate(j.createdAt)}</TableCell>
                <TableCell className="text-xs">{j.pendingReason?.replace(/_/g, " ") ?? "—"}</TableCell>
                <TableCell><StatusBadge status={j.status} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!showSent && (j.status === "ready_to_send" || j.status === "pending") && (
                      <Button size="sm" variant="ghost" onClick={() => onSend(j.id)}><Send className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => onView(j)}>View</Button>
                    {onEditRecipient && (
                      <Button size="sm" variant="ghost" onClick={() => onEditRecipient(j)}>Edit</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function CommunicationHistoryPanel({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [history, setHistory] = useState<CommJob[]>([]);

  useEffect(() => {
    void fetch(`/api/auth/admin/communication-center/history/${entityType}/${entityId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []));
  }, [entityType, entityId]);

  if (!history.length) return <p className="text-sm text-muted-foreground">No communication history.</p>;

  return (
    <div className="space-y-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
          <div>
            <div className="font-medium">{h.templateInternalKey ?? h.triggeredByEvent ?? "Email"}</div>
            <div className="text-xs text-muted-foreground">{formatDate(h.sentAt ?? h.createdAt)}</div>
          </div>
          <StatusBadge status={h.status} />
        </div>
      ))}
    </div>
  );
}
