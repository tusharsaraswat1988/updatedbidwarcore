import { pgTable, text, serial, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Cricket Rule Presets (EPIC-Rule-Presets).
 *
 * A tournament owns multiple named Cricket Rule Presets.
 * Matches explicitly reference one selected Rule Preset via stable ID.
 * Display names are organizer-defined (e.g. "League Match Rules", "QF — 12 Overs", "Grand Final Rules").
 */
export const cricketRulePresetsTable = pgTable(
  "cricket_rule_presets",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    variantId: text("variant_id").notNull().default("cricket.box"),
    ruleProfileId: text("rule_profile_id").notNull().default("cricket.box.corporate_standard"),
    ruleProfileVersion: text("rule_profile_version").notNull().default("1.0.0"),
    ruleOverridesJson: jsonb("rule_overrides_json").$type<Record<string, unknown>>(),
    squadRulesJson: jsonb("squad_rules_json").$type<Record<string, unknown>>(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("ix_cricket_rule_presets_tournament_id").on(t.tournamentId),
  ],
);

export const insertCricketRulePresetSchema = createInsertSchema(cricketRulePresetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CricketRulePreset = typeof cricketRulePresetsTable.$inferSelect;
export type InsertCricketRulePreset = z.infer<typeof insertCricketRulePresetSchema>;
