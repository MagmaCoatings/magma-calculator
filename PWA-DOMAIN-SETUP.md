# PWA + Custom Domain Setup

Goal: installers add the calculator to their home screen from the **final** address
(`calculator.magmacoatings.com`) so going live never forces a reinstall. Code
updates apply automatically (the service worker uses `autoUpdate`); only a domain
change would require reinstalling.

---

## 1. Add the custom domain in Vercel
1. Vercel → the `magma-calculator` project → **Settings → Domains**.
2. **Add** `calculator.magmacoatings.com`.
3. Vercel shows a DNS record to create. For a subdomain it's a **CNAME**:
   - **Type:** CNAME
   - **Name/Host:** `calculator`
   - **Value/Target:** `cname.vercel-dns.com` (use exactly what Vercel displays)
4. Add that record at whoever hosts DNS for `magmacoatings.com` (e.g. Cloudflare,
   GoDaddy, 123-reg). If using Cloudflare, set the record to **DNS only** (grey cloud)
   initially so Vercel can issue the certificate.
5. Back in Vercel, wait for it to verify — it auto-issues the HTTPS certificate.
   When it shows "Valid", `https://calculator.magmacoatings.com` is live.

The old `magma-calculator.vercel.app` URL keeps working too — both serve the same
deployment.

## 2. Point Supabase auth at the new domain
So invite / reset-password emails link to the new address (the app builds those
links from the current origin, and Supabase only allows whitelisted redirect URLs):

1. Supabase → **Authentication → URL Configuration**.
2. **Site URL:** `https://calculator.magmacoatings.com`
3. **Redirect URLs** (add both):
   - `https://calculator.magmacoatings.com/**`
   - keep `https://magma-calculator.vercel.app/**` while you still test there
4. Always create new users / send invites from the new domain so the links resolve there.

## 3. Deploy
```
git add -A
git commit -m "Add PWA (installable home-screen app) + icons"
git push
```
Vercel rebuilds automatically. `npm run build` now generates the service worker,
`manifest.webmanifest`, and icons — nothing else to configure.

> Note: a new dependency (`vite-plugin-pwa`) was added. Locally run `npm install`
> once after pulling before `npm run dev`.

## 4. Install on a phone (test it)
Open `https://calculator.magmacoatings.com` (must be HTTPS — it is on Vercel):

- **iPhone (Safari):** Share → **Add to Home Screen**.
- **Android (Chrome):** the **Install app** prompt / ⋮ menu → **Install app**.

It launches full-screen (no browser bar) with the Magma icon. Logging in works the
same; the session persists like a normal app.

## What forces a reinstall vs. what doesn't
- **New features / fixes you deploy:** auto-update, no reinstall. ✅
- **Changing the web address** (e.g. moving off this domain later): reinstall. ⚠️
  That's why we install everyone on `calculator.magmacoatings.com` from the start.

## Offline behaviour
The app shell (HTML/JS/CSS/icons) is cached, so it opens instantly and even loads
with no signal. Live data (quotes, products, login) always goes to Supabase over the
network — it is never cached — so an installer offline can open the app but needs a
connection to load or save quotes.
