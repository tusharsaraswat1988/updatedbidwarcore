# Schema Drift Migration Report

Generated: 2026-07-13T15:02:38.329Z
Production: BidWar Production Neon (`jolly-tree-42208228`)

## Summary

| Metric | Count |
|--------|------:|
| drizzleTables | 92 |
| productionTables | 93 |
| criticalColumnsMissingInProduction | 1 |
| tablesWithCriticalDrift | 1 |
| drizzleTablesAbsentInProduction | 0 |
| productionTablesNotInDrizzle | 1 |
| tablesWithNoBootDdlCoverage | 25 |
| tablesWithPartialBootGaps | 10 |
| namedIndexGaps | 65 |

## P0 — Columns in Drizzle but missing in production

These break `db.select().from(table)` (Drizzle emits all mapped columns).

### `tournaments` (`tournaments.ts`)

| Column | In boot DDL? |
|--------|--------------|
| `city` | **no** |

## P0 — Tables in Drizzle but missing in production

_None._

## P1 — Proposed production migration SQL

```sql
-- Review types against Drizzle schema before applying.
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS city /* TODO: confirm type from lib/db/src/schema/tournaments.ts */ text;
```

## P2 — Boot DDL coverage gaps (ensure-schema / System C)

Tables with **zero** CREATE/ALTER coverage in boot DDL (rely on pre-existing prod or drizzle-kit):

- `auction_bid_events` (auction_events.ts) — inProduction=true cols=15
- `auction_player_events` (auction_events.ts) — inProduction=true cols=23
- `auction_timer_events` (auction_events.ts) — inProduction=true cols=8
- `bids` (bids.ts) — inProduction=true cols=6
- `bot_sessions` (comm.ts) — inProduction=true cols=6
- `categories` (categories.ts) — inProduction=true cols=11
- `comm_logs` (comm.ts) — inProduction=true cols=15
- `consent_blast_log` (comm.ts) — inProduction=true cols=5
- `consent_tokens` (comm.ts) — inProduction=true cols=9
- `display_auctions` (display-auctions.ts) — inProduction=true cols=18
- `notification_logs` (notifications.ts) — inProduction=true cols=15
- `otp_sessions` (comm.ts) — inProduction=true cols=8
- `player_import_logs` (player_import_logs.ts) — inProduction=true cols=6
- `role_spec_groups` (sports.ts) — inProduction=true cols=6
- `role_spec_options` (sports.ts) — inProduction=true cols=5
- `scoring_events` (scoring_events.ts) — inProduction=true cols=16
- `scoring_sessions` (scoring_sessions.ts) — inProduction=true cols=9
- `scoring_standings` (scoring_standings.ts) — inProduction=true cols=12
- `settings` (settings.ts) — inProduction=true cols=2
- `sms_notification_settings` (sms-settings.ts) — inProduction=true cols=9
- `sport_roles` (sports.ts) — inProduction=true cols=5
- `sports` (sports.ts) — inProduction=true cols=5
- `wa_consent_events` (comm.ts) — inProduction=true cols=10
- `wa_quality_log` (comm.ts) — inProduction=true cols=8
- `wa_templates` (comm.ts) — inProduction=true cols=8

Partial gaps (table has some ensures, but these Drizzle columns are not in boot DDL):

### `auction_sessions`

`active_category_ids`, `break_ends_at`, `current_bid`, `current_bid_team_id`, `current_player_id`, `deferred_player_ids`, `display_overlay`, `display_player_filter`, `fortune_wheel_active`, `id`, `is_break`, `last_action`, `paused_time_remaining`, `sold_players_count`, `status`, `team_purse_view_active`, `timer_ends_at`, `timer_seconds`, `timer_type`, `tournament_id`, `unsold_players_count`, `updated_at`, `wheel_items_json`, `wheel_spinning`, `wheel_winner`

### `branding_settings`

`accent_color`, `app_icon_url`, `background_color`, `body_font`, `brand_name`, `created_at`, `danger_color`, `enable_watermark`, `heading_font`, `id`, `logo_animation_url`, `main_logo_url`, `mini_brand_text`, `mini_logo_url`, `powered_by_text`, `primary_color`, `secondary_color`, `show_branding_auction`, `show_branding_pdf`, `show_branding_public_links`, `show_powered_by_owner_app`, `show_powered_by_viewer`, `splash_screen_url`, `success_color`, `tagline`, `updated_at`, `watermark_opacity`, `watermark_position`, `watermark_text`

