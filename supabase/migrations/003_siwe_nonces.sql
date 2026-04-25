-- Migration: Create siwe_nonces table (for Sign-In With Ethereum)
-- No RLS needed — accessed only via service-role key in Edge Functions

CREATE TABLE IF NOT EXISTS public.siwe_nonces (
    nonce      TEXT PRIMARY KEY,
    address    TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT false
);

-- Index for efficient expiry-based cleanup
CREATE INDEX IF NOT EXISTS idx_siwe_nonces_expires ON public.siwe_nonces(expires_at);
