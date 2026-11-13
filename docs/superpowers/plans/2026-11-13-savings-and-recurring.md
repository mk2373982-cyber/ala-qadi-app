# Savings Goals and Recurring Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add polished local savings goals and monthly recurring transactions to the finance dashboard.

**Architecture:** Dexie stores goals and recurring templates. A focused dashboard component manages both experiences; recurring transactions are written only after customer confirmation, with the transaction, wallet update, and next due date committed atomically. JSON and encrypted Drive backup include both tables.

**Tech Stack:** Next.js 15, React, TypeScript, Dexie/IndexedDB, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-11-13-savings-and-recurring.md`

## Global Constraints

- Keep financial data local to IndexedDB.
- Do not auto-post a recurring transaction without customer confirmation.
- Savings goal progress does not change wallet balances.
- Include new tables in exports, imports, and encrypted Drive backups.
- Clearing financial data removes goals/rules while preserving wallet definitions and setting their balances to zero.

## Review Focus

- Double-clicking a due recurring item must never duplicate its transaction or wallet adjustment.
- Monthly recurrence from day 29, 30, or 31 must clamp correctly in short months and recover the intended day in later months.
- Deleted or missing linked wallet/category must produce a clear recovery path, not a failed transaction.
- Legacy JSON backups without new fields must remain restorable.
- Empty tables in a new backup must replace existing data during restore.

---

### Task 1: Local models, recurrence operations, and backup support

**Files:** `src/lib/db.ts`, `src/lib/recurring-transactions.ts`, `src/lib/drive-backup.ts`, `src/lib/drive-backup-crypto.ts`, `src/lib/export-import.ts`, `src/components/views/SettingsView.tsx`

- [x] Add Dexie v4 stores and typed records for savings goals and monthly recurring templates.
- [x] Implement a transactional record/skip operation that validates the rule and wallet, applies the wallet change once, writes a transaction when recording, and advances the due date.
- [x] Include the new tables in backup creation, envelope validation, restore transactions, JSON export/import, and clear-all behavior.
- [x] Run `npx tsc --noEmit`.
- [ ] Production build: attempted twice; Next.js could not create nested output directories (`EPERM` on Windows), unrelated to TypeScript diagnostics.

### Task 2: Dashboard savings and recurring experience

**Files:** `src/components/views/FinancialPlans.tsx`, `src/components/views/DashboardView.tsx`

- [x] Create mobile-first goal cards with progress, target date, add-progress, edit, and delete flows.
- [x] Create monthly recurring templates with explicit amount/category/wallet/date inputs and pause/edit/delete controls.
- [x] Show due items with record/skip actions and future items with dates; use a distinctive but restrained emerald/blue visual hierarchy.
- [x] Run `npx tsc --noEmit` and `git diff --check`.
- [ ] Production build remains blocked by the Windows `EPERM` directory creation error above.

### Task 3: Delivery

- [x] Review all changed files and ensure private security reports are not staged.
- [x] Commit and push the feature to the confirmed GitHub repository.