### `global_players`

`age`, `canonical_name`, `city`, `created_at`, `default_role`, `id`, `mobile_number`, `notes`, `photo_url`, `sport`, `updated_at`

### `organizers`

`created_at`, `email`, `google_email`, `google_id`, `id`, `license_status`, `max_tournaments`, `mobile`, `name`, `notes`, `password_hash`, `updated_at`

### `players`

`achievements`, `age`, `availability_dates`, `base_price`, `batting_style`, `bowling_style`, `category_id`, `city`, `created_at`, `crichero_url`, `global_player_id`, `id`, `is_non_playing_member`, `jersey_number`, `mobile_number`, `name`, `photo_url`, `player_tag`, `player_tag_team_id`, `retained_price`, `role`, `sold_price`, `specialization`, `status`, `team_id`, `tournament_id`, `updated_at`, `whatsapp_consent`, `whatsapp_consent_at`, `whatsapp_consent_ip`, `whatsapp_consent_method`, `whatsapp_consent_org_id`

### `scoring_fixtures`

`away_team_id`, `created_at`, `fixture_number`, `format_json`, `home_team_id`, `id`, `result_summary`, `round_name`, `scheduled_at`, `sport_slug`, `status`, `tournament_id`, `updated_at`, `venue`, `winner_team_id`

### `scoring_matches`

`away_side_json`, `away_team_id`, `completed_at`, `created_at`, `current_projection_version`, `fixture_id`, `home_side_json`, `home_team_id`, `id`, `match_kind`, `match_label`, `parent_match_id`, `result_summary`, `round_name`, `rules_json`, `scheduled_at`, `sequence_in_parent`, `sport_slug`, `started_at`, `status`, `summary_json`, `tournament_id`, `updated_at`, `venue`, `winner_team_id`

### `showcase_events`

`active`, `alt_text`, `created_at`, `description`, `display_order`, `id`, `image_url`, `sport_name`, `tournament_name`, `updated_at`

### `teams`

`access_code`, `color`, `created_at`, `id`, `is_bidding_enabled`, `logo_url`, `name`, `owner_mobile`, `owner_name`, `purse`, `purse_used`, `short_code`, `tournament_id`, `updated_at`, `whatsapp_consent`, `whatsapp_consent_at`, `whatsapp_consent_ip`, `whatsapp_consent_method`, `whatsapp_consent_org_id`

### `tournaments`

`admin_locked`, `admin_locked_at`, `auction_code`, `auction_date`, `auction_time`, `auction_unit`, `audio_enabled`, `base_purse`, `bid_increment`, `bid_tier1_increment`, `bid_tier1_up_to`, `bid_tier2_increment`, `bid_tier2_up_to`, `bid_tier3_increment`, `bid_tiers`, `bid_timer_seconds`, `break_end_sound_enabled`, `break_end_sound_url`, `break_end_sound_volume`, `cheer_cooldown_seconds`, `cheer_message_presets`, `cheer_messages_enabled`, `city`, `countdown_sound_enabled`, `countdown_sound_url`, `countdown_sound_volume`, `created_at`, `id`, `last_reset_at`, `last_reset_by`, `license_granted_at`, `license_granted_by`, `license_status`, `logo_url`, `main_banner_enabled`, `main_banner_fit`, `main_banner_url`, `master_volume`, `match_dates`, `maximum_squad_size`, `min_bid`, `minimum_squad_size`, `name`, `organizer_email`, `organizer_id`, `organizer_mobile`, `organizer_name`, `organizer_password`, `player_selection_mode`, `registration_deadline`, `registration_limit`, `reset_count`, `sold_sound_enabled`, `sold_sound_url`, `sold_sound_volume`, `sponsor_logos`, `sport`, `sport_id`, `status`, `timer_seconds`, `updated_at`, `venue`

## Indexes (named in Drizzle)

