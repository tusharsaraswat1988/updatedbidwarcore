import { apiFetch } from "@workspace/api-base";

export async function checkOrganizerAuth(tournamentId: number): Promise<boolean> {
  try {
    const r = await apiFetch(`/auth/organizer/${tournamentId}/me`);
    if (!r.ok) return false;
    const data = await r.json();
    return !!data.isOrganizer;
  } catch { return false; }
}

export async function loginOrganizer(tournamentId: number, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/organizer/${tournamentId}/login`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const data = await r.json();
    if (!r.ok) return { success: false, error: data.error || "Login failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function logoutOrganizer(tournamentId: number): Promise<void> {
  try { await apiFetch(`/auth/organizer/${tournamentId}/logout`, { method: "POST" }); } catch { }
}


export async function checkAdminAuth(): Promise<{ isAdmin: boolean; adminLevel: "master" | "data_entry" | null }> {
  try {
    const r = await apiFetch("/auth/admin/me");
    if (!r.ok) return { isAdmin: false, adminLevel: null };
    const data = await r.json();
    return { isAdmin: !!data.isAdmin, adminLevel: data.adminLevel ?? null };
  } catch { return { isAdmin: false, adminLevel: null }; }
}

export async function loginAdmin(password: string): Promise<{ success: boolean; adminLevel?: "master" | "data_entry"; error?: string }> {
  try {
    const r = await apiFetch("/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const data = await r.json();
    if (!r.ok) return { success: false, error: data.error || "Login failed" };
    return { success: true, adminLevel: data.adminLevel };
  } catch { return { success: false, error: "Network error" }; }
}

export async function logoutAdmin(): Promise<void> {
  try { await apiFetch("/auth/admin/logout", { method: "POST" }); } catch { }
}

// ─── Admin tournament list ────────────────────────────────────────────────────

export type AdminTournamentRow = {
  id: number; name: string; sport: string; status: string;
  licenseStatus: string; adminLocked: boolean;
  organizerId: number | null;
  organizerName: string | null; organizerMobile: string | null;
  organizerEmail: string | null; hasPassword: boolean;
  auctionDate: string | null; auctionTime: string | null;
  createdAt: string;
};

export async function listAdminTournaments(): Promise<AdminTournamentRow[]> {
  try {
    const r = await apiFetch("/auth/admin/tournaments");
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

// ─── Admin tournament CRUD ────────────────────────────────────────────────────

export async function createAdminTournament(data: {
  name: string; sport: string; venue?: string; auctionDate?: string; auctionTime?: string;
  organizerName?: string; organizerMobile?: string; organizerEmail?: string;
  organizerPassword?: string; basePurse?: number; minBid?: number;
  timerSeconds?: number; bidTimerSeconds?: number;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  try {
    const r = await apiFetch("/auth/admin/tournaments", { method: "POST", body: JSON.stringify(data) });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Create failed" };
    return { success: true, id: d.id };
  } catch { return { success: false, error: "Network error" }; }
}

export async function resetTournamentAsAdmin(
  tournamentId: number,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/tournaments/${tournamentId}/auction/reset-trial`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return { success: false, error: d.error || "Reset failed" };
    }
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function deleteAdminTournament(tournamentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Delete failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function updateAdminTournament(
  tournamentId: number,
  data: Partial<{
    name: string; sport: string; organizerName: string; organizerMobile: string;
    organizerEmail: string; organizerPassword: string; venue: string; auctionDate: string;
    status: string; timerSeconds: number; bidTimerSeconds: number;
    basePurse: number; minBid: number; playerSelectionMode: string; bidTiers: string;
    localModeEnabled: boolean;
  }>
): Promise<{ success: boolean; error?: string; linkedOrganizerId?: number | null; linkedOrganizerName?: string | null }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Update failed" };
    return { success: true, linkedOrganizerId: d.linkedOrganizerId ?? null, linkedOrganizerName: d.linkedOrganizerName ?? null };
  } catch { return { success: false, error: "Network error" }; }
}

