/**
 * One-time demo seed endpoint — creates two IPL/Ranji-style tournaments
 * with teams, categories, and players in the production database.
 * Protected by the ADMIN_PASSWORD environment variable via X-Seed-Key header.
 * Safe to call multiple times — idempotent check on tournament name.
 */
import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// ─── Data ──────────────────────────────────────────────────────────────────────

const IPL_TEAMS = [
  { name: "Mumbai Indians", short: "MI", owner: "Nita Ambani", color: "#004BA0", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/c/cd/Mumbai_Indians_Logo.svg/200px-Mumbai_Indians_Logo.svg.png" },
  { name: "Chennai Super Kings", short: "CSK", owner: "N Srinivasan", color: "#F9CD05", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2b/Chennai_Super_Kings_Logo.svg/200px-Chennai_Super_Kings_Logo.svg.png" },
  { name: "Royal Challengers Bengaluru", short: "RCB", owner: "United Spirits", color: "#D2181E", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/Royal_Challengers_Bangalore_2020.svg/200px-Royal_Challengers_Bangalore_2020.svg.png" },
  { name: "Delhi Capitals", short: "DC", owner: "JSW Sports", color: "#00368D", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/Delhi_Capitals_Logo.svg/200px-Delhi_Capitals_Logo.svg.png" },
  { name: "Kolkata Knight Riders", short: "KKR", owner: "Shah Rukh Khan", color: "#3A225D", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/4/4c/Kolkata_Knight_Riders_Logo.png/200px-Kolkata_Knight_Riders_Logo.png" },
  { name: "Punjab Kings", short: "PBKS", owner: "Preity Zinta", color: "#DD1F2D", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a1/Punjab_Kings_Logo_2021.svg/200px-Punjab_Kings_Logo_2021.svg.png" },
  { name: "Rajasthan Royals", short: "RR", owner: "Manoj Badale", color: "#EA1A8E", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/6/60/Rajasthan_Royals_Logo.svg/200px-Rajasthan_Royals_Logo.svg.png" },
  { name: "Sunrisers Hyderabad", short: "SRH", owner: "Sun TV Network", color: "#FF6D00", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/8/81/Sunrisers_Hyderabad.svg/200px-Sunrisers_Hyderabad.svg.png" },
  { name: "Gujarat Titans", short: "GT", owner: "CVC Capital", color: "#1C4374", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/0/09/Gujarat_Titans_Logo.svg/200px-Gujarat_Titans_Logo.svg.png" },
  { name: "Lucknow Super Giants", short: "LSG", owner: "RPSG Group", color: "#A72056", logo: "https://upload.wikimedia.org/wikipedia/en/thumb/a/a9/Lucknow_Super_Giants_Logo.svg/200px-Lucknow_Super_Giants_Logo.svg.png" },
  { name: "Pune Warriors India", short: "PWI", owner: "Subrata Roy", color: "#1C3A6C", logo: "https://ui-avatars.com/api/?name=PWI&background=1C3A6C&color=fff&size=200&bold=true&font-size=0.5" },
  { name: "Kochi Tuskers Kerala", short: "KTK", owner: "Vivek Venugopal", color: "#1B5E20", logo: "https://ui-avatars.com/api/?name=KTK&background=1B5E20&color=fff&size=200&bold=true&font-size=0.5" },
  { name: "Rising Pune Supergiants", short: "RPS", owner: "RP-Sanjiv Goenka", color: "#6A1B9A", logo: "https://ui-avatars.com/api/?name=RPS&background=6A1B9A&color=fff&size=200&bold=true&font-size=0.5" },
  { name: "Deccan Chargers", short: "DC2", owner: "Deccan Chronicle", color: "#E65100", logo: "https://ui-avatars.com/api/?name=DC&background=E65100&color=fff&size=200&bold=true&font-size=0.5" },
  { name: "Hyderabad Hawks", short: "HH", owner: "Ravi Reddy", color: "#C62828", logo: "https://ui-avatars.com/api/?name=HH&background=C62828&color=fff&size=200&bold=true&font-size=0.5" },
];

const RANJI_TEAMS = [
  { name: "Mumbai Challengers", short: "MUM", owner: "Sachin Trust", color: "#003F7F", logo: "https://ui-avatars.com/api/?name=MUM&background=003F7F&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Karnataka Warriors", short: "KAR", owner: "Karnataka CA", color: "#B71C1C", logo: "https://ui-avatars.com/api/?name=KAR&background=B71C1C&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Delhi Dominators", short: "DEL", owner: "DDCA", color: "#1A237E", logo: "https://ui-avatars.com/api/?name=DEL&background=1A237E&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Tamil Nadu Kings", short: "TNK", owner: "TNCA Board", color: "#F9A825", logo: "https://ui-avatars.com/api/?name=TNK&background=F9A825&color=000&size=200&bold=true&font-size=0.4" },
  { name: "Punjab Lions", short: "PUN", owner: "PCA Trust", color: "#2E7D32", logo: "https://ui-avatars.com/api/?name=PUN&background=2E7D32&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Bengal Tigers", short: "BEN", owner: "CAB Board", color: "#880E4F", logo: "https://ui-avatars.com/api/?name=BEN&background=880E4F&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Uttar Pradesh XI", short: "UPX", owner: "UPCA Foundation", color: "#BF360C", logo: "https://ui-avatars.com/api/?name=UPX&background=BF360C&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Maharashtra Royals", short: "MAH", owner: "MCA Trust", color: "#4A148C", logo: "https://ui-avatars.com/api/?name=MAH&background=4A148C&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Rajasthan Stallions", short: "RAJ", owner: "RCA Board", color: "#E65100", logo: "https://ui-avatars.com/api/?name=RAJ&background=E65100&color=fff&size=200&bold=true&font-size=0.4" },
  { name: "Gujarat Giants", short: "GUJ", owner: "GCA Foundation", color: "#006064", logo: "https://ui-avatars.com/api/?name=GUJ&background=006064&color=fff&size=200&bold=true&font-size=0.4" },
];

function playerPhoto(name: string, bg = "1a237e"): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=300&bold=true&rounded=true`;
}

// ─── Player pools ─────────────────────────────────────────────────────────────

type PlayerDef = { name: string; role: string; city: string; age: number; bat: string; bowl: string; achievements?: string; photo?: string };

const PLATINUM_PLAYERS: PlayerDef[] = [
  { name: "Virat Kohli", role: "Batsman", city: "Delhi", age: 35, bat: "Right-hand", bowl: "Right-arm medium", achievements: "100 International centuries, Former India captain", photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/Virat_Kohli_in_2024.jpg/240px-Virat_Kohli_in_2024.jpg" },
  { name: "Rohit Sharma", role: "Batsman", city: "Mumbai", age: 37, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "Highest T20I score 118*, India captain", photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Rohit_Sharma_-_2023.jpg/240px-Rohit_Sharma_-_2023.jpg" },
  { name: "MS Dhoni", role: "WK Batsman", city: "Ranchi", age: 43, bat: "Right-hand", bowl: "Right-arm medium", achievements: "World Cup 2007, 2011, 2013 winner, IPL legend", photo: playerPhoto("MS Dhoni", "212121") },
  { name: "Jasprit Bumrah", role: "Fast Bowler", city: "Ahmedabad", age: 30, bat: "Right-hand", bowl: "Right-arm fast", achievements: "ICC No.1 Test bowler, Wisden Cricketer of the Year 2023", photo: playerPhoto("Jasprit Bumrah", "0D47A1") },
  { name: "KL Rahul", role: "WK Batsman", city: "Bengaluru", age: 32, bat: "Right-hand", bowl: "Right-arm medium", achievements: "MOTM ICC T20 WC 2021, IPL orange cap 2020", photo: playerPhoto("KL Rahul", "880E4F") },
  { name: "Hardik Pandya", role: "All-Rounder", city: "Vadodara", age: 31, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "ICC T20 WC 2024 final over hero, MI captain", photo: playerPhoto("Hardik Pandya", "B71C1C") },
  { name: "Suryakumar Yadav", role: "Batsman", city: "Mumbai", age: 34, bat: "Right-hand", bowl: "Right-arm medium", achievements: "ICC T20I Batter No.1 ranked, 360-degree batter", photo: playerPhoto("Suryakumar Yadav", "1B5E20") },
  { name: "Shubman Gill", role: "Batsman", city: "Fazilka", age: 25, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "ODI double century, GT captain", photo: playerPhoto("Shubman Gill", "004D40") },
  { name: "Ravindra Jadeja", role: "All-Rounder", city: "Rajkot", age: 35, bat: "Left-hand", bowl: "Left-arm orthodox", achievements: "ICC No.1 Test all-rounder, 2000+ int. wickets", photo: playerPhoto("Ravindra Jadeja", "F57F17") },
  { name: "Rishabh Pant", role: "WK Batsman", city: "Roorkee", age: 27, bat: "Left-hand", bowl: "Right-arm medium", achievements: "Best overseas keeper-batsman record in Tests", photo: playerPhoto("Rishabh Pant", "006064") },
  { name: "Andre Russell", role: "All-Rounder", city: "Kingston", age: 36, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "KKR IPL champion, Powerhouse T20 hitter", photo: playerPhoto("Andre Russell", "3A225D") },
  { name: "Rashid Khan", role: "Leg Spinner", city: "Nangarhar", age: 26, bat: "Right-hand", bowl: "Right-arm leg-break", achievements: "Afghanistan captain, IPL top wicket-taker", photo: playerPhoto("Rashid Khan", "33691E") },
  { name: "David Warner", role: "Batsman", city: "Sydney", age: 37, bat: "Left-hand", bowl: "Right-arm medium", achievements: "SRH IPL champion, 3x IPL orange cap winner", photo: playerPhoto("David Warner", "E65100") },
  { name: "Jos Buttler", role: "WK Batsman", city: "Taunton", age: 34, bat: "Right-hand", bowl: "Right-arm medium", achievements: "RR IPL champion 2022, England T20 WC captain", photo: playerPhoto("Jos Buttler", "EA1A8E") },
  { name: "Glenn Maxwell", role: "All-Rounder", city: "Melbourne", age: 36, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "ODI double century 201*, RCB all-time top scorer", photo: playerPhoto("Glenn Maxwell", "D2181E") },
];

const GOLD_NAMES: PlayerDef[] = [
  { name: "Yuzvendra Chahal", role: "Leg Spinner", city: "Haryana", age: 34, bat: "Right-hand", bowl: "Right-arm leg-break", achievements: "India's leading T20I wicket-taker" },
  { name: "Mohammed Shami", role: "Fast Bowler", city: "Sahaspur", age: 34, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "WC 2023 top wicket-taker" },
  { name: "Axar Patel", role: "All-Rounder", city: "Anand", age: 30, bat: "Left-hand", bowl: "Left-arm orthodox", achievements: "Test match hero vs England 2021" },
  { name: "Shreyas Iyer", role: "Batsman", city: "Mumbai", age: 30, bat: "Right-hand", bowl: "Right-arm medium", achievements: "KKR IPL 2024 captain & winner" },
  { name: "Ishan Kishan", role: "WK Batsman", city: "Patna", age: 26, bat: "Left-hand", bowl: "Right-arm medium", achievements: "Fastest ODI double century 210*" },
  { name: "Trent Boult", role: "Fast Bowler", city: "Rotorua", age: 35, bat: "Right-hand", bowl: "Left-arm fast medium", achievements: "ICC World No.1 ranked ODI bowler (2022)" },
  { name: "Pat Cummins", role: "Fast Bowler", city: "Sydney", age: 31, bat: "Right-hand", bowl: "Right-arm fast", achievements: "Australia Test & WC captain, ICC No.1" },
  { name: "Kane Williamson", role: "Batsman", city: "Tauranga", age: 34, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "New Zealand captain, SRH IPL captain" },
  { name: "Quinton de Kock", role: "WK Batsman", city: "Johannesburg", age: 32, bat: "Left-hand", bowl: "Right-arm medium", achievements: "SA & LSG opener, T20 WC 2024 finalist" },
  { name: "Sunil Narine", role: "All-Rounder", city: "Port of Spain", age: 36, bat: "Left-hand", bowl: "Right-arm off-break", achievements: "KKR legend, multiple IPL champion" },
  { name: "Nicholas Pooran", role: "WK Batsman", city: "Couva", age: 29, bat: "Left-hand", bowl: "Right-arm medium", achievements: "WI captain, T20 big hitter" },
  { name: "Faf du Plessis", role: "Batsman", city: "Pretoria", age: 40, bat: "Right-hand", bowl: "Right-arm medium", achievements: "RCB captain, Former SA captain" },
  { name: "Mitchell Starc", role: "Fast Bowler", city: "Sydney", age: 34, bat: "Left-hand", bowl: "Left-arm fast", achievements: "WC 2023 purple cap, IPL $24.75Cr record buy" },
  { name: "Jason Roy", role: "Batsman", city: "Durban", age: 34, bat: "Right-hand", bowl: "Right-arm medium", achievements: "England WC 2019 hero, T20 explosive opener" },
  { name: "Kieron Pollard", role: "All-Rounder", city: "Tacarigua", age: 37, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "MI IPL champion 5 times" },
  { name: "Chris Gayle", role: "Batsman", city: "Kingston", age: 45, bat: "Left-hand", bowl: "Right-arm off-break", achievements: "IPL 175*, highest T20 score" },
  { name: "AB de Villiers", role: "Batsman", city: "Warmbaths", age: 41, bat: "Right-hand", bowl: "Right-arm medium", achievements: "Mr 360, RCB all-time great" },
  { name: "Eoin Morgan", role: "Batsman", city: "Dublin", age: 38, bat: "Left-hand", bowl: "Right-arm medium", achievements: "England WC 2019 winning captain" },
  { name: "R Ashwin", role: "Off Spinner", city: "Chennai", age: 38, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "ICC Cricketer of the Year 2016, 500+ Test wickets" },
  { name: "Mohammed Siraj", role: "Fast Bowler", city: "Hyderabad", age: 30, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "RCB & India new-ball spearhead" },
  { name: "Deepak Chahar", role: "Fast Bowler", city: "Agra", age: 32, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "CSK ace, death-over specialist" },
  { name: "Kuldeep Yadav", role: "Leg Spinner", city: "Kanpur", age: 29, bat: "Right-hand", bowl: "Left-arm wrist-spin", achievements: "China-man bowler, DC wicket-taker" },
  { name: "Bhuvneshwar Kumar", role: "Fast Bowler", city: "Meerut", age: 34, bat: "Right-hand", bowl: "Right-arm fast medium", achievements: "Swing king, SRH leading wicket-taker" },
  { name: "Washington Sundar", role: "All-Rounder", city: "Chennai", age: 25, bat: "Right-hand", bowl: "Right-arm off-break", achievements: "Match-winner vs England Test debut" },
  { name: "Shivam Dube", role: "All-Rounder", city: "Mumbai", age: 31, bat: "Left-hand", bowl: "Right-arm medium", achievements: "CSK power-hitter, T20 WC 2024 semifinal hero" },
  { name: "Tilak Varma", role: "Batsman", city: "Hyderabad", age: 22, bat: "Left-hand", bowl: "Right-arm medium", achievements: "MI young gun, back-to-back T20I fifties" },
  { name: "Arshdeep Singh", role: "Fast Bowler", city: "Fatehgarh Sahib", age: 25, bat: "Left-hand", bowl: "Left-arm fast medium", achievements: "India T20I new-ball bowler, PBKS ace" },
  { name: "Rinku Singh", role: "Batsman", city: "Aligarh", age: 27, bat: "Left-hand", bowl: "Right-arm medium", achievements: "5 sixes off last over, KKR fan favourite" },
  { name: "Liam Livingstone", role: "All-Rounder", city: "Barrow-in-Furness", age: 31, bat: "Right-hand", bowl: "Right-arm leg-break", achievements: "PBKS big-hitter, England top T20 scorer" },
  { name: "Sam Curran", role: "All-Rounder", city: "Northampton", age: 26, bat: "Left-hand", bowl: "Left-arm fast medium", achievements: "IPL $18.5Cr record (2023), PBKS captain" },
];

const SILVER_NAMES = [
  "Prithvi Shaw", "Ruturaj Gaikwad", "Mayank Agarwal", "Devdutt Padikkal", "Sanju Samson",
  "Manish Pandey", "Ambati Rayudu", "Kedar Jadhav", "Robin Uthappa", "Krunal Pandya",
  "Hardus Viljoen", "Chris Jordan", "Lendl Simmons", "Evin Lewis", "Colin Munro",
  "Dasun Shanaka", "Wanindu Hasaranga", "Thisara Perera", "Kusal Mendis", "Pathum Nissanka",
  "Babar Azam", "Shaheen Afridi", "Shadab Khan", "Fakhar Zaman", "Mohammad Rizwan",
  "Sarfaraz Ahmed", "Asif Ali", "Iftikhar Ahmed", "Hasan Ali", "Naseem Shah",
  "Adam Zampa", "Marcus Stoinis", "Aaron Finch", "D'Arcy Short", "Matthew Wade",
  "Heinrich Klaasen", "Aiden Markram", "David Miller", "Rassie van der Dussen", "Lungi Ngidi",
  "Kagiso Rabada", "Anrich Nortje", "Dwaine Pretorius", "Marco Jansen", "Gerald Coetzee",
  "Lokesh Rahul", "Piyush Chawla", "Imran Tahir", "Amit Mishra", "Harbhajan Singh",
  "Zaheer Khan", "RP Singh", "Munaf Patel", "Sreesanth", "Vinay Kumar",
  "Pragyan Ojha", "Ravichandran Ashwin", "Stuart Broad", "James Anderson", "Moeen Ali",
  "Ben Foakes", "Jonny Bairstow", "Alex Hales", "Dawid Malan", "Mark Wood",
];

const EMERGING_NAMES = [
  "Yashasvi Jaiswal", "Ruturaj Gaikwad", "Prabhsimran Singh", "Tushar Deshpande", "Mukesh Kumar",
  "Akash Deep", "Yash Dayal", "Rishi Dhawan", "Saurabh Kumar", "Varun Chakravarthy",
  "Manav Suthar", "Vidwath Kaverappa", "Kumar Kushagra", "Dhruv Jurel", "Harshit Rana",
  "Khaleel Ahmed", "Shardul Thakur", "Jayant Yadav", "Umesh Yadav", "Siddharth Kaul",
  "Anmolpreet Singh", "Sarfaraz Khan", "Rajat Patidar", "Dinesh Karthik", "Wriddhiman Saha",
  "N Jagadeesan", "Riyan Parag", "Shahbaz Ahmed", "Pawan Negi", "Himanshu Sharma",
  "Vijay Hazare", "Ravi Bishnoi", "Noor Ahmad", "Fazalhaq Farooqi", "Azmatullah Omarzai",
  "Rahmanullah Gurbaz", "Ibrahim Zadran", "Hashmatullah Shahidi", "Mujeeb ur Rahman", "Karim Janat",
  "Avesh Khan", "Naveen ul Haq", "Matheesha Pathirana", "Dilshan Madushanka", "Nuwanidu Fernando",
];

const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad",
  "Pune", "Jaipur", "Lucknow", "Chandigarh", "Indore", "Nagpur", "Surat", "Vadodara",
];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] as T; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── Seed endpoint ─────────────────────────────────────────────────────────────

router.post("/seed/demo", async (req, res) => {
  // Auth check
  const key = req.headers["x-seed-key"];
  const adminPass = process.env.ADMIN_PASSWORD;
  if (!adminPass || key !== adminPass) {
    res.status(401).json({ error: "Unauthorized — wrong or missing X-Seed-Key" });
    return;
  }

  // Idempotency: bail if already seeded
  const existing = await pool.query(
    `SELECT id FROM tournaments WHERE name = $1 LIMIT 1`,
    ["BidWar Premier League 2025"],
  );
  if ((existing.rowCount ?? 0) > 0) {
    res.json({ message: "Already seeded", tournamentId: existing.rows[0].id });
    return;
  }

  // ── Organizer (should already exist; upsert by mobile) ──────────────────────
  const orgRes = await pool.query(`
    INSERT INTO organizers (name, mobile, license_status, max_tournaments, notes)
    VALUES ($1, $2, 'pending', 5, 'Demo organizer — seeded by BidWar admin')
    ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name, max_tournaments = 5
    RETURNING id
  `, ["Tushar Saraswat", "7054007733"]);
  const organizerId: number = orgRes.rows[0].id;

  const results: Record<string, unknown> = { organizerId };

  // ══════════════════════════════════════════════════════════════════════════════
  // TOURNAMENT 1 — BidWar Premier League 2025 (IPL-style, 15 teams, 150 players)
  // ══════════════════════════════════════════════════════════════════════════════

  const t1 = await pool.query(`
    INSERT INTO tournaments (
      organizer_id, name, sport, venue, auction_date, organizer_name, organizer_mobile,
      logo_url, base_purse, min_bid, bid_increment,
      bid_tier1_up_to, bid_tier1_increment, bid_tier2_up_to, bid_tier2_increment, bid_tier3_increment,
      timer_seconds, bid_timer_seconds, player_selection_mode,
      status, license_status
    ) VALUES (
      $1, 'BidWar Premier League 2025', 'cricket', 'BCCI HQ, Mumbai', '2025-11-25',
      'Tushar Saraswat', '7054007733',
      'https://ui-avatars.com/api/?name=BPL&background=004BA0&color=fff&size=400&bold=true&font-size=0.4',
      100000000, 2000000, 500000,
      5000000, 500000, 10000000, 1000000, 2000000,
      30, 15, 'sequential',
      'setup', 'trial'
    ) RETURNING id
  `, [organizerId]);
  const t1id: number = t1.rows[0].id;
  results.tournament1Id = t1id;

  // Categories T1
  const t1cats = await pool.query(`
    INSERT INTO categories (tournament_id, name, min_bid, bid_increment, sort_order, color_code)
    VALUES
      ($1, 'Platinum', 20000000, 2000000, 1, '#E5C100'),
      ($1, 'Gold',     5000000,  500000,  2, '#FFD700'),
      ($1, 'Silver',   2000000,  200000,  3, '#C0C0C0'),
      ($1, 'Emerging', 1000000,  100000,  4, '#4CAF50')
    RETURNING id, name
  `, [t1id]);
  const t1catMap: Record<string, number> = {};
  for (const c of t1cats.rows) t1catMap[c.name] = c.id;

  // Teams T1
  for (const team of IPL_TEAMS) {
    await pool.query(`
      INSERT INTO teams (tournament_id, name, short_code, owner_name, color, logo_url, purse, purse_used, is_bidding_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, 100000000, 0, true)
    `, [t1id, team.name, team.short, team.owner, team.color, team.logo]);
  }
  results.t1Teams = 15;

  // Players T1 — 15 Platinum
  for (const p of PLATINUM_PLAYERS) {
    const bg = "1a237e";
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status, achievements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 20000000, 'available', $10)
    `, [t1id, t1catMap.Platinum, p.name, p.city, p.role, p.bat, p.bowl, p.age, p.photo ?? playerPhoto(p.name, bg), p.achievements ?? null]);
  }

  // Players T1 — 35 Gold
  for (let i = 0; i < 35; i++) {
    const p = GOLD_NAMES[i % GOLD_NAMES.length]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status, achievements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 5000000, 'available', $10)
    `, [t1id, t1catMap.Gold, p.name, p.city, p.role, p.bat, p.bowl, p.age, playerPhoto(p.name, "0D47A1"), p.achievements ?? null]);
  }

  // Players T1 — 60 Silver
  for (let i = 0; i < 60; i++) {
    const name = SILVER_NAMES[i % SILVER_NAMES.length]!;
    const city = CITIES[i % CITIES.length]!;
    const roles = ["Batsman", "All-Rounder", "Fast Bowler", "Spinner", "WK Batsman"];
    const role = roles[i % roles.length]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status)
      VALUES ($1, $2, $3, $4, $5, 'Right-hand', 'Right-arm medium', $6, $7, 2000000, 'available')
    `, [t1id, t1catMap.Silver, name, city, role, randomInt(22, 36), playerPhoto(name, "1B5E20")]);
  }

  // Players T1 — 40 Emerging
  for (let i = 0; i < 40; i++) {
    const name = EMERGING_NAMES[i % EMERGING_NAMES.length]!;
    const city = CITIES[i % CITIES.length]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status)
      VALUES ($1, $2, $3, $4, 'Batsman', 'Right-hand', 'Right-arm medium', $5, $6, 1000000, 'available')
    `, [t1id, t1catMap.Emerging, name, city, randomInt(18, 25), playerPhoto(name, "4A148C")]);
  }
  results.t1Players = 150;

  // ══════════════════════════════════════════════════════════════════════════════
  // TOURNAMENT 2 — Ranji Trophy Selection League 2025 (10 teams, 80 players)
  // ══════════════════════════════════════════════════════════════════════════════

  const t2 = await pool.query(`
    INSERT INTO tournaments (
      organizer_id, name, sport, venue, auction_date, organizer_name, organizer_mobile,
      logo_url, base_purse, min_bid, bid_increment,
      bid_tier1_up_to, bid_tier1_increment, bid_tier2_up_to, bid_tier2_increment, bid_tier3_increment,
      timer_seconds, bid_timer_seconds, player_selection_mode,
      status, license_status
    ) VALUES (
      $1, 'Ranji Trophy Selection League 2025', 'cricket', 'Wankhede Stadium, Mumbai', '2025-12-10',
      'Tushar Saraswat', '7054007733',
      'https://ui-avatars.com/api/?name=RSL&background=B71C1C&color=fff&size=400&bold=true&font-size=0.4',
      50000000, 1000000, 200000,
      3000000, 300000, 6000000, 600000, 1000000,
      30, 15, 'random',
      'setup', 'trial'
    ) RETURNING id
  `, [organizerId]);
  const t2id: number = t2.rows[0].id;
  results.tournament2Id = t2id;

  // Categories T2
  const t2cats = await pool.query(`
    INSERT INTO categories (tournament_id, name, min_bid, bid_increment, sort_order, color_code)
    VALUES
      ($1, 'Platinum', 10000000, 1000000, 1, '#E5C100'),
      ($1, 'Gold',     3000000,  300000,  2, '#FFD700'),
      ($1, 'Silver',   1500000,  150000,  3, '#C0C0C0'),
      ($1, 'Emerging',  500000,   50000,  4, '#4CAF50')
    RETURNING id, name
  `, [t2id]);
  const t2catMap: Record<string, number> = {};
  for (const c of t2cats.rows) t2catMap[c.name] = c.id;

  // Teams T2
  for (const team of RANJI_TEAMS) {
    await pool.query(`
      INSERT INTO teams (tournament_id, name, short_code, owner_name, color, logo_url, purse, purse_used, is_bidding_enabled)
      VALUES ($1, $2, $3, $4, $5, $6, 50000000, 0, true)
    `, [t2id, team.name, team.short, team.owner, team.color, team.logo]);
  }
  results.t2Teams = 10;

  // Players T2 — 8 Platinum
  for (let i = 0; i < 8; i++) {
    const p = PLATINUM_PLAYERS[i]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status, achievements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 10000000, 'available', $10)
    `, [t2id, t2catMap.Platinum, p.name, p.city, p.role, p.bat, p.bowl, p.age, p.photo ?? playerPhoto(p.name, "1a237e"), p.achievements ?? null]);
  }

  // Players T2 — 22 Gold
  for (let i = 0; i < 22; i++) {
    const p = GOLD_NAMES[i % GOLD_NAMES.length]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status, achievements)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 3000000, 'available', $10)
    `, [t2id, t2catMap.Gold, p.name, p.city, p.role, p.bat, p.bowl, p.age, playerPhoto(p.name, "0D47A1"), p.achievements ?? null]);
  }

  // Players T2 — 30 Silver
  for (let i = 0; i < 30; i++) {
    const name = SILVER_NAMES[(i + 10) % SILVER_NAMES.length]!;
    const city = CITIES[i % CITIES.length]!;
    const roles = ["Batsman", "All-Rounder", "Fast Bowler", "Spinner", "WK Batsman"];
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status)
      VALUES ($1, $2, $3, $4, $5, 'Right-hand', 'Right-arm medium', $6, $7, 1500000, 'available')
    `, [t2id, t2catMap.Silver, name, city, roles[i % roles.length], randomInt(22, 36), playerPhoto(name, "004D40")]);
  }

  // Players T2 — 20 Emerging
  for (let i = 0; i < 20; i++) {
    const name = EMERGING_NAMES[(i + 5) % EMERGING_NAMES.length]!;
    const city = CITIES[i % CITIES.length]!;
    await pool.query(`
      INSERT INTO players (tournament_id, category_id, name, city, role, batting_style, bowling_style, age, photo_url, base_price, status)
      VALUES ($1, $2, $3, $4, 'Batsman', 'Right-hand', 'Right-arm medium', $5, $6, 500000, 'available')
    `, [t2id, t2catMap.Emerging, name, city, randomInt(18, 24), playerPhoto(name, "880E4F")]);
  }
  results.t2Players = 80;

  // ── Link tournaments to organizer account ───────────────────────────────────
  await pool.query(
    `UPDATE tournaments SET organizer_id = $1 WHERE id IN ($2, $3)`,
    [organizerId, t1id, t2id],
  );

  res.json({
    success: true,
    message: "Demo data seeded successfully",
    ...results,
    note: "Both tournaments are in trial mode — first 10 players can be auctioned. Upgrade license to 'live' in Super Admin to unlock all players.",
  });
});

export default router;
