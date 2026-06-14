# Magma Calculator

Secure material calculator for Magma Coatings approved installers.

## Quick Start

### 1. Set up Supabase (5 mins)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click "New Project"
3. Name it `magma-calculator`, set a database password, choose a region
4. Wait for the project to be created (~2 mins)
5. Go to **SQL Editor** > **New Query**
6. Paste the contents of `magma_calculator_schema.sql` and click **Run**
7. Go to **Settings** > **API** and copy:
   - Project URL
   - `anon` public key

### 2. Configure the app

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local and add your Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:5173

### 4. Create your admin user

In Supabase dashboard:
1. Go to **Authentication** > **Users**
2. Click **Add user** > **Create new user**
3. Enter your email and a password
4. Go to **SQL Editor** and run:

```sql
UPDATE profiles 
SET role = 'admin', full_name = 'Your Name', company_name = 'Magma Coatings'
WHERE email = 'your@email.com';
```

You can now log in!

---

## Deployment

### Vercel (recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

### Custom domain

In Vercel:
1. Go to project settings > Domains
2. Add `calculator.magmacoatings.com`
3. Update DNS: CNAME to `cname.vercel-dns.com`

---

## Features

### Phase 1 (current)
- [x] User authentication
- [x] Login tracking (IP, device, location)
- [x] Material calculator (floor, wall, floor+wall)
- [x] 30 colour swatches
- [x] Real-time cost calculation
- [x] Copy shopping list

### Phase 2 (coming)
- [ ] Save/load quotes
- [ ] Admin: Product management
- [ ] Admin: User management
- [ ] Suspicious login detection

### Phase 3 (future)
- [ ] PDF export
- [ ] Analytics dashboard
- [ ] Email alerts

---

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4
- Supabase (Auth + Database)

---

## Support

Contact: info@magmacoatings.com
