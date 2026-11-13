import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BidWar Super Admin Login — Champagne Gold & Pearl Reference Suite", () => {
  const adminLoginSrc = readFileSync(
    path.resolve(__dirname, "../admin-login.tsx"),
    "utf8"
  );
  const neuralCoreSrc = readFileSync(
    path.resolve(__dirname, "../../components/admin/bidwar-neural-core.tsx"),
    "utf8"
  );
  const meshBgSrc = readFileSync(
    path.resolve(__dirname, "../../components/admin/bidwar-login-mesh-background.tsx"),
    "utf8"
  );
  const stylesSrc = readFileSync(
    path.resolve(__dirname, "../../styles/admin-neural-login.css"),
    "utf8"
  );

  describe("1. AI Neural Core 3D Engine — Champagne Gold Reference Matching", () => {
    it("uses Fibonacci sphere distribution with 96 nodes", () => {
      expect(neuralCoreSrc).toContain("goldenRatioAngle = Math.PI * (3 - Math.sqrt(5))");
      expect(neuralCoreSrc).toContain("const N = 96");
      expect(neuralCoreSrc).toContain("Math.cos(theta) * r");
      expect(neuralCoreSrc).toContain("Math.sin(theta) * r");
    });

    it("precomputes geodesic node pairs using Euclidean distance threshold", () => {
      expect(neuralCoreSrc).toContain("const pairs: Array<[number, number]> = []");
      expect(neuralCoreSrc).toContain("dist < 0.46");
    });

    it("renders a warm pearl-beige champagne central sphere body (Zero Blue/Navy)", () => {
      expect(neuralCoreSrc).toContain("sphereGrad");
      expect(neuralCoreSrc).toContain("rgba(247, 242, 233, 1)"); // Warm pearl ivory
      expect(neuralCoreSrc).toContain("rgba(226, 214, 194, 1)"); // Champagne metallic mid-tone
      // Confirm NO blue or cyan in central sphere body
      expect(neuralCoreSrc).not.toContain("rgba(11, 27, 58, 1)");
      expect(neuralCoreSrc).not.toContain("rgba(30, 58, 138");
      expect(neuralCoreSrc).not.toContain("rgba(59, 130, 246");
    });

    it("renders floor shadow with concentric champagne ripples matching reference", () => {
      expect(neuralCoreSrc).toContain("penumbraGrad");
      expect(neuralCoreSrc).toContain("umbraGrad");
      expect(neuralCoreSrc).toContain("rgba(215, 190, 145"); // Concentric ripples
    });

    it("renders warm champagne ambient halo with zero blue/cyan", () => {
      expect(neuralCoreSrc).toContain("ambientHalo");
      expect(neuralCoreSrc).toContain("rgba(255, 225, 145");
      expect(neuralCoreSrc).not.toContain("rgba(59, 130, 246");
      expect(neuralCoreSrc).not.toContain("rgba(56, 189, 248");
    });

    it("renders radiant golden miniature suns with starburst flares", () => {
      expect(neuralCoreSrc).toContain("isRadiantStar");
      expect(neuralCoreSrc).toContain("starGrad");
      expect(neuralCoreSrc).toContain("rgba(255, 252, 235");
      expect(neuralCoreSrc).toContain("flareLen");
    });

    it("renders thin warm champagne-beige filament connections (Zero Electric Blue)", () => {
      expect(neuralCoreSrc).toContain("rgba(228, 202, 155"); // Champagne filament
      expect(neuralCoreSrc).not.toContain("rgba(56, 189, 248");
      expect(neuralCoreSrc).not.toContain("rgba(59, 130, 246");
    });

    it("supports mouse and touch pointer tracking without React state re-renders", () => {
      expect(neuralCoreSrc).toContain('window.addEventListener("mousemove"');
      expect(neuralCoreSrc).toContain('window.addEventListener("touchmove"');
      expect(neuralCoreSrc).toContain("stateRef.current");
      expect(neuralCoreSrc).toContain("requestAnimationFrame(render)");
    });

    it("includes lifecycle cleanup and visibility management", () => {
      expect(neuralCoreSrc).toContain("cancelAnimationFrame(rafRef.current)");
      expect(neuralCoreSrc).toContain('window.removeEventListener("mousemove"');
      expect(neuralCoreSrc).toContain('document.addEventListener("visibilitychange"');
      expect(neuralCoreSrc).toContain("stateRef.current.paused = document.hidden");
    });

    it("respects prefers-reduced-motion user preferences", () => {
      expect(neuralCoreSrc).toContain('window.matchMedia("(prefers-reduced-motion: reduce)")');
      expect(neuralCoreSrc).toContain("prefersReducedMotion");
    });
  });

  describe("2. Ambient Champagne Background (BidWarLoginMeshBackground)", () => {
    it("renders the pearl ivory foundation (#F8F7F2) and warm beige gradients", () => {
      expect(meshBgSrc).toContain("#F8F7F2");
      expect(meshBgSrc).toContain("rgba(246, 241, 230");
      expect(meshBgSrc).toContain("220,"); // Warm champagne ambient behind core
    });

    it("does NOT contain blue or cyan gradients", () => {
      expect(meshBgSrc).not.toContain("rgba(59, 130, 246");
      expect(meshBgSrc).not.toContain("rgba(56, 189, 248");
      expect(meshBgSrc).not.toContain("neural-grid-bg");
    });

    it("renders the three floating ambient meshes A, B, and C", () => {
      expect(meshBgSrc).toContain("login-mesh login-mesh-a");
      expect(meshBgSrc).toContain("login-mesh login-mesh-b");
      expect(meshBgSrc).toContain("login-mesh login-mesh-c");
    });

    it("uses the stage prop type (intro, passwordPrompt, authenticating)", () => {
      expect(meshBgSrc).toContain('"intro" | "passwordPrompt" | "authenticating"');
    });
  });

  describe("3. Admin Login Page — Layout & UX Flow", () => {
    it("uses the three-stage state model: intro -> passwordPrompt -> authenticating", () => {
      expect(adminLoginSrc).toContain('"intro" | "passwordPrompt" | "authenticating"');
      expect(adminLoginSrc).toContain('setStage("passwordPrompt")');
      expect(adminLoginSrc).toContain('setStage("authenticating")');
    });

    it("uses pearl light mode background and champagne styling (Zero Blue Hover)", () => {
      expect(adminLoginSrc).toContain("bg-[#F8F7F2]");
      expect(adminLoginSrc).not.toContain("bg-blue-500");
    });

    it("uses organizer-auth preset for high-contrast primary logo on light backgrounds", () => {
      expect(adminLoginSrc).toContain('getBrandSurfacePreset("organizer-auth")');
    });

    it("does NOT contain removed clutter elements", () => {
      expect(adminLoginSrc).not.toContain("FROM AUCTION TO CHAMPION");
      expect(adminLoginSrc).not.toContain("SUPER ADMIN NEURAL CONSOLE");
      expect(adminLoginSrc).not.toContain("RESTRICTED BIDWAR COMMAND CENTER");
      expect(adminLoginSrc).not.toContain("Back to Tournaments");
      expect(adminLoginSrc).not.toContain("Inspect Neural Core");
      expect(adminLoginSrc).not.toContain("AdminPwaInstallHint");
      expect(adminLoginSrc).not.toContain("Full access to all tournaments and settings");
      expect(adminLoginSrc).not.toContain("Super Admin Login");
    });

    it("shows refined CTA in intro state with warm champagne gold pulse dot", () => {
      expect(adminLoginSrc).toContain("TAP CORE TO AUTHENTICATE");
      expect(adminLoginSrc).toContain("bg-[#E5B54F]");
    });

    it("reveals single password input without card wrapper", () => {
      expect(adminLoginSrc).toContain('placeholder="Enter admin password"');
      expect(adminLoginSrc).toContain("max-w-[340px]");
    });

    it("retains password visibility toggle with Eye and EyeOff icons", () => {
      expect(adminLoginSrc).toContain("setShowPw");
      expect(adminLoginSrc).toContain("<EyeOff");
      expect(adminLoginSrc).toContain("<Eye");
      expect(adminLoginSrc).toContain('type={showPw ? "text" : "password"}');
    });

    it("implements 5-second inactivity auto-reset timer", () => {
      expect(adminLoginSrc).toContain("INACTIVITY_TIMEOUT_MS");
      expect(adminLoginSrc).toContain("5000");
      expect(adminLoginSrc).toContain("inactivityTimerRef");
      expect(adminLoginSrc).toContain("startInactivityTimer");
      expect(adminLoginSrc).toContain("clearInactivityTimer");
    });

    it("cancels inactivity timer when user types", () => {
      expect(adminLoginSrc).toContain("password.length === 0");
      expect(adminLoginSrc).toContain("clearInactivityTimer");
    });
  });

  describe("4. Authentication Security & Invariants", () => {
    it("uses useAdminAuth without modifying authentication handlers", () => {
      expect(adminLoginSrc).toContain("const { login } = useAdminAuth()");
      expect(adminLoginSrc).toContain("await login(password.trim())");
      expect(adminLoginSrc).toContain('navigate("/admin")');
      expect(adminLoginSrc).toContain('setError(result.error || "Login failed")');
      expect(adminLoginSrc).not.toContain("bypass");
    });

    it("displays error with ShieldAlert on login failure", () => {
      expect(adminLoginSrc).toContain("<ShieldAlert");
      expect(adminLoginSrc).toContain("{error}");
    });

    it("disables submit when loading or password is empty", () => {
      expect(adminLoginSrc).toContain("disabled={loading || !password.trim()}");
    });
  });

  describe("5. CSS Animation Tokens & Keyframes", () => {
    it("defines floating mesh keyframes", () => {
      expect(stylesSrc).toContain("@keyframes loginFloatA");
      expect(stylesSrc).toContain("@keyframes loginFloatB");
      expect(stylesSrc).toContain("@keyframes loginFloatC");
    });

    it("defines concentric orb ring and sheen classes with champagne gold", () => {
      expect(stylesSrc).toContain(".login-orb-ring");
      expect(stylesSrc).toContain(".login-orb-ring-delay");
      expect(stylesSrc).toContain(".login-orb-sheen");
      expect(stylesSrc).toContain("rgba(220, 185, 120");
    });

    it("does NOT contain blue outer ring colors", () => {
      expect(stylesSrc).not.toContain("rgba(59, 130, 246");
    });

    it("includes prefers-reduced-motion accessibility overrides", () => {
      expect(stylesSrc).toContain("@media (prefers-reduced-motion: reduce)");
      expect(stylesSrc).toContain("animation: none !important");
    });
  });
});
