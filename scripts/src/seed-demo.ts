import { db, tournamentsTable, teamsTable, categoriesTable, playersTable } from "@workspace/db";

const avatar = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.replace("#", "")}&color=fff&size=200&bold=true`;

const sponsorLogoUrl = (name: string, bg: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg.replace("#", "")}&color=fff&size=120&bold=true&font-size=0.4`;

// Bid tiers JSON: ₹0–50L in 5L steps, ₹50L–1Cr in 10L steps, above 1Cr in 25L steps
const IPL_BID_TIERS = JSON.stringify([
  { upTo: 5000000, increment: 500000 },
  { upTo: 10000000, increment: 1000000 },
  { increment: 2500000 },
]);

// Bid tiers for Mega Auction: tiered increments
const MEGA_BID_TIERS = JSON.stringify([
  { upTo: 3000000, increment: 250000 },
  { upTo: 6000000, increment: 500000 },
  { increment: 1000000 },
]);

// sponsorLogos stored as JSON array of { url, name?, type? }
const IPL_SPONSORS = JSON.stringify([
  { url: sponsorLogoUrl("DreamSports", "#7C3AED"), name: "DreamSports", type: "Title Sponsor" },
  { url: sponsorLogoUrl("PayFast", "#059669"),     name: "PayFast",     type: "Associate Sponsor" },
  { url: sponsorLogoUrl("StarPlay", "#DC2626"),    name: "StarPlay",    type: "Media Partner" },
]);

const MEGA_SPONSORS = JSON.stringify([
  { url: sponsorLogoUrl("BetKing", "#D97706"),  name: "BetKing",  type: "Title Sponsor" },
  { url: sponsorLogoUrl("CricFlex", "#0284C7"), name: "CricFlex", type: "Venue Partner" },
  { url: sponsorLogoUrl("FanZone", "#DB2777"),  name: "FanZone",  type: "Digital Partner" },
]);

const IPL_TEAMS = [
  { name: "Mumbai Mavericks",      shortCode: "MUM", ownerName: "Rahul Mehta",   color: "#1D4ED8", bg: "1D4ED8" },
  { name: "Chennai Chargers",      shortCode: "CHE", ownerName: "Priya Sharma",  color: "#D97706", bg: "D97706" },
  { name: "Kolkata Kings",         shortCode: "KOL", ownerName: "Anil Bose",     color: "#7C3AED", bg: "7C3AED" },
  { name: "Bangalore Blasters",    shortCode: "BLR", ownerName: "Sunita Rao",    color: "#DC2626", bg: "DC2626" },
  { name: "Delhi Dragons",         shortCode: "DEL", ownerName: "Vikram Singh",  color: "#0F172A", bg: "0F172A" },
  { name: "Hyderabad Hurricanes",  shortCode: "HYD", ownerName: "Meena Reddy",   color: "#D97706", bg: "B45309" },
  { name: "Punjab Panthers",       shortCode: "PUN", ownerName: "Gurpreet Gill", color: "#DC2626", bg: "991B1B" },
  { name: "Rajasthan Royals XI",   shortCode: "RAJ", ownerName: "Deepak Joshi",  color: "#BE185D", bg: "BE185D" },
  { name: "Gujarat Giants",        shortCode: "GUJ", ownerName: "Hetal Patel",   color: "#065F46", bg: "065F46" },
  { name: "Lucknow Lions",         shortCode: "LKO", ownerName: "Arvind Gupta",  color: "#1E40AF", bg: "1E40AF" },
];

