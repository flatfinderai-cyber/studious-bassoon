# FF-BUILD-001 — FlatFinder Authentication System

**Version**: 1.0.0
**Status**: Draft
**Author**: PRD Creator (prd-creator skill)
**Date**: 2026-04-22

---

## 1. App Overview & Objectives

FlatFinder is a UK-based flat-finding platform that connects tenants (flat-seekers) with landlords and letting agents (property listers). This build document covers the **authentication and onboarding system** — the gateway through which all users enter the platform.

### Objectives

- Provide a unified, low-friction sign-up and login experience for all user types
- Support three sign-in methods: email + password, magic link, and Web3 wallet (SIWE)
- Capture user role (tenant vs. landlord) during onboarding — not at sign-up — and route each role to a tailored first-run experience
- Persist user identity and role securely in Supabase with Row Level Security (RLS)

### Success Criteria

- A new user can complete sign-up and reach their role-specific dashboard in under 90 seconds
- Email verification is required before any protected resource is accessible
- Wallet-authenticated users receive a valid Supabase JWT with the same session guarantees as email users
- All database access is gated by RLS policies — no unauthenticated row reads

---

## 2. Target Audience

| Segment | Description |
|---|---|
| **Tenant / Renter** | Individual searching for a flat to rent. Typically 18–35, mobile-first, values speed and simplicity. |
| **Landlord / Agent** | Individual or agency listing one or more properties. Values trust signals and a professional experience. |

Both segments use the **same auth system**. Their experiences diverge only in the post-verification onboarding flow.

---

## 3. Core Features & Functional Requirements

### 3.1 Unified Sign-Up

**TASK-001** — Single `/signup` page accepting:
- Full name (display name)
- Email address
- Password (min 8 chars, must include one number)

**TASK-002** — On submit: create Supabase auth user, send verification email, redirect to `/verify-email` holding screen.

**TASK-003** — Magic-link sign-up path: "Sign up without a password" button on `/signup` that sends a one-time magic link to the user's email (Supabase `signInWithOtp`).

**TASK-004** — Wallet sign-up path: "Connect Wallet" button on `/signup` that initiates SIWE flow (see Section 3.4). No email required.

### 3.2 Email Verification

**TASK-005** — `/verify-email` holding screen shown immediately after email+password signup. Copy: "Check your inbox — we've sent a verification link."

**TASK-006** — Supabase sends verification email automatically (configure in Supabase Auth settings: `Email Confirmations = On`).

**TASK-007** — On click of verification link, Supabase redirects to `/auth/callback`. The callback handler:
1. Exchanges the token
2. Creates a `profiles` row if one doesn't exist (via database trigger — see TASK-016)
3. Redirects to `/onboarding/role` if `onboarding_complete = false`, else to `/dashboard`

### 3.3 Login

**TASK-008** — `/login` page with three entry points:
- Email + password form (`signInWithPassword`)
- "Send magic link" button (`signInWithOtp`)
- "Connect Wallet" button (SIWE flow)

**TASK-009** — On successful login, check `profiles.onboarding_complete`:
- `false` → redirect to `/onboarding/role`
- `true` → redirect to role-appropriate dashboard (`/search` for tenants, `/listings` for landlords)

**TASK-010** — Logout: call `supabase.auth.signOut()`, clear local session, redirect to `/`.

### 3.4 Sign-In With Ethereum (SIWE)

**TASK-011** — Frontend: integrate WalletConnect v2 (via Web3Modal or RainbowKit) to prompt wallet connection.

**TASK-012** — On wallet connect, call Supabase Edge Function `POST /functions/v1/siwe-nonce` which:
- Generates a random nonce (stored in a `siwe_nonces` table with 5-minute TTL)
- Returns `{ nonce, message }` where `message` follows EIP-4361 format

**TASK-013** — Frontend: ask the connected wallet to sign the message (`personal_sign`).

**TASK-014** — Frontend: call Supabase Edge Function `POST /functions/v1/siwe-verify` with `{ message, signature, address }`.

