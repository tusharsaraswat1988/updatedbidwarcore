import { Link } from "wouter";
import { ArrowRight, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MissionControlMatchDay({
  available,
  primaryHref,
  primaryTitle,
  onContinueSetup,
  className,
}: {
  available: boolean;
  primaryHref: string | null;
  primaryTitle: string | null;
  onContinueSetup: () => void;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 px-5 py-5 sm:px-6",
        available && "border-primary/30 bg-primary/5",
        className,
      )}
      aria-labelledby="mc-match-day-heading"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 rounded-lg p-2",
            available ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Radio className="w-4 h-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground">
            Match Day
          </p>
          <h2
            id="mc-match-day-heading"
            className="mt-1 text-lg font-semibold tracking-tight text-foreground"
          >
            {available ? "Your tournament is ready" : "Live Operations"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            {available
              ? "Open Live Operations when you are ready to run matches."
              : "Live Operations will become available once your tournament is ready."}
          </p>
          <div className="mt-4">
            {available && primaryHref ? (
              <Button asChild className="gap-2">
                <Link href={primaryHref}>
                  {primaryTitle ?? "Open Live Operations"}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onContinueSetup}>
                Continue Setup
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
