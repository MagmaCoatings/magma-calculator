-- ============================================
-- FIX: old login_logs all show the same created_at
-- Run once in Supabase SQL Editor. Safe + idempotent.
--
-- When fix_login_logs_columns.sql added `created_at timestamptz DEFAULT now()`,
-- every PRE-EXISTING row got created_at = the instant the migration ran, so old
-- test logins all bunch at one timestamp in Admin → Login Logs. This realigns
-- created_at to each row's real event time (logged_in_at).
-- New logins are unaffected — they already set both to the sign-in time.
-- ============================================

UPDATE public.login_logs
SET created_at = logged_in_at
WHERE logged_in_at IS NOT NULL;
