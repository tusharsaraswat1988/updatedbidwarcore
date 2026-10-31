import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";

const { Client } = pg;

function resolveDatabaseUrl() {
  const args = process.argv.slice(2);
  const isProd =
    args.includes("--prod") ||
    args.includes("--target=prod") ||
    process.env.TARGET_ENV === "production" ||
    process.env.NODE_ENV === "production";

  if (isProd) {
    const prodFiles = [".env.production.env", ".env.production"];
    for (const file of prodFiles) {
      if (fs.existsSync(file)) {
        const envConfig = dotenv.parse(fs.readFileSync(file));
        if (envConfig.DATABASE_URL) {
          return { url: envConfig.DATABASE_URL, target: `PROD (${file})` };
        }
      }
    }
  }

  dotenv.config();
  if (process.env.DATABASE_URL) {
    return { url: process.env.DATABASE_URL, target: isProd ? "PROD (process.env)" : "DEV (.env)" };
  }

  throw new Error("DATABASE_URL is missing in environment");
}

const SPORTS_DATA = [
  // ─── 1. KABADDI ────────────────────────────────────────────────────────────
  {
    name: "Kabaddi",
    slug: "kabaddi",
    roles: [
      {
        roleName: "Raider",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Raiding Side",
            displayOrder: 0,
            optional: false,
            options: ["Right Raider", "Left Raider"],
          },
          {
            groupName: "Raiding Style / Skill",
            displayOrder: 1,
            optional: true,
            options: ["Running Hand Touch", "Toe Touch", "Dubki Specialist", "Bonus Specialist", "Jump / Escape"],
          },
          {
            groupName: "Playing Position",
            displayOrder: 2,
            optional: true,
            options: ["Lead Raider", "Secondary Raider", "Do-or-Die Specialist"],
          },
        ],
      },
      {
        roleName: "Defender",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Defending Position",
            displayOrder: 0,
            optional: false,
            options: ["Right Corner", "Left Corner", "Right Cover", "Left Cover"],
          },
          {
            groupName: "Tackling Style",
            displayOrder: 1,
            optional: true,
            options: ["Ankle Hold Specialist", "Thigh Hold / Knee Hold", "Dash / Body Block", "Back Hold / Chain Tackle"],
          },
        ],
      },
      {
        roleName: "All-Rounder",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Primary Specialization",
            displayOrder: 0,
            optional: false,
            options: ["Raiding All-Rounder", "Defending All-Rounder", "Balanced 50-50"],
          },
          {
            groupName: "Raiding Side",
            displayOrder: 1,
            optional: true,
            options: ["Right Raider", "Left Raider"],
          },
          {
            groupName: "Defending Position",
            displayOrder: 2,
            optional: true,
            options: ["Corner Defender", "Cover Defender", "In / Center Defender"],
          },
        ],
      },
    ],
  },

  // ─── 2. VOLLEYBALL ─────────────────────────────────────────────────────────
  {
    name: "Volleyball",
    slug: "volleyball",
    roles: [
      {
        roleName: "Setter",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Setting Style",
            displayOrder: 1,
            optional: true,
            options: ["Jump Setter", "Fast-Tempo Setter", "Traditional Setter"],
          },
        ],
      },
      {
        roleName: "Libero",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Speciality",
            displayOrder: 0,
            optional: true,
            options: ["Serve-Receive Specialist", "Digging Specialist", "All-Round Defensive Specialist"],
          },
        ],
      },
      {
        roleName: "Outside Hitter",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Attacking Style",
            displayOrder: 1,
            optional: true,
            options: ["Power Spiker", "Technical / Placement Hitter", "Pass-and-Hit Specialist"],
          },
        ],
      },
      {
        roleName: "Middle Blocker",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Blocking & Attacking Style",
            displayOrder: 1,
            optional: true,
            options: ["Quick Attacker", "Read Blocker", "Slide Specialist"],
          },
        ],
      },
      {
        roleName: "Opposite Hitter",
        displayOrder: 4,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Attacking Style",
            displayOrder: 1,
            optional: true,
            options: ["Heavy Spiker", "Backcourt Hitter (Pipe)", "Block-and-Attack Specialist"],
          },
        ],
      },
    ],
  },

  // ─── 3. BADMINTON ──────────────────────────────────────────────────────────
  {
    name: "Badminton",
    slug: "badminton",
    roles: [
      {
        roleName: "Singles Player",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Attacking / Smash", "Defensive / Retriever", "Deceptive / Net Play", "All-Round Balanced"],
          },
        ],
      },
      {
        roleName: "Doubles Player",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Court Preference",
            displayOrder: 1,
            optional: true,
            options: ["Front Court Specialist (Net)", "Back Court Specialist (Smash)", "All Court Player"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 2,
            optional: true,
            options: ["Attacking", "Defensive", "All Rounder"],
          },
        ],
      },
      {
        roleName: "Mixed Doubles",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Hand", "Left Hand"],
          },
          {
            groupName: "Court Role",
            displayOrder: 1,
            optional: true,
            options: ["Front Court Specialist (Net Control)", "Back Court Specialist (Power Attacker)", "All-Round Mixed Doubles"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 2,
            optional: true,
            options: ["Fast-Paced / Reflexes", "Power / Smashing", "Tactical Placement"],
          },
        ],
      },
    ],
  },

  // ─── 4. CHESS ──────────────────────────────────────────────────────────────
  {
    name: "Chess",
    slug: "chess",
    roles: [
      {
        roleName: "Board 1 (Top Board)",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Style",
            displayOrder: 0,
            optional: true,
            options: ["Tactical / Aggressive", "Positional / Strategic", "Universal / Solid", "Counter-Attacking"],
          },
          {
            groupName: "Preferred Opening (White)",
            displayOrder: 1,
            optional: true,
            options: ["1.e4 (King's Pawn)", "1.d4 (Queen's Pawn)", "1.c4 / 1.Nf3 (Flank System)", "Flexible / Universal"],
          },
          {
            groupName: "Rating Category",
            displayOrder: 2,
            optional: true,
            options: ["Unrated / Novice", "Club Player (< 1400)", "Intermediate (1400 - 1800)", "Advanced (1800 - 2100)", "Titled (2100+ / CM / FM / IM / GM)"],
          },
        ],
      },
      {
        roleName: "Board 2 (Senior Board)",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Style",
            displayOrder: 0,
            optional: true,
            options: ["Tactical / Aggressive", "Positional / Strategic", "Universal / Solid", "Counter-Attacking"],
          },
          {
            groupName: "Preferred Opening (White)",
            displayOrder: 1,
            optional: true,
            options: ["1.e4 (King's Pawn)", "1.d4 (Queen's Pawn)", "1.c4 / 1.Nf3 (Flank System)", "Flexible / Universal"],
          },
          {
            groupName: "Rating Category",
            displayOrder: 2,
            optional: true,
            options: ["Unrated / Novice", "Club Player (< 1400)", "Intermediate (1400 - 1800)", "Advanced (1800 - 2100)", "Titled (2100+ / CM / FM / IM / GM)"],
          },
        ],
      },
      {
        roleName: "Board 3 (Junior Board)",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Style",
            displayOrder: 0,
            optional: true,
            options: ["Tactical / Aggressive", "Positional / Strategic", "Universal / Solid", "Counter-Attacking"],
          },
          {
            groupName: "Preferred Opening (White)",
            displayOrder: 1,
            optional: true,
            options: ["1.e4 (King's Pawn)", "1.d4 (Queen's Pawn)", "1.c4 / 1.Nf3 (Flank System)", "Flexible / Universal"],
          },
          {
            groupName: "Rating Category",
            displayOrder: 2,
            optional: true,
            options: ["Unrated / Novice", "Club Player (< 1400)", "Intermediate (1400 - 1800)", "Advanced (1800 - 2100)", "Titled (2100+ / CM / FM / IM / GM)"],
          },
        ],
      },
      {
        roleName: "Board 4 (Women's Board)",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Style",
            displayOrder: 0,
            optional: true,
            options: ["Tactical / Aggressive", "Positional / Strategic", "Universal / Solid", "Counter-Attacking"],
          },
          {
            groupName: "Preferred Opening (White)",
            displayOrder: 1,
            optional: true,
            options: ["1.e4 (King's Pawn)", "1.d4 (Queen's Pawn)", "1.c4 / 1.Nf3 (Flank System)", "Flexible / Universal"],
          },
          {
            groupName: "Rating Category",
            displayOrder: 2,
            optional: true,
            options: ["Unrated / Novice", "Club Player (< 1400)", "Intermediate (1400 - 1800)", "Advanced (1800 - 2100)", "Titled (2100+ / CM / FM / IM / GM)"],
          },
        ],
      },
      {
        roleName: "Reserve / Open Board",
        displayOrder: 4,
        specGroups: [
          {
            groupName: "Playing Style",
            displayOrder: 0,
            optional: true,
            options: ["Tactical / Aggressive", "Positional / Strategic", "Universal / Solid", "Counter-Attacking"],
          },
          {
            groupName: "Preferred Opening (White)",
            displayOrder: 1,
            optional: true,
            options: ["1.e4 (King's Pawn)", "1.d4 (Queen's Pawn)", "1.c4 / 1.Nf3 (Flank System)", "Flexible / Universal"],
          },
          {
            groupName: "Rating Category",
            displayOrder: 2,
            optional: true,
            options: ["Unrated / Novice", "Club Player (< 1400)", "Intermediate (1400 - 1800)", "Advanced (1800 - 2100)", "Titled (2100+ / CM / FM / IM / GM)"],
          },
        ],
      },
    ],
  },

  // ─── 5. TENNIS ─────────────────────────────────────────────────────────────
  {
    name: "Tennis",
    slug: "tennis",
    roles: [
      {
        roleName: "Singles Player",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Backhand Style",
            displayOrder: 1,
            optional: true,
            options: ["Two-Handed Backhand", "One-Handed Backhand"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 2,
            optional: true,
            options: ["Aggressive Baseliner", "Serve and Volley", "Counterpuncher", "All-Court Player"],
          },
        ],
      },
      {
        roleName: "Doubles Specialist",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Preferred Court Side",
            displayOrder: 1,
            optional: true,
            options: ["Deuce Side", "Ad Side", "Both / Flexible"],
          },
          {
            groupName: "Doubles Speciality",
            displayOrder: 2,
            optional: true,
            options: ["Net Specialist / Volleys", "Baseline Returner / Groundstrokes", "Big Server", "All-Round Doubles Player"],
          },
        ],
      },
      {
        roleName: "Mixed Doubles Specialist",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Preferred Court Side",
            displayOrder: 1,
            optional: true,
            options: ["Deuce Side", "Ad Side", "Both / Flexible"],
          },
          {
            groupName: "Doubles Speciality",
            displayOrder: 2,
            optional: true,
            options: ["Net Specialist / Volleys", "Baseline Returner / Groundstrokes", "Big Server", "All-Round Doubles Player"],
          },
        ],
      },
      {
        roleName: "All-Court Player",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Backhand Style",
            displayOrder: 1,
            optional: true,
            options: ["Two-Handed Backhand", "One-Handed Backhand"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 2,
            optional: true,
            options: ["Aggressive Baseliner", "Serve and Volley", "Counterpuncher", "All-Court Player"],
          },
        ],
      },
    ],
  },

  // ─── 6. PICKLEBALL ─────────────────────────────────────────────────────────
  {
    name: "Pickleball",
    slug: "pickleball",
    roles: [
      {
        roleName: "Singles Player",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed", "Switch / Both Hands"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Dink / Soft Game Specialist", "Power Driver / Aggressive Attacker", "Third-Shot Drop Specialist", "All-Court Balanced"],
          },
          {
            groupName: "DUPR / Skill Rating",
            displayOrder: 2,
            optional: true,
            options: ["Beginner (< 3.0)", "Intermediate (3.0 - 4.0)", "Advanced (4.0 - 5.0)", "Pro (5.0+)"],
          },
        ],
      },
      {
        roleName: "Doubles Specialist",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed", "Switch / Both Hands"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Dink / Soft Game Specialist", "Power Driver / Aggressive Attacker", "Third-Shot Drop Specialist", "All-Court Balanced"],
          },
          {
            groupName: "DUPR / Skill Rating",
            displayOrder: 2,
            optional: true,
            options: ["Beginner (< 3.0)", "Intermediate (3.0 - 4.0)", "Advanced (4.0 - 5.0)", "Pro (5.0+)"],
          },
        ],
      },
      {
        roleName: "Mixed Doubles Specialist",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed", "Switch / Both Hands"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Dink / Soft Game Specialist", "Power Driver / Aggressive Attacker", "Third-Shot Drop Specialist", "All-Court Balanced"],
          },
          {
            groupName: "DUPR / Skill Rating",
            displayOrder: 2,
            optional: true,
            options: ["Beginner (< 3.0)", "Intermediate (3.0 - 4.0)", "Advanced (4.0 - 5.0)", "Pro (5.0+)"],
          },
        ],
      },
      {
        roleName: "Dinking / Defensive Specialist",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed", "Switch / Both Hands"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Dink / Soft Game Specialist", "Power Driver / Aggressive Attacker", "Third-Shot Drop Specialist", "All-Court Balanced"],
          },
          {
            groupName: "DUPR / Skill Rating",
            displayOrder: 2,
            optional: true,
            options: ["Beginner (< 3.0)", "Intermediate (3.0 - 4.0)", "Advanced (4.0 - 5.0)", "Pro (5.0+)"],
          },
        ],
      },
    ],
  },

  // ─── 7. TABLE TENNIS ───────────────────────────────────────────────────────
  {
    name: "Table Tennis",
    slug: "table_tennis",
    roles: [
      {
        roleName: "Offensive Attacker",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Grip Style",
            displayOrder: 1,
            optional: false,
            options: ["Shakehand Grip", "Penhold Grip"],
          },
          {
            groupName: "Rubber / Play Style",
            displayOrder: 2,
            optional: true,
            options: ["Inverted (Topspin / Loop)", "Short Pimples (Fast Block / Hit)", "Long Pimples (Spin Reversal / Chop)", "Anti-Spin / Defensive"],
          },
        ],
      },
      {
        roleName: "All-Round Player",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Grip Style",
            displayOrder: 1,
            optional: false,
            options: ["Shakehand Grip", "Penhold Grip"],
          },
          {
            groupName: "Rubber / Play Style",
            displayOrder: 2,
            optional: true,
            options: ["Inverted (Topspin / Loop)", "Short Pimples (Fast Block / Hit)", "Long Pimples (Spin Reversal / Chop)", "Anti-Spin / Defensive"],
          },
        ],
      },
      {
        roleName: "Defensive Chopper",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Grip Style",
            displayOrder: 1,
            optional: false,
            options: ["Shakehand Grip", "Penhold Grip"],
          },
          {
            groupName: "Rubber / Play Style",
            displayOrder: 2,
            optional: true,
            options: ["Inverted (Topspin / Loop)", "Short Pimples (Fast Block / Hit)", "Long Pimples (Spin Reversal / Chop)", "Anti-Spin / Defensive"],
          },
        ],
      },
      {
        roleName: "Doubles Specialist",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Grip Style",
            displayOrder: 1,
            optional: false,
            options: ["Shakehand Grip", "Penhold Grip"],
          },
          {
            groupName: "Rubber / Play Style",
            displayOrder: 2,
            optional: true,
            options: ["Inverted (Topspin / Loop)", "Short Pimples (Fast Block / Hit)", "Long Pimples (Spin Reversal / Chop)", "Anti-Spin / Defensive"],
          },
        ],
      },
    ],
  },

  // ─── 8. BASKETBALL ─────────────────────────────────────────────────────────
  {
    name: "Basketball",
    slug: "basketball",
    roles: [
      {
        roleName: "Point Guard (PG)",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Handed", "Left Handed", "Ambidextrous"],
          },
          {
            groupName: "Primary Style",
            displayOrder: 1,
            optional: true,
            options: ["Floor General / Playmaker", "Scoring Guard", "Lockdown Perimeter Defender"],
          },
        ],
      },
      {
        roleName: "Shooting Guard (SG)",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Handed", "Left Handed", "Ambidextrous"],
          },
          {
            groupName: "Primary Style",
            displayOrder: 1,
            optional: true,
            options: ["3PT Sharpshooter", "3-and-D Specialist", "Slashing Scorer"],
          },
        ],
      },
      {
        roleName: "Small Forward (SF)",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Handed", "Left Handed", "Ambidextrous"],
          },
          {
            groupName: "Primary Style",
            displayOrder: 1,
            optional: true,
            options: ["All-Around Wing", "Point Forward", "Slashing Scorer", "Lockdown Defender"],
          },
        ],
      },
      {
        roleName: "Power Forward (PF)",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Handed", "Left Handed", "Ambidextrous"],
          },
          {
            groupName: "Primary Style",
            displayOrder: 1,
            optional: true,
            options: ["Stretch Four (Shooting)", "Paint Scorer / Post-Up", "Rebounder / Rim Protector"],
          },
        ],
      },
      {
        roleName: "Center (C)",
        displayOrder: 4,
        specGroups: [
          {
            groupName: "Dominant Hand",
            displayOrder: 0,
            optional: true,
            options: ["Right Handed", "Left Handed", "Ambidextrous"],
          },
          {
            groupName: "Primary Style",
            displayOrder: 1,
            optional: true,
            options: ["Rim Protector / Shot Blocker", "Traditional Post Scorer", "Pick-and-Roll / Rim Runner"],
          },
        ],
      },
    ],
  },

  // ─── 9. HOCKEY ─────────────────────────────────────────────────────────────
  {
    name: "Hockey",
    slug: "hockey",
    roles: [
      {
        roleName: "Goalkeeper (GK)",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Goalkeeping Speciality",
            displayOrder: 0,
            optional: true,
            options: ["Penalty Corner Specialist", "Field Save Specialist", "Agile Sweeper Keeper"],
          },
        ],
      },
      {
        roleName: "Defender",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Position",
            displayOrder: 0,
            optional: true,
            options: ["Centre-Back (CB)", "Fullback (Left/Right)", "Sweeper"],
          },
          {
            groupName: "Special Skill",
            displayOrder: 1,
            optional: true,
            options: ["Drag Flicker (Penalty Corner)", "Slap Pass / Aerial Specialist", "Tackling Specialist"],
          },
        ],
      },
      {
        roleName: "Midfielder",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Position",
            displayOrder: 0,
            optional: true,
            options: ["Central Playmaker", "Defensive Half", "Attacking Midfielder"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Box-to-Box", "Playmaker / Distributor", "Counter-Attack Runner"],
          },
        ],
      },
      {
        roleName: "Forward / Striker",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Position",
            displayOrder: 0,
            optional: true,
            options: ["Centre-Forward (CF)", "Left Wing", "Right Wing"],
          },
          {
            groupName: "Finishing Style",
            displayOrder: 1,
            optional: true,
            options: ["Field Goal Poacher", "Deflection Specialist", "Dribbler / Circle Entry"],
          },
        ],
      },
    ],
  },

  // ─── 10. SQUASH ────────────────────────────────────────────────────────────
  {
    name: "Squash",
    slug: "squash",
    roles: [
      {
        roleName: "Singles Player",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Retriever / Defensive", "Attacking / Power Hitter", "Shot-Maker / Deceptive", "Traditional Length / Control"],
          },
          {
            groupName: "Skill Level",
            displayOrder: 2,
            optional: true,
            options: ["Club / Intermediate", "Advanced / District", "State / National Level"],
          },
        ],
      },
      {
        roleName: "Top Seed / Board 1",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Retriever / Defensive", "Attacking / Power Hitter", "Shot-Maker / Deceptive", "Traditional Length / Control"],
          },
          {
            groupName: "Skill Level",
            displayOrder: 2,
            optional: true,
            options: ["Club / Intermediate", "Advanced / District", "State / National Level"],
          },
        ],
      },
      {
        roleName: "Masters / Veterans",
        displayOrder: 2,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Retriever / Defensive", "Attacking / Power Hitter", "Shot-Maker / Deceptive", "Traditional Length / Control"],
          },
          {
            groupName: "Skill Level",
            displayOrder: 2,
            optional: true,
            options: ["Club / Intermediate", "Advanced / District", "State / National Level"],
          },
        ],
      },
      {
        roleName: "Junior Player",
        displayOrder: 3,
        specGroups: [
          {
            groupName: "Playing Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Handed", "Left Handed"],
          },
          {
            groupName: "Playing Style",
            displayOrder: 1,
            optional: true,
            options: ["Retriever / Defensive", "Attacking / Power Hitter", "Shot-Maker / Deceptive", "Traditional Length / Control"],
          },
          {
            groupName: "Skill Level",
            displayOrder: 2,
            optional: true,
            options: ["Club / Intermediate", "Advanced / District", "State / National Level"],
          },
        ],
      },
    ],
  },

  // ─── 11. CARROM ────────────────────────────────────────────────────────────
  {
    name: "Carrom",
    slug: "carrom",
    roles: [
      {
        roleName: "Singles Player",
        displayOrder: 0,
        specGroups: [
          {
            groupName: "Striking Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Hand", "Left Hand", "Both Hands"],
          },
          {
            groupName: "Striking Grip",
            displayOrder: 1,
            optional: true,
            options: ["Straight Grip", "Scissor Grip", "Middle Finger Strike", "Thumb Strike"],
          },
          {
            groupName: "Speciality",
            displayOrder: 2,
            optional: true,
            options: ["White Coin Specialist", "Queen & Cover Finisher", "Board Scorer / Cut Specialist"],
          },
        ],
      },
      {
        roleName: "Doubles Specialist",
        displayOrder: 1,
        specGroups: [
          {
            groupName: "Striking Hand",
            displayOrder: 0,
            optional: false,
            options: ["Right Hand", "Left Hand", "Both Hands"],
          },
          {
            groupName: "Striking Grip",
            displayOrder: 1,
            optional: true,
            options: ["Straight Grip", "Scissor Grip", "Middle Finger Strike", "Thumb Strike"],
          },
          {
            groupName: "Speciality",
            displayOrder: 2,
            optional: true,
            options: ["White Coin Specialist", "Queen & Cover Finisher", "Board Scorer / Cut Specialist"],
          },
        ],
      },
    ],
  },
];

