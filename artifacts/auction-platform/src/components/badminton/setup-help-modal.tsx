import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { FormModal, BtnSecondary } from "@/components/badminton/form-ui";
import { HowThisConnects } from "@/components/badminton/how-this-connects";
import { SetupTerm } from "@/components/badminton/setup-guide-panel";
import type { TournamentStoryBeat } from "@/lib/tournament-story";

/**
 * Lightweight Help Mode — explains the current step without navigating away.
 */
export function SetupHelpModeButton({ beat }: { beat: TournamentStoryBeat }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors min-h-11 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
      >
        <CircleHelp className="w-3.5 h-3.5" aria-hidden />
        What does this mean?
      </button>

      {open ? (
        <FormModal
          title={beat.help.title}
          subtitle="Stay on this page — this is a quick explanation only."
          onClose={() => setOpen(false)}
          size="md"
          footer={
            <div className="flex justify-end">
              <BtnSecondary type="button" onClick={() => setOpen(false)}>
                Got it
              </BtnSecondary>
            </div>
          }
        >
          <div className="space-y-4">
            {beat.help.body.map((paragraph) => (
              <p key={paragraph} className="text-sm text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ))}

            <HowThisConnects steps={beat.connects} highlightLast />

            {beat.help.terms.length > 0 ? (
              <div className="space-y-2 pt-1 border-t border-border/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Terms
                </p>
                {beat.help.terms.map((item) => (
                  <SetupTerm key={item.term} term={item.term} meaning={item.meaning} />
                ))}
              </div>
            ) : null}
          </div>
        </FormModal>
      ) : null}
    </>
  );
}
