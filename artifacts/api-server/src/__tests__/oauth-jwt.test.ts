import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/runtime-env", () => ({
  getSessionSecret: () => "test-session-secret-minimum-32-characters-long",
  getRuntimeConfig: () => ({ isProduction: false, appHosts: ["localhost"] }),
}));

import { signOAuthJwt, verifyOAuthJwt } from "../lib/jwt";

describe("OAuth JWT cookie round-trip", () => {

  it("re-signs decoded OAuth state without throwing when pendingGoogleMobile is added", () => {
    const initial = signOAuthJwt({
      pendingGoogleProfile: {
        name: "Test User",
        email: "tabbytechsolutions@gmail.com",
        googleId: "google-123",
        googleEmail: "tabbytechsolutions@gmail.com",
      },
    });

    const decoded = verifyOAuthJwt(initial);
    expect(decoded).not.toBeNull();

    expect(() =>
      signOAuthJwt({
        ...decoded!,
        pendingGoogleMobile: "7054007733",
      }),
    ).not.toThrow();
  });
});
