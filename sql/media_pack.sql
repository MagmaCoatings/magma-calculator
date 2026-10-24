-- ============================================================================
-- Media pack (October 2026): social images, videos, architect material, logos
-- Built hidden: installers see nothing until an admin turns on
-- "Show Media pack to installers" in Admin > Media pack > Settings.
-- Run once in Supabase > SQL Editor. Safe to re-run.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
-- The launch switch and defaults (one row only)
CREATE TABLE IF NOT EXISTS public.media_settings (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  media_pack_enabled boolean NOT NULL DEFAULT false,   -- the launch switch: off until Jason turns it on
  default_hashtags   text NOT NULL DEFAULT '' CHECK (char_length(default_hashtags) <= 500),
  default_credit     text NOT NULL DEFAULT '' CHECK (char_length(default_credit) <= 120),
  enabled_at         timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);
INSERT INTO public.media_settings (id, default_hashtags, default_credit)
VALUES (1, '#magmacoatings #microcement #microcementfloors #microcementuk #seamlessfloors #wetroomdesign #interiordesignuk',
        'Please tag @magmacoatings')
ON CONFLICT (id) DO NOTHING;

-- Each version of the usage terms. The highest version is the current one.
CREATE TABLE IF NOT EXISTS public.media_terms (
  version    integer PRIMARY KEY CHECK (version > 0),
  title      text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid()
);

-- Who agreed to which version, and when
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS media_terms_version integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS media_terms_agreed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.media_campaigns (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  starts_on     date NOT NULL DEFAULT current_date,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.media_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title            text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  section          text NOT NULL CHECK (section IN ('social', 'videos', 'architects', 'logos', 'pack')),
  campaign_id      uuid REFERENCES public.media_campaigns(id) ON DELETE SET NULL,
  description      text CHECK (char_length(description) <= 300),
  caption          text CHECK (char_length(caption) <= 2200),        -- Instagram's limit
  hashtags         text CHECK (char_length(hashtags) <= 500),
  credit           text CHECK (char_length(credit) <= 120),
  format           text CHECK (format IN ('square', 'portrait', 'story', 'landscape')),
  status           text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  check_watermark  boolean NOT NULL DEFAULT false,  -- "This file carries the Magma watermark or credit"
  check_permission boolean NOT NULL DEFAULT false,  -- "We have permission to use this photo or video"
  display_order    integer NOT NULL DEFAULT 0,
  pinned           boolean NOT NULL DEFAULT false,
  published_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  -- Nothing goes out by accident: both checks are required to publish
  CONSTRAINT media_items_publish_checks CHECK (status = 'draft' OR (check_watermark AND check_permission))
);
CREATE INDEX IF NOT EXISTS media_items_list_idx ON public.media_items (section, status, pinned DESC, display_order);

-- The files of an item, in order (carousel position). Replaced files are kept (is_current = false)
CREATE TABLE IF NOT EXISTS public.media_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  kind         text NOT NULL CHECK (kind IN ('image', 'video', 'document', 'zip')),
  file_path    text NOT NULL UNIQUE,
  file_name    text NOT NULL CHECK (char_length(file_name) <= 200),
  mime_type    text NOT NULL,
  file_size    bigint NOT NULL CHECK (file_size > 0),
  width        integer,
  height       integer,
  duration_s   numeric(7,2),                     -- videos
  preview_path text,                             -- small preview (images) or cover frame (videos)
  is_current   boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  replaced_at  timestamptz,
  CHECK (
    (kind = 'image'    AND mime_type IN ('image/jpeg', 'image/png', 'image/webp') AND file_size <= 15728640) OR
    (kind = 'video'    AND mime_type = 'video/mp4' AND file_size <= 104857600) OR
    (kind = 'document' AND mime_type IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') AND file_size <= 26214400) OR
    (kind = 'zip'      AND mime_type IN ('application/zip', 'application/x-zip-compressed') AND file_size <= 524288000)
  )
);
CREATE INDEX IF NOT EXISTS media_files_item_idx ON public.media_files (item_id, is_current, position);

