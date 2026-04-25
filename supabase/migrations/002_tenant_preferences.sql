-- Migration: Create tenant_preferences table
-- Run AFTER 001_profiles.sql

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

-- Auto-update updated_at on every change
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
