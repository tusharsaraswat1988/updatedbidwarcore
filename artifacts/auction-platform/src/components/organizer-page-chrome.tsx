import type { ReactNode } from "react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  TournamentContextLabel,
  SectionHeader,
  OrganizerSectionHeader,
} from "@/components/platform/section-header";

export { TournamentContextLabel, OrganizerSectionHeader };

type TournamentLike = {
  name?: string | null;
  logoUrl?: string | null;
};

/** Dialog header with tournament name above the form title. */
export function OrganizerFormDialogHeader({
  title,
  tournament,
  description,
}: {
  title: ReactNode;
  tournament?: TournamentLike | null;
  description?: ReactNode;
}) {
  return (
    <DialogHeader>
      <TournamentContextLabel tournament={tournament} className="mb-1" />
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );
}

/** @deprecated Prefer SectionHeader from platform — alias retained for callers */
export { SectionHeader };