-- Which products and systems an item belongs to (for "Media for this system" later)
CREATE TABLE IF NOT EXISTS public.media_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  system_id  uuid REFERENCES public.systems(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(product_id, system_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS media_links_product_uq ON public.media_links (item_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS media_links_system_uq  ON public.media_links (item_id, system_id)  WHERE system_id IS NOT NULL;

-- Who did what and when (counts and "See who" in admin)
CREATE TABLE IF NOT EXISTS public.media_events (
  id         bigserial PRIMARY KEY,
  item_id    uuid NOT NULL REFERENCES public.media_items(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  event      text NOT NULL CHECK (event IN ('view', 'save', 'caption', 'download', 'share')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_events_item_idx ON public.media_events (item_id, created_at DESC);

-- No-login links to one architect file, for installers to forward (30 days)
CREATE TABLE IF NOT EXISTS public.media_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  file_id    uuid NOT NULL REFERENCES public.media_files(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS media_shares_file_idx ON public.media_shares (file_id);

-- ---------------------------------------------------------------------------
-- 2. Who can see the Media pack
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.media_pack_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT media_pack_enabled FROM public.media_settings WHERE id = 1), false)
$$;

CREATE OR REPLACE FUNCTION public.media_terms_current()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(max(version), 0) FROM public.media_terms
$$;

-- True for admins always; for active installers only when the switch is on AND they agreed the current terms
CREATE OR REPLACE FUNCTION public.can_see_media()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.is_admin() THEN true
    ELSE public.is_active_user() AND public.media_pack_enabled() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.media_terms_version IS NOT NULL
        AND p.media_terms_version >= public.media_terms_current() AND public.media_terms_current() > 0)
  END
$$;

REVOKE EXECUTE ON FUNCTION public.media_pack_enabled()  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.media_terms_current() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_media()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.media_pack_enabled(), public.media_terms_current(), public.can_see_media() TO authenticated;

-- What the app needs to decide whether to show the Media tab.
-- An installer with the switch off learns nothing beyond "not visible".
CREATE OR REPLACE FUNCTION public.media_access()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin boolean := public.is_admin();
  v_current integer := public.media_terms_current();
  v_agreed integer;
  t public.media_terms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_user() THEN
    RETURN jsonb_build_object('visible', false);
  END IF;
  IF NOT v_admin AND NOT public.media_pack_enabled() THEN
    RETURN jsonb_build_object('visible', false);
  END IF;
  SELECT media_terms_version INTO v_agreed FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO t FROM public.media_terms WHERE version = v_current;
  RETURN jsonb_build_object(
    'visible', true,
    'admin', v_admin,
    'enabled', public.media_pack_enabled(),
    'terms_version', v_current,
    'agreed', v_current > 0 AND COALESCE(v_agreed, 0) >= v_current,
    'terms_title', t.title,
    'terms_body', t.body);
END $$;
REVOKE EXECUTE ON FUNCTION public.media_access() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.media_access() TO authenticated;

-- "I agree": records the version and date. Only possible through this function.
CREATE OR REPLACE FUNCTION public.agree_media_terms(p_version integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_user() THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT public.is_admin() AND NOT public.media_pack_enabled() THEN RAISE EXCEPTION 'Not available'; END IF;
  IF p_version IS NULL OR p_version <> public.media_terms_current() OR p_version = 0 THEN
    RAISE EXCEPTION 'These terms have been updated. Please reload and read the latest version.';
  END IF;
  PERFORM set_config('magma.media_terms_ok', 'on', true);
  UPDATE public.profiles SET media_terms_version = p_version, media_terms_agreed_at = now() WHERE id = auth.uid();
  PERFORM set_config('magma.media_terms_ok', '', true);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.agree_media_terms(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.agree_media_terms(integer) TO authenticated;

-- Installers may edit their own profile, so stop them setting the agreement themselves
CREATE OR REPLACE FUNCTION public.protect_media_terms_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.media_terms_version IS DISTINCT FROM OLD.media_terms_version
      OR NEW.media_terms_agreed_at IS DISTINCT FROM OLD.media_terms_agreed_at)
     AND COALESCE(current_setting('magma.media_terms_ok', true), '') <> 'on'
     AND auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    NEW.media_terms_version := OLD.media_terms_version;
    NEW.media_terms_agreed_at := OLD.media_terms_agreed_at;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_media_terms_columns ON public.profiles;
CREATE TRIGGER protect_media_terms_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_media_terms_columns();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.media_settings, public.media_terms, public.media_campaigns, public.media_items,
  public.media_files, public.media_links, public.media_events, public.media_shares FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_settings, public.media_terms, public.media_campaigns,
  public.media_items, public.media_files, public.media_links, public.media_events, public.media_shares TO authenticated;
GRANT USAGE ON SEQUENCE public.media_events_id_seq TO authenticated;

ALTER TABLE public.media_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_terms     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_shares    ENABLE ROW LEVEL SECURITY;

-- Settings and terms: admins only (installers get what they need through media_access)
DROP POLICY IF EXISTS "Admins manage media settings" ON public.media_settings;
CREATE POLICY "Admins manage media settings" ON public.media_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admins manage media terms" ON public.media_terms;
CREATE POLICY "Admins manage media terms" ON public.media_terms FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Campaigns
DROP POLICY IF EXISTS "Read media campaigns" ON public.media_campaigns;
CREATE POLICY "Read media campaigns" ON public.media_campaigns FOR SELECT TO authenticated
  USING (public.can_see_media());
DROP POLICY IF EXISTS "Admins manage media campaigns" ON public.media_campaigns;
CREATE POLICY "Admins manage media campaigns" ON public.media_campaigns FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Items: published ones for people who can see the pack; drafts for admins only
DROP POLICY IF EXISTS "Read media items" ON public.media_items;
CREATE POLICY "Read media items" ON public.media_items FOR SELECT TO authenticated
  USING (public.can_see_media() AND (status = 'published' OR public.is_admin()));
DROP POLICY IF EXISTS "Admins manage media items" ON public.media_items;
CREATE POLICY "Admins manage media items" ON public.media_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Files: the current files of visible items; replaced files for admins only
DROP POLICY IF EXISTS "Read media files" ON public.media_files;
CREATE POLICY "Read media files" ON public.media_files FOR SELECT TO authenticated
  USING (public.is_admin() OR (is_current AND public.can_see_media() AND EXISTS (
    SELECT 1 FROM public.media_items i WHERE i.id = item_id AND i.status = 'published')));
DROP POLICY IF EXISTS "Admins manage media files" ON public.media_files;
CREATE POLICY "Admins manage media files" ON public.media_files FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Read media links" ON public.media_links;
CREATE POLICY "Read media links" ON public.media_links FOR SELECT TO authenticated
  USING (public.can_see_media() AND EXISTS (
    SELECT 1 FROM public.media_items i WHERE i.id = item_id AND (i.status = 'published' OR public.is_admin())));
DROP POLICY IF EXISTS "Admins manage media links" ON public.media_links;
CREATE POLICY "Admins manage media links" ON public.media_links FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Events: installers record their own actions on items they can see; admins read them
DROP POLICY IF EXISTS "Log own media events" ON public.media_events;
CREATE POLICY "Log own media events" ON public.media_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_media() AND EXISTS (
    SELECT 1 FROM public.media_items i WHERE i.id = item_id AND (i.status = 'published' OR public.is_admin())));
DROP POLICY IF EXISTS "Admins read media events" ON public.media_events;
CREATE POLICY "Admins read media events" ON public.media_events FOR SELECT TO authenticated
  USING (public.is_admin());

-- Share links: an installer creates and switches off their own, for published architect files only
DROP POLICY IF EXISTS "Installers manage own media shares" ON public.media_shares;
CREATE POLICY "Installers manage own media shares" ON public.media_shares FOR ALL TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() AND public.can_see_media() AND EXISTS (
    SELECT 1 FROM public.media_files f JOIN public.media_items i ON i.id = f.item_id
    WHERE f.id = file_id AND f.is_current AND i.status = 'published' AND i.section = 'architects'));

-- ---------------------------------------------------------------------------
-- 4. Admin functions (one step each, so nothing is left half done)
-- ---------------------------------------------------------------------------
-- Create or update an item, its files (in order) and its links.
-- p.files is the full list of current files: existing ones by id, new ones with their details.
-- Current files left out of the list are kept as replaced files (admin reference).
CREATE OR REPLACE FUNCTION public.save_media_item(p jsonb)
RETURNS public.media_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid := (p->>'id')::uuid;
  v_old public.media_items%ROWTYPE;
  v_new public.media_items%ROWTYPE;
  v_status text := COALESCE(p->>'status', 'draft');
  v_section text := p->>'section';
  f jsonb;
  pos integer := 0;
  keep uuid[] := '{}';
  v_fid uuid;
  n_image integer; n_video integer; n_doc integer; n_zip integer; n_all integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Item id missing'; END IF;
  SELECT * INTO v_old FROM public.media_items WHERE id = v_id FOR UPDATE;

  INSERT INTO public.media_items AS m (id, title, section, campaign_id, description, caption, hashtags, credit, format,
    status, check_watermark, check_permission, published_at, updated_by)
  VALUES (v_id, trim(p->>'title'), v_section, NULLIF(p->>'campaign_id', '')::uuid, NULLIF(trim(p->>'description'), ''),
    NULLIF(p->>'caption', ''), NULLIF(trim(p->>'hashtags'), ''), NULLIF(trim(p->>'credit'), ''), NULLIF(p->>'format', ''),
    v_status, COALESCE((p->>'check_watermark')::boolean, false), COALESCE((p->>'check_permission')::boolean, false),
    CASE WHEN v_status = 'published' THEN now() END, auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, section = EXCLUDED.section, campaign_id = EXCLUDED.campaign_id,
    description = EXCLUDED.description, caption = EXCLUDED.caption, hashtags = EXCLUDED.hashtags,
    credit = EXCLUDED.credit, format = EXCLUDED.format, status = EXCLUDED.status,
    check_watermark = EXCLUDED.check_watermark, check_permission = EXCLUDED.check_permission,
    -- "New" counts from the first time it was published
    published_at = CASE WHEN EXCLUDED.status = 'published' THEN COALESCE(m.published_at, now()) ELSE m.published_at END,
    updated_at = now(), updated_by = auth.uid();

  -- New items go to the end of their section
  IF v_old.id IS NULL OR v_old.section IS DISTINCT FROM v_section THEN
    UPDATE public.media_items SET display_order = COALESCE((
      SELECT max(display_order) + 1 FROM public.media_items WHERE section = v_section AND id <> v_id), 0)
    WHERE id = v_id;
  END IF;

  IF p ? 'files' THEN
    FOR f IN SELECT * FROM jsonb_array_elements(p->'files') LOOP
      IF f ? 'id' AND f->>'id' IS NOT NULL THEN
        -- Existing file: new place in the order, and a new cover image if one was given
        UPDATE public.media_files SET position = pos,
          preview_path = COALESCE(NULLIF(f->>'preview_path', ''), preview_path)
        WHERE id = (f->>'id')::uuid AND item_id = v_id AND is_current;
        IF NOT FOUND THEN RAISE EXCEPTION 'A file no longer belongs to this item. Please reload.'; END IF;
        keep := keep || (f->>'id')::uuid;
      ELSE
        INSERT INTO public.media_files (item_id, position, kind, file_path, file_name, mime_type, file_size,
          width, height, duration_s, preview_path)
        VALUES (v_id, pos, f->>'kind', f->>'file_path', f->>'file_name', f->>'mime_type', (f->>'file_size')::bigint,
          NULLIF(f->>'width', '')::integer, NULLIF(f->>'height', '')::integer, NULLIF(f->>'duration_s', '')::numeric,
          NULLIF(f->>'preview_path', ''))
        RETURNING id INTO v_fid;
        keep := keep || v_fid;
      END IF;
      pos := pos + 1;
    END LOOP;
    UPDATE public.media_files SET is_current = false, replaced_at = now()
    WHERE item_id = v_id AND is_current AND NOT (id = ANY (keep));
  END IF;

  -- What each section may hold
  SELECT count(*) FILTER (WHERE kind = 'image'), count(*) FILTER (WHERE kind = 'video'),
         count(*) FILTER (WHERE kind = 'document'), count(*) FILTER (WHERE kind = 'zip'), count(*)
  INTO n_image, n_video, n_doc, n_zip, n_all
  FROM public.media_files WHERE item_id = v_id AND is_current;
  IF v_section = 'social' AND (n_all <> n_image OR n_image > 10) THEN
    RAISE EXCEPTION 'Social posts hold 1 to 10 images (JPG, PNG or WebP).';
  ELSIF v_section = 'videos' AND (n_all <> n_video OR n_video > 1) THEN
    RAISE EXCEPTION 'A video item holds one MP4 file.';
  ELSIF v_section = 'architects' AND (n_all <> n_doc OR n_doc > 2) THEN
    RAISE EXCEPTION 'Architect items hold a Word file, a PDF, or one of each.';
  ELSIF v_section = 'logos' AND (n_all <> n_image + n_doc OR n_all > 2
        OR EXISTS (SELECT 1 FROM public.media_files WHERE item_id = v_id AND is_current
                   AND mime_type NOT IN ('image/png', 'application/pdf'))) THEN
    RAISE EXCEPTION 'Logos and badges are a PNG, a PDF, or one of each.';
  ELSIF v_section = 'pack' AND (n_all <> n_zip OR n_zip > 1) THEN
    RAISE EXCEPTION 'A whole pack is one ZIP file.';
  END IF;
  IF v_status = 'published' AND n_all = 0 THEN
    RAISE EXCEPTION 'Add a file before publishing.';
  END IF;

  DELETE FROM public.media_links WHERE item_id = v_id;
  INSERT INTO public.media_links (item_id, product_id)
  SELECT v_id, x::uuid FROM jsonb_array_elements_text(COALESCE(p->'product_ids', '[]'::jsonb)) x;
  INSERT INTO public.media_links (item_id, system_id)
  SELECT v_id, x::uuid FROM jsonb_array_elements_text(COALESCE(p->'system_ids', '[]'::jsonb)) x;

  SELECT * INTO v_new FROM public.media_items WHERE id = v_id;
  RETURN v_new;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_media_item(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_media_item(jsonb) TO authenticated;

-- Delete an item; returns every stored file (current, replaced and previews) to remove from storage
CREATE OR REPLACE FUNCTION public.delete_media_item(p_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  paths text[];
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT array_remove(array_agg(fp), NULL) INTO paths FROM (
    SELECT file_path AS fp FROM public.media_files WHERE item_id = p_id
    UNION ALL SELECT preview_path FROM public.media_files WHERE item_id = p_id) x;
  DELETE FROM public.media_items WHERE id = p_id;
  RETURN COALESCE(paths, '{}');
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_media_item(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_media_item(uuid) TO authenticated;

-- Move an item up or down within its section (swap with its neighbour), or pin it
CREATE OR REPLACE FUNCTION public.move_media_item(p_id uuid, p_direction integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me public.media_items%ROWTYPE;
  other public.media_items%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  -- Renumber the section first so every item has its own place
  UPDATE public.media_items m SET display_order = r.rn FROM (
    SELECT id, row_number() OVER (ORDER BY display_order, created_at) AS rn
    FROM public.media_items WHERE section = (SELECT section FROM public.media_items WHERE id = p_id)) r
  WHERE m.id = r.id;
  SELECT * INTO me FROM public.media_items WHERE id = p_id;
  IF p_direction < 0 THEN
    SELECT * INTO other FROM public.media_items WHERE section = me.section AND display_order < me.display_order
    ORDER BY display_order DESC LIMIT 1;
  ELSE
    SELECT * INTO other FROM public.media_items WHERE section = me.section AND display_order > me.display_order
    ORDER BY display_order LIMIT 1;
  END IF;
  IF other.id IS NULL THEN RETURN; END IF;
  UPDATE public.media_items SET display_order = other.display_order WHERE id = me.id;
  UPDATE public.media_items SET display_order = me.display_order WHERE id = other.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.move_media_item(uuid, integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.move_media_item(uuid, integer) TO authenticated;

-- Only one pinned item per section
CREATE OR REPLACE FUNCTION public.pin_media_item(p_id uuid, p_pinned boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_pinned THEN
    UPDATE public.media_items SET pinned = false
    WHERE pinned AND section = (SELECT section FROM public.media_items WHERE id = p_id) AND id <> p_id;
  END IF;
  UPDATE public.media_items SET pinned = p_pinned WHERE id = p_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.pin_media_item(uuid, boolean) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.pin_media_item(uuid, boolean) TO authenticated;

-- Counts per item for the admin list
CREATE OR REPLACE FUNCTION public.media_stats()
RETURNS TABLE (item_id uuid, views bigint, saves bigint, captions bigint, downloads bigint, shares bigint, people bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT e.item_id,
    count(*) FILTER (WHERE e.event = 'view'), count(*) FILTER (WHERE e.event = 'save'),
    count(*) FILTER (WHERE e.event = 'caption'), count(*) FILTER (WHERE e.event = 'download'),
    count(*) FILTER (WHERE e.event = 'share'), count(DISTINCT e.user_id)
  FROM public.media_events e GROUP BY e.item_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.media_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.media_stats() TO authenticated;

-- "See who": one row per person for an item, with what they did and when last
CREATE OR REPLACE FUNCTION public.media_item_people(p_item uuid)
RETURNS TABLE (user_id uuid, name text, company text, views bigint, saves bigint, captions bigint,
               downloads bigint, shares bigint, last_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT e.user_id,
    COALESCE(NULLIF(p.full_name, ''), NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Unknown'),
    COALESCE(p.company_name, ''),
    count(*) FILTER (WHERE e.event = 'view'), count(*) FILTER (WHERE e.event = 'save'),
    count(*) FILTER (WHERE e.event = 'caption'), count(*) FILTER (WHERE e.event = 'download'),
    count(*) FILTER (WHERE e.event = 'share'), max(e.created_at)
  FROM public.media_events e LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.item_id = p_item
  GROUP BY e.user_id, p.full_name, p.first_name, p.last_name, p.email, p.company_name
  ORDER BY max(e.created_at) DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.media_item_people(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.media_item_people(uuid) TO authenticated;

-- Who has agreed to which version of the terms (Admin > Media pack > Settings)
CREATE OR REPLACE FUNCTION public.media_terms_agreements()
RETURNS TABLE (user_id uuid, name text, company text, version integer, agreed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT p.id,
    COALESCE(NULLIF(p.full_name, ''), NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), ''), p.email, 'Unknown'),
    COALESCE(p.company_name, ''), p.media_terms_version, p.media_terms_agreed_at
  FROM public.profiles p WHERE p.media_terms_version IS NOT NULL ORDER BY p.media_terms_agreed_at DESC;
END $$;
REVOKE EXECUTE ON FUNCTION public.media_terms_agreements() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.media_terms_agreements() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. The no-login share page for one architect file
-- ---------------------------------------------------------------------------
-- Live only while: the link is not switched off or expired, the installer is not suspended,
-- the Media pack is switched on and the file is still the current file of a published item.
CREATE OR REPLACE FUNCTION public.media_share_live(p_file_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.media_pack_enabled() AND EXISTS (
    SELECT 1 FROM public.media_shares s
    JOIN public.media_files f ON f.id = s.file_id
    JOIN public.media_items i ON i.id = f.item_id
    JOIN public.profiles p ON p.id = s.created_by
    WHERE f.file_path = p_file_path AND f.is_current AND i.status = 'published' AND i.section = 'architects'
      AND s.revoked_at IS NULL AND s.expires_at > now() AND COALESCE(p.status, 'active') <> 'suspended')
$$;
REVOKE EXECUTE ON FUNCTION public.media_share_live(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.media_share_live(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_media_share(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
BEGIN
  SELECT i.title, i.description, f.file_path, f.file_name, f.file_size, f.mime_type, s.expires_at,
         p.company_name, NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS installer_name
  INTO r
  FROM public.media_shares s
  JOIN public.media_files f ON f.id = s.file_id
  JOIN public.media_items i ON i.id = f.item_id
  JOIN public.profiles p ON p.id = s.created_by
  WHERE s.token = p_token AND s.revoked_at IS NULL AND s.expires_at > now()
    AND f.is_current AND i.status = 'published' AND i.section = 'architects'
    AND COALESCE(p.status, 'active') <> 'suspended' AND public.media_pack_enabled();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('title', r.title, 'description', r.description, 'file_path', r.file_path,
    'file_name', r.file_name, 'file_size', r.file_size, 'mime_type', r.mime_type, 'expires_at', r.expires_at,
    'company_name', r.company_name, 'installer_name', r.installer_name);
END $$;
REVOKE EXECUTE ON FUNCTION public.get_media_share(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_media_share(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. File storage: one private bucket, never public. Files are reached only through
--    short-lived signed links, which storage hands out only when these rules allow.
--    The bucket's overall cap is the zip limit; each kind's own limit is checked above
--    (media_files) and in the app before uploading. SVG is not allowed (it can carry scripts).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', false, 524288000, ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip', 'application/x-zip-compressed'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins manage media files in storage" ON storage.objects;
CREATE POLICY "Admins manage media files in storage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'media' AND public.is_admin())
  WITH CHECK (bucket_id = 'media' AND public.is_admin());

DROP POLICY IF EXISTS "Read visible media files" ON storage.objects;
CREATE POLICY "Read visible media files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.can_see_media() AND EXISTS (
    SELECT 1 FROM public.media_files f JOIN public.media_items i ON i.id = f.item_id
    WHERE f.is_current AND i.status = 'published'
      AND (f.file_path = storage.objects.name OR f.preview_path = storage.objects.name)));

DROP POLICY IF EXISTS "Read shared architect files" ON storage.objects;
CREATE POLICY "Read shared architect files" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'media' AND public.media_share_live(storage.objects.name));

-- ---------------------------------------------------------------------------
-- 7. Starting content: terms version 1 (the draft for approval) and the first campaign
-- ---------------------------------------------------------------------------
INSERT INTO public.media_terms (version, title, body) VALUES (1, 'Magma Media pack: terms of use',
'Magma Coatings Ltd lets approved Magma installers use the material in this Media pack, free of charge, on these terms.

1. What you may do. Use the images, videos, captions and documents to promote your own work with Magma products: on your social media, website, quotes, vans and printed material, and by passing specification documents to your clients, architects and designers.

2. Keep it intact. Do not remove or cover watermarks or credits, and do not alter, recolour, stretch or redraw the Magma logo or badge.

3. Magma products only. Do not use the material to promote work carried out with other manufacturers'' products, or in a way that suggests a project was yours when it was not.

4. Captions. You may edit captions, but keep any credit or tag Magma has included.

5. Specification documents. Pass them on as supplied. Do not change technical content or present them as your own specification.

6. No resale. Do not sell or share the material outside your business.

7. Ending use. If your Magma installer access ends, or Magma asks you to remove an item, stop using it and take it down within 14 days.

8. Ownership. All material remains the property of Magma Coatings Ltd or its photographers. MAGMA is a trade mark of Magma Coatings Ltd.

By tapping I agree you accept these terms on behalf of your business.')
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.media_campaigns (name, starts_on, display_order)
SELECT 'November 2026', DATE '2026-11-01', 0
WHERE NOT EXISTS (SELECT 1 FROM public.media_campaigns);

-- ---------------------------------------------------------------------------
-- 8. Documents library: also accept Word (.docx) files, e.g. the NBS-style clauses
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET allowed_mime_types = ARRAY['application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
WHERE id = 'documents';

COMMIT;

-- Check: the switch should be off (false) and the bucket private (false)
SELECT (SELECT media_pack_enabled FROM public.media_settings WHERE id = 1) AS media_pack_enabled,
       (SELECT public FROM storage.buckets WHERE id = 'media') AS bucket_public,
       (SELECT max(version) FROM public.media_terms) AS terms_version;
