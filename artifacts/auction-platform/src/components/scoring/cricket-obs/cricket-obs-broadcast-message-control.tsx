/**
 * Cricket OBS Broadcast Message Operator Control
 * Live Chyron card operator console for pushing names & details to Cricket OBS.
 * 
 * Capabilities:
 * 1. Quick Message: Type Name & Details -> Push to OBS directly (no template required)
 * 2. Saved Templates: Create, Select, Edit, and Delete tournament-scoped templates
 * 3. Live State: Shows real-time "● LIVE ON OBS" status with one-click Close
 * 4. Stays separate from cricket scoring engine
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getCricketBroadcastMessageTemplates,
  createCricketBroadcastMessageTemplate,
  updateCricketBroadcastMessageTemplate,
  deleteCricketBroadcastMessageTemplate,
  type CricketBroadcastMessageTemplate,
} from "@/lib/scoring-api";
import type { CricketBroadcastMessage } from "@/lib/cricket-obs-view-model";
import {
  Tv,
  Radio,
  Send,
  XCircle,
  Bookmark,
  BookmarkPlus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: number;
  className?: string;
};

export function CricketObsBroadcastMessageControl({ tournamentId, className }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Active Broadcast Message State on OBS
  const [activeMessage, setActiveMessage] = useState<CricketBroadcastMessage | null>(null);

  // Form Inputs
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);

  // Template Manager Modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CricketBroadcastMessageTemplate | null>(null);
  const [templateFormName, setTemplateFormName] = useState("");
  const [templateFormDetails, setTemplateFormDetails] = useState("");

  // Fetch Saved Templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["cricket-broadcast-message-templates", tournamentId],
    queryFn: () => getCricketBroadcastMessageTemplates(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 15_000,
  });

  // Fetch Server OBS Director state (to know currently active broadcast message)
  const { data: serverState } = useQuery<{
    broadcastMessage?: CricketBroadcastMessage | null;
  }>({
    queryKey: ["cricket-obs-director", tournamentId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`);
        if (!res.ok) return { broadcastMessage: null };
        return await res.json();
      } catch {
        return { broadcastMessage: null };
      }
    },
    enabled: tournamentId > 0,
    staleTime: 5000,
  });

  useEffect(() => {
    if (serverState?.broadcastMessage !== undefined) {
      setActiveMessage(serverState.broadcastMessage);
    }
  }, [serverState?.broadcastMessage]);

  // Listen to cross-tab & SSE director events
  useEffect(() => {
    if (typeof window === "undefined" || !tournamentId) return;

    const handleSseDirector = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail && detail.broadcastMessage !== undefined) {
        setActiveMessage(detail.broadcastMessage);
      }
    };

    window.addEventListener("cricket_obs_director", handleSseDirector);

    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== "undefined") {
      try {
        channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
        channel.onmessage = (ev) => {
          const data = ev.data;
          if (data?.type === "SET_BROADCAST_MESSAGE") {
            setActiveMessage(data.broadcastMessage ?? null);
          } else if (data?.type === "CLEAR_BROADCAST_MESSAGE") {
            setActiveMessage(null);
          }
        };
      } catch {
        // ignore
      }
    }

    return () => {
      window.removeEventListener("cricket_obs_director", handleSseDirector);
      channel?.close();
    };
  }, [tournamentId]);

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: ({ tName, tDetails }: { tName: string; tDetails: string }) =>
      createCricketBroadcastMessageTemplate(tournamentId, tName, tDetails),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: ["cricket-broadcast-message-templates", tournamentId],
      });
      setSelectedTemplateId(created.id);
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      toast({
        title: "Template Saved",
        description: `Saved template "${created.name}" for future matches.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save template",
        description: err.message || "Could not save template",
        variant: "destructive",
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, tName, tDetails }: { id: number; tName: string; tDetails: string }) =>
      updateCricketBroadcastMessageTemplate(tournamentId, id, tName, tDetails),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: ["cricket-broadcast-message-templates", tournamentId],
      });
      setTemplateModalOpen(false);
      setEditingTemplate(null);
      if (selectedTemplateId === updated.id) {
        setName(updated.name);
        setDetails(updated.details);
      }
      toast({
        title: "Template Updated",
        description: `Updated template "${updated.name}".`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update template",
        description: err.message || "Could not update template",
        variant: "destructive",
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => deleteCricketBroadcastMessageTemplate(tournamentId, id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: ["cricket-broadcast-message-templates", tournamentId],
      });
      if (selectedTemplateId === deletedId) {
        setSelectedTemplateId(null);
      }
      toast({
        title: "Template Deleted",
        description: "Template removed from tournament saved list.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to delete template",
        description: err.message || "Could not delete template",
        variant: "destructive",
      });
    },
  });

  // Handle Push to OBS
  const [isPushing, setIsPushing] = useState(false);
  const handlePushToObs = useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedDetails = details.trim();

    if (!trimmedName) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the broadcast message card (1-100 characters).",
        variant: "destructive",
      });
      return;
    }

    if (trimmedName.length > 100) {
      toast({
        title: "Name Too Long",
        description: "Name must be 100 characters or fewer.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedDetails) {
      toast({
        title: "Details Required",
        description: "Please enter a details line for the broadcast message (1-180 characters).",
        variant: "destructive",
      });
      return;
    }

    if (trimmedDetails.length > 180) {
      toast({
        title: "Details Too Long",
        description: "Details must be 180 characters or fewer.",
        variant: "destructive",
      });
      return;
    }

    setIsPushing(true);
    const msg: CricketBroadcastMessage = {
      active: true,
      name: trimmedName,
      details: trimmedDetails,
    };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType: "broadcast_message",
          broadcastMessage: msg,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to push message to OBS");
      }

      setActiveMessage(msg);

      // Local BroadcastChannel fallback
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
          ch.postMessage({ type: "SET_BROADCAST_MESSAGE", broadcastMessage: msg });
          ch.close();
        } catch {
          // ignore
        }
      }

      toast({
        title: "Broadcast Message Live",
        description: `Pushed "${trimmedName}" to OBS broadcast card.`,
      });
    } catch (err: any) {
      toast({
        title: "Push Failed",
        description: err.message || "Could not push message to OBS screen",
        variant: "destructive",
      });
    } finally {
      setIsPushing(false);
    }
  }, [name, details, tournamentId, toast]);

  // Handle Close / Clear from OBS
  const [isClosing, setIsClosing] = useState(false);
  const handleCloseMessage = useCallback(async () => {
    setIsClosing(true);
    const msg: CricketBroadcastMessage = {
      active: false,
      name: "",
      details: "",
    };

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType: "broadcast_message",
          broadcastMessage: msg,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to close broadcast message");
      }

      setActiveMessage(null);

      // Local BroadcastChannel fallback
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
          ch.postMessage({ type: "CLEAR_BROADCAST_MESSAGE" });
          ch.close();
        } catch {
          // ignore
        }
      }

      toast({
        title: "Broadcast Message Closed",
        description: "Removed broadcast message card from OBS screen.",
      });
    } catch (err: any) {
      toast({
        title: "Close Failed",
        description: err.message || "Could not clear message from OBS",
        variant: "destructive",
      });
    } finally {
      setIsClosing(false);
    }
  }, [tournamentId, toast]);

  // Handle selecting a template
  const handleSelectTemplate = (templateIdStr: string) => {
    if (!templateIdStr || templateIdStr === "none") {
      setSelectedTemplateId(null);
      return;
    }
    const id = parseInt(templateIdStr, 10);
    const found = templates.find((t) => t.id === id);
    if (found) {
      setSelectedTemplateId(id);
      setName(found.name);
      setDetails(found.details);
    }
  };

  // Handle Save as Template directly from current form
  const handleSaveCurrentAsTemplate = () => {
    const trimmedName = name.trim();
    const trimmedDetails = details.trim();
    if (!trimmedName || !trimmedDetails) {
      toast({
        title: "Fill Name & Details",
        description: "Please enter both name and details before saving template.",
        variant: "destructive",
      });
      return;
    }

    createTemplateMutation.mutate({
      tName: trimmedName,
      tDetails: trimmedDetails,
    });
  };

  const isLiveActive = Boolean(activeMessage?.active && activeMessage?.name);

  return (
    <div className={cn("rounded-xl border border-border bg-card/80 p-4 shadow-sm space-y-4", className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-bold">
            <Tv className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight flex items-center gap-2">
              Broadcast Message
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Lower-third chyron card for VIP guests, commentators, sponsors &amp; officials.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setEditingTemplate(null);
            setTemplateFormName(name);
            setTemplateFormDetails(details);
            setTemplateModalOpen(true);
          }}
          className="h-7 text-xs font-semibold gap-1 px-2.5 rounded-lg border-border hover:bg-muted"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-500" />
          <span>Saved Messages ({templates.length})</span>
        </Button>
      </div>

      {/* ACTIVE ON OBS BANNER (When Active) */}
      {isLiveActive && activeMessage ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-red-500 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded-full">
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                LIVE ON OBS
              </span>
              <span className="text-xs font-black text-foreground truncate">
                {activeMessage.name}
              </span>
            </div>
            {activeMessage.details ? (
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {activeMessage.details}
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isClosing}
            onClick={handleCloseMessage}
            className="h-8 px-3 text-xs font-bold gap-1.5 shrink-0 shadow-sm"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{isClosing ? "Closing…" : "Close Card"}</span>
          </Button>
        </div>
      ) : null}

      {/* OPERATOR INPUT CONTROLS */}
      <div className="space-y-3">
        {/* Name Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="broadcast-msg-name-input" className="text-xs font-semibold text-foreground">
              Person / Entity Name <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {name.length}/100
            </span>
          </div>
          <Input
            id="broadcast-msg-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Rahul Sharma, ABC Motors, Guest of Honour"
            className="h-9 text-xs font-medium"
          />
        </div>

        {/* Details Input */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="broadcast-msg-details-input" className="text-xs font-semibold text-foreground">
              Details Line <span className="text-red-500">*</span>
            </label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {details.length}/180
            </span>
          </div>
          <Input
            id="broadcast-msg-details-input"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={180}
            placeholder="e.g. Former India Player & Special Guest, Title Sponsor Representative"
            className="h-9 text-xs font-medium"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={createTemplateMutation.isPending || !name.trim() || !details.trim()}
            onClick={handleSaveCurrentAsTemplate}
            className="h-8 text-xs font-semibold gap-1.5 px-3 rounded-lg border-border hover:bg-muted"
            title="Save these details as a reusable template"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-amber-500" />
            <span>Save Template</span>
          </Button>

          <div className="flex items-center gap-2">
            {isLiveActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isClosing}
                onClick={handleCloseMessage}
                className="h-8 px-3 text-xs font-bold gap-1 rounded-lg border-border text-red-500 hover:bg-red-500/10"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Close</span>
              </Button>
            ) : null}

            <Button
              type="button"
              size="sm"
              disabled={isPushing || !name.trim() || !details.trim()}
              onClick={handlePushToObs}
              className="h-8 px-4 text-xs font-bold gap-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPushing ? "Pushing…" : isLiveActive ? "Update OBS Card" : "Push to OBS"}</span>
            </Button>
          </div>
        </div>

        {/* Saved Templates Quick List / Dropdown */}
        {templates.length > 0 ? (
          <div className="space-y-1.5 pt-2.5 border-t border-border/50">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground pb-0.5">
              <span className="flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-foreground font-bold">Quick Templates ({templates.length})</span>
              </span>
              <span className="text-[10px] text-muted-foreground">Click to fill inputs</span>
            </div>

            {templates.length <= 6 ? (
              /* Compact Interactive List for <= 6 templates */
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
                {templates.map((t) => {
                  const isSelected = selectedTemplateId === t.id || (name === t.name && details === t.details);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelectTemplate(String(t.id))}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border text-left transition-all text-xs group cursor-pointer",
                        isSelected
                          ? "border-amber-500/60 bg-amber-500/10 text-amber-200 ring-1 ring-amber-500/30"
                          : "border-border/60 bg-background/50 hover:bg-muted/70 hover:border-border text-foreground"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-xs truncate group-hover:text-amber-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="truncate">{t.name}</span>
                        </div>
                        {t.details && (
                          <div className="text-[10px] text-muted-foreground truncate pl-3 mt-0.5">
                            {t.details}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 transition-colors",
                        isSelected
                          ? "bg-amber-500 text-black font-black"
                          : "bg-muted text-muted-foreground group-hover:bg-amber-500/20 group-hover:text-amber-300"
                      )}>
                        {isSelected ? "Active" : "Use"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Dropdown if > 6 templates to prevent layout overflow */
              <div className="space-y-1">
                <select
                  id="broadcast-msg-template-select"
                  aria-label="Select saved template"
                  value={selectedTemplateId ?? "none"}
                  onChange={(e) => handleSelectTemplate(e.target.value)}
                  className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="none">-- Select from {templates.length} saved templates --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.details})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* TEMPLATE MANAGEMENT MODAL */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <DialogTitle className="text-base font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500" />
              <span>Broadcast Message Templates</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved chyron templates for fast one-click broadcast during live matches.
            </p>
          </DialogHeader>

          <div className="p-4 sm:p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Template Add / Edit Form */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>{editingTemplate ? "Edit Template" : "New Template"}</span>
                {editingTemplate ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateFormName("");
                      setTemplateFormDetails("");
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline"
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <div>
                  <label htmlFor="template-form-name-input" className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Name (1-100 chars):
                  </label>
                  <Input
                    id="template-form-name-input"
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Rahul Sharma"
                    className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                  />
                </div>

                <div>
                  <label htmlFor="template-form-details-input" className="text-[11px] font-semibold text-slate-700 block mb-0.5">
                    Details Line (1-180 chars):
                  </label>
                  <Input
                    id="template-form-details-input"
                    value={templateFormDetails}
                    onChange={(e) => setTemplateFormDetails(e.target.value)}
                    maxLength={180}
                    placeholder="e.g. Former India Player & Special Guest"
                    className="h-8 text-xs bg-white text-slate-900 border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={
                    !templateFormName.trim() ||
                    !templateFormDetails.trim() ||
                    createTemplateMutation.isPending ||
                    updateTemplateMutation.isPending
                  }
                  onClick={() => {
                    if (editingTemplate) {
                      updateTemplateMutation.mutate({
                        id: editingTemplate.id,
                        tName: templateFormName.trim(),
                        tDetails: templateFormDetails.trim(),
                      });
                    } else {
                      createTemplateMutation.mutate({
                        tName: templateFormName.trim(),
                        tDetails: templateFormDetails.trim(),
                      });
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 px-3"
                >
                  {editingTemplate ? "Update Template" : "+ Add Template"}
                </Button>
              </div>
            </div>

            {/* Existing Saved Templates List */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Saved Tournament Templates ({templates.length})
              </div>

              {templates.length > 0 ? (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition shadow-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {t.name}
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          {t.details}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedTemplateId(t.id);
                            setName(t.name);
                            setDetails(t.details);
                            setTemplateModalOpen(false);
                            toast({
                              title: "Template Loaded",
                              description: `Loaded "${t.name}" into operator form.`,
                            });
                          }}
                          className="h-7 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 px-2"
                        >
                          Use
                        </Button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(t);
                            setTemplateFormName(t.name);
                            setTemplateFormDetails(t.details);
                          }}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                          title="Edit template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete template "${t.name}"?`)) {
                              deleteTemplateMutation.mutate(t.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-medium">
                  No saved templates yet. Use the form above to save reusable messages.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
