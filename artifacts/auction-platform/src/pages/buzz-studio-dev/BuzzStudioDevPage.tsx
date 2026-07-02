/**
 * Buzz Studio — Developer Sandbox
 *
 * Admin-only preview center for validating Buzz Studio templates.
 * NOT a production feature. NOT exposed to tournament users.
 *
 * Route: /admin/buzz-studio-dev
 */

import { useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { useAdminPageGuard } from "@/components/admin/use-admin-page-guard";
import {
  getEnabledTemplates,
  type BuzzTemplateRegistryEntry,
} from "@/features/buzz-studio/registry";
import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import { getSandboxDemoData } from "./sandbox-demo-data";

const ASPECT_RATIO_OPTIONS = ["1:1", "4:5", "16:9"] as const;
type AspectRatioOption = (typeof ASPECT_RATIO_OPTIONS)[number];

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function TemplateLivePreview({
  entry,
  contract,
}: {
  entry: BuzzTemplateRegistryEntry;
  contract: Record<string, unknown> | undefined;
}) {
  if (!entry.component) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-amber-500/40 bg-black/40 p-8 text-center">
        <p className="text-sm text-amber-200/90">
          Template registered but component unavailable.
        </p>
      </div>
    );
  }

  const Template = entry.component;
  return (
    <div className="flex flex-1 items-center justify-center overflow-auto rounded-lg border border-white/10 bg-black/60 p-6">
      <div className="max-w-full">
        <Template {...(contract ?? {})} />
      </div>
    </div>
  );
}

export default function BuzzStudioDevPage() {
  const { isLoggedIn, isLoading } = useAdminPageGuard();
  const enabledTemplates = useMemo(() => getEnabledTemplates(), []);
  const [selectedId, setSelectedId] = useState<BuzzTemplateType>(
    () => enabledTemplates[0]?.id ?? BuzzTemplateType.PLAYER_SPOTLIGHT,
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>("1:1");

  const selectedEntry = useMemo(
    () => enabledTemplates.find((t) => t.id === selectedId),
    [enabledTemplates, selectedId],
  );

  const contract = selectedEntry
    ? (getSandboxDemoData(selectedEntry.id) as Record<string, unknown> | undefined)
    : undefined;

  if (isLoading || !isLoggedIn) return null;

  return (
    <AdminShell
      title="Buzz Studio Developer Sandbox"
      eyebrow="Developer Tools"
    >
      <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4 rounded-xl border border-border bg-[#0a0a0a] p-4 text-white">
        {/* Header */}
        <header className="border-b border-white/10 pb-4">
          <h1 className="font-display text-2xl font-black uppercase tracking-wide text-white">
            Buzz Studio Developer Sandbox
          </h1>
          <p className="mt-1 text-sm text-white/50">
            Preview and validate Buzz Studio templates.
          </p>
        </header>

        {/* Aspect ratio toolbar (placeholder — selection stored only) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
          <span className="text-xs font-medium uppercase tracking-widest text-white/40">
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
                  : "border-white/15 bg-white/5 text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              {ratio}
            </button>
          ))}
          <span className="ml-2 text-xs text-white/30">
            (placeholder — resizing not implemented)
          </span>
        </div>

        {/* Three-panel layout */}
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[240px_1fr_280px]">
          {/* Left — template selector */}
          <aside className="flex flex-col gap-2 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Templates
            </h2>
            {enabledTemplates.length === 0 ? (
              <p className="text-sm text-white/40">No enabled templates in registry.</p>
            ) : (
              enabledTemplates.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selectedId === entry.id
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-white/10 bg-white/5 text-white/80 hover:border-white/25 hover:bg-white/10"
                  }`}
                >
                  <div className="text-sm font-medium">
                    {entry.preview.previewTitle ?? entry.title}
                  </div>
                  <div className="mt-0.5 text-xs text-white/40">{entry.id}</div>
                </button>
              ))
            )}
          </aside>

          {/* Center — live preview */}
          <main className="flex min-h-[420px] flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Live Preview
            </h2>
            {selectedEntry ? (
              <TemplateLivePreview entry={selectedEntry} contract={contract} />
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-white/20 text-white/40">
                Select a template to preview.
              </div>
            )}
          </main>

          {/* Right — contract inspector + metadata */}
          <aside className="flex flex-col gap-4 overflow-hidden rounded-lg border border-white/10 bg-black/40 p-3">
            {selectedEntry && (
              <div className="space-y-2 border-b border-white/10 pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  Registry Metadata
                </h2>
                <dl className="space-y-1.5 text-xs">
                  <div>
                    <dt className="text-white/40">Template ID</dt>
                    <dd className="font-mono text-white/80">{selectedEntry.id}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">Category</dt>
                    <dd className="text-white/80">{formatCategory(selectedEntry.category)}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">Enabled</dt>
                    <dd className="text-white/80">{selectedEntry.enabled ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">Aspect Ratios</dt>
                    <dd className="text-white/80">{selectedEntry.aspectRatios.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">Contract</dt>
                    <dd className="font-mono text-white/80">{selectedEntry.contractName}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40">Selected Ratio</dt>
                    <dd className="font-mono text-white/80">{aspectRatio}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
                Contract Inspector
              </h2>
              <pre className="min-h-[200px] flex-1 overflow-auto rounded-md border border-white/10 bg-[#030303] p-3 font-mono text-[11px] leading-relaxed text-emerald-300/90">
                {contract
                  ? JSON.stringify(contract, null, 2)
                  : selectedEntry
                    ? "// No demo data registered for this template."
                    : "// Select a template to inspect its contract."}
              </pre>
            </div>
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}
