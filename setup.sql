-- FlatFinder™ — Database Setup
-- Idempotent: safe to run multiple times.
-- Paste the entire block into: Supabase Dashboard → SQL Editor → Run

-- ──────────────────────────────────────────────
-- 1. profiles
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role                TEXT CHECK (role IN ('tenant', 'landlord')),
    display_name        TEXT NOT NULL DEFAULT '',
    avatar_url          TEXT,
    wallet_address      TEXT UNIQUE,
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 2. tenant_preferences
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_preferences (
    user_id              UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    preferred_locations  TEXT[],
    min_budget           NUMERIC,
    max_budget           NUMERIC,
    move_in_date         DATE,
    bedrooms_min         INTEGER,
    property_types       TEXT[],
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tenant_preferences_updated_at ON public.tenant_preferences;
CREATE TRIGGER set_tenant_preferences_updated_at
    BEFORE UPDATE ON public.tenant_preferences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────
-- 3. siwe_nonces
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.siwe_nonces (
    nonce      TEXT PRIMARY KEY,
    address    TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_siwe_nonces_expires ON public.siwe_nonces(expires_at);

-- ──────────────────────────────────────────────
-- 4. Trigger: create profile row on new sign-up
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, wallet_address)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.raw_user_meta_data->>'wallet_address'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────
-- 5. RLS — profiles
-- ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ──────────────────────────────────────────────
-- 6. RLS — tenant_preferences
-- ──────────────────────────────────────────────
ALTER TABLE public.tenant_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own preferences" ON public.tenant_preferences;
CREATE POLICY "Tenants can view own preferences"
    ON public.tenant_preferences FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tenants can insert own preferences" ON public.tenant_preferences;
CREATE POLICY "Tenants can insert own preferences"
    ON public.tenant_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tenants can update own preferences" ON public.tenant_preferences;
CREATE POLICY "Tenants can update own preferences"
    ON public.tenant_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
