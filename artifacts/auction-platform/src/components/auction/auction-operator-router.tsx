import { Suspense, useMemo } from "react";
import { useRoute } from "wouter";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { GlobalLoadingScreen } from "@/components/global-loading-screen";

const AuctionOperatorV1 = lazyWithRetry(() => import("@/pages/auction-operator"));
const AuctionOperatorV2 = lazyWithRetry(() => import("@/pages/auction-operator-v2"));

export function AuctionOperatorRouter() {
  const [, params] = useRoute("/tournament/:id/auction");
  const tournamentId = parseInt(params?.id || "0", 10);

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const queryVersion = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const v = sp.get("v");
    if (v === "2") return "v2";
    if (v === "1") return "v1";
    return null;
  }, []);

  const effectiveVersion = useMemo(() => {
    if (queryVersion) return queryVersion;
    const features = ((tournament as any)?.featuresJson ?? (tournament as any)?.features) || {};
    return features.auctionOperatorVersion === "v2" ? "v2" : "v1";
  }, [queryVersion, tournament]);

  if (isLoading && !tournament) {
    return <GlobalLoadingScreen label="Connecting to Auction Arena…" />;
  }

  return (
    <Suspense fallback={<GlobalLoadingScreen label="Loading Auction Workspace…" />}>
      {effectiveVersion === "v2" ? (
        <AuctionOperatorV2 />
      ) : (
        <AuctionOperatorV1 />
      )}
    </Suspense>
  );
}

export default AuctionOperatorRouter;
