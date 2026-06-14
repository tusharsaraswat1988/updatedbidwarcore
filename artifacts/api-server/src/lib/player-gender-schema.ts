import { z } from "zod";
import { PLAYER_GENDER_VALUES } from "@workspace/api-base/player-gender";

export const playerGenderSchema = z.enum(PLAYER_GENDER_VALUES);

export const optionalPlayerGenderSchema = z
  .union([playerGenderSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));
