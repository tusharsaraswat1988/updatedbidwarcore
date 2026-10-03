import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
} from "@workspace/platform-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Phase 4D: Public Auction Display & Presentation Surfaces Module Boundary", () => {
  const codeGateSrc = readFileSync(path.resolve(__dirname, "../../components/tournament-code-gate.tsx"), "utf8");
  const liveViewerSrc = readFileSync(path.resolve(__dirname, "../liveviewer.tsx"), "utf8");
  const obsOverlaySrc = readFileSync(path.resolve(__dirname, "../obs-overlay.tsx"), "utf8");
  const obsV2OverlaySrc = readFileSync(path.resolve(__dirname, "../obs-v2-overlay.tsx"), "utf8");
  const obsLabOverlaySrc = readFileSync(path.resolve(__dirname, "../obs-lab-overlay.tsx"), "utf8");
  const useAuctionSocketSrc = readFileSync(path.resolve(__dirname, "../../hooks/use-auction-socket.ts"), "utf8");
  const appSrc = readFileSync(path.resolve(__dirname, "../../platform-app.tsx"), "utf8");

  describe("1. TournamentCodeGate Module Guarding (LED & Side Display)", () => {
    it("checks auctionEnabled and blocks mounting display shells if auction is disabled", () => {
      expect(codeGateSrc).toContain("data.auctionEnabled === false");
      expect(codeGateSrc).toContain("setStatus(\"auction_disabled\")");
      expect(codeGateSrc).toContain("Auction Not Enabled");
      expect(codeGateSrc).toContain("The Auction module is not enabled for this tournament.");
    });

    it("checks for invalid false+false state and shows invalid module state error", () => {
      expect(codeGateSrc).toContain("data.auctionEnabled === false && data.scoringEnabled === false");
      expect(codeGateSrc).toContain("setStatus(\"invalid_module_state\")");
      expect(codeGateSrc).toContain("Invalid Tournament State");
    });

    it("never renders children when status is auction_disabled or invalid_module_state", () => {
      // In TournamentCodeGate, children are ONLY rendered when status === "unlocked"
      expect(codeGateSrc).toMatch(/if\s*\(\s*status\s*===\s*"unlocked"\s*\)\s*\{\s*return\s*<>{children}<\/>;\s*\}/);
    });

    it("is public and does NOT require organizer authentication", () => {
      expect(codeGateSrc).not.toContain("OrganizerGuard");
      expect(codeGateSrc).not.toContain("useOrganizerAuth");
    });
  });

  describe("2. Public Live Viewer (LiveViewer fan view) Module Boundary", () => {
    it("disables useAuctionSocket when tournament.auctionEnabled === false", () => {
      expect(liveViewerSrc).toContain("const isAuctionDisabled = tournament && tournament.auctionEnabled === false;");
      expect(liveViewerSrc).toContain("useAuctionSocket(tournamentId, handleCheerMessage, {");
      expect(liveViewerSrc).toContain("enabled: !!tournamentId && !isAuctionDisabled");
    });

    it("disables useGetAuctionState and team purse queries when auction is disabled", () => {
      expect(liveViewerSrc).toContain("enabled: !!tournamentId && !isAuctionDisabled");
    });

    it("renders 'Auction Not Enabled' public holding screen when auction is disabled", () => {
      expect(liveViewerSrc).toContain("if (isAuctionDisabled)");
      expect(liveViewerSrc).toContain("Auction Not Enabled");
      expect(liveViewerSrc).toContain("The Auction module is not enabled for this tournament.");
    });

    it("renders 'Invalid Tournament State' when false+false state is detected", () => {
      expect(liveViewerSrc).toContain("if (isInvalidModuleState)");
      expect(liveViewerSrc).toContain("Invalid Tournament State");
    });

    it("is public and does NOT require organizer login or OrganizerGuard", () => {
      expect(appSrc).toContain('<Route path="/live/:id" component={LiveViewer} />');
      expect(appSrc).toContain('<Route path="/tournament/:id/liveviewer" component={LiveViewer} />');
    });

    it("registers public player registration and live redirect routes", () => {
      expect(appSrc).toContain('<Route path="/register/:code" component={PlayerRegister} />');
      expect(appSrc).toContain('<Route path="/tournament/:id/register" component={PlayerRegisterLegacy} />');
      expect(appSrc).toContain('<Route path="/live" component={LegacyLiveRedirect} />');
    });
  });

  describe("3. OBS Overlays (/obs, /obs/v2, /obs/lab) Module Boundary", () => {
    it("ObsOverlay disables socket and queries when auction is disabled", () => {
      expect(obsOverlaySrc).toContain("isAuctionDisabled");
      expect(obsOverlaySrc).toContain("enabled: !!tournamentId && !isAuctionDisabled");
    });

    it("ObsOverlay renders clean transparent canvas in OBS mode when auction is disabled", () => {
      expect(obsOverlaySrc).toContain("if (isInvalidModuleState || isAuctionDisabled)");
      expect(obsOverlaySrc).toContain('if (isObsMode)');
      expect(obsOverlaySrc).toContain('background: "transparent"');
    });

    it("ObsV2Overlay disables socket and queries when auction is disabled", () => {
      expect(obsV2OverlaySrc).toContain("isAuctionDisabled");
      expect(obsV2OverlaySrc).toContain("enabled: !!tournamentId && !isAuctionDisabled");
    });

    it("ObsV2Overlay renders clean transparent canvas in OBS mode when auction is disabled", () => {
      expect(obsV2OverlaySrc).toContain("if (isInvalidModuleState || isAuctionDisabled)");
      expect(obsV2OverlaySrc).toContain('if (isObsMode)');
      expect(obsV2OverlaySrc).toContain('background: "transparent"');
    });

    it("ObsLabOverlay disables socket and queries when auction is disabled", () => {
      expect(obsLabOverlaySrc).toContain("isAuctionDisabled");
      expect(obsLabOverlaySrc).toContain("enabled: !!tournamentId && !isAuctionDisabled");
    });
  });

  describe("4. useAuctionSocket Hook", () => {
    it("supports enabled option and avoids creating EventSource when enabled is false", () => {
      expect(useAuctionSocketSrc).toContain("UseAuctionSocketOptions");
      expect(useAuctionSocketSrc).toContain("if (!tournamentId || !enabled)");
      expect(useAuctionSocketSrc).toContain('setConnectionStatus("disconnected")');
    });
  });
});
