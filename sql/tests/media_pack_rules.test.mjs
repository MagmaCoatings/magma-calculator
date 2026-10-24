// How to run: npm i --no-save @electric-sql/pglite && node sql/tests/media_pack_rules.test.mjs sql/media_pack.sql
// Applies the script to a throwaway in-memory Postgres with Supabase-like stubs and checks every access rule.
// Rule tests for sql/media_pack.sql on a throwaway Postgres (PGlite) with Supabase-like stubs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'

const sqlPath = process.argv[2]
const db = new PGlite()
const results = []
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]) }

await db.exec(`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
INSERT INTO storage.buckets VALUES ('documents','documents',false,26214400,ARRAY['application/pdf']);

CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id), email text, full_name text, first_name text,
  last_name text, company_name text, role text DEFAULT 'installer', status text DEFAULT 'active');
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'); END $$;
CREATE FUNCTION public.is_active_user() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND COALESCE(p.status,'active') <> 'suspended') $$;
CREATE POLICY "own" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "admin upd" ON public.profiles FOR UPDATE USING (is_admin());
CREATE POLICY "upd own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TABLE public.products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
CREATE TABLE public.systems (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text);
`)

await db.exec(fs.readFileSync(sqlPath, 'utf8'))
// Running it a second time must also work
await db.exec(fs.readFileSync(sqlPath, 'utf8'))
ok('script runs twice without error', true)

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const INST = '00000000-0000-0000-0000-00000000000b'
const SUSP = '00000000-0000-0000-0000-00000000000c'
const ITEM = '11111111-1111-1111-1111-111111111111'
const DRAFT = '22222222-2222-2222-2222-222222222222'
const ARCH = '33333333-3333-3333-3333-333333333333'
await db.exec(`
INSERT INTO auth.users VALUES ('${ADMIN}'),('${INST}'),('${SUSP}');
INSERT INTO public.profiles (id, email, full_name, company_name, role, status) VALUES
 ('${ADMIN}','a@x','Admin','Magma','admin','active'),
 ('${INST}','i@x','Ian Installer','Smith Interiors','installer','active'),
 ('${SUSP}','s@x','Sam Suspended','Gone Ltd','installer','suspended');
INSERT INTO storage.objects (bucket_id, name) VALUES
 ('media','item/a.jpg'),('media','item/a-prev.webp'),('media','draft/b.jpg'),('media','arch/spec.pdf'),('media','item/old.jpg');
`)

async function as(uid, fn) {
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uid || ''}', false); SET ROLE ${uid ? 'authenticated' : 'anon'};`)
  try { return await fn() } finally { await db.exec('RESET ROLE;') }
}
const q = async (sql, params) => (await db.query(sql, params)).rows
const tryq = async (sql, params) => { try { return { rows: await q(sql, params) } } catch (e) { return { error: e.message } } }

// --- Admin builds content while the switch is off
const r1 = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: ITEM, title: 'Polished wet room, Essex', section: 'social', caption: 'Seamless', status: 'published',
  check_watermark: true, check_permission: true,
  files: [{ kind: 'image', file_path: 'item/a.jpg', file_name: 'a.jpg', mime_type: 'image/jpeg', file_size: 1000, width: 1080, height: 1350, preview_path: 'item/a-prev.webp' }],
})]))
ok('admin saves and publishes an item', !r1.error, r1.error)

const r2 = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: DRAFT, title: 'Draft', section: 'social', status: 'published', check_watermark: true, check_permission: false,
  files: [{ kind: 'image', file_path: 'draft/b.jpg', file_name: 'b.jpg', mime_type: 'image/jpeg', file_size: 1000 }],
})]))
ok('publishing without both checks is refused', !!r2.error, r2.error)
const r2b = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: DRAFT, title: 'Draft', section: 'social', status: 'draft',
  files: [{ kind: 'image', file_path: 'draft/b.jpg', file_name: 'b.jpg', mime_type: 'image/jpeg', file_size: 1000 }],
})]))
ok('admin saves a draft', !r2b.error, r2b.error)

const rbad = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: '44444444-4444-4444-4444-444444444444', title: 'Big', section: 'social', status: 'draft',
  files: [{ kind: 'image', file_path: 'x/big.jpg', file_name: 'big.jpg', mime_type: 'image/jpeg', file_size: 20 * 1024 * 1024 }],
})]))
ok('a 20 MB image is refused (15 MB limit)', !!rbad.error, rbad.error)
const rsvg = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: '55555555-5555-5555-5555-555555555555', title: 'Logo', section: 'logos', status: 'draft',
  files: [{ kind: 'image', file_path: 'x/logo.svg', file_name: 'logo.svg', mime_type: 'image/svg+xml', file_size: 100 }],
})]))
ok('an SVG is refused', !!rsvg.error, rsvg.error)
const rmix = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: '66666666-6666-6666-6666-666666666666', title: 'Mixed', section: 'videos', status: 'draft',
  files: [{ kind: 'image', file_path: 'x/v.jpg', file_name: 'v.jpg', mime_type: 'image/jpeg', file_size: 100 }],
})]))
ok('an image in the Videos section is refused', !!rmix.error, rmix.error)

