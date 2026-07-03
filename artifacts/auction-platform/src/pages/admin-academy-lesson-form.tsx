import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Archive, Copy, ExternalLink, Eye, Save } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { LessonContent } from "@/components/academy/lesson-content";
import { YoutubePlayer } from "@/components/academy/youtube-player";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AcademyCategoryRow,
  AcademyLessonInput,
  archiveAcademyLesson,
  createAcademyLesson,
  duplicateAcademyLesson,
  getAcademyLesson,
  getNextAcademyEpisodeNumber,
  listAcademyCategories,
  updateAcademyLesson,
} from "@/lib/auth";

function slugifyPreview(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "lesson"
  );
}

const EMPTY_FORM: AcademyLessonInput & { slugManual: string; slugTouched: boolean } = {
  episodeNumber: 1,
  title: "",
  slugManual: "",
  slugTouched: false,
  shortDescription: "",
  content: "",
  contentFormat: "plain",
  youtubeUrl: "",
  categoryId: null,
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  displayOrder: 0,
};

export default function AdminAcademyLessonFormPage() {
  const [location, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();

  const lessonId = useMemo(() => {
    const match = location.match(/\/admin\/knowledge-center\/academy\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }, [location]);

  const isEdit = lessonId != null && !isNaN(lessonId);
  const isNew = location.endsWith("/new");

  const [categories, setCategories] = useState<AcademyCategoryRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const activeCategories = categories.filter((c) => c.active);

  const slugPreview = form.slugTouched && form.slugManual.trim()
    ? form.slugManual.trim().toLowerCase()
    : slugifyPreview(form.title);

  const loadCategories = useCallback(async () => {
    const data = await listAcademyCategories();
    setCategories(data);
  }, []);

  const loadLesson = useCallback(async () => {
    if (!isEdit || lessonId == null) return;
    setLoading(true);
    const row = await getAcademyLesson(lessonId);
    if (!row) {
      setError("Lesson not found");
      setLoading(false);
      return;
    }
    setForm({
      episodeNumber: row.episodeNumber,
      title: row.title,
      slugManual: row.slug,
      slugTouched: true,
      shortDescription: row.shortDescription ?? "",
      content: row.content ?? "",
      contentFormat: row.contentFormat,
      youtubeUrl: row.youtubeUrl ?? "",
      categoryId: row.categoryId,
      seoTitle: row.seoTitle ?? "",
      seoDescription: row.seoDescription ?? "",
      status: row.status === "archived" ? "draft" : row.status,
      displayOrder: row.displayOrder,
    });
    setLoading(false);
  }, [isEdit, lessonId]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadCategories();
    if (isEdit) {
      loadLesson();
    } else if (isNew) {
      getNextAcademyEpisodeNumber().then((n) => setForm((f) => ({ ...f, episodeNumber: n })));
    }
  }, [isLoggedIn, isEdit, isNew, loadCategories, loadLesson]);

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (!form.episodeNumber || form.episodeNumber < 1) {
      setError("Episode number must be a positive integer");
      return;
    }

    setSaving(true);

    const payload: AcademyLessonInput = {
      episodeNumber: form.episodeNumber,
      title: form.title.trim(),
      slug: form.slugTouched ? form.slugManual.trim().toLowerCase() : undefined,
      shortDescription: form.shortDescription?.trim() || null,
      content: form.content?.trim() || null,
      contentFormat: form.contentFormat,
      youtubeUrl: form.youtubeUrl?.trim() || null,
      categoryId: form.categoryId ?? null,
      seoTitle: form.seoTitle?.trim() || null,
      seoDescription: form.seoDescription?.trim() || null,
      status: form.status,
      displayOrder: form.displayOrder ?? 0,
    };

    const result = isEdit && lessonId != null
      ? await updateAcademyLesson(lessonId, payload)
      : await createAcademyLesson(payload);

    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Save failed");
      return;
    }

    navigate("/admin/knowledge-center/academy");
  }

  async function handleArchive() {
    if (!isEdit || lessonId == null) return;
    setArchiving(true);
    const result = await archiveAcademyLesson(lessonId);
    setArchiving(false);
    if (result.success) {
      navigate("/admin/knowledge-center/academy");
    } else {
      setError(result.error ?? "Archive failed");
      setArchiveOpen(false);
    }
  }

  async function handleQuickPublish(next: "draft" | "published") {
    updateField("status", next);
    if (isEdit && lessonId != null) {
      await updateAcademyLesson(lessonId, { status: next });
    }
  }

  function statusBadgeClass(status: typeof form.status) {
    if (status === "published") return "bg-green-500/15 text-green-400";
    return "bg-amber-500/15 text-amber-400";
  }

  if (authLoading || !isLoggedIn) return null;
  if (!isNew && !isEdit) {
    navigate("/admin/knowledge-center/academy");
    return null;
  }

  return (
    <AdminShell
      title={isEdit ? "Edit Lesson" : "New Lesson"}
      eyebrow="Knowledge Center · Academy"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate("/admin/knowledge-center/academy")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Badge className={statusBadgeClass(form.status)}>
            {form.status === "published" ? "Published" : "Draft"}
          </Badge>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          {form.status === "published" && slugPreview && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={`/academy/${slugPreview}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> View Public Page
              </a>
            </Button>
          )}
          {isEdit && lessonId != null && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={async () => {
                const result = await duplicateAcademyLesson(lessonId);
                if (result.success && result.row) {
                  navigate(`/admin/knowledge-center/academy/${result.row.id}`);
                }
              }}
            >
              <Copy className="h-4 w-4" /> Duplicate
            </Button>
          )}
          {form.status === "published" ? (
            <Button size="sm" variant="outline" onClick={() => handleQuickPublish("draft")}>
              Unpublish
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => handleQuickPublish("published")}>
              Publish
            </Button>
          )}
          {isEdit && (
            <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" /> Archive
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || loading}>
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4 rounded-xl border border-border bg-card/70 p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-border bg-card/70 p-6">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Episode</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="episodeNumber">Episode number</Label>
                <Input
                  id="episodeNumber"
                  type="number"
                  min={1}
                  value={form.episodeNumber}
                  onChange={(e) => updateField("episodeNumber", parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(e) => updateField("displayOrder", parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Content</h2>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Lesson title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slugTouched ? form.slugManual : slugPreview}
                onChange={(e) => {
                  updateField("slugManual", e.target.value);
                  updateField("slugTouched", true);
                }}
                placeholder="url-friendly-slug"
              />
              <p className="text-xs text-muted-foreground">Preview: /{slugPreview}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDescription">Short description</Label>
              <Textarea
                id="shortDescription"
                value={form.shortDescription ?? ""}
                onChange={(e) => updateField("shortDescription", e.target.value)}
                rows={2}
                placeholder="Brief summary for listings"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contentFormat">Content format</Label>
              <Select
                value={form.contentFormat}
                onValueChange={(v) => updateField("contentFormat", v as typeof form.contentFormat)}
              >
                <SelectTrigger id="contentFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plain">Plain text</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="html">HTML (rich editor)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Stored in the same field — switch to HTML when a rich editor is added, no database migration needed.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content body</Label>
              <Textarea
                id="content"
                value={form.content ?? ""}
                onChange={(e) => updateField("content", e.target.value)}
                rows={14}
                placeholder={
                  form.contentFormat === "markdown"
                    ? "Write lesson content in Markdown…"
                    : form.contentFormat === "html"
                      ? "HTML content (rich editor will populate this field)…"
                      : "Write lesson content…"
                }
                className="font-mono text-sm"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Video</h2>
            <div className="space-y-2">
              <Label htmlFor="youtubeUrl">YouTube URL</Label>
              <Input
                id="youtubeUrl"
                type="url"
                value={form.youtubeUrl ?? ""}
                onChange={(e) => updateField("youtubeUrl", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Organization</h2>
            <div className="space-y-2">
              <Label htmlFor="categoryId">Category</Label>
              <Select
                value={form.categoryId != null ? String(form.categoryId) : "none"}
                onValueChange={(v) => updateField("categoryId", v === "none" ? null : parseInt(v, 10))}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeCategories.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No categories yet — add them from the Academy list page.
                </p>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">SEO</h2>
            <div className="space-y-2">
              <Label htmlFor="seoTitle">SEO title</Label>
              <Input
                id="seoTitle"
                value={form.seoTitle ?? ""}
                onChange={(e) => updateField("seoTitle", e.target.value)}
                maxLength={70}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoDescription">SEO description</Label>
              <Textarea
                id="seoDescription"
                value={form.seoDescription ?? ""}
                onChange={(e) => updateField("seoDescription", e.target.value)}
                rows={2}
                maxLength={160}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Publishing</h2>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => updateField("status", v as typeof form.status)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
        </div>
      )}

      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              The lesson will be hidden from the active list. You can restore it later from the list page.
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lesson preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Episode {form.episodeNumber}</p>
            <h2 className="text-2xl font-black">{form.title || "Untitled lesson"}</h2>
            {form.shortDescription && (
              <p className="text-muted-foreground">{form.shortDescription}</p>
            )}
            {form.youtubeUrl && (
              <YoutubePlayer
                videoId={form.youtubeUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? "invalid"}
                title={form.title || "Preview"}
              />
            )}
            <LessonContent content={form.content ?? null} format={form.contentFormat ?? "plain"} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
