-- ============================================================================
-- Document library (October 2026): TDS, SDS, installation and care guides
-- Run once in Supabase > SQL Editor. Safe to re-run.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
-- One row per document. Its slug is the permanent web address:
--   calculator.magmacoatings.com/docs/<slug>
CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  doc_type      text NOT NULL CHECK (doc_type IN ('tds', 'sds', 'install', 'care')),
  visibility    text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'installers')),
  description   text CHECK (char_length(description) <= 300),
  version       text CHECK (char_length(version) <= 30),
  issue_date    date,
  -- The current file (in the private "documents" bucket). No file yet = shown as "Coming soon"
  file_path     text,
  file_name     text,
  file_size     integer,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- Earlier files, kept when a new version is uploaded (a record of what was issued when)
CREATE TABLE IF NOT EXISTS public.document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version      text,
  issue_date   date,
  file_path    text NOT NULL,
  file_name    text,
  file_size    integer,
  replaced_at  timestamptz NOT NULL DEFAULT now(),
  replaced_by  uuid REFERENCES auth.users(id) DEFAULT auth.uid()
);
CREATE INDEX IF NOT EXISTS document_versions_doc_idx ON public.document_versions (document_id, replaced_at DESC);

-- Which products and systems a document belongs to (none = a general document)
CREATE TABLE IF NOT EXISTS public.document_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES public.products(id) ON DELETE CASCADE,
  system_id   uuid REFERENCES public.systems(id) ON DELETE CASCADE,
  CHECK (num_nonnulls(product_id, system_id) = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS document_links_product_uq ON public.document_links (document_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS document_links_system_uq  ON public.document_links (document_id, system_id)  WHERE system_id IS NOT NULL;

-- Opens and downloads by signed-in installers (counts shown in admin)
CREATE TABLE IF NOT EXISTS public.document_events (
  id          bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  event       text NOT NULL CHECK (event IN ('open', 'download')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS document_events_doc_idx ON public.document_events (document_id, created_at DESC);

-- "Share with client" links for a quote's documents (no login needed to open)
CREATE TABLE IF NOT EXISTS public.quote_shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token       text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '12 months',
  revoked_at  timestamptz
);
CREATE INDEX IF NOT EXISTS quote_shares_quote_idx ON public.quote_shares (quote_id);

-- Quotes remember which system(s) they were built from (for installation and care guides)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS system_ids uuid[] NOT NULL DEFAULT '{}';

-- ---------------------------------------------------------------------------
-- 2. Security (row level security)
-- ---------------------------------------------------------------------------
-- Table access (row level security below decides which rows). Visitors without a login
-- only get the columns the public pages need.
REVOKE ALL ON public.documents FROM anon;
GRANT SELECT (id, slug, title, doc_type, visibility, description, version, issue_date, file_path, file_name,
  file_size, is_active, display_order, updated_at) ON public.documents TO anon;
GRANT SELECT ON public.document_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents, public.document_links, public.document_versions,
  public.document_events, public.quote_shares TO authenticated;
GRANT USAGE ON SEQUENCE public.document_events_id_seq TO authenticated;

-- A signed-in, not suspended user
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND COALESCE(p.status, 'active') <> 'suspended')
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_active_user() TO anon, authenticated;

ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_shares      ENABLE ROW LEVEL SECURITY;

-- Public documents are readable by anyone (the permanent links); everything active by installers
DROP POLICY IF EXISTS "Read documents" ON public.documents;
CREATE POLICY "Read documents" ON public.documents FOR SELECT TO anon, authenticated
  USING (is_active AND (visibility = 'public' OR public.is_active_user()));
DROP POLICY IF EXISTS "Admins manage documents" ON public.documents;
CREATE POLICY "Admins manage documents" ON public.documents FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Read document links" ON public.document_links;
CREATE POLICY "Read document links" ON public.document_links FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.documents d WHERE d.id = document_id
                 AND d.is_active AND (d.visibility = 'public' OR public.is_active_user())));
DROP POLICY IF EXISTS "Admins manage document links" ON public.document_links;
CREATE POLICY "Admins manage document links" ON public.document_links FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins manage document versions" ON public.document_versions;
CREATE POLICY "Admins manage document versions" ON public.document_versions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Installers log their own opens" ON public.document_events;
CREATE POLICY "Installers log their own opens" ON public.document_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_active_user());
DROP POLICY IF EXISTS "Admins read document events" ON public.document_events;
CREATE POLICY "Admins read document events" ON public.document_events FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Installers manage shares of their quotes" ON public.quote_shares;
CREATE POLICY "Installers manage shares of their quotes" ON public.quote_shares FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND (q.created_by = auth.uid() OR is_admin())));