export async function linkOrganizerToTournament(
  tournamentId: number,
  organizerId: number | null
): Promise<{ success: boolean; error?: string; linkedOrganizerId?: number | null; linkedOrganizerName?: string | null }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/link-organizer`, {
      method: "POST",
      body: JSON.stringify({ organizerId }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Link failed" };
    return { success: true, linkedOrganizerId: d.linkedOrganizerId ?? null, linkedOrganizerName: d.linkedOrganizerName ?? null };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Admin license / lock ─────────────────────────────────────────────────────

export async function grantLicense(tournamentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/grant-license`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function revokeLicense(tournamentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/revoke-license`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function lockTournament(tournamentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/lock`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function unlockTournament(tournamentId: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/unlock`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Admin tournament detail ──────────────────────────────────────────────────

export type AdminTournamentDetail = {
  tournament: {
    id: number; name: string; sport: string; venue: string | null;
    auctionDate: string | null; auctionTime: string | null; organizerId: number | null;
    organizerName: string | null;
    organizerMobile: string | null; organizerEmail: string | null;
    status: string; licenseStatus: string; adminLocked: boolean;
    licenseGrantedAt: string | null; adminLockedAt: string | null;
    basePurse: number; minBid: number; timerSeconds: number;
    bidTimerSeconds: number; playerSelectionMode: string;
    bidTiers: string | null; hasPassword: boolean; organizerPassword: string | null;
    resetCount: number; lastResetAt: string | null; lastResetBy: string | null;
    cheerMessagesEnabled: boolean; cheerMessagePresets: string | null;
    localModeEnabled: boolean;
    createdAt: string;
  };
  teams: Array<{ id: number; name: string; shortCode: string; ownerName: string; color: string | null; logoUrl: string | null; purse: number; purseUsed: number }>;
  players: Array<{ id: number; name: string; role: string | null; status: string; basePrice: number; soldPrice: number | null; teamId: number | null; categoryId: number | null }>;
  categories: Array<{ id: number; name: string; minBid: number }>;
  playerCounts: { total: number; available: number; sold: number; unsold: number; retained: number };
  recentBids: Array<{ id: number; amount: number; timestamp: string; playerName: string | null; teamName: string | null; teamColor: string | null }>;
};

export async function fetchAdminTournamentDetail(tournamentId: number): Promise<AdminTournamentDetail | null> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/detail`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

// ─── Organizer Account ────────────────────────────────────────────────────────

export type OrganizerInfo = { id: number; name: string; email: string | null; mobile: string | null; photoUrl?: string | null; licenseStatus: string; maxTournaments: number; hasPassword?: boolean; needsMobile?: boolean };

export async function signupSendOtp(data: {
  name: string; mobile: string; email?: string; password: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/organizer-account/signup/send-otp", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Failed to send OTP" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export type LoginGuardStatus = {
  tier: "normal" | "captcha" | "cooldown";
  failures: number;
  cooldownRemainingSec: number;
  captchaRequired: boolean;
  captcha?: { captchaId: string; question: string };
  turnstileSiteKey?: string;
};

export async function fetchAuthConfig(): Promise<{
  smsOtpEnabled: boolean;
  turnstileSiteKey: string | null;
}> {
  try {
    const r = await apiFetch("/auth/config");
    if (!r.ok) return { smsOtpEnabled: false, turnstileSiteKey: null };
    const d = await r.json();
    return {
      smsOtpEnabled: !!d.smsOtpEnabled,
      turnstileSiteKey: d.turnstileSiteKey ?? null,
    };
  } catch { return { smsOtpEnabled: false, turnstileSiteKey: null }; }
}

export async function fetchLoginGuardStatus(
  identifier: string,
): Promise<LoginGuardStatus> {
  try {
    const q = encodeURIComponent(identifier);
    const r = await apiFetch(`/auth/organizer-account/login/status?identifier=${q}`);
    if (!r.ok) {
      return {
        tier: "normal",
        failures: 0,
        cooldownRemainingSec: 0,
        captchaRequired: false,
      };
    }
    return r.json();
  } catch {
    return {
      tier: "normal",
      failures: 0,
      cooldownRemainingSec: 0,
      captchaRequired: false,
    };
  }
}

export async function signupEmail(data: {
  name: string; email: string; password: string;
}): Promise<{ success: boolean; error?: string; organizer?: OrganizerInfo }> {
  try {
    const r = await apiFetch("/auth/organizer-account/signup/email", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Signup failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function setOrganizerPassword(password: string): Promise<{ success: boolean; error?: string; organizer?: OrganizerInfo }> {
  try {
    const r = await apiFetch("/auth/organizer-account/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Failed to set password" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function signupVerify(mobile: string, otp: string): Promise<{ success: boolean; error?: string; organizer?: OrganizerInfo }> {
  try {
    const r = await apiFetch("/auth/organizer-account/signup/verify", {
      method: "POST",
      body: JSON.stringify({ mobile, otp }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Verification failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function loginOrganizerAccount(
  identifier: string,
  password: string,
  captcha?: {
    turnstileToken?: string;
    captchaId?: string;
    captchaAnswer?: string;
  },
): Promise<{
  success: boolean;
  error?: string;
  organizer?: OrganizerInfo;
  loginGuard?: LoginGuardStatus;
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password, ...captcha }),
    });
    const d = await r.json();
    if (!r.ok) {
      return {
        success: false,
        error: d.error || "Login failed",
        loginGuard: d.loginGuard,
      };
    }
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function checkOrganizerAccountAuth(): Promise<{
  loggedIn: boolean;
  organizer?: OrganizerInfo;
  tournaments?: Array<{ id: number; name: string; sport: string; status: string; licenseStatus: string; venue: string | null; auctionDate: string | null; createdAt: string }>;
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/me");
    if (!r.ok) return { loggedIn: false };
    return r.json();
  } catch { return { loggedIn: false }; }
}

export async function logoutOrganizerAccount(): Promise<void> {
  try { await apiFetch("/auth/organizer-account/logout", { method: "POST" }); } catch { }
}

export async function updateOrganizerProfile(data: {
  name?: string; email?: string | null; mobile?: string; photoUrl?: string | null;
}): Promise<{ success: boolean; error?: string; organizer?: OrganizerInfo }> {
  try {
    const r = await apiFetch("/auth/organizer-account/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Update failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

export async function changeOrganizerPassword(data: {
  currentPassword: string; newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/organizer-account/change-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Failed to change password" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function createOrganizerTournament(data: {
  name: string; sport?: string; venue?: string; auctionDate?: string; auctionTime?: string;
  basePurse?: number; minimumSquadSize?: number; minBid?: number; bidIncrement?: number;
}): Promise<{ success: boolean; error?: string; tournament?: { id: number; name: string; auctionCode?: string | null } }> {
  try {
    const r = await apiFetch("/auth/organizer-account/tournaments", {
      method: "POST",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Create failed" };
    return { success: true, tournament: d.tournament };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Admin: Organizer account management ──────────────────────────────────────

export type AdminOrganizerRow = {
  id: number; name: string; email: string | null; mobile: string | null;
  licenseStatus: string; maxTournaments: number; notes: string | null;
  tournamentCount: number; createdAt: string;
};

export async function listAdminOrganizers(): Promise<AdminOrganizerRow[]> {
  try {
    const r = await apiFetch("/auth/admin/organizers");
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

export async function updateAdminOrganizer(
  id: number,
  data: Partial<{
    name: string; email: string; mobile: string;
    licenseStatus: "pending" | "active" | "suspended"; maxTournaments: number; notes: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/organizers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Update failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function deleteAdminOrganizer(id: number): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/organizers/${id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Delete failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function setTournamentLicenseStatus(
  tournamentId: number,
  status: "trial" | "active" | "completed"
): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch(`/auth/admin/tournaments/${tournamentId}/set-license-status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── OTP password reset ───────────────────────────────────────────────────────

export async function sendOtp(mobile: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/organizer-account/otp/send", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Failed to send OTP" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function resendOtp(mobile: string): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/organizer-account/otp/resend", {
      method: "POST",
      body: JSON.stringify({ mobile }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Failed to resend OTP" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

export async function verifyOtpAndReset(mobile: string, code: string, newPassword: string): Promise<{
  success: boolean; error?: string; organizer?: OrganizerInfo;
}> {
  try {
    const r = await apiFetch("/auth/organizer-account/otp/verify", {
      method: "POST",
      body: JSON.stringify({ mobile, code, newPassword }),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "OTP verification failed" };
    return { success: true, organizer: d.organizer };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Admin: SMS notification settings ────────────────────────────────────────

export type SmsSettings = {
  dltEnabled: boolean;
  teamOwnerEnabled: boolean;
  teamOwnerTemplateId: string | null;
  playerSoldEnabled: boolean;
  playerSoldTemplateId: string | null;
  viewerLinkEnabled: boolean;
  viewerLinkTemplateId: string | null;
};

export async function getAdminSmsSettings(): Promise<SmsSettings> {
  try {
    const r = await apiFetch("/auth/admin/sms-settings");
    if (!r.ok) return {
      dltEnabled: false, teamOwnerEnabled: false, teamOwnerTemplateId: null,
      playerSoldEnabled: false, playerSoldTemplateId: null,
      viewerLinkEnabled: false, viewerLinkTemplateId: null,
    };
    return r.json();
  } catch {
    return {
      dltEnabled: false, teamOwnerEnabled: false, teamOwnerTemplateId: null,
      playerSoldEnabled: false, playerSoldTemplateId: null,
      viewerLinkEnabled: false, viewerLinkTemplateId: null,
    };
  }
}

export async function updateAdminSmsSettings(data: Partial<SmsSettings>): Promise<{ success: boolean; error?: string }> {
  try {
    const r = await apiFetch("/auth/admin/sms-settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const d = await r.json();
    if (!r.ok) return { success: false, error: d.error || "Save failed" };
    return { success: true };
  } catch { return { success: false, error: "Network error" }; }
}

// ─── Display Auctions (landing page showcase) ─────────────────────────────────

export type DisplayAuction = {
  id: number;
  name: string;
  code: string;
  sport: string;
  city: string;
  state: string;
  purse: number;
  playersPerTeam: number;
  teamsCount: number;
  scheduledDate: string;
  scheduledTime: string;
  primaryColor: string;
  accentColor: string;
  status: string;
  showOnLanding: boolean;
  tournamentId: number | null;
  createdAt: string;
  updatedAt: string;
};

export async function listAdminDisplayAuctions(): Promise<DisplayAuction[]> {
  try {
    const r = await apiFetch("/auth/admin/display-auctions");
    if (!r.ok) return [];
    return r.json();
  } catch { return []; }
}

export async function createDisplayAuction(data: Partial<DisplayAuction>): Promise<DisplayAuction | null> {
  try {
    const r = await apiFetch("/auth/admin/display-auctions", { method: "POST", body: JSON.stringify(data) });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function updateDisplayAuction(id: number, data: Partial<DisplayAuction>): Promise<DisplayAuction | null> {
  try {
    const r = await apiFetch(`/auth/admin/display-auctions/${id}`, { method: "PUT", body: JSON.stringify(data) });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

export async function deleteDisplayAuction(id: number): Promise<boolean> {
  try {
    const r = await apiFetch(`/auth/admin/display-auctions/${id}`, { method: "DELETE" });
    return r.ok;
  } catch { return false; }
}

export async function seedDisplayAuctions(): Promise<{ seeded: number; static: number; real: number } | null> {
  try {
    const r = await apiFetch("/auth/admin/display-auctions/seed", { method: "POST" });
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}
