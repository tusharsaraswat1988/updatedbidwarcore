/**
 * @deprecated Prefer POST /api/tournaments/:id/auction/handoff-to-sports
 * (or conclude the auction). Kept for local recovery only.
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handoffAuctionParticipantsToSports } from "../../artifacts/api-server/src/lib/master-sports/cricket-roster";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const tid = Number(process.env.VERIFY_TOURNAMENT_ID || "4");

const result = await handoffAuctionParticipantsToSports(tid);
console.log(JSON.stringify({ tournamentId: tid, ...result }, null, 2));
