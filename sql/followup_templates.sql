-- ============================================================================
-- Editable quote follow-up wording (October 2026)
-- Run once in Supabase > SQL Editor, after sql/notifications.sql. Safe to re-run.
-- Placeholders: {project} project or client name, {reference} quote number,
-- {age} "a week" or "10 days", {days} the number of days
-- ============================================================================
BEGIN;

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS followup_title text NOT NULL DEFAULT '{project} is {age} old',
  ADD COLUMN IF NOT EXISTS followup_body  text NOT NULL DEFAULT 'Quote {reference} is ready when you are. Tap to open it and email the order to Magma.';

ALTER TABLE public.notification_settings DROP CONSTRAINT IF EXISTS notification_settings_followup_text_check;
ALTER TABLE public.notification_settings ADD CONSTRAINT notification_settings_followup_text_check
  CHECK (char_length(followup_title) BETWEEN 1 AND 80 AND char_length(followup_body) BETWEEN 1 AND 200);

-- Fill in a template for one quote, trimmed to the allowed length
CREATE OR REPLACE FUNCTION public.fill_quote_template(t text, p_project text, p_reference text, p_days integer, p_max integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT left(
    replace(replace(replace(replace(t,
      '{project}',   coalesce(p_project, '')),
      '{reference}', coalesce(p_reference, '')),
      '{age}',       CASE WHEN p_days = 7 THEN 'a week' WHEN p_days = 14 THEN 'two weeks' ELSE p_days || ' days' END),
      '{days}',      p_days::text),
    p_max)
$$;

-- The automations now use the saved wording
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
        public.fill_quote_template(s.followup_title, left(q.label, 50), q.reference, s.quote_followup_days, 80),
        public.fill_quote_template(s.followup_body,  left(q.label, 50), q.reference, s.quote_followup_days, 200),
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

REVOKE EXECUTE ON FUNCTION public.run_notification_automations() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Check: shows the current wording
SELECT followup_title, followup_body FROM public.notification_settings WHERE id = 1;
