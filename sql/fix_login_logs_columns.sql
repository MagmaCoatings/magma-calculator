-- ============================================
-- FIX: login_logs missing columns (login logging never recorded)
-- Run in Supabase SQL Editor. Safe + idempotent.
--
-- The app writes/reads email, success, failure_reason, region and created_at,
-- but the table only had: id, user_id, ip_address, city, country, device_type,
-- browser, os, is_suspicious, suspicious_reason, user_agent, logged_in_at.
-- So every login insert that included those columns silently failed.
-- This adds them so successful logins record and display in Admin -> Login Logs.
--
-- NB: each ALTER is its own complete statement (not one multi-line ALTER) so a
-- bad copy/paste can't split it into an orphaned "ADD COLUMN ..." line.
-- ============================================

ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS email          text;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS success        boolean DEFAULT true;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS failure_reason text;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS region         text;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS created_at     timestamptz DEFAULT now();

-- Backfill created_at from logged_in_at for existing rows.
-- NB: ADD COLUMN ... DEFAULT now() stamps every existing row with the migration
-- time, so they are NOT null -- we must realign unconditionally, not WHERE NULL.
UPDATE public.login_logs SET created_at = logged_in_at WHERE logged_in_at IS NOT NULL;

-- Note: "failed login" logging (no signed-in user) is still limited by RLS --
-- the insert has no auth.uid(), and user_id is required -- so only SUCCESSFUL
-- logins record from the browser. Failed-attempt logging would need an Edge
-- Function (service role) and is out of scope here.
