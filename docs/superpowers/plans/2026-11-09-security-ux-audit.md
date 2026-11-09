# Security and Mobile UX Audit Implementation Plan

> **For agentic workers:** Native implementation in this session; no delegated work.

**Goal:** Close the unauthenticated subscription-status lookup, strengthen account input/session handling, and remove mobile accessibility/navigation friction.

**Architecture:** Keep financial records local in IndexedDB and retain Supabase as the account/subscription store. Authenticate status checks with a server-signed, HttpOnly customer cookie; improve input validation and shared security headers without moving personal financial data to the server.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase REST, Tailwind CSS.

**Spec:** User request to audit vulnerabilities and improve app UX.

## Global Constraints

- Preserve local-first financial records and offline usage.
- Do not add schema changes or dependencies.
- Existing users may keep their current password; enforce stronger requirements only for new registrations.
- Do not claim offline subscription enforcement is tamper-proof.

## Review Focus

- Missing/invalid customer cookie must not expose account status.
- Malformed and oversized auth input must return a client error before password hashing.
- Logout must clear local state immediately and clear the server cookie asynchronously.
- Mobile navigation must remain below the 68px header and not squeeze six labels into unreadable columns.
- Browser zoom and text selection must remain available.

---

### Task 1: Customer session and auth input

**Files:** `src/lib/server-storage.ts`, `src/app/api/auth/{login,register,check-status,logout}/route.ts`, `src/context/AuthContext.tsx`, `src/components/AuthScreen.tsx`.

- [x] Sign login/register responses with an HttpOnly, SameSite=Strict, Secure-in-production cookie.
- [x] Derive status-check identity from that cookie; reject missing/invalid sessions and disable caching.
- [x] Add logout cookie clearing while preserving immediate local logout.
- [x] Bound auth input; require 8–128 characters for new passwords and preserve existing password compatibility.

### Task 2: Mobile accessibility and hardening

**Files:** `src/app/layout.tsx`, `src/app/globals.css`, `src/components/Navigation.tsx`, `next.config.mjs`.

- [x] Allow pinch zoom and text selection.
- [x] Place the mobile navigation at the actual header boundary, keep labels legible, and expose pressed/focus state.
- [x] Add baseline anti-sniffing, framing, referrer, and permissions headers.

### Task 3: Verify and report

**Files:** `security_best_practices_report.md`.

- [x] Run production build and `git diff --check` (no test suite requested).
- [x] Record fixed findings and remaining deployment/business-model risks with code locations.

### Task 4: Shared authentication rate limiting

**Files:** `src/lib/auth-rate-limit.ts`, auth/admin login routes, `supabase/schema.sql`, `supabase/migrations/20261109_auth_rate_limits.sql`, `docs/DEPLOYMENT-AR.md`.

- [x] Add atomic Postgres RPC limits keyed by server-HMAC digests; keep the raw phone and client IP out of the table.
- [x] Limit customer login, registration, and admin login before password verification or account creation.
- [x] Keep a per-instance fallback while the migration is missing so deployment does not break; production logs clearly identify this reduced mode.
- [ ] Build and exercise the limiter locally; SQL migration cannot be applied without the Supabase admin connection configured in this workspace.
