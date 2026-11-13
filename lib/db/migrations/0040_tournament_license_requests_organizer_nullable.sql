-- Make organizer_id optional on tournament_license_requests for admin direct grants
ALTER TABLE tournament_license_requests ALTER COLUMN organizer_id DROP NOT NULL;
