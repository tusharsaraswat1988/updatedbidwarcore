/**
 * Buzz Studio — Template Categories
 *
 * Groupings used for dashboard filtering, rendering pipelines,
 * and template discovery. A template belongs to exactly one category.
 */

export enum BuzzTemplateCategory {
  /** Templates focused on individual player creatives. */
  PLAYER = "player",

  /** Templates focused on team reveals, compositions, and branding. */
  TEAM = "team",

  /** Templates summarising or celebrating auction events. */
  AUCTION = "auction",

  /** Templates for tournament-level announcements and highlights. */
  TOURNAMENT = "tournament",

  /** Templates celebrating individual or team achievements. */
  ACHIEVEMENT = "achievement",
}
