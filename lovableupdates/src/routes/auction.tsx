import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/auction")({
  head: () => ({
    meta: [{ title: "Live Auction LED — V1" }],
  }),
  component: () => <Outlet />,
});
