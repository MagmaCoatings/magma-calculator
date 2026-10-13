-- ============================================================================
-- Notifications (October 2026): in-app bell, admin sending, automatic messages
-- Run once in Supabase > SQL Editor. Safe to re-run.
-- ============================================================================

-- Scheduled jobs (Supabase includes pg_cron; if this line errors, enable
-- "pg_cron" under Database > Extensions and run the file again)
CREATE EXTENSION IF NOT EXISTS pg_cron;

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Columns on existing tables
-- ---------------------------------------------------------------------------
-- Each installer's choices: phone alerts, and which categories they receive
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_prefs jsonb NOT NULL
  DEFAULT '{"push": true, "products": true, "quotes": true, "social": true}'::jsonb;

-- When a quote's follow-up reminder was sent (so it is only sent once)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------
-- One row per message
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body              text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  category          text NOT NULL DEFAULT 'products' CHECK (category IN ('products', 'quotes', 'social')),
  kind              text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'price', 'product', 'quote_followup', 'nudge')),
  link_type         text NOT NULL DEFAULT 'calc' CHECK (link_type IN ('calc', 'system', 'quotes', 'quote', 'url')),
  link_target       text,                      -- system id, quote id, or an https:// link
  audience          text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'selected')),
  audience_user_ids uuid[] NOT NULL DEFAULT '{}',
  send_push         boolean NOT NULL DEFAULT true,
  status            text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  send_at           timestamptz NOT NULL DEFAULT now(),
  sent_at           timestamptz,
  recipient_count   integer NOT NULL DEFAULT 0,
  created_by        uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (link_type <> 'url' OR link_target ~ '^https://')
);
CREATE INDEX IF NOT EXISTS notifications_due_idx ON public.notifications (status, send_at);

