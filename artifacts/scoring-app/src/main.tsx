import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import App from "./App";
import "./index.css";
import "@/styles/display-tv-mode.css";
import { isChunkLoadError, reloadForFreshVersion } from "@/lib/lazy-with-retry";

// Global resilience against stale Vite deployment chunks and temporary connection drops
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    console.warn("[Vite PreloadError] Scoring app dynamic import chunk failed, initiating version recovery:", event);
    event.preventDefault();
    reloadForFreshVersion();
  });

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) {
      console.warn("[Unhandled Rejection] Scoring app chunk load error detected, initiating version recovery:", event.reason);
      reloadForFreshVersion();
    }
  });
}

document.documentElement.classList.add("dark");

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 120_000,
      gcTime: 600_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
