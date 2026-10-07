import { apiFetch } from "@workspace/api-base/api-fetch";

export type BplEditionStatus =
  | "DRAFT"
  | "UPCOMING"
  | "LIVE"
  | "COMPLETED"
  | "ARCHIVED";

export type LinkedTournamentSummary = {
  id: number;
  name: string;
  sport: string;
  venue?: string | null;
  city?: string | null;
  status: string;
  auctionDate?: string | null;
  auctionTime?: string | null;
  logoUrl?: string | null;
  auctionEnabled?: boolean;
  scoringEnabled?: boolean;
};

export type BplSponsorCategory =
  | "TITLE"
  | "POWERED_BY"
  | "ASSOCIATE"
  | "PARTNER"
  | "MEDIA_PARTNER";

export type BplEditionSponsor = {
  id: number;
  editionId: number;
  name: string;
  logoUrl: string;
  category: BplSponsorCategory;
  websiteUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type BplTournamentSnapshot = {
  teamsCount: number;
  matchesCount: number;
  completedMatchesCount?: number;
  liveMatchesCount?: number;
  sport?: string | null;
  tournamentStatus?: string | null;
};

export type BplPublicTeam = {
  id: number;
  name: string;
  shortCode: string;
  color?: string | null;
  logoUrl?: string | null;
};

export type BplPublicMatch = {
  id: number;
  tournamentId?: number;
  homeTeam: BplPublicTeam;
  awayTeam: BplPublicTeam;
  roundName?: string | null;
  matchLabel?: string | null;
  status?: string;
  venue?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  winnerTeamId?: number | null;
  resultSummary?: string | null;
  liveScoreRoute?: string;
};

export type BplPublicStanding = {
  teamId: number;
  drawId?: number | null;
  teamName: string;
  shortCode: string;
  color?: string | null;
  logoUrl?: string | null;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  pointsPercentage: number;
  netRunRate: number;
};

export type BplEdition = {
  id: number;
  name: string;
  editionNumber: number;
  slug: string;
  year: number;
  startDate: string;
  endDate: string;
  venue?: string | null;
  city?: string | null;
  description?: string | null;
  status: BplEditionStatus;
  linkedTournamentId?: number | null;
  liveStreamUrl?: string | null;
  fanPageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  linkedTournament?: LinkedTournamentSummary | null;
  tournamentSnapshot?: BplTournamentSnapshot;
  teams?: BplPublicTeam[];
  liveMatch?: BplPublicMatch | null;
  nextMatch?: BplPublicMatch | null;
  recentMatch?: BplPublicMatch | null;
  standings?: BplPublicStanding[];
  sponsors?: BplEditionSponsor[];
};

export type BplActiveResponse = {
  edition: BplEdition | null;
  resolutionReason: "LIVE" | "UPCOMING" | "COMPLETED" | "EMPTY";
};

export type CreateBplEditionInput = {
  name: string;
  editionNumber: number;
  slug: string;
  year: number;
  startDate: string;
  endDate: string;
  venue?: string | null;
  city?: string | null;
  description?: string | null;
  status?: BplEditionStatus;
  linkedTournamentId?: number | null;
  liveStreamUrl?: string | null;
  fanPageUrl?: string | null;
};

export type UpdateBplEditionInput = Partial<CreateBplEditionInput>;

export type CreateBplSponsorInput = {
  name: string;
  logoUrl: string;
  category: BplSponsorCategory;
  websiteUrl?: string | null;
  displayOrder?: number;
  isActive?: boolean;
};

export type UpdateBplSponsorInput = Partial<CreateBplSponsorInput>;

/**
 * Public: Fetch the active BPL edition dynamically resolved by the backend.
 */
export async function fetchActiveBplEdition(): Promise<BplActiveResponse> {
  const res = await apiFetch("/bpl");
  if (!res.ok) {
    throw new Error(`Failed to fetch active BPL edition (${res.status})`);
  }
  return res.json();
}

/**
 * Public: Fetch all public editions (excludes DRAFT).
 */
export async function fetchPublicBplEditions(): Promise<BplEdition[]> {
  const res = await apiFetch("/bpl/editions");
  if (!res.ok) {
    throw new Error(`Failed to fetch public BPL editions (${res.status})`);
  }
  return res.json();
}

/**
 * Public: Fetch a specific edition by slug or edition number.
 */
export async function fetchBplEdition(slugOrNumber: string): Promise<BplEdition> {
  const res = await apiFetch(`/bpl/${encodeURIComponent(slugOrNumber)}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Edition not found");
    }
    throw new Error(`Failed to fetch BPL edition (${res.status})`);
  }
  return res.json();
}

/**
 * Admin: List all editions including DRAFT.
 */
export async function listAdminBplEditions(): Promise<BplEdition[]> {
  const res = await apiFetch("/auth/admin/bpl/editions");
  if (!res.ok) {
    throw new Error(`Failed to list admin BPL editions (${res.status})`);
  }
  return res.json();
}

/**
 * Admin: Get specific edition by ID.
 */
export async function getAdminBplEdition(id: number): Promise<BplEdition> {
  const res = await apiFetch(`/auth/admin/bpl/editions/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to get BPL edition (${res.status})`);
  }
  return res.json();
}

/**
 * Admin: Create an edition.
 */
export async function createAdminBplEdition(
  input: CreateBplEditionInput,
): Promise<{ success: boolean; data?: BplEdition; error?: string }> {
  try {
    const res = await apiFetch("/auth/admin/bpl/editions", {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to create edition" };
    }
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Admin: Update an edition.
 */
export async function updateAdminBplEdition(
  id: number,
  input: UpdateBplEditionInput,
): Promise<{ success: boolean; data?: BplEdition; error?: string }> {
  try {
    const res = await apiFetch(`/auth/admin/bpl/editions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to update edition" };
    }
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Admin: Delete an edition.
 */
export async function deleteAdminBplEdition(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch(`/auth/admin/bpl/editions/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to delete edition" };
    }
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

// =========================================================================
// SPONSOR API FUNCTIONS (P1.8, P1.17)
// =========================================================================

/**
 * Public: Fetch active sponsors for an edition.
 */
export async function fetchEditionSponsors(
  editionId: number,
): Promise<BplEditionSponsor[]> {
  const res = await apiFetch(`/bpl/editions/${editionId}/sponsors`);
  if (!res.ok) {
    throw new Error(`Failed to fetch edition sponsors (${res.status})`);
  }
  return res.json();
}

/**
 * Admin: List all sponsors for an edition (including inactive).
 */
export async function listAdminEditionSponsors(
  editionId: number,
): Promise<BplEditionSponsor[]> {
  const res = await apiFetch(`/auth/admin/bpl/editions/${editionId}/sponsors`);
  if (!res.ok) {
    throw new Error(`Failed to list edition sponsors (${res.status})`);
  }
  return res.json();
}

/**
 * Admin: Create a new sponsor for an edition.
 */
export async function createAdminEditionSponsor(
  editionId: number,
  input: CreateBplSponsorInput,
): Promise<{ success: boolean; data?: BplEditionSponsor; error?: string }> {
  try {
    const res = await apiFetch(`/auth/admin/bpl/editions/${editionId}/sponsors`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to create sponsor" };
    }
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Admin: Update a sponsor for an edition.
 */
export async function updateAdminEditionSponsor(
  editionId: number,
  sponsorId: number,
  input: UpdateBplSponsorInput,
): Promise<{ success: boolean; data?: BplEditionSponsor; error?: string }> {
  try {
    const res = await apiFetch(
      `/auth/admin/bpl/editions/${editionId}/sponsors/${sponsorId}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
        headers: { "Content-Type": "application/json" },
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to update sponsor" };
    }
    return { success: true, data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Admin: Delete a sponsor from an edition.
 */
export async function deleteAdminEditionSponsor(
  editionId: number,
  sponsorId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await apiFetch(
      `/auth/admin/bpl/editions/${editionId}/sponsors/${sponsorId}`,
      {
        method: "DELETE",
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || "Failed to delete sponsor" };
    }
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

