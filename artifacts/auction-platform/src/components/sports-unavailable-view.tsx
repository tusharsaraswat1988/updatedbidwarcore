import { AccessStateView } from "@/components/access-state-view";

/** Shared unavailable state when tournament match scoring is off. */
export function SportsUnavailableView() {
  return (
    <AccessStateView
      code={403}
      title="Scoring not Activated"
      body="Sports scoring is not enabled for this tournament."
      next="Contact BIDWAR for enabling sport scoring module."
    />
  );
}
