import { useRoute } from "wouter";
import { DisplayShell } from "@/components/display";

/**
 * LED broadcast page. Thin route shell — all rendering, realtime data,
 * and animation logic lives inside DisplayShell and the modular
 * /components/display module (see ./components/display/display-shell.tsx
 * for the render-isolation map).
 */
export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");
  return <DisplayShell tournamentId={tournamentId} />;
}
