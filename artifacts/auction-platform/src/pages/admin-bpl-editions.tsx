import { useEffect, useState, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Crown,
  ExternalLink,
  Globe,
  ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Video,
} from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import { AdminScrollPanel } from "@/components/admin/admin-scroll-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  listAdminBplEditions,
  createAdminBplEdition,
  updateAdminBplEdition,
  deleteAdminBplEdition,
  listAdminEditionSponsors,
  createAdminEditionSponsor,
  updateAdminEditionSponsor,
  deleteAdminEditionSponsor,
  type BplEdition,
  type BplEditionStatus,
  type CreateBplEditionInput,
  type BplEditionSponsor,
  type BplSponsorCategory,
  type CreateBplSponsorInput,
} from "@/lib/bpl-api";
import { uploadImageFile } from "@/lib/cloudinary-upload";
import { listAdminTournaments, type AdminTournamentRow } from "@/lib/auth";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  BplEditionStatus,
  { label: string; className: string; pulse?: boolean }
> = {
  DRAFT: {
    label: "Draft",
    className: "border-white/20 bg-white/5 text-muted-foreground",
  },
  UPCOMING: {
    label: "Upcoming",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  LIVE: {
    label: "Live Now",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400 font-semibold",
    pulse: true,
  },
  COMPLETED: {
    label: "Completed",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
  ARCHIVED: {
    label: "Archived",
    className: "border-zinc-700 bg-zinc-800/30 text-zinc-400",
  },
};

const SPONSOR_CATEGORY_CONFIG: Record<
  BplSponsorCategory,
  { label: string; badgeClass: string }
> = {
  TITLE: {
    label: "Title Sponsor",
    badgeClass: "border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold",
  },
  POWERED_BY: {
    label: "Powered By",
    badgeClass: "border-purple-500/40 bg-purple-500/15 text-purple-300 font-semibold",
  },
  ASSOCIATE: {
    label: "Associate Sponsor",
    badgeClass: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  },
  PARTNER: {
    label: "Official Partner",
    badgeClass: "border-zinc-600 bg-zinc-800/60 text-zinc-300",
  },
  MEDIA_PARTNER: {
    label: "Media Partner",
    badgeClass: "border-pink-500/40 bg-pink-500/15 text-pink-300",
  },
};

export default function AdminBplEditionsPage() {
  const [, navigate] = useLocation();
  const { isLoggedIn, isLoading: authLoading } = useAdminPageGuard();
  const { toast } = useToast();

  const [editions, setEditions] = useState<BplEdition[]>([]);
  const [tournaments, setTournaments] = useState<AdminTournamentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEdition, setEditingEdition] = useState<BplEdition | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<BplEdition | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form inputs
  const [name, setName] = useState("");
  const [editionNumber, setEditionNumber] = useState<number>(1);
  const [slug, setSlug] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<BplEditionStatus>("DRAFT");
  const [linkedTournamentId, setLinkedTournamentId] = useState<number | null>(null);
  const [liveStreamUrl, setLiveStreamUrl] = useState("");
  const [fanPageUrl, setFanPageUrl] = useState("");

  const sponsorFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sponsor management modal state
  const [sponsorModalEdition, setSponsorModalEdition] = useState<BplEdition | null>(null);
  const [sponsorsList, setSponsorsList] = useState<BplEditionSponsor[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);

  // Sponsor form state (for add / edit)
  const [editingSponsor, setEditingSponsor] = useState<BplEditionSponsor | null>(null);
  const [sponsorName, setSponsorName] = useState("");
  const [sponsorCategory, setSponsorCategory] = useState<BplSponsorCategory>("TITLE");
  const [sponsorLogoUrl, setSponsorLogoUrl] = useState("");
  const [sponsorWebsiteUrl, setSponsorWebsiteUrl] = useState("");
  const [sponsorDisplayOrder, setSponsorDisplayOrder] = useState<number>(0);
  const [sponsorIsActive, setSponsorIsActive] = useState<boolean>(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSubmittingSponsor, setIsSubmittingSponsor] = useState(false);

  // Sponsor delete target
  const [deleteSponsorTarget, setDeleteSponsorTarget] = useState<BplEditionSponsor | null>(null);
  const [isDeletingSponsor, setIsDeletingSponsor] = useState(false);

  const resetSponsorForm = () => {
    setEditingSponsor(null);
    setSponsorName("");
    setSponsorCategory("TITLE");
    setSponsorLogoUrl("");
    setSponsorWebsiteUrl("");
    setSponsorDisplayOrder(sponsorsList.length);
    setSponsorIsActive(true);
  };

  const loadSponsors = async (editionId: number) => {
    setLoadingSponsors(true);
    setSponsorError(null);
    try {
      const list = await listAdminEditionSponsors(editionId);
      setSponsorsList(list);
    } catch (err: unknown) {
      setSponsorError(err instanceof Error ? err.message : "Failed to load sponsors");
    } finally {
      setLoadingSponsors(false);
    }
  };

  const openSponsorsModal = async (edition: BplEdition) => {
    setSponsorModalEdition(edition);
    setSponsorError(null);
    resetSponsorForm();
    await loadSponsors(edition.id);
  };

  const handleStartEditSponsor = (sponsor: BplEditionSponsor) => {
    setEditingSponsor(sponsor);
    setSponsorName(sponsor.name);
    setSponsorCategory(sponsor.category);
    setSponsorLogoUrl(sponsor.logoUrl);
    setSponsorWebsiteUrl(sponsor.websiteUrl || "");
    setSponsorDisplayOrder(sponsor.displayOrder);
    setSponsorIsActive(sponsor.isActive);
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const res = await uploadImageFile(file, file.name);
      setSponsorLogoUrl(res.url);
      toast({
        title: "Logo Uploaded",
        description: "Sponsor brand logo uploaded successfully.",
      });
    } catch (err: unknown) {
      toast({
        title: "Upload Failed",
        description: err instanceof Error ? err.message : "Failed to upload logo image.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      if (sponsorFileInputRef.current) {
        sponsorFileInputRef.current.value = "";
      }
    }
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sponsorModalEdition) return;

    if (!sponsorName.trim()) {
      toast({
        title: "Validation Error",
        description: "Sponsor brand name is required",
        variant: "destructive",
      });
      return;
    }
    if (!sponsorLogoUrl.trim()) {
      toast({
        title: "Validation Error",
        description: "Sponsor logo URL or image upload is required",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingSponsor(true);
    try {
      const payload: CreateBplSponsorInput = {
        name: sponsorName.trim(),
        category: sponsorCategory,
        logoUrl: sponsorLogoUrl.trim(),
        websiteUrl: sponsorWebsiteUrl.trim() || null,
        displayOrder: sponsorDisplayOrder,
        isActive: sponsorIsActive,
      };

      if (editingSponsor) {
        const res = await updateAdminEditionSponsor(
          sponsorModalEdition.id,
          editingSponsor.id,
          payload,
        );
        if (!res.success) {
          toast({
            title: "Update Failed",
            description: res.error || "Failed to update sponsor",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Sponsor Updated",
          description: `Updated '${res.data?.name}'.`,
        });
      } else {
        const res = await createAdminEditionSponsor(sponsorModalEdition.id, payload);
        if (!res.success) {
          toast({
            title: "Creation Failed",
            description: res.error || "Failed to create sponsor",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Sponsor Added",
          description: `Added '${res.data?.name}'.`,
        });
      }

      resetSponsorForm();
      await loadSponsors(sponsorModalEdition.id);
      loadData();
    } finally {
      setIsSubmittingSponsor(false);
    }
  };

  const handleToggleSponsorActive = async (sponsor: BplEditionSponsor) => {
    if (!sponsorModalEdition) return;
    const newActive = !sponsor.isActive;
    const res = await updateAdminEditionSponsor(sponsorModalEdition.id, sponsor.id, {
      isActive: newActive,
    });
    if (res.success) {
      setSponsorsList((prev) =>
        prev.map((s) => (s.id === sponsor.id ? { ...s, isActive: newActive } : s)),
      );
      loadData();
    } else {
      toast({ title: "Update Failed", description: res.error, variant: "destructive" });
    }
  };

  const handleDeleteSponsorConfirm = async () => {
    if (!sponsorModalEdition || !deleteSponsorTarget) return;
    setIsDeletingSponsor(true);
    try {
      const res = await deleteAdminEditionSponsor(
        sponsorModalEdition.id,
        deleteSponsorTarget.id,
      );
      if (res.success) {
        toast({
          title: "Sponsor Deleted",
          description: `Removed '${deleteSponsorTarget.name}'.`,
        });
        setSponsorsList((prev) => prev.filter((s) => s.id !== deleteSponsorTarget.id));
        if (editingSponsor?.id === deleteSponsorTarget.id) {
          resetSponsorForm();
        }
        setDeleteSponsorTarget(null);
        loadData();
      } else {
        toast({ title: "Delete Failed", description: res.error, variant: "destructive" });
      }
    } finally {
      setIsDeletingSponsor(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [editionsData, tournamentsData] = await Promise.all([
        listAdminBplEditions(),
        listAdminTournaments().catch(() => []),
      ]);
      setEditions(editionsData);
      setTournaments(tournamentsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load editions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadData();
    }
  }, [isLoggedIn]);

  const openCreateModal = () => {
    setEditingEdition(null);
    const nextNumber = editions.length > 0 ? Math.max(...editions.map((e) => e.editionNumber)) + 1 : 1;
    const padNum = String(nextNumber).padStart(2, "0");
    setName(`BidWar Premier League — Edition ${padNum}`);
    setEditionNumber(nextNumber);
    setSlug(`edition-${padNum}`);
    setYear(2026);
    setStartDate("2026-10-10");
    setEndDate("2026-10-11");
    setVenue("");
    setCity("");
    setDescription("");
    setStatus("DRAFT");
    setLinkedTournamentId(null);
    setLiveStreamUrl("");
    setFanPageUrl("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (edition: BplEdition) => {
    setEditingEdition(edition);
    setName(edition.name);
    setEditionNumber(edition.editionNumber);
    setSlug(edition.slug);
    setYear(edition.year);
    setStartDate(edition.startDate);
    setEndDate(edition.endDate);
    setVenue(edition.venue || "");
    setCity(edition.city || "");
    setDescription(edition.description || "");
    setStatus(edition.status);
    setLinkedTournamentId(edition.linkedTournamentId || null);
    setLiveStreamUrl(edition.liveStreamUrl || "");
    setFanPageUrl(edition.fanPageUrl || "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (!slug.trim()) {
      setFormError("Slug is required");
      return;
    }
    if (!startDate || !endDate) {
      setFormError("Start and End dates are required");
      return;
    }
    if (startDate > endDate) {
      setFormError("Start date cannot be after end date");
      return;
    }

    setIsSubmitting(true);
    const payload: CreateBplEditionInput = {
      name: name.trim(),
      editionNumber,
      slug: slug.trim().toLowerCase(),
      year,
      startDate,
      endDate,
      venue: venue.trim() || null,
      city: city.trim() || null,
      description: description.trim() || null,
      status,
      linkedTournamentId: linkedTournamentId || null,
      liveStreamUrl: liveStreamUrl.trim() || null,
      fanPageUrl: fanPageUrl.trim() || null,
    };

    if (editingEdition) {
      const result = await updateAdminBplEdition(editingEdition.id, payload);
      setIsSubmitting(false);
      if (!result.success) {
        setFormError(result.error || "Failed to update edition");
        return;
      }
      toast({
        title: "Edition Updated",
        description: `Successfully saved '${result.data?.name}'.`,
      });
    } else {
      const result = await createAdminBplEdition(payload);
      setIsSubmitting(false);
      if (!result.success) {
        setFormError(result.error || "Failed to create edition");
        return;
      }
      toast({
        title: "Edition Created",
        description: `Successfully created '${result.data?.name}'.`,
      });
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const result = await deleteAdminBplEdition(deleteTarget.id);
    setIsDeleting(false);
    if (!result.success) {
      toast({
        title: "Delete Failed",
        description: result.error || "Could not delete edition.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Edition Deleted",
      description: `Edition '${deleteTarget.name}' was removed.`,
    });
    setDeleteTarget(null);
    loadData();
  };

  const hasLiveEdition = useMemo(
    () => editions.some((e) => e.status === "LIVE"),
    [editions],
  );

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-stage">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminShell
      title="BPL Editions"
      eyebrow="BidWar Premier League"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Edition
          </Button>
        </div>
      }
    >
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Edition Lifecycle Management
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage flagship BidWar Premier League editions, dates, linked tournaments, sponsors, and live broadcasts.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <Button variant="ghost" size="sm" onClick={loadData}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-card p-5 space-y-3"
              >
                <div className="flex justify-between items-center">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-72" />
                <div className="flex gap-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : editions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-card/40 p-12 text-center">
            <Crown className="h-12 w-12 text-amber-400/60 mb-4" />
            <h3 className="text-lg font-semibold text-foreground">No BPL Editions Yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create the first edition for BidWar Premier League to establish the tournament schedule and identity.
            </p>
            <Button onClick={openCreateModal} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              Create Edition 01
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {editions.map((edition) => {
              const statusCfg = STATUS_CONFIG[edition.status];
              const linked = edition.linkedTournament;
              return (
                <div
                  key={edition.id}
                  className="group relative rounded-xl border border-white/10 bg-card/60 p-5 transition-all hover:border-white/20 hover:bg-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          #{String(edition.editionNumber).padStart(2, "0")}
                        </span>
                        <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                          {edition.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`gap-1.5 text-xs py-0.5 px-2.5 ${statusCfg.className}`}
                        >
                          {statusCfg.pulse && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          )}
                          {statusCfg.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-amber-400/80" />
                          <span>
                            {edition.startDate === edition.endDate
                              ? edition.startDate
                              : `${edition.startDate} to ${edition.endDate}`}
                          </span>
                        </div>
                        {(edition.city || edition.venue) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-blue-400/80" />
                            <span>
                              {[edition.venue, edition.city].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground/70">
                          <span>Slug: /{edition.slug}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSponsorsModal(edition)}
                        className="h-8 gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Sponsors ({edition.sponsors?.length ?? 0})
                      </Button>

                      <Link href={`/bpl/${edition.slug}`} target="_blank">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Public Page</span>
                        </Button>
                      </Link>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(edition)}
                        className="h-8 gap-1.5 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={edition.status === "LIVE"}
                        onClick={() => setDeleteTarget(edition)}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                        title={
                          edition.status === "LIVE"
                            ? "Cannot delete active LIVE edition"
                            : "Delete edition"
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Linked Tournament & Public Links Row */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground font-medium">Linked Tournament:</span>
                      {linked ? (
                        <Link href={`/admin/tournaments/${linked.id}`}>
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 text-foreground border border-white/10 transition-colors cursor-pointer">
                            <Trophy className="h-3 w-3 text-amber-400" />
                            <span className="font-medium">{linked.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1 rounded bg-black/40 text-muted-foreground">
                              {linked.sport}
                            </span>
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground/60 italic">
                          None linked (Standings/Fixtures will not appear)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {edition.liveStreamUrl && (
                        <a
                          href={edition.liveStreamUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 font-medium"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Live Stream
                        </a>
                      )}
                      {edition.fanPageUrl && (
                        <a
                          href={edition.fanPageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Fan Hub
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Edition Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-stage border-white/10 text-foreground">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                {editingEdition ? `Edit ${editingEdition.name}` : "Create New BPL Edition"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set edition identity, dates, status, and link an existing tournament engine.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid gap-4 py-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-foreground">
                    Edition Title <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. BidWar Premier League — Edition 01"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="editionNumber" className="text-xs font-medium text-foreground">
                    Edition # <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="editionNumber"
                    type="number"
                    min={1}
                    value={editionNumber}
                    onChange={(e) => setEditionNumber(parseInt(e.target.value, 10) || 1)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="slug" className="text-xs font-medium text-foreground">
                    URL Slug <span className="text-red-400">*</span>
                  </Label>
                  <div className="flex items-center">
                    <span className="rounded-l-md border border-r-0 border-white/10 bg-white/5 px-2.5 py-2 text-xs text-muted-foreground font-mono">
                      /bpl/
                    </span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                      placeholder="edition-01"
                      className="rounded-l-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="year" className="text-xs font-medium text-foreground">
                    Year <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    min={2000}
                    max={2100}
                    value={year}
                    onChange={(e) => setYear(parseInt(e.target.value, 10) || 2026)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate" className="text-xs font-medium text-foreground">
                    Start Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate" className="text-xs font-medium text-foreground">
                    End Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="venue" className="text-xs font-medium text-foreground">
                    Venue
                  </Label>
                  <Input
                    id="venue"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="e.g. Sigra Stadium"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-xs font-medium text-foreground">
                    City
                  </Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Varanasi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-medium text-foreground">
                    Status
                  </Label>
                  <Select
                    value={status}
                    onValueChange={(val) => setStatus(val as BplEditionStatus)}
                  >
                    <SelectTrigger id="status" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft (Admin only)</SelectItem>
                      <SelectItem value="UPCOMING">Upcoming (Publicly visible)</SelectItem>
                      <SelectItem value="LIVE">Live Now (Active flagship edition)</SelectItem>
                      <SelectItem value="COMPLETED">Completed (Publicly archived)</SelectItem>
                      <SelectItem value="ARCHIVED">Archived (Historical)</SelectItem>
                    </SelectContent>
                  </Select>
                  {status === "LIVE" && !hasLiveEdition && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      ● This will be the sole active LIVE edition on /bpl.
                    </p>
                  )}
                  {status === "LIVE" && hasLiveEdition && editingEdition?.status !== "LIVE" && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      ⚠️ Another edition is currently LIVE. Only one LIVE edition is permitted.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="linkedTournament" className="text-xs font-medium text-foreground">
                    Linked Tournament Engine
                  </Label>
                  <Select
                    value={linkedTournamentId ? String(linkedTournamentId) : "none"}
                    onValueChange={(val) =>
                      setLinkedTournamentId(val === "none" ? null : parseInt(val, 10))
                    }
                  >
                    <SelectTrigger id="linkedTournament" className="w-full">
                      <SelectValue placeholder="Select tournament" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      <SelectItem value="none">None / Unlinked</SelectItem>
                      {tournaments.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          #{t.id} {t.name} ({t.sport})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Connects to existing BidWar tournament teams, fixtures, and scores.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="liveStreamUrl" className="text-xs font-medium text-foreground">
                    Live Stream URL
                  </Label>
                  <Input
                    id="liveStreamUrl"
                    type="url"
                    value={liveStreamUrl}
                    onChange={(e) => setLiveStreamUrl(e.target.value)}
                    placeholder="https://youtube.com/live/..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fanPageUrl" className="text-xs font-medium text-foreground">
                    Fan / Details Page URL
                  </Label>
                  <Input
                    id="fanPageUrl"
                    type="url"
                    value={fanPageUrl}
                    onChange={(e) => setFanPageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-medium text-foreground">
                  Description / Synopsis
                </Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Overview of this premier league edition, participating franchises, and highlights..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-4 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {editingEdition ? "Save Changes" : "Create Edition"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-stage border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete BPL Edition?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete edition{" "}
              <strong className="text-foreground">'{deleteTarget?.name}'</strong>?
              This action cannot be undone. Any linked tournament will remain completely intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete Edition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sponsor Management Dialog */}
      <Dialog
        open={Boolean(sponsorModalEdition)}
        onOpenChange={(open) => {
          if (!open) {
            setSponsorModalEdition(null);
            resetSponsorForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-stage border-white/10 text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <DialogTitle className="text-lg font-bold">
                Manage Sponsors — {sponsorModalEdition?.name}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure title, powered-by, associate, and partner sponsors. These display in the official BPL public showcase.
            </DialogDescription>
          </DialogHeader>

          {sponsorError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{sponsorError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sponsorModalEdition && loadSponsors(sponsorModalEdition.id)}
                className="ml-auto text-xs h-7"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Current Sponsors List */}
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Configured Sponsors ({sponsorsList.length})
              </h4>
              {editingSponsor && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetSponsorForm}
                  className="h-7 text-xs text-amber-400 hover:text-amber-300"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Sponsor
                </Button>
              )}
            </div>

            {loadingSponsors ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full rounded-lg" />
                <Skeleton className="h-14 w-full rounded-lg" />
              </div>
            ) : sponsorsList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 bg-card/40 p-6 text-center text-xs text-muted-foreground">
                <p className="font-medium text-foreground">No explicit BPL sponsors added yet.</p>
                <p className="mt-1 text-[11px]">
                  If a tournament is linked with sponsor logos, those logos will automatically appear on the public page until you add custom sponsors here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {sponsorsList.map((sponsor) => {
                  const catCfg = SPONSOR_CATEGORY_CONFIG[sponsor.category] || {
                    label: sponsor.category,
                    badgeClass: "border-white/20 bg-white/5 text-muted-foreground",
                  };
                  return (
                    <div
                      key={sponsor.id}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-lg border p-3 text-xs transition-colors",
                        editingSponsor?.id === sponsor.id
                          ? "border-amber-500/50 bg-amber-500/10"
                          : "border-white/10 bg-card/60 hover:border-white/20",
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {sponsor.logoUrl ? (
                          <img
                            src={sponsor.logoUrl}
                            alt={sponsor.name}
                            className="h-9 w-14 rounded object-contain bg-black/50 border border-white/10 p-1 shrink-0"
                          />
                        ) : (
                          <div className="h-9 w-14 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground truncate">
                              {sponsor.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${catCfg.badgeClass}`}
                            >
                              {catCfg.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            <span>Order #{sponsor.displayOrder}</span>
                            {sponsor.websiteUrl && (
                              <a
                                href={sponsor.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                <span>Website</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 mr-2">
                          <Switch
                            checked={sponsor.isActive}
                            onCheckedChange={() => handleToggleSponsorActive(sponsor)}
                            aria-label={`Toggle ${sponsor.name} active`}
                          />
                          <span
                            className={cn(
                              "text-[10px] font-medium hidden sm:inline",
                              sponsor.isActive ? "text-emerald-400" : "text-muted-foreground",
                            )}
                          >
                            {sponsor.isActive ? "Active" : "Hidden"}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEditSponsor(sponsor)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit Sponsor"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteSponsorTarget(sponsor)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          title="Delete Sponsor"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              {editingSponsor ? (
                <>
                  <Pencil className="h-3.5 w-3.5 text-amber-400" />
                  Edit Sponsor: <span className="text-foreground">{editingSponsor.name}</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Add New Sponsor
                </>
              )}
            </h4>

            <form onSubmit={handleSaveSponsor} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sponsorName" className="text-xs font-medium text-foreground">
                    Sponsor / Brand Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="sponsorName"
                    value={sponsorName}
                    onChange={(e) => setSponsorName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sponsorCategory" className="text-xs font-medium text-foreground">
                    Sponsorship Tier <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    value={sponsorCategory}
                    onValueChange={(val) => setSponsorCategory(val as BplSponsorCategory)}
                  >
                    <SelectTrigger id="sponsorCategory" className="w-full">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TITLE">Title Sponsor (Hero Priority)</SelectItem>
                      <SelectItem value="POWERED_BY">Powered By</SelectItem>
                      <SelectItem value="ASSOCIATE">Associate Sponsor</SelectItem>
                      <SelectItem value="PARTNER">Official Partner</SelectItem>
                      <SelectItem value="MEDIA_PARTNER">Media Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sponsorLogoUrl" className="text-xs font-medium text-foreground">
                  Brand Logo <span className="text-red-400">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="sponsorLogoUrl"
                    value={sponsorLogoUrl}
                    onChange={(e) => setSponsorLogoUrl(e.target.value)}
                    placeholder="https://... or upload image"
                    className="flex-1 font-mono text-xs"
                    required
                  />
                  <input
                    type="file"
                    ref={sponsorFileInputRef}
                    onChange={handleLogoFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploadingLogo}
                    onClick={() => sponsorFileInputRef.current?.click()}
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload
                  </Button>
                </div>
                {sponsorLogoUrl && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[11px] text-muted-foreground">Preview:</span>
                    <img
                      src={sponsorLogoUrl}
                      alt="Preview"
                      className="h-8 max-w-[120px] rounded object-contain bg-black/40 border border-white/10 p-1"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sponsorWebsiteUrl" className="text-xs font-medium text-foreground">
                    Website URL (Optional)
                  </Label>
                  <Input
                    id="sponsorWebsiteUrl"
                    type="url"
                    value={sponsorWebsiteUrl}
                    onChange={(e) => setSponsorWebsiteUrl(e.target.value)}
                    placeholder="https://acme.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sponsorDisplayOrder" className="text-xs font-medium text-foreground">
                    Display Order
                  </Label>
                  <Input
                    id="sponsorDisplayOrder"
                    type="number"
                    min={0}
                    value={sponsorDisplayOrder}
                    onChange={(e) => setSponsorDisplayOrder(parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="sponsorIsActive"
                  checked={sponsorIsActive}
                  onCheckedChange={setSponsorIsActive}
                />
                <Label htmlFor="sponsorIsActive" className="text-xs text-foreground font-medium cursor-pointer">
                  Display sponsor publicly on BPL edition showcase
                </Label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingSponsor && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetSponsorForm}
                    disabled={isSubmittingSponsor}
                    className="text-xs"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingSponsor}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs"
                >
                  {isSubmittingSponsor ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  {editingSponsor ? "Update Sponsor" : "Add Sponsor"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Sponsor Confirmation */}
      <AlertDialog
        open={Boolean(deleteSponsorTarget)}
        onOpenChange={(open) => !open && setDeleteSponsorTarget(null)}
      >
        <AlertDialogContent className="bg-stage border-white/10 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Sponsor?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete sponsor{" "}
              <strong className="text-foreground">'{deleteSponsorTarget?.name}'</strong> from this edition?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={isDeletingSponsor} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSponsorConfirm}
              disabled={isDeletingSponsor}
              className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5"
            >
              {isDeletingSponsor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete Sponsor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminShell>
  );
}