-- One row per installer who received a message (the bell reads these)
CREATE TABLE IF NOT EXISTS public.notification_recipients (
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delivered_at    timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz,
  opened_at       timestamptz,
  pushed_at       timestamptz,
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX IF NOT EXISTS notification_recipients_user_idx ON public.notification_recipients (user_id, delivered_at DESC);

-- Automatic message settings (a single row)
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  auto_price           boolean NOT NULL DEFAULT true,   -- offer to announce price changes
  auto_product         boolean NOT NULL DEFAULT true,   -- offer to announce new products
  quote_followup       boolean NOT NULL DEFAULT true,
  quote_followup_days  integer NOT NULL DEFAULT 7 CHECK (quote_followup_days BETWEEN 1 AND 60),
  nudge_enabled        boolean NOT NULL DEFAULT false,  -- off until you add your messages
  nudge_gap_days       integer NOT NULL DEFAULT 10 CHECK (nudge_gap_days BETWEEN 3 AND 60),
  auto_send_time       time NOT NULL DEFAULT '08:30',   -- automatic messages go out on weekdays at this UK time
  weekly_cap           integer NOT NULL DEFAULT 2 CHECK (weekly_cap BETWEEN 1 AND 14),
  last_auto_run        date,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.notification_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Rotating "quiet period" messages (e.g. Instagram)
CREATE TABLE IF NOT EXISTS public.nudge_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  url           text NOT NULL CHECK (url ~ '^https://'),
  position      integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  last_sent_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Phone alert subscriptions (used by stage 2: phone alerts)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- 3. Security (row level security)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nudge_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage notifications" ON public.notifications;
CREATE POLICY "Admins manage notifications" ON public.notifications
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Recipients read their notifications" ON public.notifications;
CREATE POLICY "Recipients read their notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.notification_recipients r
                 WHERE r.notification_id = notifications.id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS "Users read own deliveries" ON public.notification_recipients;
CREATE POLICY "Users read own deliveries" ON public.notification_recipients
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users mark own deliveries" ON public.notification_recipients;
CREATE POLICY "Users mark own deliveries" ON public.notification_recipients
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage notification settings" ON public.notification_settings;
CREATE POLICY "Admins manage notification settings" ON public.notification_settings
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins manage nudge messages" ON public.nudge_messages;
CREATE POLICY "Admins manage nudge messages" ON public.nudge_messages
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins read push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admins read push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (is_admin());

-- ---------------------------------------------------------------------------
-- 4. Delivering messages
-- ---------------------------------------------------------------------------
-- Phone alerts hook: does nothing until stage 2 replaces it
CREATE OR REPLACE FUNCTION public.request_push(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN;
END $$;

-- Deliver one scheduled message to its installers
CREATE OR REPLACE FUNCTION public.deliver_notification(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  n   public.notifications%ROWTYPE;
  cap integer;
  cnt integer;
BEGIN
  -- Only admins (or the scheduler, which has no user) may deliver
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can send notifications';
  END IF;

  SELECT * INTO n FROM public.notifications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR n.status <> 'scheduled' THEN
    RETURN 0;
  END IF;

  SELECT weekly_cap INTO cap FROM public.notification_settings WHERE id = 1;

  INSERT INTO public.notification_recipients (notification_id, user_id)
  SELECT n.id, p.id
  FROM public.profiles p
  WHERE COALESCE(p.status, 'active') = 'active'
    AND (n.audience = 'all' OR p.id = ANY (n.audience_user_ids))
    -- respect the installer's category choices (quote reminders are personal, always delivered)
    AND (n.category = 'quotes' OR COALESCE((p.notify_prefs ->> n.category)::boolean, true))
    -- quiet-period nudges respect the weekly limit
    AND (n.kind <> 'nudge' OR (
          SELECT count(*) FROM public.notification_recipients r
          JOIN public.notifications x ON x.id = r.notification_id
          WHERE r.user_id = p.id AND x.category <> 'quotes'
            AND r.delivered_at > now() - interval '7 days') < COALESCE(cap, 2))
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS cnt = ROW_COUNT;

  UPDATE public.notifications
  SET status = 'sent', sent_at = now(), recipient_count = cnt
  WHERE id = n.id;

  IF n.send_push AND cnt > 0 THEN
    PERFORM public.request_push(n.id);
  END IF;
  RETURN cnt;
END $$;

-- Deliver everything that is due (run by the scheduler every 5 minutes)
CREATE OR REPLACE FUNCTION public.deliver_due_notifications()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  total integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can send notifications';
  END IF;
  FOR r IN SELECT id FROM public.notifications
           WHERE status = 'scheduled' AND send_at <= now() ORDER BY send_at LOOP
    total := total + public.deliver_notification(r.id);
  END LOOP;
  RETURN total;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Automatic messages: quote follow-ups and the quiet-period nudge
--    Run every 15 minutes; acts once per weekday at the chosen UK time.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_notification_automations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s       public.notification_settings%ROWTYPE;
  uk_now  timestamp := (now() AT TIME ZONE 'Europe/London');
  q       record;
  m       public.nudge_messages%ROWTYPE;
  new_id  uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Automations run from the scheduler only';
  END IF;

  SELECT * INTO s FROM public.notification_settings WHERE id = 1 FOR UPDATE;
  -- Weekdays only, once a day, at or after the chosen time
  IF extract(isodow FROM uk_now) > 5 OR uk_now::time < s.auto_send_time
     OR s.last_auto_run = uk_now::date THEN
    RETURN;
  END IF;
  UPDATE public.notification_settings SET last_auto_run = uk_now::date WHERE id = 1;

  -- Quote follow-ups: quotes not yet accepted or declined, old enough, not reminded,
  -- and no more than 30 days past due (so switching this on doesn't flood old quotes)
  IF s.quote_followup THEN
    FOR q IN
      SELECT id, reference, created_by, COALESCE(NULLIF(project_name, ''), NULLIF(client_name, ''), reference) AS label
      FROM public.quotes
      WHERE status IN ('draft', 'sent') AND reminded_at IS NULL AND created_by IS NOT NULL
        AND created_at <= now() - make_interval(days => s.quote_followup_days)
        AND created_at >  now() - make_interval(days => s.quote_followup_days + 30)
    LOOP
      INSERT INTO public.notifications (title, body, category, kind, link_type, link_target, audience, audience_user_ids, created_by)
      VALUES (
        left(q.label, 50) || CASE WHEN s.quote_followup_days = 7 THEN ' is a week old' ELSE ' is ' || s.quote_followup_days || ' days old' END,
        'Quote ' || q.reference || ' is ready when you are. Tap to open it and email the order to Magma.',
        'quotes', 'quote_followup', 'quote', q.id::text, 'selected', ARRAY[q.created_by], NULL)
      RETURNING id INTO new_id;
      UPDATE public.quotes SET reminded_at = now() WHERE id = q.id;
      PERFORM public.deliver_notification(new_id);
    END LOOP;
  END IF;

  -- Quiet-period nudge: nothing sent to everyone for the chosen number of days
  IF s.nudge_enabled AND NOT EXISTS (
       SELECT 1 FROM public.notifications
       WHERE audience = 'all' AND status IN ('sent', 'scheduled')
         AND COALESCE(sent_at, send_at) > now() - make_interval(days => s.nudge_gap_days)) THEN
    SELECT * INTO m FROM public.nudge_messages
    WHERE active ORDER BY last_sent_at NULLS FIRST, position LIMIT 1;
    IF FOUND THEN
      INSERT INTO public.notifications (title, body, category, kind, link_type, link_target, audience, created_by)
      VALUES (m.title, m.body, 'social', 'nudge', 'url', m.url, 'all', NULL)
      RETURNING id INTO new_id;
      UPDATE public.nudge_messages SET last_sent_at = now() WHERE id = m.id;
      PERFORM public.deliver_notification(new_id);
    END IF;
  END IF;
END $$;

-- Opened/read figures for the History tab (admins only)
CREATE OR REPLACE FUNCTION public.notification_stats()
RETURNS TABLE (notification_id uuid, delivered bigint, opened bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY
  SELECT r.notification_id, count(*), count(r.opened_at)
  FROM public.notification_recipients r GROUP BY r.notification_id;
END $$;

-- Lock the functions down: only signed-in users can call the admin ones (they check is_admin)
REVOKE EXECUTE ON FUNCTION public.request_push(uuid)                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_notification_automations()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deliver_notification(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.deliver_due_notifications()        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notification_stats()               FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.deliver_notification(uuid)         TO authenticated;
GRANT  EXECUTE ON FUNCTION public.deliver_due_notifications()        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.notification_stats()               TO authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- 6. Live bell updates (the app hears new messages straight away)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notification_recipients') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_recipients;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Scheduled jobs
-- ---------------------------------------------------------------------------
SELECT cron.unschedule(jobid) FROM cron.job
WHERE jobname IN ('magma-deliver-notifications', 'magma-notification-automations');
SELECT cron.schedule('magma-deliver-notifications',   '*/5 * * * *',  'SELECT public.deliver_due_notifications()');
SELECT cron.schedule('magma-notification-automations', '*/15 * * * *', 'SELECT public.run_notification_automations()');

-- Check: should list both jobs
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'magma-%';
