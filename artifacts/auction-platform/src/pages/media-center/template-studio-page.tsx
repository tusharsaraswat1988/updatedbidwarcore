/**
 * BidWar Media Center — Template Studio
 *
 * Registry-driven preview studio using Phase-13 live data providers.
 * Queues creative jobs and renders PNGs via the background worker.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import {
  ArrowLeft,
  ImageOff,
  Loader2,
  Moon,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { AppLayout } from "@/components/layout";
import { BuzzStudioFeatureGuard } from "@/components/buzz-studio-feature-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getTemplateById,
  templateExists,
  type BuzzTemplateRegistryEntry,
  type TopBuysListContract,
  BUZZ_EXPORT_DIMENSIONS,
} from "@/features/buzz-studio";
import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import {
  createCreativeJob,
  listCreativeJobs,
} from "@/features/buzz-studio/jobs";
import { CreativeHistoryPanel } from "./creative-history-panel";
import {
  getTemplateStudioConfig,
  hasTemplateStudioSupport,
  isTopBuysEmpty,
  type TemplateStudioListItem,
} from "./template-studio-config";
import { useTemplateStudioData } from "./use-template-studio-data";
import {
  mediaCenterPath,
  mediaCenterTournamentPath,
} from "@/lib/tournament-navigation";

const ASPECT_RATIO_OPTIONS = ["1:1", "4:5", "9:16", "16:9"] as const;
type AspectRatioOption = (typeof ASPECT_RATIO_OPTIONS)[number];

/** Platform-level Buzz Studio background URLs, keyed by aspect ratio. */
type BuzzStudioBackgrounds = Record<AspectRatioOption, string | null>;

/** Scale export canvas to fit preview panel — WYSIWYG with PNG output. */
const PREVIEW_MAX_WIDTH: Record<AspectRatioOption, number> = {
  "1:1":  520,
  "4:5":  420,
  "9:16": 340,
  "16:9": 640,
};

function previewScale(aspectRatio: AspectRatioOption): number {
  const dims = BUZZ_EXPORT_DIMENSIONS[aspectRatio];
  return PREVIEW_MAX_WIDTH[aspectRatio] / dims.width;
}

function resolveTemplateId(raw: string | undefined): BuzzTemplateType | null {
  if (!raw || !templateExists(raw)) return null;
  return raw;
}

function resolveMediaCenterBackPath(
  tournamentId: number,
  isOrganizerRoute: boolean,
): string {
  return isOrganizerRoute
    ? mediaCenterPath(tournamentId)
    : mediaCenterTournamentPath(tournamentId);
}

function TemplateLivePreview({
  entry,
  contract,
  aspectRatio,
  previewTheme,
  backgroundImageUrl,
  featuredFrameLayout,
}: {
  entry: BuzzTemplateRegistryEntry;
  contract: Record<string, unknown> | undefined;
  aspectRatio: AspectRatioOption;
  previewTheme: "dark" | "light";
  backgroundImageUrl: string | null;
  featuredFrameLayout?: boolean;
}) {
  if (!entry.component) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-amber-500/40 bg-black/40 p-8 text-center">
        <p className="text-sm text-amber-200/90">
          Template registered but component unavailable.
        </p>
      </div>
    );
  }

  const Template = entry.component;
  const dims = BUZZ_EXPORT_DIMENSIONS[aspectRatio];
  const scale = previewScale(aspectRatio);
  const surfaceClass =
    previewTheme === "dark"
      ? "bg-[#0a0a0a] border-white/10"
      : "bg-neutral-100 border-neutral-300";

  return (
    <div
      className={`flex flex-1 overflow-auto rounded-xl border p-4 transition-colors ${surfaceClass}`}
    >
      <div
        className="mx-auto"
        style={{
          width: Math.round(dims.width * scale),
          height: Math.round(dims.height * scale),
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: dims.width,
            height: dims.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* backgroundImageUrl is a render-time inject — never stored in the contract */}
          <Template
            {...(contract ?? {})}
            renderMode="preview"
            aspectRatio={aspectRatio}
            renderWidth={dims.width}
            renderHeight={dims.height}
            backgroundImageUrl={backgroundImageUrl ?? undefined}
            featuredFrameLayout={featuredFrameLayout}
          />
        </div>
      </div>
    </div>
  );
}

function StudioEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/40 px-8 py-16 text-center">
      <div className="rounded-full bg-muted/60 p-4">
        <ImageOff className="h-10 w-10 text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-medium text-white">{message}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Data will appear here once your tournament has the required records.
        </p>
      </div>
    </div>
  );
}

