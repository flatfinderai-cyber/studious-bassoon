-- Migration: Triggers, RLS policies
-- Run AFTER 001_profiles.sql and 002_tenant_preferences.sql

-- ──────────────────────────────────────────────
-- Trigger: auto-create profile on new user signup
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
-- RLS: profiles
-- ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);


-- ──────────────────────────────────────────────
-- RLS: tenant_preferences
-- ──────────────────────────────────────────────
ALTER TABLE public.tenant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view own preferences"
    ON public.tenant_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Tenants can insert own preferences"
    ON public.tenant_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Tenants can update own preferences"
    ON public.tenant_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
