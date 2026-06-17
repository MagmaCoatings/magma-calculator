# Deployment

## Build facts
- Framework: **Vite** (auto-detected)
- Build command: `npm run build`  (runs `tsc -b && vite build`)
- Output directory: `dist`
- SPA routing: handled by `vercel.json` (rewrites all paths to `index.html`)
- Env vars (both already in your local `.env.local`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## A) Vercel — staging (live URL for testing)

1. Go to **vercel.com** and **Sign in with GitHub** (the repo is `MagmaCoatings/magma-calculator`).
2. **Add New… → Project** → find **magma-calculator** → **Import**.
3. Vercel auto-detects Vite. Leave Build Command = `npm run build`, Output = `dist`.
4. Expand **Environment Variables** and add the two vars (copy the exact values from your `.env.local`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   Add them for **Production** and **Preview**.
5. Click **Deploy**. After ~1 min you'll get a URL like `https://magma-calculator.vercel.app`.
6. From now on: every push to `main` auto-deploys; every branch/PR gets its own preview URL.

### Important: let Supabase trust the Vercel URL (so login works)
In the Supabase dashboard → **Authentication → URL Configuration**:
- Add your Vercel URL (e.g. `https://magma-calculator.vercel.app`) to **Site URL** and/or the **Redirect URLs** allow-list.
Without this, sign-in/redirects can fail on the deployed site.

### Test on a real device
Open the Vercel URL on your phone (iOS + Android). Check: surface tabs, +VAT bar, History button, the InfoTip bottom sheet, Build Your Own.

---

## B) Your own hosting — production (later)

The app builds to static files, so it can be served by any static host (nginx, Apache, S3+CloudFront, etc.).

1. Build locally (env vars are baked in at build time):
   ```
   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run build
   ```
   (or put them in `.env.production` first). Output is in `dist/`.
2. Upload the contents of `dist/` to your web root.
3. Configure SPA fallback so deep links work. Example nginx:
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     root /var/www/magma-calculator;   # where you put dist/
     index index.html;
     location / {
       try_files $uri $uri/ /index.html;   # SPA fallback
     }
   }
   ```
4. Add your production domain to Supabase → Authentication → URL Configuration (as above).
5. Serve over HTTPS (Let's Encrypt / your host's TLS).

Decision for later: keep Vercel as production, or self-host fully — both work.
