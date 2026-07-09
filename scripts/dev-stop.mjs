/**
 * Stop all BidWar local dev servers (API, auction-platform, owner-app, and scoring-app if running).
 * Usage: pnpm dev:stop
 */
import { getDevPorts, freePorts, waitForPortsFree } from "./dev-ports.mjs";

const ports = getDevPorts();
const unique = [...new Set([ports.api, ports.frontend, ports.ownerApp, ports.scoringApp])];

console.log("\nBidWar — stopping local dev servers\n");
console.log(`  Ports: ${unique.join(", ")}\n`);

const { freed } = freePorts(unique);

if (freed.length === 0) {
  console.log("  No dev servers were listening on those ports.\n");
  process.exit(0);
}

const allFree = await waitForPortsFree(unique, 10000);
if (!allFree) {
  console.error(
    "\n  Warning: some ports are still in use. Run `pnpm dev:stop` again or reboot.\n",
  );
  process.exit(1);
}

console.log("\n  All dev ports are free. Run `pnpm dev` to start.\n");