**TASK-015** — Edge Function verifies:
1. Signature is valid for the address (using `ethers.verifyMessage` or `viem verifyMessage`)
2. Nonce exists in `siwe_nonces` and hasn't expired
3. Marks nonce as used (delete row)
4. Upserts a row in `auth.users` via Supabase Admin API (`createUser` with wallet address as email substitute: `${address}@wallet.flatfinder.app`)
5. Returns a Supabase custom JWT via `supabase.auth.admin.generateLink` or signs a session token

**TASK-016** — `profiles.wallet_address` is stored (unique, nullable) to re-identify returning wallet users without re-querying `auth.users`.

### 3.5 Role Onboarding

**TASK-017** — `/onboarding/role` screen: presented once after first verification. Two cards:
- "I'm looking for a flat" → sets `profiles.role = 'tenant'`
- "I'm listing a property" → sets `profiles.role = 'landlord'`

**TASK-018** — **Tenant onboarding** (`/onboarding/tenant`, 2 steps):
- Step 1: Location preference (free-text city/area, multi-select)
- Step 2: Budget range (slider: £0–£5,000/month), move-in date, bedroom count
- On complete: write to `tenant_preferences`, set `profiles.onboarding_complete = true`, redirect to `/search`

**TASK-019** — **Landlord onboarding** (`/onboarding/landlord`, 1 step):
- Step 1: Display name / trading name confirmation
- On complete: set `profiles.onboarding_complete = true`, redirect to `/listings` (listing creation is a separate build)

---

## 4. Key User Flows

### Flow A — New Tenant (Email + Password)

```
/signup
  → fill name, email, password → submit
  → [Supabase sends verification email]
  → /verify-email (holding screen)
  → user clicks link in email
  → /auth/callback (token exchange, profile row created)
  → /onboarding/role → selects "I'm looking for a flat"
  → /onboarding/tenant (step 1: location)
  → /onboarding/tenant (step 2: budget, date, rooms)
  → /search (tenant dashboard)
```

### Flow B — New Landlord (Magic Link)

```
/signup → "Sign up without a password" → enters email
  → [Supabase sends magic link]
  → /verify-email (holding screen)
  → user clicks magic link
  → /auth/callback → /onboarding/role → "I'm listing a property"
  → /onboarding/landlord (trading name)
  → /listings (landlord dashboard)
```

### Flow C — New User (Wallet / SIWE)

```
/signup → "Connect Wallet"
  → WalletConnect modal → user connects MetaMask / preferred wallet
  → Frontend calls /siwe-nonce edge fn → receives EIP-4361 message
  → Wallet signs message → signature sent to /siwe-verify edge fn
  → Edge fn verifies sig, creates/finds auth user, returns session
  → /auth/callback → /onboarding/role → tenant or landlord
  → appropriate onboarding → dashboard
```

### Flow D — Returning User (Any Method)

```
/login → chosen method
  → session restored
  → check onboarding_complete
  → /search or /listings (skips onboarding)
```

---

## 5. Technical Stack

| Layer | Technology | Rationale |
|---|---|---|
| Auth provider | Supabase Auth | Already in stack; handles email, magic link, JWT natively |
| Database | Supabase Postgres (ca-central-1) | Existing infrastructure |
| Edge functions | Supabase Edge Functions (Deno) | SIWE nonce + verify without exposing service key to client |
| Wallet UI | Web3Modal v3 (WalletConnect v2) | Supports MetaMask, Coinbase Wallet, WalletConnect QR |
| Signature verification | viem `verifyMessage` (in Edge Fn) | Lightweight, typed, works in Deno |
| Frontend framework | Vanilla JS / HTML (current) | Match existing codebase; upgrade path to React is separate build |
| Session storage | Supabase JS client (localStorage) | Standard Supabase pattern |

---

## 6. Conceptual Data Model

### `profiles`
| Field | Type | Notes |
|---|---|---|
| `id` | UUID | FK → `auth.users.id`, primary key |
| `role` | enum `('tenant', 'landlord')` | Set during onboarding, nullable until chosen |
| `display_name` | text | From signup form or wallet address (truncated) |
| `avatar_url` | text | Nullable; future: upload via Supabase Storage |
| `wallet_address` | text | Nullable, unique; checksummed EIP-55 format |
| `onboarding_complete` | boolean | Default `false` |
| `created_at` | timestamptz | Default `now()` |