| Table | Index | In prod | In boot |
|-------|-------|---------|---------|
| consent_tokens | ix_consent_tokens_token | true | false |
| consent_tokens | ix_consent_tokens_mobile | true | false |
| otp_sessions | ix_otp_sessions_mobile | true | false |
| comm_logs | ix_comm_logs_tournament_id | true | false |
| comm_logs | ix_comm_logs_recipient_mobile | true | false |
| comm_logs | ix_comm_logs_sent_at | true | false |
| comm_logs | ix_comm_logs_blast_id | true | false |
| consent_blast_log | uq_consent_blast_log | true | false |
| bot_sessions | ix_bot_sessions_mobile | true | false |
| wa_consent_events | ix_wa_consent_events_mobile | true | false |
| wa_consent_events | ix_wa_consent_events_event_at | true | false |
| communication_assets | ix_communication_assets_asset_type | false | false |
| communication_templates | ix_communication_templates_event_type | false | false |
| communication_templates | ix_communication_templates_is_active | false | false |
| communication_templates | ix_communication_templates_is_draft | false | false |
| communication_template_versions | ix_communication_template_versions_template_id | false | false |
| communication_jobs | ix_communication_jobs_channel | false | false |
| communication_jobs | ix_communication_jobs_template_id | false | false |
| communication_jobs | ix_communication_jobs_entity | false | false |
| communication_jobs | ix_communication_jobs_next_retry_at | false | false |
| communication_jobs | ix_communication_jobs_pending_reason | false | false |
| communication_jobs | ix_communication_jobs_bulk_campaign_id | false | false |
| communication_job_recipients | ix_communication_job_recipients_role | false | false |
| communication_logs | ix_communication_logs_action | false | false |
| communication_logs | ix_communication_logs_recipient_email | false | false |
| audit_logs | ix_audit_logs_tournament | false | false |
| global_players | ix_gp_mobile | true | false |
| global_players | ix_gp_canonical_name | true | false |
| notification_logs | ux_notification_logs_dedup_key | true | false |
| notification_logs | ix_notification_logs_event_type | true | false |
| notification_logs | ix_notification_logs_channel | true | false |
| notification_logs | ix_notification_logs_status | true | false |
| notification_logs | ix_notification_logs_tournament_id | true | false |
| notification_logs | ix_notification_logs_created_at | true | false |
| platform_audit_events | ix_audit_actor_time | true | false |
| platform_audit_events | ix_audit_resource | true | false |
| platform_audit_events | ix_audit_category_action_time | true | false |
| platform_audit_events | ix_audit_alert_key | true | false |
| platform_audit_events | ix_audit_severity | true | false |
| players | ix_players_tournament_id | true | false |
| players | ix_players_mobile_number | true | false |
| players | ix_players_name | true | false |
| players | ix_players_global_player_id | true | false |
| player_import_logs | ix_pil_target_tournament | true | false |
| player_import_logs | ix_pil_source_tournament | true | false |
| player_import_logs | ix_pil_organizer | true | false |
| purse_boosters | ux_purse_boosters_local_uuid | true | false |
| purse_boosters | ix_purse_boosters_sync_pending | true | false |
| scoring_events | uq_scoring_events_match_sequence | true | false |
| scoring_events | ix_scoring_events_match_id | true | false |
| scoring_events | ix_scoring_events_tournament_id | true | false |
| scoring_fixtures | ix_scoring_fixtures_tournament_id | true | false |
| scoring_fixtures | ix_scoring_fixtures_tournament_status | true | false |
| scoring_matches | ix_scoring_matches_tournament_id | true | false |
| scoring_matches | ix_scoring_matches_fixture_id | true | false |
| scoring_matches | ix_scoring_matches_tournament_status | true | false |
| scoring_sessions | uq_scoring_sessions_match_id | true | false |
| scoring_standings | uq_scoring_standings_tournament_team | true | false |
| scoring_standings | ix_scoring_standings_tournament_id | true | false |
| sports | ix_sports_slug | true | false |
| sport_roles | ix_sport_roles_sport_id | true | false |
| role_spec_groups | ix_role_spec_groups_role_id | true | false |
| role_spec_options | ix_role_spec_options_group_id | true | false |
| teams | uq_teams_tournament_owner_mobile | true | false |
| tournaments | ix_tournaments_auction_code | true | false |

## Informational — production-only (not in Drizzle)

Production tables not mapped in Drizzle: 1

`sessions`
