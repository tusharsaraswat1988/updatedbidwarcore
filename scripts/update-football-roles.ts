import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is missing in environment");
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to Neon DB.");

  try {
    await client.query("BEGIN");

    // 1. Get Football sport ID
    const sportRes = await client.query("SELECT id, name, slug FROM sports WHERE slug = 'football'");
    if (sportRes.rows.length === 0) {
      throw new Error("Football sport not found in sports table");
    }
    const footballId = sportRes.rows[0].id;
    console.log(`Found Football sport with id: ${footballId}`);

    // Helper to get or create role
    async function upsertRole(oldName: string, newName: string, displayOrder: number) {
      const existing = await client.query(
        "SELECT id, role_name FROM sport_roles WHERE sport_id = $1 AND (role_name = $2 OR role_name = $3)",
        [footballId, oldName, newName]
      );
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await client.query(
          "UPDATE sport_roles SET role_name = $1, display_order = $2, active = true WHERE id = $3",
          [newName, displayOrder, id]
        );
        console.log(`Updated role [${id}] -> ${newName} (order: ${displayOrder})`);
        return id;
      } else {
        const ins = await client.query(
          "INSERT INTO sport_roles (sport_id, role_name, display_order, active) VALUES ($1, $2, $3, true) RETURNING id",
          [footballId, newName, displayOrder]
        );
        const id = ins.rows[0].id;
        console.log(`Created role [${id}] -> ${newName} (order: ${displayOrder})`);
        return id;
      }
    }

    // Helper to get or create spec group
    async function upsertSpecGroup(roleId: number, groupName: string, displayOrder: number, optional = true) {
      const existing = await client.query(
        "SELECT id FROM role_spec_groups WHERE role_id = $1 AND group_name = $2",
        [roleId, groupName]
      );
      if (existing.rows.length > 0) {
        const id = existing.rows[0].id;
        await client.query(
          "UPDATE role_spec_groups SET display_order = $1, optional = $2, active = true WHERE id = $3",
          [displayOrder, optional, id]
        );
        console.log(`  Updated spec group [${id}] "${groupName}" (order: ${displayOrder})`);
        return id;
      } else {
        const ins = await client.query(
          "INSERT INTO role_spec_groups (role_id, group_name, display_order, optional, active) VALUES ($1, $2, $3, $4, true) RETURNING id",
          [roleId, groupName, displayOrder, optional]
        );
        const id = ins.rows[0].id;
        console.log(`  Created spec group [${id}] "${groupName}" (order: ${displayOrder})`);
        return id;
      }
    }

    // Helper to upsert options
    async function syncOptions(groupId: number, options: string[]) {
      for (let i = 0; i < options.length; i++) {
        const optName = options[i];
        const existing = await client.query(
          "SELECT id FROM role_spec_options WHERE group_id = $1 AND option_name = $2",
          [groupId, optName]
        );
        if (existing.rows.length > 0) {
          const id = existing.rows[0].id;
          await client.query(
            "UPDATE role_spec_options SET display_order = $1, active = true WHERE id = $2",
            [i, id]
          );
        } else {
          await client.query(
            "INSERT INTO role_spec_options (group_id, option_name, display_order, active) VALUES ($1, $2, $3, true)",
            [groupId, optName, i]
          );
        }
      }
      console.log(`    Synced options for group [${groupId}]: ${options.join(", ")}`);
    }

    // 1. Goalkeeper (GK)
    const gkRoleId = await upsertRole("Goalkeeper", "Goalkeeper (GK)", 0);
    const gkStyleGroup = await upsertSpecGroup(gkRoleId, "Playing Style", 0, true);
    await syncOptions(gkStyleGroup, ["Shot stopper", "Sweeper Keeper", "Backup Goalkeeper"]);
    const gkFootGroup = await upsertSpecGroup(gkRoleId, "Preferred Foot", 1, true);
    await syncOptions(gkFootGroup, ["Right", "Left", "Both"]);

    // 2. Defender
    const defRoleId = await upsertRole("Defender", "Defender", 1);
    const defPosGroup = await upsertSpecGroup(defRoleId, "Playing Position", 0, true);
    await syncOptions(defPosGroup, [
      "Centre-Back (CB)",
      "Left-Back (LB)",
      "Right-Back (RB)",
      "Wing-Back (LWB/RWB)",
    ]);
    const defFootGroup = await upsertSpecGroup(defRoleId, "Preferred Foot", 1, true);
    await syncOptions(defFootGroup, ["Right", "Left", "Both"]);

    // 3. Midfielder
    const midRoleId = await upsertRole("Midfielder", "Midfielder", 2);
    const midPosGroup = await upsertSpecGroup(midRoleId, "Playing Position", 0, true);
    await syncOptions(midPosGroup, [
      "Defensive Midfielder (CDM)",
      "Central Midfielder (CM)",
      "Attacking Midfielder (CAM)",
      "Left/Right Midfielder (LM/RM)",
    ]);
    const midFootGroup = await upsertSpecGroup(midRoleId, "Preferred Foot", 1, true);
    await syncOptions(midFootGroup, ["Right", "Left", "Both"]);

    // 4. Forward
    const fwdRoleId = await upsertRole("Forward", "Forward", 3);
    const fwdPosGroup = await upsertSpecGroup(fwdRoleId, "Playing Position", 0, true);
    await syncOptions(fwdPosGroup, [
      "Centre-Forward (CF)",
      "Striker (ST)",
      "Left Winger (LW)",
      "Right Winger (RW)",
      "Second Striker (SS)",
    ]);
    const fwdFootGroup = await upsertSpecGroup(fwdRoleId, "Preferred Foot", 1, true);
    await syncOptions(fwdFootGroup, ["Right", "Left", "Both"]);

    await client.query("COMMIT");
    console.log("\nTransaction successfully committed!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Error during update, rolled back:", e);
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
