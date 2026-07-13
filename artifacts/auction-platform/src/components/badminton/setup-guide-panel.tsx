import { ArrowRight, HelpCircle, Lightbulb, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubPanelClass } from "@/components/badminton/form-ui";
import {
  HowThisConnects,
  TournamentStoryRibbon,
} from "@/components/badminton/how-this-connects";
import { SetupHelpModeButton } from "@/components/badminton/setup-help-modal";
import type { TournamentStoryBeat } from "@/lib/tournament-story";

/**
 * Story Mode guide — every page answers:
 * Where am I? Why am I here? What will this create? What happens next?
 */
export function BadmintonSetupGuidePanel({
  beat,
  className,
  extras,
}: {
  beat: TournamentStoryBeat;
  className?: string;
  extras?: React.ReactNode;
}) {
  const questions = [
    {
      key: "where",
      label: "Where am I?",
      body: beat.whereAmI,
      icon: Target,
      tone: "text-primary",
      iconBg: "bg-primary/15",
    },
    {
      key: "why",
      label: "Why am I here?",
      body: beat.whyHere,
      icon: Lightbulb,
      tone: "text-amber-300/90",
      iconBg: "bg-amber-500/15",
      iconClass: "text-amber-300",
    },
    {
      key: "creates",
      label: "What will this create?",
      body: beat.creates,
      icon: Sparkles,
      tone: "text-emerald-300/90",
      iconBg: "bg-emerald-500/15",
      iconClass: "text-emerald-300",
    },
    {
      key: "next",
      label: "What happens next?",
      body: beat.happensNext,
      icon: ArrowRight,
      tone: "text-sky-300/90",
      iconBg: "bg-sky-500/15",
      iconClass: "text-sky-300",
    },
  ] as const;

  return (
    <div className={cn("space-y-4", className)}>
      <TournamentStoryRibbon focus={beat.storyFocus} />

      <div className={cn(hubPanelClass, "space-y-4 border-primary/20 bg-primary/5")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden />
            Building your tournament
          </p>
          <SetupHelpModeButton beat={beat} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {questions.map((q) => {
            const Icon = q.icon;
            return (
              <div key={q.key} className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                <div className={cn("p-2 rounded-lg shrink-0", q.iconBg)}>
                  <Icon
                    className={cn("w-4 h-4", "iconClass" in q ? q.iconClass : "text-primary")}
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className={cn("text-[11px] font-bold uppercase tracking-widest", q.tone)}>
                    {q.label}
                  </p>
                  <p className="text-sm text-foreground/90 leading-snug">{q.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-1 border-t border-border/60">
          <HowThisConnects steps={beat.connects} highlightLast />
        </div>

        {extras ? <div className="pt-1 border-t border-border/60">{extras}</div> : null}
      </div>
    </div>
  );
}

/** Short term glossary line — keeps jargon from standing alone. */
export function SetupTerm({
  term,
  meaning,
}: {
  term: string;
  meaning: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{term}</span>
      {" — "}
      {meaning}
    </p>
  );
}

export function SetupReadyCelebration({ className }: { className?: string }) {
  const journey = [
    "Tournament",
    "Players",
    "Events",
    "Tournament Draw",
    "Court Schedule",
    "Live Operations",
    "Champions",
  ];

  return (
    <div
      className={cn(
        hubPanelClass,
        "text-center space-y-4 border-green-500/30 bg-green-500/10",
        className,
      )}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mx-auto">
        <Sparkles className="w-6 h-6 text-green-400" aria-hidden />
      </div>
      <p className="text-3xl" aria-hidden>
        🎉
      </p>
      <h2 className="text-xl font-display font-bold text-foreground">
        Everything is ready.
      </h2>
      <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
        You are no longer configuring the tournament.
        <br />
        Now you are operating the tournament.
      </p>

      <div className="pt-2">
        <HowThisConnects
          title="Your complete journey"
          steps={journey}
          highlightLast
          className="items-center text-left sm:text-center max-w-2xl mx-auto"
        />
      </div>
    </div>
  );
}
