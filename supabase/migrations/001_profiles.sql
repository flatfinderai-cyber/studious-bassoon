-- Migration: Create profiles table
-- Run in: Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS public.profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role                TEXT CHECK (role IN ('tenant', 'landlord')),
    display_name        TEXT NOT NULL DEFAULT '',
    avatar_url          TEXT,
    wallet_address      TEXT UNIQUE,
    onboarding_complete BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'One row per auth user. Extended user metadata.';
