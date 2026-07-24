import { TIMELINE_STEPS } from "@/data/homepage-content";

/**
 * Tournament Timeline — the visual journey from registration to trophy.
 * Data-driven via `TIMELINE_STEPS`.
 */
export function Timeline() {
  return (
    <section id="timeline" aria-labelledby="timeline-heading" className="py-16 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl border border-border bg-card/20 p-6 md:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <h2 id="timeline-heading" className="font-display font-black text-xl md:text-2xl">
              Tournament Timeline
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              The flow of a live tournament
            </span>
          </div>
          <ol className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            {TIMELINE_STEPS.map((step, i) => (
              <li key={step.title} className="relative">
                <div className="flex h-full flex-col items-start gap-2 rounded-xl border border-border bg-black/20 px-4 py-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-bold text-black">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="font-display font-bold text-sm leading-tight">{step.title}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{step.description}</div>
                </div>
                {i < TIMELINE_STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute right-[-10px] top-1/2 hidden -translate-y-1/2 font-mono text-primary/70 lg:block"
                  >
                    &#9656;
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
