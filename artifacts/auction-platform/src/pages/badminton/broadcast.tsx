/**
 * Display & Broadcast — redirects to Operator Panel Broadcast Director.
 * Route: /tournament/:id/badminton/broadcast
 */

import { useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";

export default function BadmintonBroadcastPage() {
  const [, params] = useRoute("/tournament/:id/badminton/broadcast");
  const tournamentId = params?.id ?? "0";
  const [, navigate] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const qs = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    qs.set("focus", "broadcast");
    const query = qs.toString();
    navigate(`/tournament/${tournamentId}/badminton/control?${query}`, {
      replace: true,
    });
  }, [navigate, tournamentId, search]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Opening Operator Panel…
    </div>
  );
}