### `tenant_preferences`
| Field | Type | Notes |
|---|---|---|
| `user_id` | UUID | FK → `profiles.id`, primary key |
| `preferred_locations` | text[] | Array of location strings |
| `max_budget` | numeric | Monthly rent ceiling (GBP) |
| `min_budget` | numeric | Monthly rent floor (GBP) |
| `move_in_date` | date | Target earliest move-in |
| `bedrooms_min` | int | Minimum bedroom count |
| `property_types` | text[] | e.g. `['studio', 'flat', 'house']` |
| `updated_at` | timestamptz | Auto-updated |

### `siwe_nonces`
| Field | Type | Notes |
|---|---|---|
| `nonce` | text | Primary key; random 16-byte hex |
| `address` | text | Wallet address this nonce was issued for |
| `expires_at` | timestamptz | `now() + 5 minutes` |
| `used` | boolean | Marked true after verification (prevent replay) |

### Database Trigger

**TASK-020** — `on_auth_user_created` trigger: fires `AFTER INSERT ON auth.users`, inserts a row into `profiles` with `id = NEW.id`, `display_name = NEW.raw_user_meta_data->>'full_name'` (or wallet address if no name), `onboarding_complete = false`.

---

## 7. Security Considerations

**TASK-021** — Enable RLS on `profiles`:
- `SELECT`: authenticated user can only read their own row (`auth.uid() = id`)
- `UPDATE`: authenticated user can only update their own row
- `INSERT`: disallowed directly (handled by trigger)

**TASK-022** — Enable RLS on `tenant_preferences`:
- `SELECT`, `UPDATE`, `INSERT`: authenticated user can only access rows where `user_id = auth.uid()`

**TASK-023** — `siwe_nonces` table: only accessible from service-role key (Edge Function). No client-facing RLS needed — client never queries it directly.

**TASK-024** — SIWE replay prevention:
- Nonce expires after 5 minutes
- Nonce is deleted (or marked `used = true`) immediately after first successful verification
- Edge Function rejects any request with an expired or already-used nonce

**TASK-025** — Wallet address stored in checksummed EIP-55 format to prevent case-mismatch collisions.

**TASK-026** — Supabase Auth settings:
- `Email Confirmations`: On
- `Secure Email Change`: On
- `JWT expiry`: 3600s (1 hour)
- `Refresh token rotation`: On

---

## 8. UI Design Principles

- **Single-column layout** for all auth pages — no sidebars, minimal chrome
- **Progressive disclosure**: role selection and onboarding appear only after verification, not upfront
- Auth pages share a consistent card container (max-width 420px, centered)
- Wallet connect button displays the WalletConnect logo + "Connect Wallet" — no jargon
- Error states shown inline (below the relevant field), not as modal alerts
- Magic link confirmation: clear copy — "We've emailed a sign-in link to [email]. It expires in 1 hour."

---

## 9. Development Phases

### Phase 1 — Email Auth (Foundation)
TASK-001 through TASK-010, TASK-020 through TASK-026
- Signup, login, email verification, logout
- Profiles table + trigger
- RLS policies
- Role onboarding screens
- Tenant + landlord onboarding flows

### Phase 2 — SIWE / Wallet Auth
TASK-011 through TASK-016
- Edge functions: nonce generation + verification
- WalletConnect frontend integration
- `siwe_nonces` table

---

## 10. Assumptions & Dependencies

| # | Assumption |
|---|---|
| A1 | Supabase project is already provisioned and the anon/service keys are available |
| A2 | Email sending is handled by Supabase (default SMTP) — no custom email provider for this build |
| A3 | Landlord identity verification (e.g. proof of property ownership) is a future build — role is self-declared |
| A4 | Frontend remains vanilla HTML/JS for this build; no framework migration |
| A5 | WalletConnect Project ID will be obtained from cloud.walletconnect.com before Phase 2 begins |
| A6 | `/listings` and `/search` dashboard pages are separate builds — onboarding only needs to redirect to a placeholder URL |
| A7 | Password reset is out of scope for this build |
| A8 | Mobile app is out of scope — web only |

---

## 11. Out of Scope

- Password reset / forgot password flow
- Account deletion / GDPR erasure request
- Admin dashboard or role promotion tools
- Social OAuth (Google, Apple)
- Property listing creation (separate build)
- Search/discovery features (separate build)
- Email template customisation
