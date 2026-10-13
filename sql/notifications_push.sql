-- ============================================================================
-- Notifications stage 2: phone alerts (push)
-- Run AFTER sql/notifications.sql, and after the "send-push" Edge Function is
-- deployed with its secrets. Replace PASTE_THE_SAME_PUSH_HOOK_SECRET below with
-- the PUSH_HOOK_SECRET value you set on the Edge Function. Safe to re-run.
-- ============================================================================

-- Lets the database call the Edge Function
CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

-- The shared secret the database sends to the Edge Function (stored encrypted in Supabase Vault)
DO $$
DECLARE
  v text := 'PASTE_THE_SAME_PUSH_HOOK_SECRET';
  existing uuid;
BEGIN
  IF v LIKE 'PASTE%' THEN
    RAISE EXCEPTION 'Replace PASTE_THE_SAME_PUSH_HOOK_SECRET with your PUSH_HOOK_SECRET first';
  END IF;
  SELECT id INTO existing FROM vault.secrets WHERE name = 'magma_push_hook_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(v, 'magma_push_hook_secret', 'Sent with push requests to the send-push Edge Function');
  ELSE
    PERFORM vault.update_secret(existing, v);
  END IF;
END $$;

-- Only real push services can be stored, and devices are saved only through save_push_subscription
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_check;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_check CHECK (
  endpoint ~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
) NOT VALID;
REVOKE INSERT, UPDATE ON public.push_subscriptions FROM authenticated, anon;

-- Save this device's subscription for the signed-in user (moves it if another user had it)
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint !~ '^https://([a-z0-9-]+\.)*(googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)/'
     OR p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'Invalid subscription';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = auth.uid(), p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent, created_at = now();
END $$;
REVOKE EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_push_subscription(text, text, text, text) TO authenticated;

-- Replace the stage 1 placeholder: ask the Edge Function to send phone alerts for a message
CREATE OR REPLACE FUNCTION public.request_push(p_notification_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  secret text;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name = 'magma_push_hook_secret';
  IF secret IS NULL THEN
    RETURN; -- phone alerts not set up: the bell still works
  END IF;
  PERFORM net.http_post(
    url     := 'https://twxtkzoznfdqywvfqwdd.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body    := jsonb_build_object('notification_id', p_notification_id),
    timeout_milliseconds := 30000
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.request_push(uuid) FROM PUBLIC, anon, authenticated;

COMMIT;

-- Check: should return 1
SELECT count(*) AS secret_saved FROM vault.secrets WHERE name = 'magma_push_hook_secret';
