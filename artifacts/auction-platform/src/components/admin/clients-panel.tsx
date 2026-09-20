import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  UploadCloud,
  Briefcase,
  Trophy,
  Search,
  ImagePlus,
  AlertCircle,
  X,
  Sparkles,
  CheckCircle2,
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
import { uploadImageFile } from "@/lib/cloudinary-upload";

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
  const [searchQuery, setSearchQuery] = useState("");
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
  const [isDragging, setIsDragging] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setSuccessMessage(null);
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
    setSuccessMessage(null);
    setFormOpen(true);
  }

  async function handleFileProcess(file: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP, or SVG)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size exceeds 5 MB limit. Please choose a smaller image.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploaded = await uploadImageFile(file, file.name);
      setLogoUrl(uploaded.url);
      setLogoPublicId(uploaded.publicId || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload image";
      setError(msg);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Brand or Organisation name is required");
      return;
    }
    setSaving(true);
    setError(null);

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
        setError(d.error ?? "Failed to save client details");
      }
    } catch {
      setError("Network error occurred while saving client");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Are you sure you want to remove this client from the platform?")) return;
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

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.websiteUrl && c.websiteUrl.toLowerCase().includes(q)) ||
      (c.clientType && c.clientType.toLowerCase().includes(q))
    );
  });

  const activeCount = clients.filter((c) => c.active).length;

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 text-slate-100">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-white tracking-tight">
                  Our Clients & Partners
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage brand logos, club partners, and website links displayed in the homepage &quot;OUR CLIENTS&quot; showcase.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 border-0"
              onClick={openAdd}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Add Client
            </Button>
          </div>
        </div>

        {/* Stats & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-slate-900/80 border-white/10 text-xs px-2.5 py-1 text-slate-300">
              Total: <span className="font-semibold text-white ml-1">{clients.length}</span>
            </Badge>
            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/30 text-xs px-2.5 py-1 text-emerald-400">
              Active on Homepage: <span className="font-semibold ml-1">{activeCount}</span>
            </Badge>
            {clients.length - activeCount > 0 && (
              <Badge variant="outline" className="bg-slate-800/80 border-white/10 text-xs px-2.5 py-1 text-slate-400">
                Hidden: <span className="font-semibold ml-1">{clients.length - activeCount}</span>
              </Badge>
            )}
          </div>

          {clients.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients or links..."
                className="h-8.5 pl-8 pr-3 text-xs bg-slate-900/90 border-white/10 text-slate-200 placeholder:text-slate-500 rounded-lg focus:border-amber-400/50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Client List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-800/60" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-400 border border-dashed border-white/10 rounded-2xl bg-slate-900/30">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="font-display font-semibold text-white text-base">No clients added yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Add client logos, sponsor brands, or sports organisations to feature them in the homepage carousel.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-2 border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
              onClick={openAdd}
            >
              <Plus className="w-3.5 h-3.5" /> Add First Client
            </Button>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 border border-white/10 rounded-xl bg-slate-900/40">
            <Search className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="text-sm font-medium text-slate-300">No matching clients found</p>
            <p className="text-xs text-slate-500 mt-0.5">Try clearing or adjusting your search term.</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3 text-xs text-amber-400 hover:bg-white/5"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {filteredClients.map((client, i) => {
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
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex items-center gap-3.5 p-3.5 rounded-xl border border-white/10 bg-[#121726]/90 hover:bg-[#161d30] transition-colors shadow-sm"
                  >
                    {/* Reorder controls */}
                    <div className="flex flex-col gap-0.5 -my-1 text-slate-400">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-white/10 hover:text-white disabled:opacity-20"
                        disabled={i === 0 || !!searchQuery}
                        onClick={() => void handleMove(i, -1)}
                        title="Move up"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 hover:bg-white/10 hover:text-white disabled:opacity-20"
                        disabled={i === clients.length - 1 || !!searchQuery}
                        onClick={() => void handleMove(i, 1)}
                        title="Move down"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {/* Logo or Monogram Thumbnail */}
                    <div className="w-14 h-12 rounded-lg bg-black/70 border border-white/15 flex items-center justify-center overflow-hidden flex-shrink-0 relative group/thumb shadow-inner">
                      {client.logoUrl ? (
                        <img
                          src={client.logoUrl}
                          alt={client.name}
                          className="w-full h-full object-contain p-1.5 transition-transform group-hover/thumb:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
                          <span className="font-display font-bold text-xs tracking-wider text-amber-400">
                            {initials || "BW"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-white truncate max-w-[320px]">
                          {client.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9.5px] font-medium tracking-wide uppercase px-2 py-0.5 h-4.5 flex items-center gap-1 rounded-md ${
                            client.clientType === "organisation"
                              ? "border-sky-500/40 text-sky-300 bg-sky-500/10"
                              : "border-amber-500/40 text-amber-300 bg-amber-500/10"
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
                            className="text-[9.5px] text-slate-400 bg-slate-800/80 border-white/10 h-4.5 px-1.5"
                          >
                            Hidden
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {client.websiteUrl ? (
                          <a
                            href={client.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 hover:underline truncate max-w-[280px]"
                          >
                            <Globe className="w-3 h-3 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{client.websiteUrl.replace(/^https?:\/\//i, "")}</span>
                            <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-70" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">
                            No website link attached
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-white/10"
                        onClick={() => void handleToggleActive(client)}
                        title={client.active ? "Click to hide from homepage" : "Click to show on homepage"}
                        aria-label={client.active ? "Hide client" : "Show client"}
                      >
                        {client.active ? (
                          <Eye className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-500" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-300 hover:text-white hover:bg-white/10"
                        onClick={() => openEdit(client)}
                        title="Edit client"
                        aria-label={`Edit ${client.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => void handleDelete(client.id)}
                        disabled={deleting === client.id}
                        title="Delete client"
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
            </AnimatePresence>
          </div>
        )}

        {clients.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 pt-3 border-t border-white/10 gap-2">
            <span>
              Showing {filteredClients.length} of {clients.length} total clients ({activeCount} active)
            </span>
            <span className="text-slate-500">
              Live updates reflect instantly on the public website showcase.
            </span>
          </div>
        )}
      </div>

      {/* Modern Modal Dialog - Non-transparent, Solid Clean UX */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className="max-w-md w-full bg-[#0e1320] border border-white/15 text-slate-100 shadow-[0_25px_70px_rgba(0,0,0,0.95)] rounded-2xl p-0 overflow-hidden"
          style={{ backgroundColor: "#0e1320" }}
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10 bg-[#121829]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Building2 className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <DialogTitle className="text-base font-bold text-white tracking-tight">
                    {editItem ? "Edit Client / Partner" : "Add Client / Partner"}
                  </DialogTitle>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {editItem ? "Update branding details and links" : "Add a brand, firm, or organisation to homepage"}
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[calc(85vh-140px)] overflow-y-auto">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-400 hover:text-rose-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Logo Upload Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Brand / Organisation Logo
                </Label>
                {logoUrl && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Logo Attached
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await handleFileProcess(f);
                  e.target.value = "";
                }}
              />

              {logoUrl ? (
                /* Attached Logo Preview Card */
                <div className="flex items-center gap-3.5 p-3 rounded-xl border border-white/15 bg-black/40">
                  <div className="w-20 h-16 rounded-lg bg-[#080b12] border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    <img
                      src={logoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-contain p-1.5"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs font-medium text-slate-200 truncate">Logo ready</p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 px-2.5 text-xs bg-slate-800/80 border-white/15 text-slate-200 hover:bg-slate-700"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploading ? (
                          <RefreshCw className="w-3 h-3 animate-spin mr-1.5" />
                        ) : (
                          <ImagePlus className="w-3 h-3 mr-1.5 text-amber-400" />
                        )}
                        Change
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        disabled={uploading}
                        onClick={() => {
                          setLogoUrl("");
                          setLogoPublicId(null);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Drag & Drop Upload Zone */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) await handleFileProcess(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-amber-400 bg-amber-400/10"
                      : "border-white/15 bg-black/20 hover:border-amber-400/40 hover:bg-black/40"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-amber-400">
                      {uploading ? (
                        <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">
                        {uploading ? "Uploading logo..." : "Click or drag logo here"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PNG, SVG, WebP, or JPEG (Max 5 MB • Transparent works best)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Brand / Organisation Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>Brand / Organisation Name *</span>
                <span className="text-[10px] text-slate-500 font-normal">{name.length}/140</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vyapari Network, Rotary Shine, SJMAA"
                className="h-9.5 text-sm bg-slate-900/90 border-white/15 text-white placeholder:text-slate-500 rounded-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                maxLength={140}
              />
            </div>

            {/* Client Classification */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Client Classification
              </Label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setClientType("brand")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    clientType === "brand"
                      ? "border-amber-400 bg-amber-500/15 text-white shadow-sm ring-1 ring-amber-400/30"
                      : "border-white/10 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Briefcase className={`w-4 h-4 mb-1 ${clientType === "brand" ? "text-amber-400" : "text-slate-400"}`} />
                  <span className="text-xs font-semibold">Brand / Firm</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Corporate & Sponsors</span>
                </button>

                <button
                  type="button"
                  onClick={() => setClientType("organisation")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition ${
                    clientType === "organisation"
                      ? "border-sky-400 bg-sky-500/15 text-white shadow-sm ring-1 ring-sky-400/30"
                      : "border-white/10 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Trophy className={`w-4 h-4 mb-1 ${clientType === "organisation" ? "text-sky-400" : "text-slate-400"}`} />
                  <span className="text-xs font-semibold">Organisation</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Club / Sports League</span>
                </button>
              </div>
            </div>

            {/* Website Link (Optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Website Link <span className="text-slate-500 font-normal">(Optional)</span>
              </Label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="e.g. vyaparinetwork.com or https://example.com"
                  className="h-9.5 pl-8 text-sm bg-slate-900/90 border-white/15 text-white placeholder:text-slate-500 rounded-xl focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Clicking the brand card on the homepage carousel will redirect visitors here.
              </p>
            </div>

            {/* Visibility Toggle Card */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-black/30">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold text-white">
                  Showcase on Homepage
                </Label>
                <p className="text-[11px] text-slate-400">
                  {active ? "Currently visible in the Our Clients section" : "Hidden from public view on homepage"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={active} onCheckedChange={setActive} />
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-white/10 bg-[#121829] flex items-center justify-end gap-2.5">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="text-slate-300 hover:text-white hover:bg-white/10"
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || uploading}
              className="gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-semibold shadow-lg shadow-amber-500/20 border-0 px-4"
            >
              {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {editItem ? "Save Changes" : "Add Client"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