async function syncSport(client, sportData) {
  console.log(`\n================ Processing Sport: ${sportData.name} (${sportData.slug}) ================`);

  // 1. Get or create Sport
  let sportId;
  const sportRes = await client.query("SELECT id, name, active FROM sports WHERE slug = $1", [sportData.slug]);
  if (sportRes.rows.length > 0) {
    sportId = sportRes.rows[0].id;
    await client.query("UPDATE sports SET name = $1, active = true WHERE id = $2", [sportData.name, sportId]);
    console.log(`Existing sport found [${sportId}] "${sportData.name}" - ensure active`);
  } else {
    const ins = await client.query(
      "INSERT INTO sports (name, slug, active) VALUES ($1, $2, true) RETURNING id",
      [sportData.name, sportData.slug]
    );
    sportId = ins.rows[0].id;
    console.log(`Created new sport [${sportId}] "${sportData.name}"`);
  }

  // 2. Roles
  for (const roleData of sportData.roles) {
    let roleId;
    const roleRes = await client.query(
      "SELECT id, role_name FROM sport_roles WHERE sport_id = $1 AND role_name = $2",
      [sportId, roleData.roleName]
    );
    if (roleRes.rows.length > 0) {
      roleId = roleRes.rows[0].id;
      await client.query(
        "UPDATE sport_roles SET display_order = $1, active = true WHERE id = $2",
        [roleData.displayOrder, roleId]
      );
      console.log(`  Updated role [${roleId}] "${roleData.roleName}" (order: ${roleData.displayOrder})`);
    } else {
      const insRole = await client.query(
        "INSERT INTO sport_roles (sport_id, role_name, display_order, active) VALUES ($1, $2, $3, true) RETURNING id",
        [sportId, roleData.roleName, roleData.displayOrder]
      );
      roleId = insRole.rows[0].id;
      console.log(`  Created role [${roleId}] "${roleData.roleName}" (order: ${roleData.displayOrder})`);
    }

    // 3. Spec Groups for Role
    for (const groupData of roleData.specGroups) {
      let groupId;
      const groupRes = await client.query(
        "SELECT id FROM role_spec_groups WHERE role_id = $1 AND group_name = $2",
        [roleId, groupData.groupName]
      );
      if (groupRes.rows.length > 0) {
        groupId = groupRes.rows[0].id;
        await client.query(
          "UPDATE role_spec_groups SET display_order = $1, optional = $2, active = true WHERE id = $3",
          [groupData.displayOrder, groupData.optional, groupId]
        );
        console.log(`    Updated spec group [${groupId}] "${groupData.groupName}" (order: ${groupData.displayOrder}, opt: ${groupData.optional})`);
      } else {
        const insGroup = await client.query(
          "INSERT INTO role_spec_groups (role_id, group_name, display_order, optional, active) VALUES ($1, $2, $3, $4, true) RETURNING id",
          [roleId, groupData.groupName, groupData.displayOrder, groupData.optional]
        );
        groupId = insGroup.rows[0].id;
        console.log(`    Created spec group [${groupId}] "${groupData.groupName}" (order: ${groupData.displayOrder}, opt: ${groupData.optional})`);
      }

      // 4. Options for Spec Group
      for (let i = 0; i < groupData.options.length; i++) {
        const optName = groupData.options[i];
        const optRes = await client.query(
          "SELECT id FROM role_spec_options WHERE group_id = $1 AND option_name = $2",
          [groupId, optName]
        );
        if (optRes.rows.length > 0) {
          const optId = optRes.rows[0].id;
          await client.query(
            "UPDATE role_spec_options SET display_order = $1, active = true WHERE id = $2",
            [i, optId]
          );
        } else {
          await client.query(
            "INSERT INTO role_spec_options (group_id, option_name, display_order, active) VALUES ($1, $2, $3, true)",
            [groupId, optName, i]
          );
        }
      }
      console.log(`      Synced ${groupData.options.length} options: [${groupData.options.join(", ")}]`);
    }
  }
}

async function main() {
  const { url, target } = resolveDatabaseUrl();
  const dbHost = new URL(url.replace("postgresql://", "http://")).host;
  console.log(`Targeting: ${target}`);
  console.log(`Connecting to Neon DB on host: ${dbHost}`);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected successfully.");

  try {
    await client.query("BEGIN");

    for (const sport of SPORTS_DATA) {
      await syncSport(client, sport);
    }

    await client.query("COMMIT");
    console.log("\n========================================================");
    console.log("All sports, roles, and specifications committed successfully!");
    console.log("========================================================");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transaction rolled back due to error:", err);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Execution failed:", err);
  process.exit(1);
});