const MEGA_TEAMS = [
  { name: "Ahmedabad Aces",        shortCode: "AHM", ownerName: "Nirav Patel",    color: "#0369A1", bg: "0369A1" },
  { name: "Bengaluru Bulls",       shortCode: "BNG", ownerName: "Kavita Shetty",  color: "#7C2D12", bg: "7C2D12" },
  { name: "Chennai Cobras",        shortCode: "CCO", ownerName: "Rajan Iyer",     color: "#854D0E", bg: "854D0E" },
  { name: "Delhi Daredevils XI",   shortCode: "DDX", ownerName: "Pooja Kapoor",   color: "#1E3A5F", bg: "1E3A5F" },
  { name: "Goa Gladiators",        shortCode: "GOA", ownerName: "Sandeep Naik",   color: "#166534", bg: "166534" },
  { name: "Hyderabad Hawks",       shortCode: "HHK", ownerName: "Lakshmi Rao",    color: "#9A3412", bg: "9A3412" },
  { name: "Indore Invaders",       shortCode: "IND", ownerName: "Suresh Malviya", color: "#5B21B6", bg: "5B21B6" },
  { name: "Jaipur Jets",           shortCode: "JAI", ownerName: "Reena Sharma",   color: "#991B1B", bg: "991B1B" },
  { name: "Kochi Knights",         shortCode: "KOC", ownerName: "Biju Menon",     color: "#065F46", bg: "065F46" },
  { name: "Kolkata Krakens",       shortCode: "KKR", ownerName: "Tanya Ghosh",    color: "#6B21A8", bg: "6B21A8" },
  { name: "Lucknow Legends",       shortCode: "LKL", ownerName: "Mohit Verma",    color: "#0C4A6E", bg: "0C4A6E" },
  { name: "Mumbai Monarchs",       shortCode: "MOM", ownerName: "Hina Desai",     color: "#1D4ED8", bg: "1D4ED8" },
  { name: "Nagpur Ninjas",         shortCode: "NAG", ownerName: "Prakash Bhosle", color: "#047857", bg: "047857" },
  { name: "Noida Nomads",          shortCode: "NOI", ownerName: "Preethi Arora",  color: "#374151", bg: "374151" },
  { name: "Pune Pirates",          shortCode: "PUN", ownerName: "Girish Joshi",   color: "#7E22CE", bg: "7E22CE" },
  { name: "Rajkot Renegades",      shortCode: "RJK", ownerName: "Ketan Shah",     color: "#B45309", bg: "B45309" },
  { name: "Surat Strikers",        shortCode: "SRT", ownerName: "Dhruv Modi",     color: "#0F766E", bg: "0F766E" },
  { name: "Vadodara Vipers",       shortCode: "VAD", ownerName: "Mira Mehta",     color: "#4D7C0F", bg: "4D7C0F" },
  { name: "Visakha Volcanoes",     shortCode: "VIS", ownerName: "Ravi Kumar",     color: "#BE185D", bg: "BE185D" },
  { name: "Bhopal Battleaxes",     shortCode: "BHO", ownerName: "Anita Tiwari",   color: "#92400E", bg: "92400E" },
];

