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
import { Plus, Pencil, Trash2, Tag, Filter } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditReasonField, isAuditReasonValid } from "@/components/audit-reason-field";

type TierFields = {
  tier1UpTo: number;
  tier1Inc: number;
  tier2UpTo: number;
  tier2Inc: number;
  tier3Inc: number;
};

function parseExistingTiers(bidTiers: string | null | undefined): TierFields {
  if (bidTiers) {
    try {
      const t = JSON.parse(bidTiers);
      if (Array.isArray(t) && t.length >= 3) {
        return {
          tier1UpTo: t[0].upTo || 100000,
          tier1Inc: t[0].increment || 25000,
          tier2UpTo: t[1].upTo || 200000,
          tier2Inc: t[1].increment || 50000,
          tier3Inc: t[2].increment || 100000,
        };
      }
    } catch { /* ignore */ }
  }
  return { tier1UpTo: 100000, tier1Inc: 25000, tier2UpTo: 200000, tier2Inc: 50000, tier3Inc: 100000 };
}

function getInitialIncrementMode(category?: any): "none" | "flat" | "tiers" {
  if (!category) return "none";
  if (category.bidTiers) return "tiers";
  if (category.bidIncrement) return "flat";
  return "none";
}

function CategoryForm({ tournamentId, category, onClose }: { tournamentId: number; category?: any; onClose: () => void }) {
  const qc = useQueryClient();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();

  const [incrementMode, setIncrementMode] = useState<"none" | "flat" | "tiers">(() => getInitialIncrementMode(category));
  const initialTiers = parseExistingTiers(category?.bidTiers);

  const [auditReason, setAuditReason] = useState("");
  const isEdit = !!category;

  const [form, setForm] = useState({
    name: category?.name || "",
    minBid: category?.minBid != null ? String(category.minBid) : "",
    flatIncrement: category?.bidIncrement ? String(category.bidIncrement) : "",
    maxPlayers: category?.maxPlayers ? String(category.maxPlayers) : "",
    colorCode: category?.colorCode || "#F59E0B",
    tier1UpTo: initialTiers.tier1UpTo,
    tier1Inc: initialTiers.tier1Inc,
    tier2UpTo: initialTiers.tier2UpTo,
    tier2Inc: initialTiers.tier2Inc,
    tier3Inc: initialTiers.tier3Inc,
  });

  function setF(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: any = {
      name: form.name,
      colorCode: form.colorCode,
      minBid: form.minBid !== "" ? parseInt(form.minBid) : null,
      maxPlayers: form.maxPlayers !== "" ? parseInt(form.maxPlayers) : null,
    };

    if (incrementMode === "flat") {
      data.bidIncrement = form.flatIncrement !== "" ? parseInt(form.flatIncrement) : null;
      data.bidTiers = null;
    } else if (incrementMode === "tiers") {
      data.bidIncrement = null;
      data.bidTiers = JSON.stringify([
        { upTo: form.tier1UpTo, increment: form.tier1Inc },
        { upTo: form.tier2UpTo, increment: form.tier2Inc },
        { increment: form.tier3Inc },
      ]);
    } else {
      data.bidIncrement = null;
      data.bidTiers = null;
    }

    if (isEdit && !isAuditReasonValid(auditReason)) {
      return;
    }
    if (category) {
      await updateCat.mutateAsync({
        tournamentId,
        categoryId: category.id,
        data: { ...data, reason: auditReason.trim() },
      });
    } else {
      await createCat.mutateAsync({ tournamentId, data });
    }
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey(tournamentId) });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Category Name *</Label>
        <Input
          value={form.name}
          onChange={e => setF("name", e.target.value)}
          required
          placeholder="e.g. Platinum, Gold, Under-23, Fast Bowlers"
        />
      </div>

      <div className="space-y-2">
        <Label>Minimum Base Value (₹)</Label>
        <Input
          type="number"
          value={form.minBid}
          onChange={e => setF("minBid", e.target.value)}
          placeholder="Leave blank to use tournament default"
        />
        <p className="text-xs text-muted-foreground">
          If left blank, the tournament's default min value applies. Category will act as a filter/grouping label only unless min value or increment is set.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Bid Increment</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={incrementMode === "none" ? "default" : "outline"}
            onClick={() => setIncrementMode("none")}
            className="flex-1"
          >
            Hub Default
          </Button>
          <Button
            type="button"
            size="sm"
            variant={incrementMode === "flat" ? "default" : "outline"}
            onClick={() => setIncrementMode("flat")}
            className="flex-1"
          >
            Flat Amount
          </Button>
          <Button
            type="button"
            size="sm"
            variant={incrementMode === "tiers" ? "default" : "outline"}
            onClick={() => setIncrementMode("tiers")}
            className="flex-1"
          >
            Tier System
          </Button>
        </div>

        {incrementMode === "flat" && (
          <div className="space-y-1">
            <Input
              type="number"
              value={form.flatIncrement}
              onChange={e => setF("flatIncrement", e.target.value)}
              placeholder="e.g. 20000"
            />
            <p className="text-xs text-muted-foreground">Fixed amount added per bid step for players in this category.</p>
          </div>
        )}

        {incrementMode === "tiers" && (
          <div className="border border-border rounded-lg p-3 space-y-3">
            <p className="text-xs text-muted-foreground">Each tier applies while current bid is below the threshold.</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tier 1 — bid up to (₹)</Label>
                <Input type="number" value={form.tier1UpTo} onChange={e => setF("tier1UpTo", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tier 1 increment (₹)</Label>
                <Input type="number" value={form.tier1Inc} onChange={e => setF("tier1Inc", parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tier 2 — bid up to (₹)</Label>
                <Input type="number" value={form.tier2UpTo} onChange={e => setF("tier2UpTo", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tier 2 increment (₹)</Label>
                <Input type="number" value={form.tier2Inc} onChange={e => setF("tier2Inc", parseInt(e.target.value) || 0)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Final tier increment (₹)</Label>
              <Input type="number" value={form.tier3Inc} onChange={e => setF("tier3Inc", parseInt(e.target.value) || 0)} />
            </div>
          </div>
        )}

        {incrementMode === "none" && (
          <p className="text-xs text-muted-foreground">Uses the bid increment tiers configured in the tournament hub settings.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max Players per Team</Label>
          <Input
            type="number"
            value={form.maxPlayers}
            onChange={e => setF("maxPlayers", e.target.value)}
            placeholder="No limit"
          />
          <p className="text-xs text-muted-foreground">Max players from this category a team can buy. Leave blank for no limit.</p>
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.colorCode}
              onChange={e => setF("colorCode", e.target.value)}
              className="w-12 h-10 rounded cursor-pointer border border-border bg-transparent"
            />
            <Input value={form.colorCode} onChange={e => setF("colorCode", e.target.value)} className="font-mono" />
          </div>
        </div>
      </div>

      {isEdit && (
        <AuditReasonField
          value={auditReason}
          onChange={setAuditReason}
          placeholder="Explain why category bidding rules are being changed…"
        />
      )}
      <div className="flex gap-3 pt-4">
        <Button
          type="submit"
          className="flex-1"
          disabled={createCat.isPending || updateCat.isPending || (isEdit && !isAuditReasonValid(auditReason))}
        >
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
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-4xl font-bold tracking-tight">Categories</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted/60 text-muted-foreground border border-border/50 tracking-wide">OPTIONAL</span>
            </div>
            <p className="text-muted-foreground mt-2">
              Group players into tiers (e.g. Platinum, Gold, Silver) and set different minimum values or bid increments per tier. Skip this section if all players have the same rules.
            </p>
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
        ) : categories?.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/20 py-14 px-8 text-center max-w-xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Tag className="w-7 h-7 text-amber-500/60" />
            </div>
            <h3 className="font-display font-bold text-lg mb-2">No categories yet — and that is fine</h3>
            <p className="text-muted-foreground text-sm mb-1">
              Categories let you group players into tiers (e.g. Platinum, Gold, Silver) with different minimum values and bid increments.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              This step is optional. If you skip it, all players will use the tournament-level defaults.
            </p>
            <Button className="gap-2" onClick={() => { setEditing(null); setOpen(true); }}>
              <Plus className="w-4 h-4" /> Add Category
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories?.map(cat => {
              const isFilterOnly = cat.minBid == null && cat.bidIncrement == null && !cat.bidTiers;
              return (
                <Card key={cat.id} className="overflow-hidden border-border hover:border-primary/30 transition-all">
                  <div className="h-1.5" style={{ backgroundColor: cat.colorCode || "#F59E0B" }} />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${cat.colorCode}22`, border: `1px solid ${cat.colorCode}44` }}
                        >
                          {isFilterOnly
                            ? <Filter className="w-5 h-5" style={{ color: cat.colorCode || "#F59E0B" }} />
                            : <Tag className="w-5 h-5" style={{ color: cat.colorCode || "#F59E0B" }} />
                          }
                        </div>
                        <div>
                          <h3 className="font-bold text-xl leading-tight">{cat.name}</h3>
                          {cat.maxPlayers && <p className="text-xs text-muted-foreground">Max {cat.maxPlayers} players/team</p>}
                          {isFilterOnly && <p className="text-xs text-muted-foreground italic">Filter/grouping only</p>}
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
                    {!isFilterOnly && (
                      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Min Base Value</p>
                          <p className="font-bold font-mono" style={{ color: cat.colorCode || "#F59E0B" }}>
                            {cat.minBid != null ? formatIndianRupee(cat.minBid) : "Hub default"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Increment</p>
                          {cat.bidTiers ? (
                            <p className="font-bold font-mono text-muted-foreground text-xs">Tier system</p>
                          ) : (
                            <p className="font-bold font-mono text-muted-foreground">
                              {cat.bidIncrement != null ? formatIndianRupee(cat.bidIncrement) : "Hub default"}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
