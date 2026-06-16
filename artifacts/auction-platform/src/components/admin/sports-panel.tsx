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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// ─── Drag handle ──────────────────────────────────────────────────────────────

function DragHandle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={`cursor-grab touch-none text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing ${className ?? ""}`}
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
  onRemove,
}: {
  role: AdminSportRole;
  selected: boolean;
  onSelect: () => void;
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
      className={`group flex items-center gap-1 rounded-lg border transition-colors ${
        selected
          ? "border-primary/40 bg-primary/10"
          : "border-transparent hover:border-border/40 hover:bg-muted/30"
      }`}
    >
      <div {...attributes} {...listeners} className="pl-2 py-2">
        <DragHandle />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center justify-between py-2 pr-1 text-sm text-left min-w-0"
      >
        <span className={`truncate ${selected ? "text-primary font-medium" : ""}`}>{role.roleName}</span>
        <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
          {specCount} {specCount === 1 ? "spec" : "specs"}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="pr-2 text-muted-foreground/30 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        title="Remove role"
      >
        <X className="w-3 h-3" />
      </button>
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
      className="group flex items-center gap-1.5 pl-6 pr-2 py-1 rounded-md hover:bg-muted/20 transition-colors"
    >
      <div {...attributes} {...listeners}>
        <DragHandle className="!text-muted-foreground/30" />
      </div>
      <span className="text-xs text-muted-foreground">•</span>
      <span className="text-sm flex-1">{option.optionName}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-destructive transition-colors"
        title="Remove option"
      >
        <X className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ─── Registration preview ─────────────────────────────────────────────────────

function RegistrationPreview({
  roleName,
  specGroups,
  previewSelections,
  onSelectionChange,
}: {
  roleName: string;
  specGroups: AdminSpecGroup[];
  previewSelections: Record<number, string>;
  onSelectionChange: (groupId: number, value: string) => void;
}) {
  const sortedGroups = useMemo(
    () => [...specGroups.filter((g) => g.active)].sort(byDisplayOrder),
    [specGroups],
  );

  return (
    <div className="border-t border-border/50 bg-muted/10 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Eye className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Player Registration Preview
        </p>
      </div>
      <div className="rounded-lg border border-border/40 bg-card/80 p-4 space-y-3 shadow-inner">
        <div className="space-y-1.5">
          <Label className="text-sm">
            Role <span className="text-destructive">*</span>
          </Label>
          <Select value={roleName} disabled>
            <SelectTrigger className="h-9 bg-muted/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark">
              <SelectItem value={roleName}>{roleName}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sortedGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            Add specifications above to see them in the registration form.
          </p>
        ) : (
          sortedGroups.map((group) => {
            const options = [...group.options.filter((o) => o.active)].sort(byDisplayOrder);
            return (
              <div key={group.id} className="space-y-1.5">
                <Label className="text-sm">
                  {group.groupName}
                  {!group.optional && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                {options.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic">No options configured</p>
                ) : (
                  <Select
                    value={previewSelections[group.id] ?? ""}
                    onValueChange={(v) => onSelectionChange(group.id, v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={`Select ${group.groupName}`} />
                    </SelectTrigger>
                    <SelectContent className="dark">
                      {options.map((opt) => (
                        <SelectItem key={opt.id} value={opt.optionName}>
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
      <div className="rounded-full bg-muted/30 p-3 mb-3">
        <Icon className="w-5 h-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">{description}</p>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function SportsPanel() {
  const [sports, setSports] = useState<AdminSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSportId, setSelectedSportId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [addingRole, setAddingRole] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newOptions, setNewOptions] = useState<Record<number, string>>({});
  const [savingOption, setSavingOption] = useState<number | null>(null);
  const [previewSelections, setPreviewSelections] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
      if (r.ok) setSports(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSport = sports.find((s) => s.id === selectedSportId) ?? null;
  const selectedRole = selectedSport?.roles.find((r) => r.id === selectedRoleId) ?? null;

  const activeRoles = useMemo(
    () => (selectedSport ? [...selectedSport.roles.filter((r) => r.active)].sort(byDisplayOrder) : []),
    [selectedSport],
  );

  const activeSpecGroups = useMemo(
    () => (selectedRole ? [...selectedRole.specGroups.filter((g) => g.active)].sort(byDisplayOrder) : []),
    [selectedRole],
  );

  // Sync preview selections when role/specs change
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
      await load();
    } else flash("Failed", false);
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
        body: JSON.stringify({ groupName: newGroupName.trim(), displayOrder: nextOrder }),
      });
      if (r.ok) {
        setNewGroupName("");
        flash("Specification added");
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
      await load();
    } else flash("Failed", false);
  }

  return (
    <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
      {/* Flash toast */}
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
              msg.ok
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-destructive/20 text-destructive border border-destructive/30"
            }`}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Col 1: Sports */}
      <div className="w-full lg:w-52 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/40 flex flex-col min-h-0 max-h-[180px] lg:max-h-none">
        <div className="px-3 py-2.5 border-b border-border/40 flex-shrink-0 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sports</p>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sports.map((sport) => {
                const roleCount = sport.roles.filter((r) => r.active).length;
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => {
                      setSelectedSportId(sport.id);
                      setSelectedRoleId(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all ${
                      selectedSportId === sport.id
                        ? "bg-primary/15 text-primary border border-primary/30 shadow-sm"
                        : "hover:bg-muted/40 border border-transparent"
                    }`}
                  >
                    <span className="capitalize font-medium">{sport.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {roleCount} {roleCount === 1 ? "role" : "roles"}
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Col 2: Roles */}
      <div className="w-full lg:w-60 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/40 flex flex-col min-h-0 max-h-[240px] lg:max-h-none">
        <div className="px-3 py-2.5 border-b border-border/40 flex-shrink-0 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roles</p>
        </div>
        {!selectedSport ? (
          <EmptyState
            icon={Layers}
            title="Select a sport"
            description="Choose a sport from the left to manage its roles"
          />
        ) : activeRoles.length === 0 && !newRoleName ? (
          <div className="flex-1 flex flex-col">
            <EmptyState
              icon={Users}
              title="No roles yet"
              description={`Add the first role for ${selectedSport.name}`}
            />
            <div className="p-3 border-t border-border/30">
              <div className="flex items-center gap-1.5">
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRole()}
                  placeholder="New role name..."
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={addRole}
                  disabled={addingRole || !newRoleName.trim()}
                >
                  {addingRole ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add Role
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRoleDragEnd}>
                <SortableContext items={activeRoles.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {activeRoles.map((role) => (
                    <SortableRoleRow
                      key={role.id}
                      role={role}
                      selected={selectedRoleId === role.id}
                      onSelect={() => setSelectedRoleId(role.id)}
                      onRemove={() => removeRole(role.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex items-center gap-1.5 pt-2 px-1">
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRole()}
                  placeholder="New role name..."
                  className="h-8 text-xs flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1 shrink-0"
                  onClick={addRole}
                  disabled={addingRole || !newRoleName.trim()}
                >
                  {addingRole ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add Role
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Col 3: Specifications + Preview */}
      <div className="flex-1 flex flex-col min-h-[320px]">
        <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2 flex-shrink-0">
          <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Specifications</p>
          {selectedRole && (
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {selectedRole.roleName}
            </Badge>
          )}
        </div>

        {!selectedRole ? (
          <EmptyState
            icon={ClipboardList}
            title="Select a role"
            description="Choose a role to edit its specifications and preview the registration form"
          />
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {activeSpecGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
                    <ClipboardList className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No specifications yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Add specification groups like &quot;Bowling Arm&quot; or &quot;Bowling Style&quot;
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
                            onAddOption={() => addOption(group.id)}
                            onRemoveOption={removeOption}
                            onRemoveGroup={() => removeGroup(group.id)}
                            savingOption={savingOption === group.id}
                            onOptionDragEnd={handleOptionDragEnd(group.id, activeOptions)}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                )}

                {/* Add spec group */}
                <div className="rounded-lg border border-dashed border-border/40 p-3 bg-muted/5">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Add Specification</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addGroup()}
                      placeholder="e.g. Bowling Arm, Bowling Style..."
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1 shrink-0"
                      onClick={addGroup}
                      disabled={addingGroup || !newGroupName.trim()}
                    >
                      {addingGroup ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Sticky registration preview */}
            <div className="flex-shrink-0 sticky bottom-0">
              <RegistrationPreview
                roleName={selectedRole.roleName}
                specGroups={selectedRole.specGroups}
                previewSelections={previewSelections}
                onSelectionChange={(groupId, value) =>
                  setPreviewSelections((prev) => ({ ...prev, [groupId]: value }))
                }
              />
            </div>
          </>
        )}
      </div>
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
      className="rounded-lg border border-border/50 bg-card/50 overflow-hidden shadow-sm"
    >
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border/30 bg-muted/10">
        <div {...attributes} {...listeners} className="px-1">
          <DragHandle />
        </div>
        <span className="text-sm font-medium flex-1">{group.groupName}</span>
        {group.optional && (
          <Badge variant="outline" className="text-[9px] h-3.5 px-1 text-muted-foreground border-muted-foreground/30">
            optional
          </Badge>
        )}
        <button
          type="button"
          onClick={onRemoveGroup}
          className="text-muted-foreground/30 hover:text-destructive transition-colors p-1"
          title="Remove group"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <div className="py-1">
        {activeOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 px-4 py-2 italic">No options yet — add one below</p>
        ) : (
          <DndContext sensors={optionSensors} collisionDetection={closestCenter} onDragEnd={onOptionDragEnd}>
            <SortableContext items={activeOptions.map((o) => o.id)} strategy={verticalListSortingStrategy}>
              {activeOptions.map((opt) => (
                <SortableOptionRow key={opt.id} option={opt} onRemove={() => onRemoveOption(opt.id)} />
              ))}
            </SortableContext>
          </DndContext>
        )}
        <div className="flex items-center gap-1.5 px-3 py-2 mt-1">
          <Input
            value={newOptionValue}
            onChange={(e) => onNewOptionChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddOption()}
            placeholder="Add option..."
            className="h-7 text-xs flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onAddOption}
            disabled={savingOption || !newOptionValue.trim()}
          >
            {savingOption ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
