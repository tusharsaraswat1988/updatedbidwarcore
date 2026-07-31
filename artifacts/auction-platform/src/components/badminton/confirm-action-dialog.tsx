/**
 * Shared confirmation dialog for destructive / irreversible actions.
 *
 * Uses a plain confirm button (not AlertDialogAction) so we never fight Radix's
 * default close-on-action + preventDefault race — that made Emergency / Resume
 * feel intermittent when the click was swallowed or the overlay stuck.
 */

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => {
      if (busy && !next) return;
      onOpenChange(next);
    }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {typeof description === "string" ? <p>{description}</p> : description}
              {error ? <p className="text-red-400" role="alert">{error}</p> : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={busy} className="min-h-11">
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            disabled={busy}
            variant={destructive ? "destructive" : "default"}
            className="min-h-11"
            onClick={() => {
              void Promise.resolve(onConfirm());
            }}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
