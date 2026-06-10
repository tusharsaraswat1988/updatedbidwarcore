import { createFileRoute } from "@tanstack/react-router";
import { DisplayShell } from "@/components/auction-demo/v1/DisplayShell";
import { StageThemeProvider } from "@/components/auction-demo/v1/StageThemeProvider";
import { DevThemePicker } from "@/components/auction-demo/v1/DevThemePicker";

export const Route = createFileRoute("/auction/v1")({
  head: () => ({ meta: [{ title: "BidWar Live — LED Stage" }] }),
  component: AuctionV1,
});

function AuctionV1() {
  return (
    <StageThemeProvider>
      <DisplayShell />
      <DevThemePicker />
    </StageThemeProvider>
  );
}