const ROLES = ["Batsman", "Bowler", "All-rounder", "Wicketkeeper-Batsman", "Opening Batsman", "Fast Bowler", "Spin Bowler"];
const CITIES = ["Mumbai", "Chennai", "Kolkata", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Ahmedabad", "Jaipur", "Lucknow", "Nagpur", "Surat", "Vadodara", "Visakhapatnam", "Indore"];
const BATTING_STYLES = ["Right-hand bat", "Left-hand bat"];
const BOWLING_STYLES = ["Right-arm fast", "Right-arm medium", "Left-arm fast", "Left-arm orthodox", "Right-arm off-spin", "Right-arm leg-spin", "Left-arm chinaman", null];

// 30 IPL-style players (Platinum 5, Gold 10, Silver 10, Emerging 5)
const IPL_PLAYERS: Array<{name: string; role: string; city: string; batting: string; bowling: string | null; age: number; tier: "Platinum"|"Gold"|"Silver"|"Emerging"}> = [
  // Platinum
  { name: "Rohit Sharma", role: "Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: "Right-arm medium", age: 37, tier: "Platinum" },
  { name: "Jasprit Bumrah", role: "Bowler", city: "Ahmedabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Platinum" },
  { name: "Virat Kohli", role: "Batsman", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm medium", age: 35, tier: "Platinum" },
  { name: "Ravindra Jadeja", role: "All-rounder", city: "Jamnagar", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 35, tier: "Platinum" },
  { name: "KL Rahul", role: "Wicketkeeper-Batsman", city: "Mangalore", batting: "Right-hand bat", bowling: null, age: 32, tier: "Platinum" },
  // Gold
  { name: "Shreyas Iyer", role: "Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 29, tier: "Gold" },
  { name: "Mohammed Siraj", role: "Fast Bowler", city: "Hyderabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Gold" },
  { name: "Suryakumar Yadav", role: "Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: "Right-arm medium", age: 33, tier: "Gold" },
  { name: "Hardik Pandya", role: "All-rounder", city: "Vadodara", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Gold" },
  { name: "Axar Patel", role: "All-rounder", city: "Anand", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 30, tier: "Gold" },
  { name: "Rinku Singh", role: "Batsman", city: "Aligarh", batting: "Left-hand bat", bowling: "Right-arm medium", age: 26, tier: "Gold" },
  { name: "Arshdeep Singh", role: "Fast Bowler", city: "Ludhiana", batting: "Left-hand bat", bowling: "Left-arm fast", age: 25, tier: "Gold" },
  { name: "Ishan Kishan", role: "Wicketkeeper-Batsman", city: "Patna", batting: "Left-hand bat", bowling: null, age: 25, tier: "Gold" },
  { name: "Kuldeep Yadav", role: "Spin Bowler", city: "Kanpur", batting: "Left-hand bat", bowling: "Left-arm chinaman", age: 29, tier: "Gold" },
  { name: "Shubman Gill", role: "Opening Batsman", city: "Fazilka", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 24, tier: "Gold" },
  // Silver
  { name: "Tilak Varma", role: "Batsman", city: "Hyderabad", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 21, tier: "Silver" },
  { name: "Abhishek Sharma", role: "All-rounder", city: "Amritsar", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 23, tier: "Silver" },
  { name: "Ruturaj Gaikwad", role: "Opening Batsman", city: "Pune", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 27, tier: "Silver" },
  { name: "Sai Sudharsan", role: "Batsman", city: "Chennai", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 22, tier: "Silver" },
  { name: "Mukesh Kumar", role: "Fast Bowler", city: "Nalanda", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Silver" },
  { name: "Ravi Bishnoi", role: "Spin Bowler", city: "Jodhpur", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 24, tier: "Silver" },
  { name: "Deepak Chahar", role: "Fast Bowler", city: "Agra", batting: "Right-hand bat", bowling: "Right-arm medium", age: 31, tier: "Silver" },
  { name: "Yashasvi Jaiswal", role: "Opening Batsman", city: "Bhadohi", batting: "Left-hand bat", bowling: "Right-arm leg-spin", age: 22, tier: "Silver" },
  { name: "Riyan Parag", role: "All-rounder", city: "Guwahati", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 22, tier: "Silver" },
  { name: "Prasidh Krishna", role: "Fast Bowler", city: "Bengaluru", batting: "Right-hand bat", bowling: "Right-arm fast", age: 28, tier: "Silver" },
  // Emerging
  { name: "Harshit Rana", role: "Fast Bowler", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm fast", age: 22, tier: "Emerging" },
  { name: "Nitish Kumar Reddy", role: "All-rounder", city: "Visakhapatnam", batting: "Right-hand bat", bowling: "Right-arm fast", age: 20, tier: "Emerging" },
  { name: "Mayank Yadav", role: "Fast Bowler", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm fast", age: 22, tier: "Emerging" },
  { name: "Dhruv Jurel", role: "Wicketkeeper-Batsman", city: "Agra", batting: "Right-hand bat", bowling: null, age: 23, tier: "Emerging" },
  { name: "Aakash Deep", role: "Fast Bowler", city: "Jehanabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 27, tier: "Emerging" },
];

// Additional players for Mega Auction (50 total: Platinum 8, Gold 16, Silver 18, Emerging 8)
const MEGA_PLAYERS: Array<{name: string; role: string; city: string; batting: string; bowling: string | null; age: number; tier: "Platinum"|"Gold"|"Silver"|"Emerging"}> = [
  // Platinum (8)
  { name: "MS Dhoni", role: "Wicketkeeper-Batsman", city: "Ranchi", batting: "Right-hand bat", bowling: null, age: 43, tier: "Platinum" },
  { name: "Rohit Sharma", role: "Opening Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: "Right-arm medium", age: 37, tier: "Platinum" },
  { name: "Virat Kohli", role: "Batsman", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm medium", age: 35, tier: "Platinum" },
  { name: "Jasprit Bumrah", role: "Fast Bowler", city: "Ahmedabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Platinum" },
  { name: "Ravindra Jadeja", role: "All-rounder", city: "Jamnagar", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 35, tier: "Platinum" },
  { name: "Suryakumar Yadav", role: "Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: null, age: 33, tier: "Platinum" },
  { name: "KL Rahul", role: "Wicketkeeper-Batsman", city: "Mangalore", batting: "Right-hand bat", bowling: null, age: 32, tier: "Platinum" },
  { name: "Hardik Pandya", role: "All-rounder", city: "Vadodara", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Platinum" },
  // Gold (16)
  { name: "Shreyas Iyer", role: "Batsman", city: "Mumbai", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 29, tier: "Gold" },
  { name: "Shubman Gill", role: "Opening Batsman", city: "Fazilka", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 24, tier: "Gold" },
  { name: "Mohammed Siraj", role: "Fast Bowler", city: "Hyderabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Gold" },
  { name: "Axar Patel", role: "All-rounder", city: "Anand", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 30, tier: "Gold" },
  { name: "Kuldeep Yadav", role: "Spin Bowler", city: "Kanpur", batting: "Left-hand bat", bowling: "Left-arm chinaman", age: 29, tier: "Gold" },
  { name: "Arshdeep Singh", role: "Fast Bowler", city: "Ludhiana", batting: "Left-hand bat", bowling: "Left-arm fast", age: 25, tier: "Gold" },
  { name: "Ishan Kishan", role: "Wicketkeeper-Batsman", city: "Patna", batting: "Left-hand bat", bowling: null, age: 25, tier: "Gold" },
  { name: "Rinku Singh", role: "Batsman", city: "Aligarh", batting: "Left-hand bat", bowling: null, age: 26, tier: "Gold" },
  { name: "Yashasvi Jaiswal", role: "Opening Batsman", city: "Bhadohi", batting: "Left-hand bat", bowling: "Right-arm leg-spin", age: 22, tier: "Gold" },
  { name: "Ruturaj Gaikwad", role: "Opening Batsman", city: "Pune", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 27, tier: "Gold" },
  { name: "Tilak Varma", role: "Batsman", city: "Hyderabad", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 21, tier: "Gold" },
  { name: "Abhishek Sharma", role: "All-rounder", city: "Amritsar", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 23, tier: "Gold" },
  { name: "Deepak Chahar", role: "Fast Bowler", city: "Agra", batting: "Right-hand bat", bowling: "Right-arm medium", age: 31, tier: "Gold" },
  { name: "Yuzvendra Chahal", role: "Spin Bowler", city: "Jind", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 33, tier: "Gold" },
  { name: "Riyan Parag", role: "All-rounder", city: "Guwahati", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 22, tier: "Gold" },
  { name: "Washington Sundar", role: "All-rounder", city: "Chennai", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 24, tier: "Gold" },
  // Silver (18)
  { name: "Sai Sudharsan", role: "Batsman", city: "Chennai", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 22, tier: "Silver" },
  { name: "Mukesh Kumar", role: "Fast Bowler", city: "Nalanda", batting: "Right-hand bat", bowling: "Right-arm fast", age: 30, tier: "Silver" },
  { name: "Ravi Bishnoi", role: "Spin Bowler", city: "Jodhpur", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 24, tier: "Silver" },
  { name: "Prasidh Krishna", role: "Fast Bowler", city: "Bengaluru", batting: "Right-hand bat", bowling: "Right-arm fast", age: 28, tier: "Silver" },
  { name: "Shahrukh Khan", role: "Batsman", city: "Chennai", batting: "Right-hand bat", bowling: "Right-arm medium", age: 28, tier: "Silver" },
  { name: "Shivam Dube", role: "All-rounder", city: "Mumbai", batting: "Left-hand bat", bowling: "Right-arm medium", age: 30, tier: "Silver" },
  { name: "Prabhsimran Singh", role: "Wicketkeeper-Batsman", city: "Patiala", batting: "Right-hand bat", bowling: null, age: 24, tier: "Silver" },
  { name: "Khaleel Ahmed", role: "Fast Bowler", city: "Tonk", batting: "Right-hand bat", bowling: "Left-arm fast", age: 26, tier: "Silver" },
  { name: "Rahul Tripathi", role: "Batsman", city: "Nagpur", batting: "Right-hand bat", bowling: "Right-arm medium", age: 31, tier: "Silver" },
  { name: "Harshal Patel", role: "Fast Bowler", city: "Anand", batting: "Right-hand bat", bowling: "Right-arm medium", age: 33, tier: "Silver" },
  { name: "Naman Dhir", role: "All-rounder", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 23, tier: "Silver" },
  { name: "Finn Allen", role: "Opening Batsman", city: "Auckland", batting: "Right-hand bat", bowling: "Right-arm off-spin", age: 26, tier: "Silver" },
  { name: "Venkatesh Iyer", role: "All-rounder", city: "Indore", batting: "Left-hand bat", bowling: "Right-arm medium", age: 28, tier: "Silver" },
  { name: "Kartik Tyagi", role: "Fast Bowler", city: "Hapur", batting: "Right-hand bat", bowling: "Right-arm fast", age: 23, tier: "Silver" },
  { name: "Rahul Chahar", role: "Spin Bowler", city: "Agra", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 24, tier: "Silver" },
  { name: "Devdutt Padikkal", role: "Batsman", city: "Bengaluru", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 23, tier: "Silver" },
  { name: "Himmat Singh", role: "Batsman", city: "Sikar", batting: "Right-hand bat", bowling: null, age: 24, tier: "Silver" },
  { name: "Gurjapneet Singh", role: "Fast Bowler", city: "Ludhiana", batting: "Right-hand bat", bowling: "Right-arm fast", age: 22, tier: "Silver" },
  // Emerging (8)
  { name: "Harshit Rana", role: "Fast Bowler", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm fast", age: 22, tier: "Emerging" },
  { name: "Nitish Kumar Reddy", role: "All-rounder", city: "Visakhapatnam", batting: "Right-hand bat", bowling: "Right-arm fast", age: 20, tier: "Emerging" },
  { name: "Mayank Yadav", role: "Fast Bowler", city: "Delhi", batting: "Right-hand bat", bowling: "Right-arm fast", age: 22, tier: "Emerging" },
  { name: "Dhruv Jurel", role: "Wicketkeeper-Batsman", city: "Agra", batting: "Right-hand bat", bowling: null, age: 23, tier: "Emerging" },
  { name: "Aakash Deep", role: "Fast Bowler", city: "Jehanabad", batting: "Right-hand bat", bowling: "Right-arm fast", age: 27, tier: "Emerging" },
  { name: "Suyash Sharma", role: "Spin Bowler", city: "Patna", batting: "Right-hand bat", bowling: "Right-arm leg-spin", age: 21, tier: "Emerging" },
  { name: "Arshin Kulkarni", role: "All-rounder", city: "Mumbai", batting: "Left-hand bat", bowling: "Left-arm orthodox", age: 19, tier: "Emerging" },
  { name: "Musheer Khan", role: "All-rounder", city: "Mumbai", batting: "Left-hand bat", bowling: "Right-arm off-spin", age: 19, tier: "Emerging" },
];

const CATEGORY_CONFIG = {
  Platinum: { minBid: 2000000, colorCode: "#E5E7EB", sortOrder: 0 },
  Gold:     { minBid: 1000000, colorCode: "#F59E0B", sortOrder: 1 },
  Silver:   { minBid: 500000,  colorCode: "#94A3B8", sortOrder: 2 },
  Emerging: { minBid: 200000,  colorCode: "#34D399", sortOrder: 3 },
};

async function seedTournament1() {
  console.log("Creating Tournament 1: BidWar Premier League 2025...");

  const [t] = await db.insert(tournamentsTable).values({
    name: "BidWar Premier League 2025",
    sport: "cricket",
    venue: "BidWar Stadium, Mumbai",
    auctionDate: "2025-03-15",
    organizerName: "BidWar Sports Pvt Ltd",
    organizerMobile: "9876543210",
    organizerEmail: "admin@bidwar.in",
    logoUrl: avatar("BPL", "1D4ED8"),
    sponsorLogos: IPL_SPONSORS,
    basePurse: 10000000,
    minBid: 200000,
    bidIncrement: 500000,
    bidTiers: IPL_BID_TIERS,
    bidTier1UpTo: 5000000,
    bidTier1Increment: 500000,
    bidTier2UpTo: 10000000,
    bidTier2Increment: 1000000,
    bidTier3Increment: 2500000,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    playerSelectionMode: "sequential",
    status: "setup",
  }).returning();

  console.log(`  Tournament created: id=${t.id}`);

  // Insert categories
  const catRows = await db.insert(categoriesTable).values(
    (["Platinum", "Gold", "Silver", "Emerging"] as const).map(tier => ({
      tournamentId: t.id,
      name: tier,
      minBid: CATEGORY_CONFIG[tier].minBid,
      colorCode: CATEGORY_CONFIG[tier].colorCode,
      sortOrder: CATEGORY_CONFIG[tier].sortOrder,
    }))
  ).returning();
  const catMap: Record<string, number> = {};
  for (const c of catRows) catMap[c.name] = c.id;
  console.log(`  ${catRows.length} categories created`);

  // Insert teams
  const teamRows = await db.insert(teamsTable).values(
    IPL_TEAMS.map((team, i) => ({
      tournamentId: t.id,
      name: team.name,
      shortCode: team.shortCode,
      ownerName: team.ownerName,
      ownerMobile: `9876543${String(210 + i).padStart(3, "0")}`,
      color: team.color,
      logoUrl: avatar(team.shortCode, team.bg),
      purse: 10000000,
    }))
  ).returning();
  console.log(`  ${teamRows.length} teams created`);

  // Insert players
  const playerRows = await db.insert(playersTable).values(
    IPL_PLAYERS.map((p, i) => ({
      tournamentId: t.id,
      serialNo: i + 1,
      categoryId: catMap[p.tier],
      name: p.name,
      city: p.city,
      role: p.role,
      battingStyle: p.batting,
      bowlingStyle: p.bowling ?? null,
      age: p.age,
      photoUrl: avatar(p.name, "1E40AF"),
      basePrice: CATEGORY_CONFIG[p.tier].minBid,
      status: "available",
    }))
  ).returning();
  console.log(`  ${playerRows.length} players created`);

  return t.id;
}

async function seedTournament2() {
  console.log("Creating Tournament 2: BidWar Mega Auction 2025...");

  const [t] = await db.insert(tournamentsTable).values({
    name: "BidWar Mega Auction 2025",
    sport: "cricket",
    venue: "BidWar Arena, Bengaluru",
    auctionDate: "2025-04-20",
    organizerName: "BidWar Sports Pvt Ltd",
    organizerMobile: "9876543210",
    organizerEmail: "admin@bidwar.in",
    logoUrl: avatar("BMA", "7C3AED"),
    sponsorLogos: MEGA_SPONSORS,
    basePurse: 8000000,
    minBid: 100000,
    bidIncrement: 250000,
    bidTiers: MEGA_BID_TIERS,
    bidTier1UpTo: 3000000,
    bidTier1Increment: 250000,
    bidTier2UpTo: 6000000,
    bidTier2Increment: 500000,
    bidTier3Increment: 1000000,
    timerSeconds: 25,
    bidTimerSeconds: 12,
    playerSelectionMode: "sequential",
    status: "setup",
  }).returning();

  console.log(`  Tournament created: id=${t.id}`);

  // Insert categories
  const catRows = await db.insert(categoriesTable).values(
    (["Platinum", "Gold", "Silver", "Emerging"] as const).map(tier => ({
      tournamentId: t.id,
      name: tier,
      minBid: CATEGORY_CONFIG[tier].minBid,
      colorCode: CATEGORY_CONFIG[tier].colorCode,
      sortOrder: CATEGORY_CONFIG[tier].sortOrder,
    }))
  ).returning();
  const catMap: Record<string, number> = {};
  for (const c of catRows) catMap[c.name] = c.id;
  console.log(`  ${catRows.length} categories created`);

  // Insert teams
  const teamRows = await db.insert(teamsTable).values(
    MEGA_TEAMS.map((team, i) => ({
      tournamentId: t.id,
      name: team.name,
      shortCode: team.shortCode,
      ownerName: team.ownerName,
      ownerMobile: `9876500${String(100 + i).padStart(3, "0")}`,
      color: team.color,
      logoUrl: avatar(team.shortCode, team.bg),
      purse: 8000000,
    }))
  ).returning();
  console.log(`  ${teamRows.length} teams created`);

  // Insert players
  const playerRows = await db.insert(playersTable).values(
    MEGA_PLAYERS.map((p, i) => ({
      tournamentId: t.id,
      serialNo: i + 1,
      categoryId: catMap[p.tier],
      name: p.name,
      city: p.city,
      role: p.role,
      battingStyle: p.batting,
      bowlingStyle: p.bowling ?? null,
      age: p.age,
      photoUrl: avatar(p.name, "7C3AED"),
      basePrice: CATEGORY_CONFIG[p.tier].minBid,
      status: "available",
    }))
  ).returning();
  console.log(`  ${playerRows.length} players created`);

  return t.id;
}

async function main() {
  console.log("=== BidWar Demo Seed Script ===");
  try {
    const t1id = await seedTournament1();
    const t2id = await seedTournament2();
    console.log(`\nDone! Tournament IDs: ${t1id}, ${t2id}`);
    console.log("Both tournaments are visible on the Dashboard.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
