import { useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/layout";
import { AuthForm } from "@/pages/organizer-portal";
import { useOrganizerAccountAuth } from "@/hooks/use-auth";
import { setOrganizerAccountAuthData } from "@/lib/organizer-account-auth-cache";
import { navigateAfterOrganizerAuth } from "@/lib/navigate-after-organizer-auth";
import type { OrganizerInfo } from "@/lib/auth";

type Tournament = {
  id: number;
  name: string;
  sport: string;
  status: string;
  licenseStatus: string;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  createdAt: string;
};

function readNextParam(search: string): string {
  try {
    const next = new URLSearchParams(search).get("next") || "";
    return next.startsWith("/") ? next : "";
  } catch {
    return "";
  }
}

function readAuthTab(search: string): "login" | "signup" {
  try {
    return new URLSearchParams(search).get("tab") === "signup" ? "signup" : "login";
  } catch {
    return "login";
  }
}

/**
 * Scoring-only sign-in shell.
 * Uses the shared organizer-account APIs / AuthForm, but never shows the Auction portal.
 */
export default function ScoringLoginPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { isLoggedIn, isLoading, tournaments } = useOrganizerAccountAuth();

  const next = useMemo(() => readNextParam(search), [search]);
  const initialView = useMemo(() => readAuthTab(search), [search]);

  useEffect(() => {
    if (isLoading || !isLoggedIn) return;
    if (next) {
      navigateAfterOrganizerAuth(next, navigate);
      return;
    }
    // No return path — send to first owned tournament scoring hub when possible.
    const first = tournaments[0];
    if (first) {
      const path =
        first.sport === "badminton"
          ? `/scoring-app/tournament/${first.id}/badminton`
          : `/scoring-app/tournament/${first.id}/score`;
      navigateAfterOrganizerAuth(path, navigate);
    }
  }, [isLoading, isLoggedIn, next, navigate, tournaments]);

  function handleAuthSuccess(org: OrganizerInfo, tours: Tournament[]) {
    setOrganizerAccountAuthData(queryClient, { organizer: org, tournaments: tours });
  }

  if (isLoading || isLoggedIn) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"
            aria-label="Signing in"
          />
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md mb-6 text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            BidWar Scoring
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Sign in to continue</h1>
          <p className="text-sm text-muted-foreground">
            Use your organizer account. You will return to the same scoring page after sign-in.
          </p>
        </div>
        <AuthForm
          onSuccess={handleAuthSuccess}
          next={next || undefined}
          initialView={initialView}
        />
      </div>
    </FullscreenLayout>
  );
}