function SelectorPanel({
  label,
  items,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: {
  label: string;
  items: TemplateStudioListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card/70 p-3">
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search…"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">No matches.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                selectedId === item.id
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border bg-background/40 text-foreground hover:border-primary/30 hover:bg-background/70"
              }`}
            >
              <div className="text-sm font-medium">{item.label}</div>
              {item.subtitle ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{item.subtitle}</div>
              ) : null}
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

export default function TemplateStudioPage() {
  const [, organizerRoute] = useRoute("/organizer/media-center/:id/:templateId");
  const [, tournamentRoute] = useRoute("/tournament/:id/media-center/:templateId");
  const routeParams = organizerRoute ?? tournamentRoute;
  const isOrganizerRoute = Boolean(organizerRoute);

  const tournamentId = parseInt(routeParams?.id ?? "0", 10);
  const templateId = resolveTemplateId(routeParams?.templateId);
  const entry = templateId ? getTemplateById(templateId) : undefined;
  const studioConfig = templateId ? getTemplateStudioConfig(templateId) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useTemplateStudioData(
    tournamentId,
    templateId ?? BuzzTemplateType.PLAYER_SPOTLIGHT,
  );

  const creativeJobsQueryKey = ["buzz-studio", "creative-jobs", tournamentId] as const;

  const {
    data: creativeJobs = [],
    isLoading: jobsLoading,
    isError: jobsError,
  } = useQuery({
    queryKey: creativeJobsQueryKey,
    queryFn: () => listCreativeJobs(tournamentId, { limit: 20 }),
    enabled: tournamentId > 0,
    refetchInterval: 15000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("1:1");
  const [previewTheme, setPreviewTheme] = useState<"dark" | "light">("dark");

  // Fetch global Buzz Studio background URLs (admin-controlled)
  const { data: buzzBackgrounds } = useQuery<BuzzStudioBackgrounds>({
    queryKey: ["buzz-studio-backgrounds"],
    queryFn: async () => {
      const res = await fetch("/api/settings/buzz-studio-assets");
      if (!res.ok) return { "1:1": null, "4:5": null, "9:16": null, "16:9": null };
      return res.json() as Promise<BuzzStudioBackgrounds>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: topBuysTemplateBackgrounds } = useQuery<BuzzStudioBackgrounds>({
    queryKey: ["buzz-studio-template-backgrounds", "top_buys"],
    queryFn: async () => {
      const res = await fetch("/api/settings/buzz-studio-template-assets/top-buys");
      if (!res.ok) return { "1:1": null, "4:5": null, "9:16": null, "16:9": null };
      return res.json() as Promise<BuzzStudioBackgrounds>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: templateId === BuzzTemplateType.TOP_BUYS,
  });

  const templateBackgroundUrl =
    templateId === BuzzTemplateType.TOP_BUYS
      ? (topBuysTemplateBackgrounds?.[aspectRatio] ?? null)
      : null;

  const activeBackgroundUrl = templateBackgroundUrl ?? buzzBackgrounds?.[aspectRatio] ?? null;

  const featuredFrameLayout = Boolean(
    templateId === BuzzTemplateType.TOP_BUYS &&
    templateBackgroundUrl &&
    aspectRatio === "4:5",
  );

  const filteredItems = useMemo(() => {
    if (!data?.items.length) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.items;
    return data.items.filter((item) => item.searchText.includes(query));
  }, [data?.items, searchQuery]);

  const effectiveSelectedId = useMemo(() => {
    if (!data?.items.length) return null;
    if (selectedId && filteredItems.some((item) => item.id === selectedId)) {
      return selectedId;
    }
    return filteredItems[0]?.id ?? data.items[0]?.id ?? null;
  }, [data?.items, filteredItems, selectedId]);

  const activeContract = useMemo(() => {
    if (!data) return undefined;
    if (data.directContract) {
      const contract = data.directContract;
      if (
        templateId === BuzzTemplateType.TOP_BUYS &&
        isTopBuysEmpty(contract as unknown as TopBuysListContract)
      ) {
        return undefined;
      }
      return contract;
    }
    if (!effectiveSelectedId) return undefined;
    return data.contractsById.get(effectiveSelectedId);
  }, [data, effectiveSelectedId, templateId]);

  const isEmpty = useMemo(() => {
    if (!data) return false;
    if (data.selectionMode === "none") {
      return !data.directContract || !activeContract;
    }
    return data.items.length === 0;
  }, [activeContract, data]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!templateId || !activeContract) {
        throw new Error("No contract data available for this template.");
      }
      // Contracts are data-only. The background URL is resolved at render time
      // by the server (creative-render-process) from Creative Assets Manager.
      return createCreativeJob({
        tournamentId,
        templateId,
        contract: activeContract,
        aspectRatio,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: creativeJobsQueryKey });
      toast({
        title: "Creative queued successfully",
        description: "Your creative job has been added to the queue.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not queue creative",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const backPath = resolveMediaCenterBackPath(tournamentId, isOrganizerRoute);

  const canGenerate = Boolean(activeContract) && !isEmpty && !generateMutation.isPending;

  function handleGenerateClick() {
    if (!canGenerate) return;
    generateMutation.mutate();
  }

  if (!templateId || !entry || !entry.enabled || !studioConfig || !hasTemplateStudioSupport(templateId)) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <BuzzStudioFeatureGuard tournamentId={tournamentId}>
          <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
            <h1 className="text-xl font-display font-bold text-white">Template not found</h1>
            <p className="text-sm text-muted-foreground">
              This template is unavailable or not enabled for Template Studio.
            </p>
            <Button asChild variant="outline">
              <Link href={backPath}>Back to Media Center</Link>
            </Button>
          </div>
        </BuzzStudioFeatureGuard>
      </AppLayout>
    );
  }

  const showSelector = studioConfig.selectionMode === "list";

  return (
    <AppLayout tournamentId={tournamentId}>
      <BuzzStudioFeatureGuard tournamentId={tournamentId}>
        <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4">
          {/* Header */}
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-2">
              <Link
                href={backPath}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Media Center
              </Link>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-display font-black text-white tracking-tight">
                    {entry.title}
                  </h1>
                  <p className="text-sm text-muted-foreground">{entry.description}</p>
                </div>
              </div>
            </div>
            <Button
              className="font-display font-bold"
              onClick={handleGenerateClick}
              disabled={!canGenerate}
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Queuing…
                </>
              ) : (
                "Generate Creative"
              )}
            </Button>
          </header>

          {/* Preview toolbar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Aspect Ratio
            </span>
            {ASPECT_RATIO_OPTIONS.map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  aspectRatio === ratio
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border bg-background/50 text-muted-foreground hover:border-primary/30 hover:text-white"
                }`}
              >
                {ratio}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewTheme("dark")}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  previewTheme === "dark"
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                <Moon className="h-3.5 w-3.5" />
                Dark
              </button>
              <button
                type="button"
                onClick={() => setPreviewTheme("light")}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  previewTheme === "light"
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border text-muted-foreground hover:text-white"
                }`}
              >
                <Sun className="h-3.5 w-3.5" />
                Light
              </button>
            </div>
          </div>

          {/* Main panels */}
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/40 py-24 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading tournament data…
            </div>
          ) : isError ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
              <p className="text-sm text-destructive">
                {(error as Error)?.message ?? "Failed to load template data."}
              </p>
            </div>
          ) : (
            <div
              className={`grid min-h-0 flex-1 gap-4 ${
                showSelector
                  ? "lg:grid-cols-[260px_1fr_300px]"
                  : "lg:grid-cols-[1fr_300px]"
              }`}
            >
              {showSelector ? (
                <SelectorPanel
                  label={studioConfig.listLabel}
                  items={filteredItems}
                  selectedId={effectiveSelectedId}
                  onSelect={setSelectedId}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                />
              ) : null}

              <main className="flex min-h-[480px] flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Live Preview
                  </h2>
                  <Badge variant="outline" className="text-[10px]">
                    {aspectRatio}
                  </Badge>
                </div>
                {isEmpty ? (
                  <StudioEmptyState message={data?.emptyMessage ?? "No data available"} />
                ) : (
                  <TemplateLivePreview
                    entry={entry}
                    contract={activeContract}
                    aspectRatio={aspectRatio}
                    previewTheme={previewTheme}
                    backgroundImageUrl={activeBackgroundUrl}
                    featuredFrameLayout={featuredFrameLayout}
                  />
                )}
              </main>

              <aside className="flex min-h-0 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card/70 p-3">
                <CreativeHistoryPanel
                  jobs={creativeJobs}
                  tournamentId={tournamentId}
                  isLoading={jobsLoading}
                  isError={jobsError}
                />
                <div className="space-y-2 border-b border-border pb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Registry
                  </h2>
                  <dl className="space-y-1.5 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Template ID</dt>
                      <dd className="font-mono text-foreground">{entry.id}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Contract</dt>
                      <dd className="font-mono text-foreground">{entry.contractName}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Aspect Ratio</dt>
                      <dd className="font-mono text-foreground">{aspectRatio}</dd>
                    </div>
                  </dl>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Contract Inspector
                  </h2>
                  <pre className="min-h-[240px] flex-1 overflow-auto rounded-md border border-border bg-[#030303] p-3 font-mono text-[11px] leading-relaxed text-emerald-300/90">
                    {activeContract
                      ? JSON.stringify(activeContract, null, 2)
                      : isEmpty
                        ? `// ${data?.emptyMessage ?? "No contract data."}`
                        : "// Select an item to inspect its contract."}
                  </pre>
                </div>
              </aside>
            </div>
          )}
        </div>
      </BuzzStudioFeatureGuard>
    </AppLayout>
  );
}
