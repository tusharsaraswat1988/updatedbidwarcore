import { useState, useEffect, useCallback, useMemo, type ComponentType } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  X,
  Trash2,
  RefreshCw,
  ChevronRight,
  GripVertical,
  Layers,
  Users,
  ClipboardList,
  Eye,
  Pencil,
  Check,
  RotateCcw,
  Archive,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ADMIN_FLEX_SCROLL_CLASS } from "@/components/admin/admin-scroll-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminSpecOption = { id: number; optionName: string; displayOrder: number; active: boolean };
type AdminSpecGroup = {
  id: number;
  groupName: string;
  displayOrder: number;
  optional: boolean;
  active: boolean;
  options: AdminSpecOption[];
};
type AdminSportRole = {
  id: number;
  roleName: string;
  displayOrder: number;
  active: boolean;
  specGroups: AdminSpecGroup[];
};
type AdminSport = { id: number; name: string; slug: string; active: boolean; roles: AdminSportRole[] };

function byDisplayOrder<T extends { displayOrder: number }>(a: T, b: T) {
  return a.displayOrder - b.displayOrder;
}

function getSportMeta(slug: string) {
  const s = slug.toLowerCase();
  if (s.includes("cricket")) return { emoji: "🏏", engine: "Match Center V2", isLiveEngine: true };
  if (s.includes("badminton")) return { emoji: "🏸", engine: "Scoring Hub", isLiveEngine: true };
  if (s.includes("football") || s.includes("soccer")) return { emoji: "⚽", engine: "Auction Only", isLiveEngine: false };
  if (s.includes("kabaddi")) return { emoji: "🤼", engine: "Auction Only", isLiveEngine: false };
  if (s.includes("volleyball")) return { emoji: "🏐", engine: "Auction Only", isLiveEngine: false };
  if (s.includes("esport") || s.includes("gaming")) return { emoji: "🎮", engine: "Auction Only", isLiveEngine: false };
  return { emoji: "🏆", engine: "Auction Only", isLiveEngine: false };
}

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "cursor-grab touch-none text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing p-1 rounded hover:bg-muted/30 transition-colors",
        className
      )}
      aria-label="Drag to reorder"
    >
      <GripVertical className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Sortable role row ────────────────────────────────────────────────────────

function SortableRoleRow({
  role,
  selected,
  onSelect,
  onStartRename,
  onRemove,
}: {
  role: AdminSportRole;
  selected: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRemove: () => void;
}) {
  const specCount = role.specGroups.filter((g) => g.active).length;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: role.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-1.5 rounded-lg border transition-all text-sm px-2 py-1.5",
        selected
          ? "border-primary/40 bg-primary/10 text-primary shadow-xs"
          : "border-border/40 hover:border-border hover:bg-muted/30 text-foreground"
      )}
    >
      <div {...attributes} {...listeners}>
        <DragHandle />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center justify-between py-1 text-left min-w-0"
      >
        <span className={cn("truncate font-medium text-xs", selected ? "text-primary" : "text-foreground")}>
          {role.roleName}
        </span>
        <span className="text-[10px] text-muted-foreground ml-2 shrink-0 bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
          {specCount} {specCount === 1 ? "spec" : "specs"}
        </span>
      </button>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStartRename();
          }}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
          title="Rename role"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
          title="Remove role"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Sortable option row ──────────────────────────────────────────────────────

