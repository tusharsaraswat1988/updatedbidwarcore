import {
  MOBILE_LAST_ROLE_KEY,
  isMobileRoleId,
  type MobileRoleId,
} from "@workspace/api-base/mobile-app-urls";
import { getRoleModule } from "@/roles/registry";

/** Remember last selected role locally (not an auth token). */
export function getLastSelectedRole(): MobileRoleId | null {
  try {
    const raw = localStorage.getItem(MOBILE_LAST_ROLE_KEY);
    if (!isMobileRoleId(raw)) return null;
    return getRoleModule(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setLastSelectedRole(role: MobileRoleId): void {
  try {
    localStorage.setItem(MOBILE_LAST_ROLE_KEY, role);
  } catch {
    // ignore quota / private mode
  }
}

export function clearLastSelectedRole(): void {
  try {
    localStorage.removeItem(MOBILE_LAST_ROLE_KEY);
  } catch {
    // ignore
  }
}
