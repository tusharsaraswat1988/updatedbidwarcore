import { useState } from "react";
import { useRoute } from "wouter";
import {
  useListCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getListCategoriesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

function CategoryForm({ tournamentId, category, onClose }: { tournamentId: number; category?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const [form, setForm] = useState({
    name: category?.name || "",
    minBid: category?.minBid || 100000,
    bidIncrement: category?.bidIncrement || 50000,
    maxPlayers: category?.maxPlayers || 5,
    colorCode: category?.colorCode || "#F59E0B",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (category) {
      await updateCat.mutateAsync({ tournamentId, categoryId: category.id, data: form });
    } else {
      await createCat.mutateAsync({ tournamentId, data: form });
    }
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey(tournamentId) });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Category Name</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Platinum, Gold, Silver" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Minimum Bid (₹)</Label>
          <Input type="number" value={form.minBid} onChange={e => setForm(f => ({ ...f, minBid: parseInt(e.target.value) || 0 }))} required />
        </div>
        <div className="space-y-2">
          <Label>Bid Increment (₹)</Label>
          <Input type="number" value={form.bidIncrement} onChange={e => setForm(f => ({ ...f, bidIncrement: parseInt(e.target.value) || 0 }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max Players per Team</Label>
          <Input type="number" value={form.maxPlayers} onChange={e => setForm(f => ({ ...f, maxPlayers: parseInt(e.target.value) || 0 }))} />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.colorCode} onChange={e => setForm(f => ({ ...f, colorCode: e.target.value }))} className="w-12 h-10 rounded cursor-pointer border border-border bg-transparent" />
            <Input value={form.colorCode} onChange={e => setForm(f => ({ ...f, colorCode: e.target.value }))} className="font-mono" />
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1" disabled={createCat.isPending || updateCat.isPending}>
          {category ? "Update Category" : "Add Category"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}

export default function Categories() {
  const [, params] = useRoute("/tournament/:id/categories");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const { data: categories, isLoading } = useListCategories(tournamentId, {
    query: { queryKey: getListCategoriesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const deleteCat = useDeleteCategory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  async function handleDelete(categoryId: number) {
    if (!confirm("Delete this category?")) return;
    await deleteCat.mutateAsync({ tournamentId, categoryId });
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey(tournamentId) });
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground mt-2">Define player tiers, base bids, and bid increments.</p>
          </div>
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2" onClick={() => setEditing(null)}>
                <Plus className="w-5 h-5" /> Add Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg dark">
              <DialogHeader>
                <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
              </DialogHeader>
              <CategoryForm tournamentId={tournamentId} category={editing} onClose={() => { setOpen(false); setEditing(null); }} />
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories?.map(cat => (
              <Card key={cat.id} className="overflow-hidden border-border hover:border-primary/30 transition-all">
                <div className="h-1.5" style={{ backgroundColor: cat.colorCode || "#F59E0B" }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${cat.colorCode}22`, border: `1px solid ${cat.colorCode}44` }}
                      >
                        <Tag className="w-5 h-5" style={{ color: cat.colorCode || "#F59E0B" }} />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl leading-tight">{cat.name}</h3>
                        {cat.maxPlayers && <p className="text-xs text-muted-foreground">Max {cat.maxPlayers} players/team</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(cat); setOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Min Bid</p>
                      <p className="font-bold font-mono" style={{ color: cat.colorCode || "#F59E0B" }}>{formatIndianRupee(cat.minBid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Increment</p>
                      <p className="font-bold font-mono text-muted-foreground">{formatIndianRupee(cat.bidIncrement || 0)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
