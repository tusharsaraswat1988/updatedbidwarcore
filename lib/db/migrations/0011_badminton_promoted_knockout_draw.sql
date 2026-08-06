-- P0.2 Promotion Engine — canonical knockout draw pointer (idempotency)

ALTER TABLE badminton_categories
  ADD COLUMN IF NOT EXISTS promoted_knockout_draw_id INTEGER;

DO $$
BEGIN
  ALTER TABLE badminton_categories
    ADD CONSTRAINT badminton_categories_promoted_knockout_draw_id_fkey
    FOREIGN KEY (promoted_knockout_draw_id)
    REFERENCES badminton_draws(id)
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
