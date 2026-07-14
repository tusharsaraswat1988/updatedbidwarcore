/**
 * Display & Broadcast — redirects to Operator Panel Broadcast Director.
 * Route: /tournament/:id/badminton/broadcast
 */

import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";

export default function BadmintonBroadcastPage() {
  const [, params] = useRoute("/tournament/:id/badminton/broadcast");
  const tournamentId = params?.id ?? "0";
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate(`/tournament/${tournamentId}/badminton/control?focus=broadcast`, {
      replace: true,
    });
  }, [navigate, tournamentId]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-muted-foreground">
      Opening Operator Panel…
    </div>
  );
}
