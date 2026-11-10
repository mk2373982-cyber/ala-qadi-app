# Google Drive Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local financial data recoverable through a resilient, encrypted Google Drive backup and restore flow.

**Architecture:** IndexedDB remains the source of truth and stores a non-extractable local CryptoKey plus a durable pending-sync marker. Google Drive stores AES-GCM encrypted current and previous snapshots; a one-time recovery key unlocks backups on another device. The existing Google token stays memory-only, and legacy plaintext backups remain readable during migration.

**Tech Stack:** Next.js 15, React 19, TypeScript, Dexie/IndexedDB, Web Crypto AES-GCM, Google Drive API v3 appDataFolder.

**Spec:** `docs/superpowers/specs/2026-11-10-drive-recovery.md`

## Global Constraints

- Keep financial records local-first; Supabase continues to store account/license metadata only.
- Do not persist Google access tokens or plaintext recovery keys in localStorage, sessionStorage, or Drive.
- Encrypt new backups with AES-GCM and a fresh IV; authenticate the backup format metadata.
- Preserve current and one previous backup; never permanently delete Drive backup files automatically.
- Existing plaintext backup files must remain restorable.
- Do not add a test framework or tests unless requested; verify with the existing production build and safe manual checks.

## Review Focus

- Offline edits and app restart: pending work remains discoverable and retries after reconnect.
- New or expired Google token: upload pauses safely and clearly requests user-driven reconnect.
- Repeated local edits during an upload: latest snapshot eventually becomes current and prior current remains previous.
- Wrong/lost recovery key: restore fails before local tables are changed.
- Legacy JSON backup: restore succeeds and upgrade does not overwrite it until the user has saved a recovery key.

---

### Task 1: Local key and queue primitives

**Files:** `src/lib/db.ts`, `src/lib/drive-backup.ts`

- [x] Add a Dexie store for a non-extractable per-user CryptoKey and recovery acknowledgment.
- [x] Add durable pending-sync state and per-session user/token state without persisting secrets.
- [x] Implement AES-GCM envelope encode/decode and recovery-key generation.
- [x] Production build and inspect changed files.

### Task 2: Reliable Drive synchronization

**Files:** `src/lib/drive-backup.ts`, `src/app/page.tsx`

- [x] Mark data changes pending before checking connectivity or token availability.
- [x] Serialize uploads; clear pending only when the uploaded revision is still current.
- [x] Retry pending uploads on app start, connectivity return, visibility return, and bounded backoff.
- [x] Store current and previous files in appDataFolder without automatic permanent deletion.
- [x] Production build and inspect changed files.

### Task 3: Recovery and status UI

**Files:** `src/components/GoogleDriveBackupPanel.tsx`

- [x] Show one-time recovery key with copy and explicit acknowledgment before first encrypted upload.
- [x] Show connection, pending, last successful upload, and failure/reconnect states.
- [x] Restore current or previous snapshot with date preview and confirmation.
- [x] Accept the legacy JSON format and require encrypted setup before upgrading its Drive copy.
- [x] Production build and inspect changed files.

### Task 4: Documentation and delivery

**Files:** `docs/DEPLOYMENT-AR.md`, `docs/superpowers/plans/2026-11-10-drive-recovery.md`

- [x] Document the new recovery-key setup and same-Google-account recovery flow.
- [ ] Complete safe manual verification in a separate browser profile if available; never change the user's backup data.
- [x] Run `npm run build` and `git diff --check`.
- [ ] Commit and push only application/documentation changes; keep local security reports private.
