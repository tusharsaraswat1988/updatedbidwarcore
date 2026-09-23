import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Gavel, Radio, Zap, Sparkles, Loader2, CheckCircle2, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LicenseModuleChoice = "auction" | "scoring" | "both";

export function RequestTournamentLicenseModal({
  open,
  onClose,
  tournament,
  initialMobile,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tournament: {
    id: number;
    name: string;
    sport: string;
    city?: string | null;
  } | null;
  initialMobile?: string | null;
  onSuccess?: () => void;
}) {
  const { toast } = useToast();
  const [moduleChoice, setModuleChoice] = useState<LicenseModuleChoice>("both");
  const [mobile, setMobile] = useState(initialMobile ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialMobile) {
      setMobile(initialMobile);
    }
  }, [initialMobile]);

  useEffect(() => {
    if (open) {
      setSubmitted(false);
      setNotes("");
    }
  }, [open]);

  if (!tournament) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tournaments/${tournament?.id}/license-request`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedModules: moduleChoice,
          organizerMobile: mobile.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Failed to submit license request");
      }

      setSubmitted(true);
      toast({
        title: "⚡ License Request Submitted",
        description:
          "BidWar Super Admin has been notified. Our team will connect with you via WhatsApp/Phone for verification.",
      });

      onSuccess?.();
    } catch (err) {
      toast({
        title: "Request Failed",
        description: err instanceof Error ? err.message : "Could not submit request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
      <DialogContent className="max-w-lg bg-card border-border/80 p-6 sm:p-7 text-foreground">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <DialogTitle className="font-display text-xl font-bold">
              Request Tournament License
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Upgrade this tournament from Free Trial to full Live production access.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-foreground">Request Under Review</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Your request for <span className="text-foreground font-semibold">"{tournament.name}"</span> has been sent to Super Admin. You will receive a WhatsApp message or call for quick payment verification.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={onClose} className="w-full">
                Back to Tournament
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            {/* Tournament badge summary */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{tournament.name}</p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {tournament.sport} {tournament.city ? `· ${tournament.city}` : ""}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] border-amber-500/40 bg-amber-500/10 text-amber-400 shrink-0">
                Currently Trial
              </Badge>
            </div>

            {/* Module selection */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select Required License Package
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Both package */}
                <button
                  type="button"
                  onClick={() => setModuleChoice("both")}
                  className={`relative p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                    moduleChoice === "both"
                      ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40 text-foreground"
                      : "border-border/60 bg-muted/10 hover:border-border text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Zap className={`h-4 w-4 ${moduleChoice === "both" ? "text-primary" : ""}`} />
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                      All-in-One
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground leading-tight">Auction + Scoring</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Full complete platform</p>
                  </div>
                </button>

                {/* Auction only */}
                <button
                  type="button"
                  onClick={() => setModuleChoice("auction")}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                    moduleChoice === "auction"
                      ? "border-amber-500/60 bg-amber-500/10 shadow-md ring-1 ring-amber-500/40 text-foreground"
                      : "border-border/60 bg-muted/10 hover:border-border text-muted-foreground"
                  }`}
                >
                  <Gavel className={`h-4 w-4 ${moduleChoice === "auction" ? "text-amber-400" : ""}`} />
                  <div>
                    <p className="text-xs font-bold text-foreground leading-tight">Auction Module</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Bidding & LED screen</p>
                  </div>
                </button>

                {/* Scoring only */}
                <button
                  type="button"
                  onClick={() => setModuleChoice("scoring")}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                    moduleChoice === "scoring"
                      ? "border-sky-500/60 bg-sky-500/10 shadow-md ring-1 ring-sky-500/40 text-foreground"
                      : "border-border/60 bg-muted/10 hover:border-border text-muted-foreground"
                  }`}
                >
                  <Radio className={`h-4 w-4 ${moduleChoice === "scoring" ? "text-sky-400" : ""}`} />
                  <div>
                    <p className="text-xs font-bold text-foreground leading-tight">Sports Scoring</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Live matches & stats</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="req-phone" className="text-xs font-medium">
                WhatsApp / Contact Mobile
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="req-phone"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="pl-9 text-xs"
                  required
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Super Admin will contact this number for payment QR & verification.
              </p>
            </div>

            {/* Optional Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="req-notes" className="text-xs font-medium">
                Additional Requirements / Expected Date (Optional)
              </Label>
              <Textarea
                id="req-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Auction on 15th Oct, 8 teams, 120 players..."
                className="text-xs resize-none h-20"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-white shadow-md hover:from-amber-600 hover:to-amber-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Submit License Request
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
