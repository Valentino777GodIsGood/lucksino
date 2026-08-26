-- ═══════════════════════════════════════════════════════════════
-- Lucksino — Supabase Database Schema
-- Run in the SQL Editor at https://supabase.com/dashboard
-- ═══════════════════════════════════════════════════════════════

-- ─── Profiles ─────────────────────────────────────────────────
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'bonus', 'game_win', 'game_loss')),
  package_id TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  amount_usd INTEGER DEFAULT 0,
  stripe_session_id TEXT,
  game_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);

-- ─── Row Level Security ───────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own profile
CREATE POLICY "Users read own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Users can read their own transactions
CREATE POLICY "Users read own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);

-- Service role has full access (server-side)
CREATE POLICY "Service role full access profiles"
  ON profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access transactions"
  ON transactions FOR ALL USING (auth.role() = 'service_role');

-- ─── Auto-create profile on signup ───────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── Auto-update timestamp ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
