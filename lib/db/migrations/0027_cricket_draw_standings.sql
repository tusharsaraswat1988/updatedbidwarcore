-- Cricket competition standings are one row per team per scoring draw.
-- Match identity stays fixture_id -> scoring_fixtures.draw_id. No category_id.

ALTER TABLE scoring_standings ADD COLUMN IF NOT EXISTS draw_id integer;

-- Teams that belong to exactly one draw can be attached without mixing competitions.
UPDATE scoring_standings AS s
SET draw_id = sub.draw_id
FROM (
  SELECT gm.team_id, g.tournament_id, MIN(g.draw_id) AS draw_id
  FROM scoring_group_members gm
  JOIN scoring_groups g ON g.id = gm.group_id
  GROUP BY gm.team_id, g.tournament_id
  HAVING COUNT(DISTINCT g.draw_id) = 1
) AS sub
WHERE s.team_id = sub.team_id
  AND s.tournament_id = sub.tournament_id
  AND s.draw_id IS NULL;

DROP INDEX IF EXISTS uq_scoring_standings_tournament_team;

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_draw_team
  ON scoring_standings (tournament_id, draw_id, team_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scoring_standings_tournament_team_unscoped
  ON scoring_standings (tournament_id, team_id)
  WHERE draw_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_scoring_standings_draw_id
  ON scoring_standings (draw_id);
