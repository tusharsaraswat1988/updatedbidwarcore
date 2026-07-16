import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Archive, Copy, ExternalLink, Eye, FolderOpen, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { AdminListHeader } from "@/components/admin/admin-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AcademyCategoryRow,
  AcademyLessonRow,
  archiveAcademyLesson,
  createAcademyCategory,
  deleteAcademyCategory,
  duplicateAcademyLesson,
  listAcademyCategories,
  listAcademyLessons,
  updateAcademyCategory,
  updateAcademyLesson,
} from "@/lib/auth";

function statusBadgeClass(status: AcademyLessonRow["status"]) {
  if (status === "published") return "bg-green-500/15 text-green-400";
  if (status === "archived") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-400";
}

function statusLabel(status: AcademyLessonRow["status"]) {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export default function AdminAcademyLessonsListPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const [lessons, setLessons] = useState<AcademyLessonRow[]>([]);
  const [categories, setCategories] = useState<AcademyCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "archived">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<AcademyLessonRow | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryDeletingId, setCategoryDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [lessonData, categoryData] = await Promise.all([
      listAcademyLessons(showArchived),
      listAcademyCategories(),
    ]);
    setLessons(lessonData);
    setCategories(categoryData);
    setLoading(false);
  }, [showArchived]);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  const activeCategories = categories.filter((c) => c.active);

  const filtered = lessons.filter((lesson) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const matchesSearch =
        lesson.title.toLowerCase().includes(q) ||
        lesson.slug.toLowerCase().includes(q) ||
        String(lesson.episodeNumber).includes(q) ||
        (lesson.categoryName ?? "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (statusFilter !== "all" && lesson.status !== statusFilter) return false;
    if (categoryFilter !== "all" && String(lesson.categoryId ?? "") !== categoryFilter) return false;
    return true;
  });

  const publishedCount = lessons.filter((l) => l.status === "published").length;
  const draftCount = lessons.filter((l) => l.status === "draft").length;
  const archivedCount = lessons.filter((l) => l.status === "archived").length;

  async function handleArchive() {
    if (!archiveTarget) return;
    setArchiving(true);
    const result = await archiveAcademyLesson(archiveTarget.id);
    setArchiving(false);
    if (result.success) {
      setArchiveTarget(null);
      await load();
    }
  }

  async function handleRestore(lesson: AcademyLessonRow) {
    await updateAcademyLesson(lesson.id, { status: "draft" });
    await load();
  }

  async function handleTogglePublish(lesson: AcademyLessonRow) {
    const next = lesson.status === "published" ? "draft" : "published";
    await updateAcademyLesson(lesson.id, { status: next });
    await load();
  }

  async function handleDuplicate(lesson: AcademyLessonRow) {
    const result = await duplicateAcademyLesson(lesson.id);
    if (result.success && result.row) {
      navigate(`/admin/knowledge-center/academy/${result.row.id}`);
    }
  }

  async function handleAddCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    setCategoryError(null);
    const result = await createAcademyCategory({ name });
    setCategorySaving(false);
    if (!result.success) {
      setCategoryError(result.error ?? "Failed to create category");
      return;
    }
    setNewCategoryName("");
    await load();
  }

  async function handleToggleCategory(cat: AcademyCategoryRow) {
    setCategoryError(null);
    const result = await updateAcademyCategory(cat.id, { active: !cat.active });
    if (!result.success) {
      setCategoryError(result.error ?? "Failed to update category");
      return;
    }
    await load();
  }

  async function handleDeleteCategory(cat: AcademyCategoryRow) {
    if (!confirm(`Delete "${cat.name}"? This cannot be undone.`)) return;
    setCategoryDeletingId(cat.id);
    setCategoryError(null);
    const result = await deleteAcademyCategory(cat.id);
    setCategoryDeletingId(null);
    if (!result.success) {
      setCategoryError(result.error ?? "Failed to delete category");
      return;
    }
    await load();
  }

  if (authLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Academy"
      eyebrow="Knowledge Center"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCategoriesOpen(true)}>
            <FolderOpen className="h-4 w-4" /> Categories
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/admin/knowledge-center/academy/new")}>
            <Plus className="h-4 w-4" /> New Lesson
          </Button>
        </div>
      }
    >
      <div className="rounded-xl border border-border bg-card/70">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lessons..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All categories</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} />
            Show archived
          </label>
          <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={load} title="Refresh" aria-label="Refresh lessons">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
          {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}
          {" · "}
          {publishedCount} published
          {" · "}
          {draftCount} draft
          {showArchived && archivedCount > 0 ? ` · ${archivedCount} archived` : ""}
        </div>

        <AdminListHeader
          gridClassName="md:grid md:grid-cols-[60px_1fr_120px_100px_80px_180px] md:gap-4"
          columns={[
            { label: "Ep #" },
            { label: "Title" },
            { label: "Category" },
            { label: "Status" },
            { label: "Order" },
            { label: "Actions", align: "right" },
          ]}
        />

        <AdminScrollPanel>
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search || statusFilter !== "all" || categoryFilter !== "all"
                ? "No lessons match your filters."
                : "No academy lessons yet. Create your first lesson to get started."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((lesson) => (
                <div
                  key={lesson.id}
                  className="px-4 py-3 md:grid md:grid-cols-[60px_1fr_120px_100px_80px_180px] md:items-center md:gap-4"
                >
                  <span className="text-sm font-mono text-muted-foreground">{lesson.episodeNumber}</span>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/knowledge-center/academy/${lesson.id}`)}
                    className="min-w-0 text-left hover:opacity-80"
                  >
                    <div className="font-semibold text-white">{lesson.title}</div>
                    <div className="truncate text-xs text-muted-foreground">/{lesson.slug}</div>
                  </button>
                  <span className="truncate text-xs text-muted-foreground">
                    {lesson.categoryName ?? "—"}
                  </span>
                  <div>
                    <Badge className={statusBadgeClass(lesson.status)}>{statusLabel(lesson.status)}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{lesson.displayOrder}</span>
                  <div className="mt-2 flex flex-wrap justify-end gap-1 md:mt-0">
                    {lesson.status === "published" && (
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="View public page" aria-label="View public page" asChild>
                        <a href={`/academy/${lesson.slug}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {lesson.status !== "archived" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title={lesson.status === "published" ? "Unpublish" : "Publish"}
                          aria-label={lesson.status === "published" ? "Unpublish lesson" : "Publish lesson"}
                          onClick={() => handleTogglePublish(lesson)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Duplicate lesson"
                          aria-label="Duplicate lesson"
                          onClick={() => handleDuplicate(lesson)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Archive lesson"
                          aria-label="Archive lesson"
                          onClick={() => setArchiveTarget(lesson)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {lesson.status === "archived" && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => handleRestore(lesson)}>
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminScrollPanel>
      </div>

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{archiveTarget?.title}&rdquo; will be hidden from the active list. You can restore it later.
              This does not permanently delete the lesson.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiving}>
              {archiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={categoriesOpen}
        onOpenChange={(open) => {
          setCategoriesOpen(open);
          if (!open) {
            setCategoryError(null);
            setNewCategoryName("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Academy Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={newCategoryName}
                onChange={(e) => {
                  setNewCategoryName(e.target.value);
                  if (categoryError) setCategoryError(null);
                }}
                placeholder="New category name"
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button
                className="shrink-0"
                onClick={handleAddCategory}
                disabled={categorySaving || !newCategoryName.trim()}
              >
                {categorySaving ? "Adding…" : "Add"}
              </Button>
            </div>
            {categoryError && <p className="text-sm text-destructive">{categoryError}</p>}
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categories yet.</p>
              ) : (
                categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{cat.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{cat.slug}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Label htmlFor={`cat-${cat.id}`} className="sr-only sm:not-sr-only sm:text-xs sm:text-muted-foreground">
                        Active
                      </Label>
                      <Switch
                        id={`cat-${cat.id}`}
                        checked={cat.active}
                        onCheckedChange={() => handleToggleCategory(cat)}
                        disabled={categoryDeletingId === cat.id}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        title={`Delete ${cat.name}`}
                        aria-label={`Delete ${cat.name}`}
                        onClick={() => handleDeleteCategory(cat)}
                        disabled={categoryDeletingId === cat.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
