/**
 * Creative History — view / download completed PNG jobs.
 */

import { useCallback, useState } from "react";
import { Download, Eye, Loader2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getTemplateById } from "@/features/buzz-studio";
import { BuzzTemplateType } from "@/features/buzz-studio/registry/template-types";
import {
  CREATIVE_JOB_STATUS_LABELS,
  type CreativeJob,
  type CreativeJobStatus,
} from "@/features/buzz-studio/jobs";
import {
  canViewCreativeJobFile,
  creativeJobDownloadFilename,
  creativeJobFileUrl,
  fetchCreativeJobFileBlob,
} from "@/features/buzz-studio/jobs/creative-job-file";

const STATUS_BADGE_VARIANT: Record<
  CreativeJobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  processing: "default",
  completed: "outline",
  failed: "destructive",
};

function formatJobCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTemplateLabel(templateId: string): string {
  const entry = getTemplateById(templateId as BuzzTemplateType);
  return entry?.title ?? templateId;
}

function CreativeJobPreviewDialog({
  job,
  tournamentId,
  open,
  onOpenChange,
}: {
  job: CreativeJob | null;
  tournamentId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!job) return null;

  const previewUrl = creativeJobFileUrl(tournamentId, job.id);
  const title = `${formatTemplateLabel(job.templateId)} · ${job.aspectRatio}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden border-border bg-card p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="font-display text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[calc(90vh-4rem)] items-center justify-center overflow-auto bg-[#0a0a0a] p-4">
          <img
            src={previewUrl}
            alt={title}
            className="max-h-[70vh] w-auto max-w-full rounded-md object-contain shadow-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreativeHistoryPanel({
  jobs,
  tournamentId,
  isLoading,
  isError,
}: {
  jobs: CreativeJob[];
  tournamentId: number;
  isLoading: boolean;
  isError: boolean;
}) {
  const { toast } = useToast();
  const [previewJob, setPreviewJob] = useState<CreativeJob | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (job: CreativeJob) => {
      if (!canViewCreativeJobFile(job)) return;
      setDownloadingId(job.id);
      try {
        const blob = await fetchCreativeJobFileBlob(tournamentId, job.id);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = creativeJobDownloadFilename(job);
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        toast({ title: "Download started", description: anchor.download });
      } catch (err) {
        toast({
          title: "Download failed",
          description: err instanceof Error ? err.message : "Could not download creative.",
          variant: "destructive",
        });
      } finally {
        setDownloadingId(null);
      }
    },
    [tournamentId, toast],
  );

  return (
    <>
      <section className="flex min-h-0 flex-col gap-2 border-b border-border pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Creative History
        </h2>
        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        ) : isError ? (
          <p className="py-2 text-sm text-destructive">Could not load creative history.</p>
        ) : jobs.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            No creatives queued yet. Generate one to start.
          </p>
        ) : (
          <div className="min-h-0 max-h-[280px] overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-card/95 backdrop-blur">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-1.5 font-semibold">Status</th>
                  <th className="px-2 py-1.5 font-semibold">Template</th>
                  <th className="px-2 py-1.5 font-semibold">Created</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const canView = canViewCreativeJobFile(job);
                  const isDownloading = downloadingId === job.id;

                  return (
                    <tr key={job.id} className="border-b border-border/60 last:border-0">
                      <td className="px-2 py-2 align-top">
                        <Badge variant={STATUS_BADGE_VARIANT[job.status]} className="text-[10px]">
                          {CREATIVE_JOB_STATUS_LABELS[job.status]}
                        </Badge>
                        {job.status === "failed" && job.errorMessage ? (
                          <p
                            className="mt-1 max-w-[120px] truncate text-[10px] text-destructive/90"
                            title={job.errorMessage}
                          >
                            {job.errorMessage}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[88px] truncate px-2 py-2 align-top text-foreground">
                        {formatTemplateLabel(job.templateId)}
                        <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                          {job.aspectRatio}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 align-top text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0 opacity-70" />
                          {formatJobCreatedAt(job.createdAt)}
                        </span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        {canView ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="View PNG"
                              onClick={() => setPreviewJob(job)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title="Download PNG"
                              disabled={isDownloading}
                              onClick={() => void handleDownload(job)}
                            >
                              {isDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              <span className="sr-only">Download</span>
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CreativeJobPreviewDialog
        job={previewJob}
        tournamentId={tournamentId}
        open={previewJob !== null}
        onOpenChange={(next) => {
          if (!next) setPreviewJob(null);
        }}
      />
    </>
  );
}
