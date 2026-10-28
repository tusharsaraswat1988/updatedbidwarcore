import { db, sportsTable, sportRolesTable, roleSpecGroupsTable, roleSpecOptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  // Check if already seeded
  const existing = await db.select().from(sportsTable).limit(1);
  if (existing.length > 0) {
    console.log("Sports already seeded, skipping.");
    process.exit(0);
  }

  console.log("Seeding sports data into NEON database...");

  // ─── Sports ────────────────────────────────────────────────────────────────
  const sports = await db.insert(sportsTable).values([
    { name: "Cricket",    slug: "cricket" },
    { name: "Football",   slug: "football" },
    { name: "Kabaddi",    slug: "kabaddi" },
    { name: "Badminton",  slug: "badminton" },
    { name: "Volleyball", slug: "volleyball" },
    { name: "E-Sports",   slug: "esports" },
    { name: "Other",      slug: "other" },
  ]).returning();

  const bySlug = Object.fromEntries(sports.map(s => [s.slug, s.id]));

  // ─── Roles ─────────────────────────────────────────────────────────────────
  const roles = await db.insert(sportRolesTable).values([
    // Cricket
    { sportId: bySlug.cricket,    roleName: "Batsman",          displayOrder: 0 },
    { sportId: bySlug.cricket,    roleName: "Bowler",           displayOrder: 1 },
    { sportId: bySlug.cricket,    roleName: "All-Rounder",      displayOrder: 2 },
    { sportId: bySlug.cricket,    roleName: "Wicketkeeper",     displayOrder: 3 },
    // Football
    { sportId: bySlug.football,   roleName: "Goalkeeper (GK)",  displayOrder: 0 },
    { sportId: bySlug.football,   roleName: "Defender",         displayOrder: 1 },
    { sportId: bySlug.football,   roleName: "Midfielder",       displayOrder: 2 },
    { sportId: bySlug.football,   roleName: "Forward",          displayOrder: 3 },
    // Kabaddi
    { sportId: bySlug.kabaddi,    roleName: "Raider",           displayOrder: 0 },
    { sportId: bySlug.kabaddi,    roleName: "Defender",         displayOrder: 1 },
    { sportId: bySlug.kabaddi,    roleName: "All-Rounder",      displayOrder: 2 },
    // Badminton
    { sportId: bySlug.badminton,  roleName: "Singles Player",   displayOrder: 0 },
    { sportId: bySlug.badminton,  roleName: "Doubles Player",   displayOrder: 1 },
    { sportId: bySlug.badminton,  roleName: "Mixed Doubles",    displayOrder: 2 },
    // Volleyball
    { sportId: bySlug.volleyball, roleName: "Setter",           displayOrder: 0 },
    { sportId: bySlug.volleyball, roleName: "Libero",           displayOrder: 1 },
    { sportId: bySlug.volleyball, roleName: "Outside Hitter",   displayOrder: 2 },
    { sportId: bySlug.volleyball, roleName: "Middle Blocker",   displayOrder: 3 },
    { sportId: bySlug.volleyball, roleName: "Opposite Hitter",  displayOrder: 4 },
    // E-Sports
    { sportId: bySlug.esports,    roleName: "Fragger",          displayOrder: 0 },
    { sportId: bySlug.esports,    roleName: "Support",          displayOrder: 1 },
    { sportId: bySlug.esports,    roleName: "IGL",              displayOrder: 2 },
    { sportId: bySlug.esports,    roleName: "Entry Fragger",    displayOrder: 3 },
    // Other
    { sportId: bySlug.other,      roleName: "Player",           displayOrder: 0 },
  ]).returning();

  const byRoleName = (sportSlug: string, name: string) =>
    roles.find(r => r.sportId === bySlug[sportSlug] && r.roleName === name)!.id;

  // ─── Spec Groups ───────────────────────────────────────────────────────────
  const groups = await db.insert(roleSpecGroupsTable).values([
    // Cricket - Batsman
    { roleId: byRoleName("cricket", "Batsman"),          groupName: "Batting Hand",     displayOrder: 0, optional: false },
    // Cricket - Bowler
    { roleId: byRoleName("cricket", "Bowler"),           groupName: "Bowling Style",    displayOrder: 0, optional: false },
    { roleId: byRoleName("cricket", "Bowler"),           groupName: "Bowling Arm",      displayOrder: 1, optional: false },
    // Cricket - All-Rounder
    { roleId: byRoleName("cricket", "All-Rounder"),      groupName: "Batting Hand",     displayOrder: 0, optional: false },
    { roleId: byRoleName("cricket", "All-Rounder"),      groupName: "Bowling Style",    displayOrder: 1, optional: true  },
    // Cricket - Wicketkeeper
    { roleId: byRoleName("cricket", "Wicketkeeper"),     groupName: "Batting Hand",     displayOrder: 0, optional: false },
    // Football - Goalkeeper (GK)
    { roleId: byRoleName("football", "Goalkeeper (GK)"), groupName: "Playing Style",    displayOrder: 0, optional: true  },
    { roleId: byRoleName("football", "Goalkeeper (GK)"), groupName: "Preferred Foot",   displayOrder: 1, optional: true  },
    // Football - Defender
    { roleId: byRoleName("football", "Defender"),        groupName: "Playing Position", displayOrder: 0, optional: true  },
    { roleId: byRoleName("football", "Defender"),        groupName: "Preferred Foot",   displayOrder: 1, optional: true  },
    // Football - Midfielder
    { roleId: byRoleName("football", "Midfielder"),      groupName: "Playing Position", displayOrder: 0, optional: true  },
    { roleId: byRoleName("football", "Midfielder"),      groupName: "Preferred Foot",   displayOrder: 1, optional: true  },
    // Football - Forward
    { roleId: byRoleName("football", "Forward"),         groupName: "Playing Position", displayOrder: 0, optional: true  },
    { roleId: byRoleName("football", "Forward"),         groupName: "Preferred Foot",   displayOrder: 1, optional: true  },
  ]).returning();

  const byGroupName = (roleId: number, name: string) =>
    groups.find(g => g.roleId === roleId && g.groupName === name)!.id;

  // ─── Spec Options ──────────────────────────────────────────────────────────
  const batsman    = byRoleName("cricket", "Batsman");
  const bowler     = byRoleName("cricket", "Bowler");
  const allRounder = byRoleName("cricket", "All-Rounder");
  const keeper     = byRoleName("cricket", "Wicketkeeper");
  const gk         = byRoleName("football", "Goalkeeper (GK)");
  const defender   = byRoleName("football", "Defender");
  const midfielder = byRoleName("football", "Midfielder");
  const forward    = byRoleName("football", "Forward");

  await db.insert(roleSpecOptionsTable).values([
    // Batting Hand
    { groupId: byGroupName(batsman,    "Batting Hand"),   optionName: "Right-hand",  displayOrder: 0 },
    { groupId: byGroupName(batsman,    "Batting Hand"),   optionName: "Left-hand",   displayOrder: 1 },
    { groupId: byGroupName(allRounder, "Batting Hand"),   optionName: "Right-hand",  displayOrder: 0 },
    { groupId: byGroupName(allRounder, "Batting Hand"),   optionName: "Left-hand",   displayOrder: 1 },
    { groupId: byGroupName(keeper,     "Batting Hand"),   optionName: "Right-hand",  displayOrder: 0 },
    { groupId: byGroupName(keeper,     "Batting Hand"),   optionName: "Left-hand",   displayOrder: 1 },
    // Bowling Style
    { groupId: byGroupName(bowler,     "Bowling Style"),  optionName: "Fast/Pace",   displayOrder: 0 },
    { groupId: byGroupName(bowler,     "Bowling Style"),  optionName: "Medium",      displayOrder: 1 },
    { groupId: byGroupName(bowler,     "Bowling Style"),  optionName: "Spin",        displayOrder: 2 },
    { groupId: byGroupName(bowler,     "Bowling Style"),  optionName: "Swing",       displayOrder: 3 },
    { groupId: byGroupName(allRounder, "Bowling Style"),  optionName: "Fast/Pace",   displayOrder: 0 },
    { groupId: byGroupName(allRounder, "Bowling Style"),  optionName: "Medium",      displayOrder: 1 },
    { groupId: byGroupName(allRounder, "Bowling Style"),  optionName: "Spin",        displayOrder: 2 },
    // Bowling Arm
    { groupId: byGroupName(bowler,     "Bowling Arm"),    optionName: "Right-arm",   displayOrder: 0 },
    { groupId: byGroupName(bowler,     "Bowling Arm"),    optionName: "Left-arm",    displayOrder: 1 },
    // Football - Goalkeeper Playing Style
    { groupId: byGroupName(gk,         "Playing Style"),    optionName: "Shot stopper",          displayOrder: 0 },
    { groupId: byGroupName(gk,         "Playing Style"),    optionName: "Sweeper Keeper",        displayOrder: 1 },
    { groupId: byGroupName(gk,         "Playing Style"),    optionName: "Backup Goalkeeper",     displayOrder: 2 },
    // Football - Defender Playing Position
    { groupId: byGroupName(defender,   "Playing Position"), optionName: "Centre-Back (CB)",      displayOrder: 0 },
    { groupId: byGroupName(defender,   "Playing Position"), optionName: "Left-Back (LB)",        displayOrder: 1 },
    { groupId: byGroupName(defender,   "Playing Position"), optionName: "Right-Back (RB)",       displayOrder: 2 },
    { groupId: byGroupName(defender,   "Playing Position"), optionName: "Wing-Back (LWB/RWB)",   displayOrder: 3 },
    // Football - Midfielder Playing Position
    { groupId: byGroupName(midfielder, "Playing Position"), optionName: "Defensive Midfielder (CDM)",     displayOrder: 0 },
    { groupId: byGroupName(midfielder, "Playing Position"), optionName: "Central Midfielder (CM)",        displayOrder: 1 },
    { groupId: byGroupName(midfielder, "Playing Position"), optionName: "Attacking Midfielder (CAM)",     displayOrder: 2 },
    { groupId: byGroupName(midfielder, "Playing Position"), optionName: "Left/Right Midfielder (LM/RM)",  displayOrder: 3 },
    // Football - Forward Playing Position
    { groupId: byGroupName(forward,    "Playing Position"), optionName: "Centre-Forward (CF)",   displayOrder: 0 },
    { groupId: byGroupName(forward,    "Playing Position"), optionName: "Striker (ST)",          displayOrder: 1 },
    { groupId: byGroupName(forward,    "Playing Position"), optionName: "Left Winger (LW)",      displayOrder: 2 },
    { groupId: byGroupName(forward,    "Playing Position"), optionName: "Right Winger (RW)",     displayOrder: 3 },
    { groupId: byGroupName(forward,    "Playing Position"), optionName: "Second Striker (SS)",   displayOrder: 4 },
    // Football - Preferred Foot
    { groupId: byGroupName(gk,         "Preferred Foot"), optionName: "Right",       displayOrder: 0 },
    { groupId: byGroupName(gk,         "Preferred Foot"), optionName: "Left",        displayOrder: 1 },
    { groupId: byGroupName(gk,         "Preferred Foot"), optionName: "Both",        displayOrder: 2 },
    { groupId: byGroupName(defender,   "Preferred Foot"), optionName: "Right",       displayOrder: 0 },
    { groupId: byGroupName(defender,   "Preferred Foot"), optionName: "Left",        displayOrder: 1 },
    { groupId: byGroupName(defender,   "Preferred Foot"), optionName: "Both",        displayOrder: 2 },
    { groupId: byGroupName(midfielder, "Preferred Foot"), optionName: "Right",       displayOrder: 0 },
    { groupId: byGroupName(midfielder, "Preferred Foot"), optionName: "Left",        displayOrder: 1 },
    { groupId: byGroupName(midfielder, "Preferred Foot"), optionName: "Both",        displayOrder: 2 },
    { groupId: byGroupName(forward,    "Preferred Foot"), optionName: "Right",       displayOrder: 0 },
    { groupId: byGroupName(forward,    "Preferred Foot"), optionName: "Left",        displayOrder: 1 },
    { groupId: byGroupName(forward,    "Preferred Foot"), optionName: "Both",        displayOrder: 2 },
  ]);

  console.log(`Seeded ${sports.length} sports, ${roles.length} roles, ${groups.length} spec groups.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
