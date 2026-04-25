# FlatFinder — Auth System Summary

FlatFinder is a UK flat-finding platform. This build implements the authentication and onboarding system that gates all user access.

## Main Features

- **Unified auth** — one sign-up and login page for all users (email + password, magic link, or Web3 wallet via SIWE)
- **Role-based onboarding** — after email verification, users pick their role (tenant or landlord) and complete a short role-specific onboarding flow
- **Supabase-backed** — profiles, preferences, and sessions managed in Supabase Postgres (ca-central-1) with full RLS

## Key User Flows

1. Tenant signs up → verifies email → picks role → sets location/budget preferences → lands on /search
2. Landlord signs up → verifies email → picks role → confirms display name → lands on /listings
3. Wallet user connects wallet → signs SIWE message → Edge Function issues Supabase JWT → same onboarding as above

## Key Requirements

- Email verification required before any protected resource is accessible
- Three sign-in methods: email + password, magic link, Sign-In with Ethereum (SIWE)
- Profiles table with `role` and `onboarding_complete` fields, auto-created via database trigger
- `tenant_preferences` table for renter search settings
- RLS on all tables — no unauthenticated row access
- SIWE nonce management (5-minute TTL, single-use) via Edge Functions
