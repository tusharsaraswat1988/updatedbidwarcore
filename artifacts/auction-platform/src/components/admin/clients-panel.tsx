import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
  Globe,
  Tag,
  UploadCloud,
  CheckCircle2,
  Briefcase,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ClientRow = {
  id: number;
  name: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  websiteUrl: string | null;
  clientType: "brand" | "organisation" | string;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export function ClientsPanel() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<ClientRow | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPublicId, setLogoPublicId] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [clientType, setClientType] = useState<"brand" | "organisation">("brand");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin/clients", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as ClientRow[];
        setClients(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditItem(null);
    setName("");
    setLogoUrl("");
    setLogoPublicId(null);
    setWebsiteUrl("");
    setClientType("brand");
    setActive(true);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(item: ClientRow) {
    setEditItem(item);
    setName(item.name);
    setLogoUrl(item.logoUrl ?? "");
    setLogoPublicId(item.logoPublicId ?? null);
    setWebsiteUrl(item.websiteUrl ?? "");
    setClientType(item.clientType === "organisation" ? "organisation" : "brand");
    setActive(item.active);
    setError(null);
    setFormOpen(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/image", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string; publicId?: string };
        setLogoUrl(data.url);
        if (data.publicId) setLogoPublicId(data.publicId);
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Image upload failed");
      }
    } catch {
      setError("Image upload network error");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Brand/Organisation name is required");
      return;
    }
    setSaving(true);
    setError(null);

    // Format website URL if user omitted protocol
    let formattedWebsite = websiteUrl.trim();
    if (formattedWebsite && !/^https?:\/\//i.test(formattedWebsite)) {
      formattedWebsite = `https://${formattedWebsite}`;
    }

    const payload = {
      name: name.trim(),
      logoUrl: logoUrl.trim() || null,
      logoPublicId,
      websiteUrl: formattedWebsite || null,
      clientType,
      active,
    };

    try {
      const url = editItem
        ? `/api/auth/admin/clients/${editItem.id}`
        : "/api/auth/admin/clients";
      const method = editItem ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (res.ok) {
        setFormOpen(false);
        void load();
      } else {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Failed to save client");
      }
    } catch {
      setError("Network error occurred while saving client");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to remove this client?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/auth/admin/clients/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      void load();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleActive(item: ClientRow) {
    try {
      await fetch(`/api/auth/admin/clients/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
        credentials: "include",
      });
      void load();
    } catch {
      // ignore
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= clients.length) return;
    const ids = clients.map((c) => c.id);
    const tmp = ids[target];
    ids[target] = ids[index];
    ids[index] = tmp;

    try {
      await fetch("/api/auth/admin/clients/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
        credentials: "include",
      });
      void load();
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Our Clients & Partners
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Manage client logos, names, and website links displayed in the &quot;OUR CLIENTS&quot; section on the BidWar homepage.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 flex-shrink-0" onClick={openAdd}>
            <Plus className="w-3.5 h-3.5" /> Add Client
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border/40 rounded-2xl">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No clients found. Add your first brand or partner organisation.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {clients.map((client, i) => {
              const initials = client.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0].toUpperCase())
                .join("");

              return (
                <motion.div
                  key={client.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3.5 p-3.5 rounded-xl border border-border/40 bg-card/50 hover:bg-card/80 transition-colors group"
                >
                  {/* Logo or Monogram */}
                  <div className="w-14 h-12 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {client.logoUrl ? (
                      <img
                        src={client.logoUrl}
                        alt={client.name}
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <span className="font-display font-bold text-xs tracking-wider text-amber-400/90">
                        {initials || "BW"}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white truncate">
                        {client.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] uppercase px-1.5 h-4 flex items-center gap-1 ${
                          client.clientType === "organisation"
                            ? "border-sky-500/40 text-sky-400 bg-sky-500/10"
                            : "border-amber-500/40 text-amber-400 bg-amber-500/10"
                        }`}
                      >
                        {client.clientType === "organisation" ? (
                          <>
                            <Trophy className="w-2.5 h-2.5" /> Organisation
                          </>
                        ) : (
                          <>
                            <Briefcase className="w-2.5 h-2.5" /> Brand / Firm
                          </>
                        )}
                      </Badge>
                      {!client.active && (
                        <Badge
                          variant="outline"
                          className="text-[9px] text-muted-foreground border-white/20 h-4 px-1"
                        >
                          Hidden
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {client.websiteUrl ? (
                        <a
                          href={client.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline truncate max-w-[260px]"
                        >
                          <Globe className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{client.websiteUrl}</span>
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/60 italic">
                          No website link
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={i === 0}
                      onClick={() => void handleMove(i, -1)}
                      title="Move up"
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      disabled={i === clients.length - 1}
                      onClick={() => void handleMove(i, 1)}
                      title="Move down"
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => void handleToggleActive(client)}
                      title={client.active ? "Hide from homepage" : "Show on homepage"}
                      aria-label={client.active ? "Hide from homepage" : "Show on homepage"}
                    >
                      {client.active ? (
                        <Eye className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(client)}
                      title="Edit"
                      aria-label={`Edit ${client.name}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => void handleDelete(client.id)}
                      disabled={deleting === client.id}
                      title="Delete"
                      aria-label={`Delete ${client.name}`}
                    >
                      {deleting === client.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {clients.length > 0 && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/20">
            <span>
              {clients.filter((c) => c.active).length} of {clients.length} clients visible on homepage
            </span>
            <span className="text-muted-foreground/60">
              Changes reflect immediately on the landing page
            </span>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg bg-card/95 border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              {editItem ? "Edit Client / Partner" : "Add New Client / Partner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs">
                {error}
              </div>
            )}

            {/* Logo Upload & Preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Brand / Organisation Logo
              </Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-16 rounded-lg bg-black/60 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-contain p-1.5"
                    />
                  ) : (
                    <span className="text-[11px] text-muted-foreground/50 text-center px-1">
                      No logo
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) await handleUpload(f);
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 pointer-events-none"
                        disabled={uploading}
                        type="button"
                      >
                        {uploading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5" />
                        )}
                        {logoUrl ? "Replace Logo" : "Upload Logo"}
                      </Button>
                    </label>

                    {logoUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8"
                        onClick={() => {
                          setLogoUrl("");
                          setLogoPublicId(null);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    PNG, SVG, WebP, or JPEG (transparent background looks best)
                  </p>
                </div>
              </div>
            </div>

            {/* Brand / Organisation Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Brand / Organisation Name *
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vyapari Network, Rotary Shine, SJMAA"
                className="text-sm"
                maxLength={140}
              />
            </div>

            {/* Client Type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Client Classification
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setClientType("brand")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
                    clientType === "brand"
                      ? "border-amber-400 bg-amber-400/15 text-amber-300"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Company / Firm / Brand</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClientType("organisation")}
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-semibold transition ${
                    clientType === "organisation"
                      ? "border-sky-400 bg-sky-400/15 text-sky-300"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card"
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Auction Organisation</span>
                </button>
              </div>
            </div>

            {/* Optional Website Link */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Website Link (Optional)
              </Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="e.g. https://example.com"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                If provided, clicking the brand card on the homepage will redirect to their website.
              </p>
            </div>

            {/* Visibility Switch */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-white">
                  Visibility on Homepage
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Show or hide this client in the &quot;OUR CLIENTS&quot; section
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="text-xs text-muted-foreground">
                  {active ? "Active" : "Hidden"}
                </span>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || uploading}
                className="gap-1.5"
              >
                {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                {editItem ? "Save Changes" : "Add Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