function SortableOptionRow({ option, onRemove }: { option: AdminSpecOption; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 pl-4 pr-2 py-1 rounded-md hover:bg-muted/30 transition-colors text-xs"
    >
      <div {...attributes} {...listeners}>
        <DragHandle className="!text-muted-foreground/30 hover:!text-muted-foreground" />
      </div>
      <span className="text-muted-foreground">•</span>
      <span className="flex-1 font-medium text-foreground">{option.optionName}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-destructive transition-colors p-1"
        title="Remove option"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Registration preview ─────────────────────────────────────────────────────

function RegistrationPreview({
  roleName,
  sportName,
  specGroups,
  previewSelections,
  onSelectionChange,
  onReset,
}: {
  roleName: string;
  sportName: string;
  specGroups: AdminSpecGroup[];
  previewSelections: Record<number, string>;
  onSelectionChange: (groupId: number, value: string) => void;
  onReset: () => void;
}) {
  const sortedGroups = useMemo(
    () => [...specGroups.filter((g) => g.active)].sort(byDisplayOrder),
    [specGroups],
  );

  return (
    <div className="p-6 space-y-5 max-w-xl mx-auto">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">Live Registration Preview</h4>
            <p className="text-xs text-muted-foreground">
              What players and organizers see during onboarding for {sportName}.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="h-7 text-xs gap-1">
          <RotateCcw className="w-3 h-3" /> Reset
        </Button>
      </div>

      <div className="rounded-xl border border-border/80 bg-card/90 p-5 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="preview-role" className="text-xs font-semibold text-foreground">
            Player Primary Role <span className="text-destructive">*</span>
          </Label>
          <Select value={roleName} disabled>
            <SelectTrigger id="preview-role" className="h-9 bg-muted/30 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value={roleName}>{roleName}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {sortedGroups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground italic">
            No specifications added yet for &quot;{roleName}&quot;. Switch to the Specifications tab to configure attributes like Batting Style, Bowling Arm, or Position.
          </div>
        ) : (
          sortedGroups.map((group) => {
            const options = [...group.options.filter((o) => o.active)].sort(byDisplayOrder);
            return (
              <div key={group.id} className="space-y-1.5">
                <Label htmlFor={`preview-group-${group.id}`} className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>
                    {group.groupName}
                    {!group.optional && <span className="text-destructive ml-0.5">*</span>}
                  </span>
                  {group.optional && (
                    <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
                  )}
                </Label>
                {options.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic pl-1">No options configured in catalog</p>
                ) : (
                  <Select
                    value={previewSelections[group.id] ?? ""}
                    onValueChange={(v) => onSelectionChange(group.id, v)}
                  >
                    <SelectTrigger id={`preview-group-${group.id}`} className="h-9 text-xs">
                      <SelectValue placeholder={`Select ${group.groupName}`} />
                    </SelectTrigger>
                    <SelectContent className="dark">
                      {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.optionName} className="text-xs">
                          {opt.optionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Empty state helper ─────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-xl bg-muted/40 p-3.5 mb-3 border border-border/40">
        <Icon className="w-5 h-5 text-muted-foreground/70" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[240px] leading-relaxed">{description}</p>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SportsPanel() {
  const [sports, setSports] = useState<AdminSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilterTab, setSportFilterTab] = useState<"active" | "archived">("active");
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // Col 3 view mode tab: "specs" | "preview"
  const [col3ViewTab, setCol3ViewTab] = useState<"specs" | "preview">("specs");

  // Input states
  const [newSportName, setNewSportName] = useState("");
  const [addingSport, setAddingSport] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isGroupOptional, setIsGroupOptional] = useState(true);
  const [addingGroup, setAddingGroup] = useState(false);
  const [newOptions, setNewOptions] = useState<Record<number, string>>({});
  const [savingOption, setSavingOption] = useState<number | null>(null);
  const [previewSelections, setPreviewSelections] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // In-place rename state
  const [isEditingSportName, setIsEditingSportName] = useState(false);
  const [editingSportName, setEditingSportName] = useState("");
  const [savingSport, setSavingSport] = useState(false);

  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  // Alert Dialog states
  const [confirmDeactivateSport, setConfirmDeactivateSport] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<AdminSportRole | null>(null);
  const [groupToDelete, setGroupToDelete] = useState<AdminSpecGroup | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/admin/sports-full", { credentials: "include" });
      if (r.ok) {
        const data = (await r.json()) as AdminSport[];
        setSports(data);
        // Default select first active sport if none selected
        if (selectedSportId === null) {
          const first = data.find((s) => s.active);
          if (first) {
            setSelectedSportId(first.id);
            const firstRole = first.roles.find((r) => r.active);
            if (firstRole) setSelectedRoleId(firstRole.id);
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [selectedSportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSport = sports.find((s) => s.id === selectedSportId) ?? null;
  const selectedRole = selectedSport?.roles.find((r) => r.id === selectedRoleId) ?? null;

  useEffect(() => {
    setEditingSportName(selectedSport?.name ?? "");
    setIsEditingSportName(false);
  }, [selectedSport?.id, selectedSport?.name]);

  useEffect(() => {
    setEditingRoleName(selectedRole?.roleName ?? "");
    setEditingRoleId(null);
  }, [selectedRole?.id, selectedRole?.roleName]);

  const activeSports = useMemo(() => sports.filter((s) => s.active), [sports]);
  const inactiveSports = useMemo(() => sports.filter((s) => !s.active), [sports]);
  const displayedSports = sportFilterTab === "active" ? activeSports : inactiveSports;

  const activeRoles = useMemo(
    () => (selectedSport ? [...selectedSport.roles.filter((r) => r.active)].sort(byDisplayOrder) : []),
    [selectedSport],
  );

  const activeSpecGroups = useMemo(
    () => (selectedRole ? [...selectedRole.specGroups.filter((g) => g.active)].sort(byDisplayOrder) : []),
    [selectedRole],
  );

  // Sync preview selections
  useEffect(() => {
    if (!selectedRole) {
      setPreviewSelections({});
      return;
    }
    const groups = [...selectedRole.specGroups.filter((g) => g.active)].sort(byDisplayOrder);
    setPreviewSelections((prev) => {
      const next: Record<number, string> = {};
      for (const g of groups) {
        const opts = [...g.options.filter((o) => o.active)].sort(byDisplayOrder);
        const existing = prev[g.id];
        if (existing && opts.some((o) => o.optionName === existing)) {
          next[g.id] = existing;
        } else if (opts.length > 0) {
          next[g.id] = opts[0].optionName;
        }
      }
      return next;
    });
  }, [selectedRole]);

  function applyRoleOrder(sportId: number, ids: number[]) {
    setSports((prev) =>
      prev.map((s) => {
        if (s.id !== sportId) return s;
        return {
          ...s,
          roles: s.roles.map((r) => {
            const idx = ids.indexOf(r.id);
            return idx >= 0 ? { ...r, displayOrder: idx } : r;
          }),
        };
      }),
    );
  }

  function applySpecGroupOrder(roleId: number, ids: number[]) {
    setSports((prev) =>
      prev.map((s) => ({
        ...s,
        roles: s.roles.map((r) => {
          if (r.id !== roleId) return r;
          return {
            ...r,
            specGroups: r.specGroups.map((g) => {
              const idx = ids.indexOf(g.id);
              return idx >= 0 ? { ...g, displayOrder: idx } : g;
            }),
          };
        }),
      })),
    );
  }

  function applyOptionOrder(groupId: number, ids: number[]) {
    setSports((prev) =>
      prev.map((s) => ({
        ...s,
        roles: s.roles.map((r) => ({
          ...r,
          specGroups: r.specGroups.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              options: g.options.map((o) => {
                const idx = ids.indexOf(o.id);
                return idx >= 0 ? { ...o, displayOrder: idx } : o;
              }),
            };
          }),
        })),
      })),
    );
  }

  async function reorderRoles(sportId: number, ids: number[]) {
    const r = await fetch(`/api/auth/admin/sports/${sportId}/roles/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) throw new Error("Failed to reorder roles");
  }

  async function reorderSpecGroups(roleId: number, ids: number[]) {
    const r = await fetch(`/api/auth/admin/sport-roles/${roleId}/spec-groups/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) throw new Error("Failed to reorder spec groups");
  }

  async function reorderOptions(groupId: number, ids: number[]) {
    const r = await fetch(`/api/auth/admin/spec-groups/${groupId}/options/reorder`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!r.ok) throw new Error("Failed to reorder options");
  }

  function handleRoleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedSportId) return;
    const oldIndex = activeRoles.findIndex((r) => r.id === active.id);
    const newIndex = activeRoles.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeRoles, oldIndex, newIndex);
    const ids = reordered.map((r) => r.id);
    applyRoleOrder(selectedSportId, ids);
    reorderRoles(selectedSportId, ids)
      .then(() => flash("Role order updated"))
      .catch(() => {
        flash("Failed to save role order", false);
        void load();
      });
  }

  function handleSpecGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !selectedRoleId) return;
    const oldIndex = activeSpecGroups.findIndex((g) => g.id === active.id);
    const newIndex = activeSpecGroups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(activeSpecGroups, oldIndex, newIndex);
    const ids = reordered.map((g) => g.id);
    applySpecGroupOrder(selectedRoleId, ids);
    reorderSpecGroups(selectedRoleId, ids)
      .then(() => flash("Specification order updated"))
      .catch(() => {
        flash("Failed to save specification order", false);
        void load();
      });
  }

  function handleOptionDragEnd(groupId: number, options: AdminSpecOption[]) {
    return (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = options.findIndex((o) => o.id === active.id);
      const newIndex = options.findIndex((o) => o.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(options, oldIndex, newIndex);
      const ids = reordered.map((o) => o.id);
      applyOptionOrder(groupId, ids);
      reorderOptions(groupId, ids)
        .then(() => flash("Option order updated"))
        .catch(() => {
          flash("Failed to save option order", false);
          void load();
        });
    };
  }

  async function addRole() {
    if (!selectedSportId || !newRoleName.trim()) return;
    setAddingRole(true);
    try {
      const nextOrder =
        activeRoles.length > 0 ? Math.max(...activeRoles.map((r) => r.displayOrder)) + 1 : 0;
      const r = await fetch(`/api/auth/admin/sports/${selectedSportId}/roles`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: newRoleName.trim(), displayOrder: nextOrder }),
      });
      if (r.ok) {
        setNewRoleName("");
        flash("Role added");
        await load();
      } else flash("Failed to add role", false);
    } finally {
      setAddingRole(false);
    }
  }

  async function removeRole(roleId: number) {
    const r = await fetch(`/api/auth/admin/sport-roles/${roleId}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      if (selectedRoleId === roleId) setSelectedRoleId(null);
      flash("Role removed");
      setRoleToDelete(null);
      await load();
    } else flash("Failed to remove role", false);
  }

  async function addGroup() {
    if (!selectedRoleId || !newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const nextOrder =
        activeSpecGroups.length > 0 ? Math.max(...activeSpecGroups.map((g) => g.displayOrder)) + 1 : 0;
      const r = await fetch(`/api/auth/admin/sport-roles/${selectedRoleId}/spec-groups`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: newGroupName.trim(), displayOrder: nextOrder, optional: isGroupOptional }),
      });
      if (r.ok) {
        setNewGroupName("");
        flash("Specification group added");
        await load();
      } else flash("Failed to add specification", false);
    } finally {
      setAddingGroup(false);
    }
  }

  async function addOption(groupId: number) {
    const name = (newOptions[groupId] || "").trim();
    if (!name) return;
    setSavingOption(groupId);
    try {
      const group = activeSpecGroups.find((g) => g.id === groupId);
      const activeOpts = group ? [...group.options.filter((o) => o.active)].sort(byDisplayOrder) : [];
      const nextOrder =
        activeOpts.length > 0 ? Math.max(...activeOpts.map((o) => o.displayOrder)) + 1 : 0;
      const r = await fetch(`/api/auth/admin/spec-groups/${groupId}/options`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionName: name, displayOrder: nextOrder }),
      });
      if (r.ok) {
        setNewOptions((p) => ({ ...p, [groupId]: "" }));
        flash("Option added");
        await load();
      } else flash("Failed to add option", false);
    } finally {
      setSavingOption(null);
    }
  }

  async function removeOption(optionId: number) {
    const r = await fetch(`/api/auth/admin/spec-options/${optionId}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      flash("Option removed");
      await load();
    } else flash("Failed", false);
  }

  async function removeGroup(groupId: number) {
    const r = await fetch(`/api/auth/admin/spec-groups/${groupId}`, { method: "DELETE", credentials: "include" });
    if (r.ok) {
      flash("Specification removed");
      setGroupToDelete(null);
      await load();
    } else flash("Failed", false);
  }

  async function addSport() {
    if (!newSportName.trim()) return;
    setAddingSport(true);
    try {
      const r = await fetch("/api/auth/admin/sports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSportName.trim() }),
      });
      if (r.ok) {
        const created = (await r.json()) as AdminSport;
        setNewSportName("");
        flash("Sport added");
        await load();
        setSelectedSportId(created.id);
        setSelectedRoleId(null);
      } else {
        const err = await r.json().catch(() => ({}));
        flash((err as { error?: string }).error ?? "Failed to add sport", false);
      }
    } finally {
      setAddingSport(false);
    }
  }

  async function saveRoleName() {
    if (!editingRoleId || !editingRoleName.trim()) return;
    setSavingRole(true);
    try {
      const r = await fetch(`/api/auth/admin/sport-roles/${editingRoleId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleName: editingRoleName.trim() }),
      });
      if (r.ok) {
        flash("Role updated");
        setEditingRoleId(null);
        await load();
      } else flash("Failed to update role", false);
    } finally {
      setSavingRole(false);
    }
  }

  async function saveSportName() {
    if (!selectedSportId || !editingSportName.trim()) return;
    setSavingSport(true);
    try {
      const r = await fetch(`/api/auth/admin/sports/${selectedSportId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingSportName.trim() }),
      });
      if (r.ok) {
        flash("Sport updated");
        setIsEditingSportName(false);
        await load();
      } else flash("Failed to update sport", false);
    } finally {
      setSavingSport(false);
    }
  }

  async function deactivateSport() {
    if (!selectedSportId) return;
    const r = await fetch(`/api/auth/admin/sports/${selectedSportId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (r.ok) {
      flash("Sport archived");
      setConfirmDeactivateSport(false);
      setSelectedSportId(null);
      setSelectedRoleId(null);
      await load();
    } else flash("Failed to archive sport", false);
  }

  async function reactivateSport(sportId: number) {
    const r = await fetch(`/api/auth/admin/sports/${sportId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    if (r.ok) {
      flash("Sport restored");
      await load();
    } else flash("Failed to restore sport", false);
  }

  const selectedSportMeta = selectedSport ? getSportMeta(selectedSport.slug) : null;

  return (
    <div className="h-full flex-1 flex min-h-0 flex-col lg:flex-row overflow-hidden bg-card/40">
      {/* Toast Notification */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-xs font-semibold shadow-lg border",
              msg.ok
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : "bg-destructive/20 text-destructive border-destructive/30"
            )}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Column 1: Sports Directory ────────────────────────────────────── */}
      <div className="w-full lg:w-72 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/60 flex flex-col min-h-0 bg-card/60">
        {/* Col 1 Header */}
        <div className="p-3 border-b border-border/60 flex-shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Sports Catalog</h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {activeSports.length} active
            </Badge>
          </div>

          {/* Segmented Filter: Active vs Archived */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-0.5 border border-border/40 text-xs">
            <button
              type="button"
              onClick={() => setSportFilterTab("active")}
              className={cn(
                "py-1 font-medium rounded-md transition-colors text-[11px]",
                sportFilterTab === "active"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active ({activeSports.length})
            </button>
            <button
              type="button"
              onClick={() => setSportFilterTab("archived")}
              className={cn(
                "py-1 font-medium rounded-md transition-colors text-[11px]",
                sportFilterTab === "archived"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Archived ({inactiveSports.length})
            </button>
          </div>
        </div>

        {/* Col 1 Scrollable List */}
        <div className={ADMIN_FLEX_SCROLL_CLASS}>
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {displayedSports.map((sport) => {
                const meta = getSportMeta(sport.slug);
                const roleCount = sport.roles.filter((r) => r.active).length;
                const isSelected = selectedSportId === sport.id;

                return (
                  <div
                    key={sport.id}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs text-left transition-all border",
                      isSelected
                        ? "bg-primary/10 text-primary border-primary/30 shadow-xs font-medium"
                        : "hover:bg-muted/40 border-transparent text-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSportId(sport.id);
                        const firstRole = sport.roles.find((r) => r.active);
                        setSelectedRoleId(firstRole ? firstRole.id : null);
                      }}
                      className="flex-1 flex items-center gap-2.5 min-w-0 pr-1 text-left"
                    >
                      <span className="text-base select-none">{meta.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate font-medium", isSelected ? "text-primary" : "text-foreground")}>
                          {sport.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {roleCount} {roleCount === 1 ? "role" : "roles"}
                          </span>
                          <span className="text-[9px] text-muted-foreground/60">•</span>
                          <span className={cn("text-[10px]", meta.isLiveEngine ? "text-emerald-400 font-medium" : "text-muted-foreground")}>
                            {meta.engine}
                          </span>
                        </div>
                      </div>
                    </button>

                    {sportFilterTab === "archived" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] gap-1 text-primary hover:text-primary"
                        onClick={() => void reactivateSport(sport.id)}
                        title="Restore sport"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </Button>
                    ) : (
                      <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", isSelected ? "text-primary" : "text-muted-foreground/40")} />
                    )}
                  </div>
                );
              })}

              {displayedSports.length === 0 && (
                <div className="text-center py-8 px-4 text-xs text-muted-foreground">
                  {sportFilterTab === "active" ? "No active sports catalog entries." : "No archived sports."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Col 1 Pinned Footer: Add Sport */}
        <div className="p-3 border-t border-border/60 bg-card/80 flex-shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void addSport();
            }}
            className="flex items-center gap-1.5"
          >
            <Input
              id="new-sport-name"
              name="newSportName"
              value={newSportName}
              onChange={(e) => setNewSportName(e.target.value)}
              placeholder="Add sport (e.g. Tennis)..."
              className="h-8 text-xs flex-1 bg-background"
              aria-label="New sport name"
            />
            <Button
              type="submit"
              size="sm"
              className="h-8 text-xs gap-1 shrink-0"
              disabled={addingSport || !newSportName.trim()}
            >
              {addingSport ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </Button>
          </form>
        </div>
      </div>

      {/* ─── Column 2: Sport Roles ────────────────────────────────────────── */}
      <div className="w-full lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/60 flex flex-col min-h-0 bg-card/50">
        {/* Col 2 Header */}
        <div className="p-3 border-b border-border/60 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
                {selectedSport ? `${selectedSport.name} Roles` : "Sport Roles"}
              </h3>
              {selectedSport && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {activeRoles.length} {activeRoles.length === 1 ? "role defined" : "roles defined"}
                </p>
              )}
            </div>
          </div>

          {selectedSport && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsEditingSportName(true)}
                title="Rename sport"
              >
                <Pencil className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDeactivateSport(true)}
                title="Archive sport"
              >
                <Archive className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* In-place Sport Rename Bar */}
        {isEditingSportName && selectedSport && (
          <div className="px-3 py-2 bg-muted/30 border-b border-border/60 flex items-center gap-1.5 animate-in fade-in">
            <Input
              id="rename-sport-input" name="renameSportName" aria-label="Rename sport"
              value={editingSportName}
              onChange={(e) => setEditingSportName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void saveSportName()}
              className="h-7 text-xs flex-1 bg-background"
              placeholder="Sport name..."
              autoFocus
            />
            <Button
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => void saveSportName()}
              disabled={savingSport || !editingSportName.trim() || editingSportName.trim() === selectedSport.name}
            >
              {savingSport ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-1.5 text-xs text-muted-foreground"
              onClick={() => setIsEditingSportName(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Col 2 Scrollable Roles List */}
        {!selectedSport ? (
          <EmptyState
            icon={Layers}
            title="Select a Sport"
            description="Choose a sport from the left column to view and configure its roles."
          />
        ) : activeRoles.length === 0 && !newRoleName ? (
          <EmptyState
            icon={Users}
            title="No Roles Configured"
            description={`Add the first roster role for ${selectedSport.name} using the form below.`}
          />
        ) : (
          <div className={ADMIN_FLEX_SCROLL_CLASS}>
            <div className="p-2 space-y-1.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoleDragEnd}>
                <SortableContext items={activeRoles.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {activeRoles.map((role) => (
                    <div key={role.id}>
                      {editingRoleId === role.id ? (
                        <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-primary/30 bg-primary/5">
                          <Input
                            id={`edit-role-${role.id}`} name={`editRole-${role.id}`} aria-label="Edit role name"
                            value={editingRoleName}
                            onChange={(e) => setEditingRoleName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void saveRoleName()}
                            className="h-7 text-xs flex-1 bg-background"
                            placeholder="Role name..."
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => void saveRoleName()}
                            disabled={savingRole || !editingRoleName.trim() || editingRoleName.trim() === role.roleName}
                          >
                            {savingRole ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-xs text-muted-foreground"
                            onClick={() => setEditingRoleId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <SortableRoleRow
                          role={role}
                          selected={selectedRoleId === role.id}
                          onSelect={() => setSelectedRoleId(role.id)}
                          onStartRename={() => {
                            setEditingRoleId(role.id);
                            setEditingRoleName(role.roleName);
                          }}
                          onRemove={() => setRoleToDelete(role)}
                        />
                      )}
                    </div>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>
        )}

        {/* Col 2 Pinned Footer: Add Role */}
        {selectedSport && (
          <div className="p-3 border-t border-border/60 bg-card/80 flex-shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void addRole();
              }}
              className="flex items-center gap-1.5"
            >
              <Input
                id="new-role-name"
                name="newRoleName"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Add role (e.g. All-Rounder)..."
                className="h-8 text-xs flex-1 bg-background"
                aria-label="New role name"
              />
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs gap-1 shrink-0"
                disabled={addingRole || !newRoleName.trim()}
              >
                {addingRole ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* ─── Column 3: Specifications & Live Preview ───────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 bg-background/50">
        {/* Col 3 Header & View Mode Switcher */}
        <div className="p-3 border-b border-border/60 flex items-center justify-between flex-shrink-0 bg-card/40">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Specifications & Rules</h3>
              {selectedRole && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Attributes for <span className="text-foreground font-medium">{selectedRole.roleName}</span>
                </p>
              )}
            </div>
          </div>

          {selectedRole && (
            <div className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCol3ViewTab("specs")}
                className={cn(
                  "px-3 py-1 font-medium rounded-md transition-colors text-xs flex items-center gap-1.5",
                  col3ViewTab === "specs"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Specifications ({activeSpecGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setCol3ViewTab("preview")}
                className={cn(
                  "px-3 py-1 font-medium rounded-md transition-colors text-xs flex items-center gap-1.5",
                  col3ViewTab === "preview"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="w-3 h-3" />
                Live Preview
              </button>
            </div>
          )}
        </div>

        {!selectedRole ? (
          <EmptyState
            icon={ClipboardList}
            title="Select a Role"
            description="Choose a role from the middle column to manage its player specification attributes and test the registration flow."
          />
        ) : col3ViewTab === "preview" ? (
          <div className={ADMIN_FLEX_SCROLL_CLASS}>
            <RegistrationPreview
              roleName={selectedRole.roleName}
              sportName={selectedSport?.name || "Sport"}
              specGroups={selectedRole.specGroups}
              previewSelections={previewSelections}
              onSelectionChange={(groupId, value) =>
                setPreviewSelections((prev) => ({ ...prev, [groupId]: value }))
              }
              onReset={() => setPreviewSelections({})}
            />
          </div>
        ) : (
          <div className={ADMIN_FLEX_SCROLL_CLASS}>
            <div className="p-4 space-y-4 max-w-2xl">
              {activeSpecGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 p-8 text-center bg-card/30">
                  <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2.5" />
                  <p className="text-sm font-semibold text-foreground">No Specification Groups</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Add specification groups like &quot;Batting Style&quot;, &quot;Bowling Arm&quot;, or &quot;Position&quot; to prompt players during registration.
                  </p>
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSpecGroupDragEnd}>
                  <SortableContext items={activeSpecGroups.map((g) => g.id)} strategy={verticalListSortingStrategy}>
                    {activeSpecGroups.map((group) => {
                      const activeOptions = [...group.options.filter((o) => o.active)].sort(byDisplayOrder);
                      return (
                        <SpecGroupCard
                          key={group.id}
                          group={group}
                          activeOptions={activeOptions}
                          newOptionValue={newOptions[group.id] || ""}
                          onNewOptionChange={(v) => setNewOptions((p) => ({ ...p, [group.id]: v }))}
                          onAddOption={() => void addOption(group.id)}
                          onRemoveOption={(optId) => void removeOption(optId)}
                          onRemoveGroup={() => setGroupToDelete(group)}
                          savingOption={savingOption === group.id}
                          onOptionDragEnd={handleOptionDragEnd(group.id, activeOptions)}
                        />
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}

              {/* Add Specification Group Card */}
              <div className="rounded-xl border border-dashed border-border/70 p-4 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Add New Specification Attribute</span>
                  <label htmlFor="spec-optional-toggle" className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <input
                      id="spec-optional-toggle" name="specOptionalToggle"
                      type="checkbox"
                      checked={isGroupOptional}
                      onChange={(e) => setIsGroupOptional(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    Optional for players
                  </label>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addGroup();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    id="new-group-name"
                    name="newGroupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Bowling Arm, Batting Hand, Jersey Size..."
                    className="h-8 text-xs flex-1 bg-background"
                    aria-label="New specification group name"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs gap-1 shrink-0"
                    disabled={addingGroup || !newGroupName.trim()}
                  >
                    {addingGroup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Add Attribute
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Confirm Deactivate Sport Dialog ───────────────────────────────── */}
      <AlertDialog open={confirmDeactivateSport} onOpenChange={setConfirmDeactivateSport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive &quot;{selectedSport?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving this sport removes it from new tournament creation dropdowns. Existing tournaments using this sport will remain completely operational. You can reactivate it at any time from the Archived tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deactivateSport()}
            >
              Archive Sport
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Confirm Remove Role Dialog ─────────────────────────────────────── */}
      <AlertDialog open={roleToDelete !== null} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Role &quot;{roleToDelete?.roleName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This role will no longer appear in future player registrations for {selectedSport?.name}. Existing registered players will retain their historical roster records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (roleToDelete) void removeRole(roleToDelete.id);
              }}
            >
              Remove Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Confirm Remove Spec Group Dialog ──────────────────────────────── */}
      <AlertDialog open={groupToDelete !== null} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Specification &quot;{groupToDelete?.groupName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This specification and all its configured options will be removed from future onboarding forms for this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (groupToDelete) void removeGroup(groupToDelete.id);
              }}
            >
              Remove Specification
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Spec group card with nested option DnD ───────────────────────────────────

function SpecGroupCard({
  group,
  activeOptions,
  newOptionValue,
  onNewOptionChange,
  onAddOption,
  onRemoveOption,
  onRemoveGroup,
  savingOption,
  onOptionDragEnd,
}: {
  group: AdminSpecGroup;
  activeOptions: AdminSpecOption[];
  newOptionValue: string;
  onNewOptionChange: (v: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optionId: number) => void;
  onRemoveGroup: () => void;
  savingOption: boolean;
  onOptionDragEnd: (event: DragEndEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });
  const optionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border/60 bg-card/80 overflow-hidden shadow-xs space-y-1"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/20">
        <div {...attributes} {...listeners}>
          <DragHandle />
        </div>
        <span className="text-xs font-semibold text-foreground flex-1">{group.groupName}</span>
        {group.optional ? (
          <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground border-border/60">
            optional
          </Badge>
        ) : (
          <Badge className="text-[10px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
            required
          </Badge>
        )}
        <button
          type="button"
          onClick={onRemoveGroup}
          className="text-muted-foreground/40 hover:text-destructive transition-colors p-1 rounded"
          title="Remove specification group"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-2 space-y-2">
        {activeOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 px-3 py-1.5 italic">No options configured yet. Add values below.</p>
        ) : (
          <DndContext sensors={optionSensors} collisionDetection={closestCenter} onDragEnd={onOptionDragEnd}>
            <SortableContext items={activeOptions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {activeOptions.map((opt) => (
                  <SortableOptionRow key={opt.id} option={opt} onRemove={() => onRemoveOption(opt.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onAddOption();
          }}
          className="flex items-center gap-1.5 px-2 pt-1 border-t border-border/30"
        >
          <Input
            id={`spec-opt-${group.id}`}
            name={`newOption-${group.id}`}
            value={newOptionValue}
            onChange={(e) => onNewOptionChange(e.target.value)}
            placeholder="Add option (e.g. Right-hand)..."
            className="h-7 text-xs flex-1 bg-background"
            aria-label={`Add option for ${group.groupName}`}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 shrink-0"
            disabled={savingOption || !newOptionValue.trim()}
          >
            {savingOption ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add
          </Button>
        </form>
      </div>
    </div>
  );
}
