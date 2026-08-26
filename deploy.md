# 🚀 Lucksino Deployment Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose (for production)
- A Supabase project (free tier works)
- A Stripe account (test mode for development)

---

## 1. Supabase Setup

### Create Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- Profiles table (stores player data)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT NOT NULL DEFAULT 'Player',
  coins INTEGER NOT NULL DEFAULT 1000,
  inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar JSONB NOT NULL DEFAULT '{
    "outfitColor": "#e74c3c",
    "hairColor": "#4a3728",
    "skinTone": "#ffdbac",
    "accessory": "none",
    "hat": "none"
  }'::jsonb,
  last_daily_bonus TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transaction log (audit trail for purchases)
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  package_id TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  amount_usd INTEGER DEFAULT 0,
  stripe_session_id TEXT,
  game_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access profiles"
  ON profiles FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access transactions"
  ON transactions FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Get Your Keys

1. Go to Settings > API in your Supabase dashboard
2. Copy `URL`, `anon` key, and `service_role` key
3. Put them in your `.env` file

---

## 2. Stripe Setup

### Development (Test Mode)

1. Create a Stripe account at https://dashboard.stripe.com
2. Toggle to **Test mode** (top-right switch)
3. Go to Developers > API keys
4. Copy the `Secret key` (starts with `sk_test_`)
5. Set up a webhook endpoint:
   - Go to Developers > Webhooks
   - Add endpoint: `https://your-domain.com/webhooks/stripe`
   - Events: `checkout.session.completed`
   - Copy the webhook signing secret (`whsec_...`)

### Local Testing

Use Stripe CLI for local webhook forwarding:
```bash
stripe listen --forward-to localhost:2567/webhooks/stripe
```

---

## 3. Local Development

```bash
# Install dependencies
npm install
cd shared && npm install && cd ..
cd server && npm install && cd ..
cd client && npm install && cd ..

# Copy env file
cp .env.example .env
# Edit .env with your Supabase + Stripe keys

# Start dev (in separate terminals)
cd server && npm run dev
cd client && npm run dev
```

---

## 4. Production Deployment

### Option A: Docker (Recommended)

```bash
# Build & run with Docker Compose
docker compose up --build -d

# Check health
curl http://localhost:2567/health
```

### Option B: Railway / Render / Fly.io

These platforms support monorepo deployments. Set environment variables in their dashboard.

**Railway:**
```bash
# Install Railway CLI
railway login
railway init
railway up
```

**Fly.io:**
```bash
fly launch
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
fly deploy
```

### Option C: VPS (DigitalOcean, Hetzner)

```bash
# On your VPS:
git clone <your-repo>
cd lucksino
cp .env.example .env && nano .env  # fill in secrets
docker compose up --build -d

# Set up reverse proxy (Caddy recommended for auto-TLS):
# Caddyfile:
# lucksino.yourdomain.com {
#   reverse_proxy localhost:3000
# }
```

---

## 5. Domain & SSL

- Point your domain's DNS A record to your server IP
- If using Docker + Caddy: SSL is automatic
- If using Railway/Render/Fly: SSL is included

---

## 6. Post-Deployment Checklist

- [ ] Health endpoint returns 200: `GET /health`
- [ ] Supabase status shows "connected" in health response
- [ ] Stripe status shows "connected" in health response
- [ ] Test a coin purchase with Stripe test card `4242 4242 4242 4242`
- [ ] Verify webhook fires on purchase completion
- [ ] Test multiplayer: open 2 browser tabs, confirm players see each other
- [ ] PWA install prompt appears on mobile Chrome/Safari
- [ ] Service worker caches pages for offline shell

---

## Architecture

```
┌─────────────────────────────────────────────┐
│ Client (Vite + Phaser + PWA)                │
│  - Scenes: Casino, Slots, Plinko, Crash     │
│  - Auth: Supabase GoTrue                    │
│  - Store: Stripe Checkout redirect          │
└───────────────────┬─────────────────────────┘
                    │ WebSocket + REST
┌───────────────────▼─────────────────────────┐
│ Server (Express + Colyseus)                 │
│  - Rooms: Casino (multiplayer lobby)        │
│  - Payments: /store/* endpoints             │
│  - Webhooks: /webhooks/stripe               │
│  - Auth: /auth/verify (token validation)    │
└───────────────────┬─────────────────────────┘
                    │
     ┌──────────────┼──────────────┐
     ▼              ▼              ▼
 Supabase       Stripe         Redis (opt)
 (Auth+DB)    (Payments)      (Sessions)
```
