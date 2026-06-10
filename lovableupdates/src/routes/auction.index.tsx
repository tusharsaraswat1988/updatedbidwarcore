import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auction/")({
  component: () => <Navigate to="/auction/v1" replace />,
});
