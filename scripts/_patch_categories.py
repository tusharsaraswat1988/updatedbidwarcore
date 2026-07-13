from pathlib import Path

path = Path(r"artifacts/auction-platform/src/pages/badminton/categories.tsx")
text = path.read_text(encoding="utf-8")
start = text.index("function CategoryPanel(")
end = text.index("function CategoryFormModal(")

new_panel = r'''function CategoryPanel({
  category,
  tournamentId,
  expanded,
  onToggle,
  onEdit,
  onDeleted,
  onRefresh,
}: {
  category: BadmintonCategory;
  tournamentId: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onRefresh: () => void;
}) {
  const { data: registrations = [], isLoading: regsLoading } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const [showAddReg, setShowAddReg] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${category.id}`, { method: "DELETE" });
      setConfirmDeleteOpen(false);
      onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const isDoublesEntry = category.matchType !== "singles";

  return (
    <div className={cn(hubCardClass, "overflow-hidden")}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-4 p-5 text-left hover:bg-white/3 transition-colors min-w-0"
        >
          <div className="flex items-center gap-4 min-w-0">
            {category.colorCode && (
              <div
                className="w-3 h-10 rounded-full flex-none"
                style={{ backgroundColor: category.colorCode }}
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-white font-bold text-lg truncate">{category.name}</h3>
                {category.code && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                    {category.code}
                  </span>
                )}
                <PhaseBadge phase={category.phase} />
              </div>
              <p className="text-white/40 text-sm mt-0.5">
                {formatMatchType(category.matchType)}
                {category.ageGroup ? ` · ${category.ageGroup}` : ""}
                {category.gender ? ` · ${category.gender}` : ""}
                {" · "}{category.drawType.replace("_", " ")}
              </p>
            </div>
          </div>
          <span className="text-white/30 text-sm flex-none">{expanded ? "Hide" : "Open"}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteError("");
            setConfirmDeleteOpen(true);
          }}
          title="Delete category"
          aria-label={`Delete ${category.name}`}
          className="flex-none w-14 border-l border-white/8 hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeleteError("");
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete category?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Delete <span className="text-foreground font-medium">{category.name}</span>?
                  All entries and related fixture data for this category will be permanently
                  removed.
                </p>
                <p>This cannot be undone.</p>
                {deleteError ? <p className="text-red-400">{deleteError}</p> : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {expanded && (
        <div className="border-t border-white/8 p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onEdit}
              className="h-9 px-4 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold transition-colors"
            >
              Edit Category
            </button>
            <button
              onClick={() => setShowAddReg(true)}
              className="h-9 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors border border-primary/25"
            >
              + Add Entry
            </button>
            <Link
              href={`/tournament/${tournamentId}/badminton/fixtures?categoryId=${category.id}`}
              className="h-9 px-4 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-semibold transition-colors inline-flex items-center"
            >
              Open Draw & Fixtures
            </Link>
          </div>

          <section>
            <h4 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
              Entries ({registrations.length})
            </h4>
            {regsLoading ? (
              <div className="h-16 rounded-xl bg-white/4 animate-pulse" />
            ) : registrations.length === 0 ? (
              <p className="text-white/30 text-sm">No entries yet — add players to this category.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {registrations.map((row) => (
                  <div
                    key={row.registration.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
                  >
                    {row.registration.seedNumber && (
                      <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] text-xs font-black flex items-center justify-center flex-none">
                        {row.registration.seedNumber}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">
                        {formatRegistrationEntryName(row, isDoublesEntry)}
                      </p>
                      <p className="text-white/30 text-xs capitalize">
                        {row.registration.seedNumber
                          ? `Seed ${row.registration.seedNumber} · ${row.registration.status}`
                          : row.registration.status}
                      </p>
                    </div>
                    {row.registration.status === "withdrawn" ? (
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
                        onClick={() =>
                          void badmintonFetch(
                            tournamentId,
                            `/categories/${category.id}/registrations/${row.registration.id}`,
                            { method: "PATCH", body: JSON.stringify({ status: "accepted" }) },
                          ).then(() => onRefresh())
                        }
                      >
                        Reinstate
                      </button>
                    ) : row.registration.status !== "disqualified" ? (
                      <button
                        type="button"
                        className="text-[10px] uppercase tracking-wide text-amber-400 hover:text-amber-300"
                        onClick={() =>
                          void badmintonFetch(
                            tournamentId,
                            `/categories/${category.id}/registrations/${row.registration.id}`,
                            { method: "PATCH", body: JSON.stringify({ status: "withdrawn" }) },
                          ).then(() => onRefresh())
                        }
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {showAddReg && (
        <AddRegistrationModal
          tournamentId={tournamentId}
          category={category}
          onClose={() => setShowAddReg(false)}
          onSaved={() => {
            onRefresh();
            setShowAddReg(false);
          }}
        />
      )}
    </div>
  );
}

'''

path.write_text(text[:start] + new_panel + text[end:], encoding="utf-8")
print("patched", path)
