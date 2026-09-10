# Supabase Integration Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Google login and private, revision-protected cloud storage for the existing single-session PadelScore app.
**Architecture:** Keep the vanilla UI. A cloud controller owns account loading and serialized writes; Supabase RPC reads/writes relational tables atomically. Realtime triggers server reads, never unguarded overwrites.
**Tech Stack:** JavaScript ES modules, Supabase JS, esbuild, PostgreSQL, node:test, PGlite for local SQL integration tests.
**Spec:** docs/superpowers/specs/2026-09-10-supabase-design.md (approved by user).

## Global Constraints
- One active session per account; auth.uid() is authoritative.
- No privileged credentials in frontend/source.
- No automatic offline merging or public sharing.
- Preserve legacy padelscore-state-v1; import explicitly after login.
- Never report saved before server acknowledgement; retain failed/conflicting drafts per account.
- UI copy remains bilingual.

## Tasks

### 1. Database and security
- [ ] Create SQL migration and PGlite integration tests. Tables: sessions, session_players, courts, matches, match_players, match_replacements.
- [ ] RPC `load_padel_session()` returns `{ revision: number, state: State }` (revision 0 + empty state if absent).
- [ ] RPC `save_padel_session(p_state jsonb, p_expected_revision bigint)` returns `{ revision: number }`. Increment revision; reject stale version using message `revision_conflict`.
- [ ] RLS denies anon and isolates accounts. Authenticated has SELECT only, writes via checked RPC. Transactional validation covers arrays, references, status, score, size.
- [ ] Run `node --test test/database.test.js`: exercise two owners, anon denial, direct write denial, malformed input rollback, round trip including replacements, stale revisions.

### 2. Local backup, revision controller, and client
- [ ] Test first in test/cloud.test.js: failed requests keep draft; serial saves preserve latest edit; remote revisions never overwrite draft; account load races are ignored; recovery restore compares base revision.
- [ ] src/backup.js: `parseBackup(text)`, `serializeBackup(state)`, `readRecovery(storage,userId)`, `writeRecovery(storage,userId,value)`.
- [ ] src/cloud.js: `CloudSession({ repository, storage, onChange })`; methods `connect(user)`, `edit(state)`, `flush()`, `refresh()`, `retry()`, `discardAndReload()`, `restoreRecovery()`, `dispose()`; snapshot fields user,state,revision,status,dirty,recovery,error. Use account generation and local edit sequence guards.
- [ ] src/supabase.js: singleton client, Google OAuth, auth listener, RPC repository; Realtime watches sessions owner_id and calls refresh on SUBSCRIBED and data changes.
- [ ] Build with esbuild into dist, copy CSS/index and backup utility. Vercel explicit build/output config. No secrets in dist.

### 3. UI and migration
- [ ] src/cloud-ui.js integrates sign-in, account toolbar, status/retry/conflict, import/export, restore draft and legacy import. Local data remains accessible for export before sign-in.
- [ ] src/app.js reads cloud snapshot after login, persists through controller, locks editing until loaded and on failures/conflicts. Avoid full rerenders on save notifications; capture player inputs too.
- [ ] Tests for bilingual copy; browser smoke test sign-in view, failure UI, responsive layout and import controls. Existing app algorithm tests continue passing.

### 4. Review and handoff
- [ ] Full `npm test`, `npm run build`, `git diff --check`.
- [ ] Independent review, fix concrete findings, rerun affected tests.
- [ ] docs/supabase-setup.md gives exact migration, OAuth URL settings, import origin caveat, Vercel build overrides and real-account verification steps.
- [ ] Clearly distinguish local proof from pending hosted SQL, actual Google sign-in, and production deployment. No claim of live persistence until verified.

## Execution notes
- Baseline: 29 tests pass.
- Branch codex/supabase-integration created in existing checkout. No separate worktree needed; changes remain reviewable on this branch.
