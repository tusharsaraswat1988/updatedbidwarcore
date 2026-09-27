import { useRoute, Redirect } from "wouter";
import { cricketScorerConsolePath } from "@/lib/cricket-routes";

export default function ScoringMatchPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId/live");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const scorerConsoleUrl = cricketScorerConsolePath(tournamentId, matchId);
  return <Redirect to={scorerConsoleUrl} replace />;
}