-- ---------------------------------------------------------------------------
-- 3. The client share page (no login): only what the page needs, only while the link is live
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_quote_share(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s  public.quote_shares%ROWTYPE;
  q  record;
  result jsonb;
BEGIN
  SELECT * INTO s FROM public.quote_shares
  WHERE token = p_token AND revoked_at IS NULL AND expires_at > now();
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT qt.id, qt.project_name, qt.system_ids, p.company_name,
         NULLIF(trim(concat_ws(' ', p.first_name, p.last_name)), '') AS installer_name
  INTO q
  FROM public.quotes qt JOIN public.profiles p ON p.id = qt.created_by
  WHERE qt.id = s.quote_id AND COALESCE(p.status, 'active') <> 'suspended';
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  WITH quote_products AS (
    SELECT DISTINCT pr.id FROM public.quote_items qi JOIN public.products pr ON pr.code = qi.product_code
    WHERE qi.quote_id = q.id
  ), docs AS (
    SELECT DISTINCT d.* FROM public.documents d
    WHERE d.is_active AND d.visibility = 'public' AND d.file_path IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM public.document_links l WHERE l.document_id = d.id
                AND (l.product_id IN (SELECT id FROM quote_products) OR l.system_id = ANY (q.system_ids)))
        OR (d.doc_type = 'care' AND NOT EXISTS (SELECT 1 FROM public.document_links l WHERE l.document_id = d.id))
      )
  )
  SELECT jsonb_build_object(
    'project_name', q.project_name,
    'company_name', q.company_name,
    'installer_name', q.installer_name,
    'documents', COALESCE(jsonb_agg(jsonb_build_object(
        'slug', slug, 'title', title, 'doc_type', doc_type, 'version', version, 'issue_date', issue_date,
        'file_path', file_path, 'file_name', file_name)
      ORDER BY CASE doc_type WHEN 'tds' THEN 1 WHEN 'sds' THEN 2 WHEN 'care' THEN 3 ELSE 4 END, display_order, title), '[]'::jsonb))
  INTO result FROM docs;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_quote_share(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_quote_share(text) TO anon, authenticated;

-- Open counts for the admin list
CREATE OR REPLACE FUNCTION public.document_stats()
RETURNS TABLE (document_id uuid, opens bigint, people bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN QUERY SELECT e.document_id, count(*), count(DISTINCT e.user_id) FROM public.document_events e GROUP BY e.document_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.document_stats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.document_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Saving and deleting (one step each, so nothing is left half done)
-- ---------------------------------------------------------------------------
-- Create or update a document, its current file and its links in one go.
-- A new file moves the previous one into the past versions.
CREATE OR REPLACE FUNCTION public.save_document(p jsonb)
RETURNS public.documents LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d_old public.documents%ROWTYPE;
  d_new public.documents%ROWTYPE;
  v_id uuid := (p->>'id')::uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Document id missing';
  END IF;
  SELECT * INTO d_old FROM public.documents WHERE id = v_id FOR UPDATE;

  INSERT INTO public.documents AS d (id, slug, title, doc_type, visibility, description, version, issue_date, updated_by)
  VALUES (v_id, p->>'slug', p->>'title', p->>'doc_type', p->>'visibility', NULLIF(p->>'description', ''),
          NULLIF(p->>'version', ''), NULLIF(p->>'issue_date', '')::date, auth.uid())
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug, title = EXCLUDED.title, doc_type = EXCLUDED.doc_type, visibility = EXCLUDED.visibility,
    description = EXCLUDED.description, version = EXCLUDED.version, issue_date = EXCLUDED.issue_date,
    updated_by = auth.uid(), updated_at = now();

  IF p ? 'file_path' AND p->>'file_path' IS NOT NULL AND p->>'file_path' IS DISTINCT FROM d_old.file_path THEN
    IF d_old.file_path IS NOT NULL THEN
      INSERT INTO public.document_versions (document_id, version, issue_date, file_path, file_name, file_size)
      VALUES (v_id, d_old.version, d_old.issue_date, d_old.file_path, d_old.file_name, d_old.file_size);
    END IF;
    UPDATE public.documents SET file_path = p->>'file_path', file_name = p->>'file_name',
      file_size = (p->>'file_size')::integer WHERE id = v_id;
  END IF;

  DELETE FROM public.document_links WHERE document_id = v_id;
  INSERT INTO public.document_links (document_id, product_id)
  SELECT v_id, x::uuid FROM jsonb_array_elements_text(COALESCE(p->'product_ids', '[]'::jsonb)) x;
  INSERT INTO public.document_links (document_id, system_id)
  SELECT v_id, x::uuid FROM jsonb_array_elements_text(COALESCE(p->'system_ids', '[]'::jsonb)) x;

  SELECT * INTO d_new FROM public.documents WHERE id = v_id;
  RETURN d_new;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_document(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_document(jsonb) TO authenticated;

-- Delete a document and its versions; returns the files to remove from storage
CREATE OR REPLACE FUNCTION public.delete_document(p_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  paths text[];
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  SELECT array_remove(array_agg(fp), NULL) INTO paths FROM (
    SELECT file_path AS fp FROM public.documents WHERE id = p_id
    UNION ALL SELECT file_path FROM public.document_versions WHERE document_id = p_id) f;
  DELETE FROM public.documents WHERE id = p_id;
  RETURN COALESCE(paths, '{}');
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_document(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_document(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. File storage: one private bucket. Only a document's CURRENT file can be opened:
--    by anyone for public documents, by signed-in installers for installers-only ones.
--    Past versions are only reachable by admins.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents', 'documents', false, 26214400, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Admins manage document files" ON storage.objects;
CREATE POLICY "Admins manage document files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND is_admin())
  WITH CHECK (bucket_id = 'documents' AND is_admin());

DROP POLICY IF EXISTS "Read current document files" ON storage.objects;
CREATE POLICY "Read current document files" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'documents' AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_path = storage.objects.name AND d.is_active
      AND (d.visibility = 'public' OR public.is_active_user())));

COMMIT;

-- Check: should show the documents bucket (public = false)
SELECT id, public FROM storage.buckets WHERE id = 'documents';