const r3 = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: ARCH, title: 'NBS clauses', section: 'architects', status: 'published', check_watermark: true, check_permission: true,
  files: [{ kind: 'document', file_path: 'arch/spec.pdf', file_name: 'spec.pdf', mime_type: 'application/pdf', file_size: 5000 }],
})]))
ok('admin publishes an architect PDF', !r3.error, r3.error)

const adminItems = await as(ADMIN, () => q(`SELECT id FROM public.media_items`))
ok('admin sees drafts and published items with the switch off', adminItems.length === 3, String(adminItems.length))
const adminAccess = await as(ADMIN, () => q(`SELECT public.media_access() a`))
ok('admin gets the Media tab (preview) with the switch off', adminAccess[0].a.visible === true && adminAccess[0].a.enabled === false)
const adminObj = await as(ADMIN, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media'`))
ok('admin can reach every stored file', adminObj.length === 5)

// --- Installer before launch: nothing
const accOff = await as(INST, () => q(`SELECT public.media_access() a`))
ok('installer before launch: tab hidden, no detail given', JSON.stringify(accOff[0].a) === '{"visible": false}' || JSON.stringify(accOff[0].a) === '{"visible":false}', JSON.stringify(accOff[0].a))
ok('installer before launch: no items', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 0)
ok('installer before launch: no files', (await as(INST, () => q(`SELECT * FROM public.media_files`))).length === 0)
ok('installer before launch: no campaigns', (await as(INST, () => q(`SELECT * FROM public.media_campaigns`))).length === 0)
ok('installer before launch: cannot read settings or terms', (await as(INST, () => q(`SELECT * FROM public.media_settings UNION ALL SELECT 1,false,'','',null,now(),null FROM public.media_terms`))).length === 0)
ok('installer before launch: no stored files', (await as(INST, () => q(`SELECT * FROM storage.objects WHERE bucket_id='media'`))).length === 0)
const agreeOff = await as(INST, () => tryq(`SELECT public.agree_media_terms(1)`))
ok('installer before launch: cannot agree to terms', !!agreeOff.error, agreeOff.error)
const turnOn = await as(INST, () => tryq(`UPDATE public.media_settings SET media_pack_enabled = true RETURNING 1`))
ok('installer cannot turn the switch on', !turnOn.error && turnOn.rows.length === 0)

// --- Launch
await as(ADMIN, () => q(`UPDATE public.media_settings SET media_pack_enabled = true, enabled_at = now()`))

// Installer after launch, not yet agreed
const accOn = await as(INST, () => q(`SELECT public.media_access() a`))
ok('installer after launch: sees the terms prompt', accOn[0].a.visible === true && accOn[0].a.agreed === false && accOn[0].a.terms_version === 1)
ok('installer after launch without agreeing: no items', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 0)
ok('installer after launch without agreeing: no stored files', (await as(INST, () => q(`SELECT * FROM storage.objects WHERE bucket_id='media'`))).length === 0)

// Trying to skip the terms by editing their own profile
await as(INST, () => tryq(`UPDATE public.profiles SET media_terms_version = 1, media_terms_agreed_at = now() WHERE id = '${INST}'`))
ok('installer cannot mark themselves as agreed by editing their profile', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 0)
const wrongV = await as(INST, () => tryq(`SELECT public.agree_media_terms(99)`))
ok('agreeing to a version that is not current is refused', !!wrongV.error)

const agree = await as(INST, () => tryq(`SELECT public.agree_media_terms(1)`))
ok('installer agrees', !agree.error, agree.error)
const instItems = await as(INST, () => q(`SELECT id, status FROM public.media_items`))
ok('installer after agreeing: sees published items only (no drafts)', instItems.length === 2 && instItems.every(i => i.status === 'published'), JSON.stringify(instItems))
const instObj = (await as(INST, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media' ORDER BY name`))).map(r => r.name)
ok('installer reaches published files and previews, not draft files', JSON.stringify(instObj) === JSON.stringify(['arch/spec.pdf', 'item/a-prev.webp', 'item/a.jpg']), JSON.stringify(instObj))
const ev = await as(INST, () => tryq(`INSERT INTO public.media_events (item_id, event) VALUES ('${ITEM}', 'save')`))
ok('installer logs a save', !ev.error, ev.error)
const evDraft = await as(INST, () => tryq(`INSERT INTO public.media_events (item_id, event) VALUES ('${DRAFT}', 'save')`))
ok('installer cannot log events on a draft', !!evDraft.error)
const evFake = await as(INST, () => tryq(`INSERT INTO public.media_events (item_id, user_id, event) VALUES ('${ITEM}', '${ADMIN}', 'save')`))
ok('installer cannot log events as someone else', !!evFake.error)
ok('installer cannot read the event log', (await as(INST, () => q(`SELECT * FROM public.media_events`))).length === 0)
const instEdit = await as(INST, () => tryq(`UPDATE public.media_items SET title = 'hacked' RETURNING 1`))
ok('installer cannot edit items', !instEdit.error && instEdit.rows.length === 0)
const instSave = await as(INST, () => tryq(`SELECT public.save_media_item('{"id":"${ITEM}"}'::jsonb)`))
ok('installer cannot use the admin save function', !!instSave.error)

// Share link for an architect file
const fileRow = await as(INST, () => q(`SELECT id FROM public.media_files WHERE file_path = 'arch/spec.pdf'`))
const socialFile = await as(INST, () => q(`SELECT id FROM public.media_files WHERE file_path = 'item/a.jpg'`))
const shareSocial = await as(INST, () => tryq(`INSERT INTO public.media_shares (file_id) VALUES ('${socialFile[0].id}') RETURNING token`))
ok('share links only for architect files', !!shareSocial.error)
const share = await as(INST, () => tryq(`INSERT INTO public.media_shares (file_id) VALUES ('${fileRow[0].id}') RETURNING token, expires_at`))
ok('installer creates a 30-day share link', !share.error, share.error)
const token = share.rows?.[0]?.token
const pub = await as(null, () => q(`SELECT public.get_media_share($1) s`, [token]))
ok('the share page works without a login', pub[0].s && pub[0].s.file_path === 'arch/spec.pdf')
const pubObj = await as(null, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media'`))
ok('without a login, only the shared file is reachable', pubObj.length === 1 && pubObj[0].name === 'arch/spec.pdf', JSON.stringify(pubObj))
const anonItems = await as(null, () => tryq(`SELECT * FROM public.media_items`))
ok('without a login, the media tables are closed', !!anonItems.error || anonItems.rows.length === 0)

// Suspended installer: nothing, and their share links stop
await as(ADMIN, () => q(`UPDATE public.profiles SET media_terms_version = 1 WHERE id = '${SUSP}'`))
ok('admin can set agreement fields directly (support)', (await as(ADMIN, () => q(`SELECT media_terms_version v FROM public.profiles WHERE id='${SUSP}'`)))[0].v === 1)
ok('suspended installer: tab hidden', (await as(SUSP, () => q(`SELECT public.media_access() a`)))[0].a.visible === false)
ok('suspended installer: no items', (await as(SUSP, () => q(`SELECT * FROM public.media_items`))).length === 0)
const suspObj = await as(SUSP, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media'`))
ok('suspended installer: no stored files beyond a file someone shared by link', suspObj.every(r => r.name === 'arch/spec.pdf'), JSON.stringify(suspObj))
await as(ADMIN, () => q(`UPDATE public.profiles SET status = 'suspended' WHERE id = '${INST}'`))
ok('share link stops when its installer is suspended', (await as(null, () => q(`SELECT public.get_media_share($1) s`, [token])))[0].s === null)
ok('shared file unreachable once suspended', (await as(null, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media'`))).length === 0)
await as(ADMIN, () => q(`UPDATE public.profiles SET status = 'active' WHERE id = '${INST}'`))

// Terms updated: everyone is asked again
await as(ADMIN, () => q(`INSERT INTO public.media_terms (version, title, body) VALUES (2, 'Terms v2', 'Updated')`))
const acc2 = await as(INST, () => q(`SELECT public.media_access() a`))
ok('new terms version: installer asked again', acc2[0].a.agreed === false && acc2[0].a.terms_version === 2)
ok('new terms version: content hidden until agreed', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 0)
await as(INST, () => q(`SELECT public.agree_media_terms(2)`))
ok('agreeing again restores access', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 2)

// Switch off again: hidden instantly, nothing deleted
await as(ADMIN, () => q(`UPDATE public.media_settings SET media_pack_enabled = false`))
ok('switch off: installer sees nothing again', (await as(INST, () => q(`SELECT * FROM public.media_items`))).length === 0)
ok('switch off: share links stop', (await as(null, () => q(`SELECT public.get_media_share($1) s`, [token])))[0].s === null)
ok('switch off: content still there for admin', (await as(ADMIN, () => q(`SELECT * FROM public.media_items`))).length === 3)
await as(ADMIN, () => q(`UPDATE public.media_settings SET media_pack_enabled = true`))

// Replacing a file keeps the old one for admin reference only
await db.exec(`INSERT INTO storage.objects (bucket_id, name) VALUES ('media','item/new.jpg')`)
const cur = await as(ADMIN, () => q(`SELECT id FROM public.media_files WHERE file_path='item/a.jpg'`))
const rep = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: ITEM, title: 'Polished wet room, Essex', section: 'social', status: 'published', check_watermark: true, check_permission: true,
  files: [{ kind: 'image', file_path: 'item/new.jpg', file_name: 'new.jpg', mime_type: 'image/jpeg', file_size: 900 }],
})]))
ok('admin replaces an image', !rep.error, rep.error)
const oldRow = await as(ADMIN, () => q(`SELECT is_current FROM public.media_files WHERE id = '${cur[0].id}'`))
ok('old file kept, marked replaced', oldRow[0].is_current === false)
const instNames = (await as(INST, () => q(`SELECT name FROM storage.objects WHERE bucket_id='media' ORDER BY name`))).map(r => r.name)
ok('installer gets the new file, not the replaced one', instNames.includes('item/new.jpg') && !instNames.includes('item/a.jpg'), JSON.stringify(instNames))

// Carousel order kept, existing files by id
const car = '77777777-7777-7777-7777-777777777777'
const rc = await as(ADMIN, () => tryq(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({
  id: car, title: 'Carousel', section: 'social', status: 'draft',
  files: [1, 2, 3].map(n => ({ kind: 'image', file_path: `car/${n}.jpg`, file_name: `${n}.jpg`, mime_type: 'image/jpeg', file_size: 100 })),
})]))
ok('carousel of 3 saved', !rc.error, rc.error)
const ids = (await as(ADMIN, () => q(`SELECT id FROM public.media_files WHERE item_id='${car}' ORDER BY position`))).map(r => r.id)
await as(ADMIN, () => q(`SELECT public.save_media_item($1::jsonb)`, [JSON.stringify({ id: car, title: 'Carousel', section: 'social', status: 'draft', files: [{ id: ids[2] }, { id: ids[0] }, { id: ids[1] }] })]))
const ids2 = (await as(ADMIN, () => q(`SELECT id FROM public.media_files WHERE item_id='${car}' AND is_current ORDER BY position`))).map(r => r.id)
ok('carousel reordered without re-uploading', JSON.stringify(ids2) === JSON.stringify([ids[2], ids[0], ids[1]]))

// Ordering and pinning
await as(ADMIN, () => q(`SELECT public.move_media_item('${car}', -1)`))
await as(ADMIN, () => q(`SELECT public.pin_media_item('${car}', true)`))
await as(ADMIN, () => q(`SELECT public.pin_media_item('${ITEM}', true)`))
const pins = await as(ADMIN, () => q(`SELECT id FROM public.media_items WHERE pinned`))
ok('only one pinned item per section', pins.length === 1 && pins[0].id === ITEM)

// Stats
const st = await as(ADMIN, () => q(`SELECT * FROM public.media_stats()`))
ok('stats count the save', st.some(r => r.item_id === ITEM && Number(r.saves) === 1))
const who = await as(ADMIN, () => q(`SELECT * FROM public.media_item_people('${ITEM}')`))
ok('See who lists the installer', who.length === 1 && who[0].company === 'Smith Interiors')
const stInst = await as(INST, () => tryq(`SELECT * FROM public.media_stats()`))
ok('installer cannot read stats', !!stInst.error)

// Delete returns all stored paths
const del = await as(ADMIN, () => q(`SELECT public.delete_media_item('${ITEM}') p`))
ok('delete returns every stored file, including replaced and previews', ['item/a.jpg', 'item/new.jpg', 'item/a-prev.webp'].every(x => del[0].p.includes(x)), JSON.stringify(del[0].p))

ok('documents bucket now accepts Word files', (await q(`SELECT allowed_mime_types a FROM storage.buckets WHERE id='documents'`))[0].a.length === 2)

let fails = 0
for (const [s, n, e] of results) { if (s === 'FAIL') fails++; console.log(`${s}  ${n}${s === 'FAIL' && e ? `  (${e})` : ''}`) }
console.log(`\n${results.length - fails} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
