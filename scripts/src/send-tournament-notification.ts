import { loadRootEnv } from "../load-root-env.mjs";

const tournamentName = process.argv[2]?.trim() || "Amaira";

async function main() {
  loadRootEnv();

  const { db, tournamentsTable } = await import("@workspace/db");
  const { desc, ilike } = await import("drizzle-orm");
  const { dispatchNotification } = await import(
    "../../artifacts/api-server/src/lib/notifications/index.ts"
  );

  const namePattern = tournamentName.includes("%") ? tournamentName : `%${tournamentName}%`;
  const matches = await db
    .select()
    .from(tournamentsTable)
    .where(ilike(tournamentsTable.name, namePattern))
    .orderBy(desc(tournamentsTable.createdAt))
    .limit(5);

  if (matches.length === 0) {
    console.error(`Tournament not found matching: ${tournamentName}`);
    process.exit(1);
  }

  if (matches.length > 1) {
    console.log("Multiple matches — using most recent:");
    for (const t of matches) {
      console.log(`  #${t.id} ${t.name}`);
    }
  }

  const tournament = matches[0]!;

  if (!tournament) {
    console.error(`Tournament not found: ${tournamentName}`);
    process.exit(1);
  }

  console.log(`Sending TOURNAMENT_CREATED notification for #${tournament.id} "${tournament.name}"`);
  console.log(`Organizer: ${tournament.organizerName ?? "—"} <${tournament.organizerEmail ?? "no email"}>`);

  await dispatchNotification(
    "TOURNAMENT_CREATED",
    {
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      sport: tournament.sport,
      auctionCode: tournament.auctionCode,
      auctionDate: tournament.auctionDate,
      auctionTime: tournament.auctionTime,
      venue: tournament.venue,
      organizerName: tournament.organizerName,
      organizerEmail: tournament.organizerEmail,
      organizerMobile: tournament.organizerMobile,
      organizerId: tournament.organizerId,
    },
    { skipDedup: true },
  );

  console.log("Done — check admin Notification Center and organizer inbox.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
