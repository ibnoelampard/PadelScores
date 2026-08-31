# PadelScore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first web app that creates padel sessions, collects player names, generates fair 10-minute court schedules, and tracks editable scores without losing data on refresh.

**Architecture:** Use a dependency-free vanilla HTML/CSS/JavaScript app. Keep scheduling logic pure and separate from DOM rendering, persist one normalized session object in `localStorage`, and render one mobile flow for empty state, setup, names, and live court-list screens.

**Tech Stack:** HTML5, CSS3, modern browser JavaScript, `localStorage`, Node.js built-in test runner for pure scheduling/storage helpers.

## Global Constraints

- Aplikasi berbasis web, tanpa login dan tanpa backend.
- Data disimpan di `localStorage` dan tetap tersedia setelah refresh atau browser dibuka kembali pada perangkat yang sama.
- Jumlah pemain minimal 4 dan jumlah lapangan minimal 1.
- Durasi setiap slot jadwal ditetapkan 10 menit.
- Pemain dan pasangan terkunci setelah jadwal dibuat; skor tetap dapat diedit setelah Finish.
- Tampilan mobile-first dengan palet clean green: `#F8FAF8`, `#168A5B`, `#123C2E`, `#E8F5EF`, `#17352A`, `#D7E6DD`, `#FFF4D6`.

## File Map

- Create: `index.html` — semantic app shell and screen containers.
- Create: `styles.css` — responsive mobile-first design system and screen styling.
- Create: `src/storage.js` — state defaults, normalization, and localStorage persistence.
- Create: `src/mixer.js` — deterministic fair rotation and schedule generation.
- Create: `src/app.js` — DOM rendering, validation, navigation, score editing, Finish, and event wiring.
- Create: `test/mixer.test.js` — schedule invariants and fairness-priority tests.
- Create: `test/storage.test.js` — normalization and persistence serialization tests.
- Create: `package.json` — `node --test` script only; no runtime dependencies.

### Task 1: Project shell and state/storage contract

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/storage.js`
- Create: `test/storage.test.js`

**Interfaces:**
- `createEmptyState()` returns `{ session, players, courts, schedule }` with `session.status === "empty"`.
- `saveState(state, storage)` writes JSON under `padelscore-state-v1`.
- `loadState(storage)` returns normalized state or `createEmptyState()` for missing/invalid data.
- `normalizeState(value)` clamps invalid counts and ensures `slotMinutes === 10`.

- [ ] **Step 1: Add package metadata and a failing storage test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyState, normalizeState } from "../src/storage.js";

test("empty state uses the 10-minute slot contract", () => {
  const state = createEmptyState();
  assert.equal(state.session.status, "empty");
  assert.equal(state.session.slotMinutes, 10);
  assert.deepEqual(state.players, []);
  assert.deepEqual(state.courts, []);
});

test("invalid persisted state falls back to safe defaults", () => {
  const state = normalizeState({ session: { playerCount: -2, courtCount: 0, slotMinutes: 60 } });
  assert.equal(state.session.playerCount, 0);
  assert.equal(state.session.courtCount, 0);
  assert.equal(state.session.slotMinutes, 10);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test test/storage.test.js`
Expected: FAIL because `src/storage.js` and `package.json` do not exist.

- [ ] **Step 3: Implement storage helpers and the initial app shell**

Implement the exact exports above, keep all persisted values JSON-safe, and add `index.html` with `#app`, four screen containers (`empty-screen`, `setup-screen`, `players-screen`, `schedule-screen`) and a live region. Add the clean-green tokens and mobile layout foundation to `styles.css`.

- [ ] **Step 4: Run the storage tests**

Run: `node --test test/storage.test.js`
Expected: PASS.

- [ ] **Step 5: Commit the foundation**

```bash
git add package.json index.html styles.css src/storage.js test/storage.test.js
git commit -m "feat: add PadelScore app shell and persisted state"
```

### Task 2: Fair mixer and 10-minute schedule generation

**Files:**
- Create: `src/mixer.js`
- Create: `test/mixer.test.js`

**Interfaces:**
- `generateSchedule({ players, courts, durationHours, previousSchedule })` returns `{ schedule, byePlayerIds }`.
- Each schedule item is `{ id, slotIndex, startMinute, courtId, teamA, teamB, scoreA: "", scoreB: "", finished: false }`.
- `teamA` and `teamB` are arrays of exactly two player IDs.

- [ ] **Step 1: Write failing invariants tests**

Cover 4 players/1 court, 12 players/2 courts/2 hours, no duplicate player IDs within a slot, maximum four players per court, exactly 12 slots for 2 hours, and previous-slot bye priority.

- [ ] **Step 2: Run mixer tests and verify failure**

Run: `node --test test/mixer.test.js`
Expected: FAIL because `src/mixer.js` does not exist.

- [ ] **Step 3: Implement fair rotation**

Use stable player IDs, play-count and bye-count ordering, partner-history penalties, opponent-history penalties, and a small seeded tie-breaker. Select up to `courtCount * 4` players each slot, chunk into groups of four, pair each group, and append unselected IDs to `byePlayerIds`. Generate `Math.floor(durationHours * 60 / 10)` slots.

- [ ] **Step 4: Run mixer tests**

Run: `node --test test/mixer.test.js`
Expected: PASS, including the 12-player/2-court case with 8 active and 4 bye per slot.

- [ ] **Step 5: Commit the mixer**

```bash
git add src/mixer.js test/mixer.test.js
git commit -m "feat: generate fair ten-minute padel rotations"
```

### Task 3: Setup and player-entry flow

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`

**Interfaces:**
- Setup form reads `playerCount`, `courtCount`, and `durationHours`.
- `startSetup()` creates named courts (`Court 1`, `Court 2`, …), creates empty player records, saves status `players`, and renders the names screen.
- `validatePlayers()` rejects blank or case-insensitive duplicate names.

- [ ] **Step 1: Add accessible forms and failing DOM behavior checklist**

Add labels, numeric inputs with `min`, Create Match button, generated player inputs, validation message with `role="alert"`, and Buat Jadwal Pertandingan button.

- [ ] **Step 2: Implement setup and names handlers**

Wire Create Match to validate counts and duration, render exactly the requested number of name fields, save each valid name, and transition only when all names pass validation.

- [ ] **Step 3: Verify in browser**

Run: `python3 -m http.server 4173`
Open: `http://localhost:4173`
Verify empty state → setup → 12 player fields, blank-name error, duplicate-name error, and successful transition to schedule generation.

- [ ] **Step 4: Commit the setup flow**

```bash
git add index.html src/app.js styles.css
git commit -m "feat: add match setup and player entry flow"
```

### Task 4: Live court-list schedule, scores, and persistence

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `styles.css`

**Interfaces:**
- `renderSchedule()` shows court tabs and chronological 10-minute cards.
- `updateScore(scheduleId, scoreA, scoreB)` updates only scores.
- `finishMatch(scheduleId)` sets `finished: true` without changing team IDs.
- `resetSession()` clears state only after `window.confirm` returns true.

- [ ] **Step 1: Add schedule-list markup and score controls**

Render one court tab per configured court, active/next/finished states, both team names, two score inputs, Finish/Edit skor button, bye summary, and reset action.

- [ ] **Step 2: Implement schedule generation and court tabs**

Call `generateSchedule`, save the full schedule, keep the active court tab local to the UI, and render all slots in chronological order for that court.

- [ ] **Step 3: Implement score editing, Finish, and localStorage writes**

Use input events to persist scores immediately. Finish changes only status and button copy; score inputs remain enabled. Reload with an existing schedule must render the schedule screen directly.

- [ ] **Step 4: Verify the complete mobile flow**

Run: `python3 -m http.server 4173`
Verify 12 players/2 courts/2 hours, court tabs, 12 schedule rows per court, 8 active plus 4 bye per slot, Finish, post-Finish score edit, refresh persistence, and reset confirmation.

- [ ] **Step 5: Commit the live schedule**

```bash
git add index.html src/app.js styles.css
git commit -m "feat: add live court schedule and editable scores"
```

### Task 5: Final responsive and accessibility verification

**Files:**
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `src/app.js`

- [ ] **Step 1: Run all automated tests**

Run: `node --test`
Expected: PASS for storage and mixer suites.

- [ ] **Step 2: Verify mobile layouts**

Check 320px, 360px, and 390px widths. Confirm no horizontal overflow, all controls have readable labels, score fields remain at least 16px text, and tabs can be reached without clipping.

- [ ] **Step 3: Verify state recovery and edge cases**

Test 4 players/1 court, 5 players/1 court, 12 players/2 courts, 16 players/3 courts, fractional duration such as 1.5 hours, invalid localStorage JSON, and reset.

- [ ] **Step 4: Commit verification fixes**

```bash
git add index.html styles.css src/app.js
git commit -m "test: verify responsive PadelScore experience"
```

### Task 6: GitHub Pages deployment readiness

**Files:**
- Create: `.nojekyll`
- Modify: `index.html`
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Make asset paths GitHub Pages-safe**

Use relative paths for `styles.css` and JavaScript modules so the site works both at `/` locally and at `/repository-name/` on GitHub Pages. Keep the app as a static site with no server-side route requirement.

- [ ] **Step 2: Add GitHub Pages workflow**

Create a workflow triggered on pushes to `main` that uploads the repository root as the Pages artifact and deploys it with the official GitHub Pages actions. Set the repository Pages source to GitHub Actions after the first push.

- [ ] **Step 3: Verify the production artifact**

Run the same mobile smoke tests against the deployed GitHub Pages URL: empty state, setup, names, generated schedules, score edits, Finish, refresh persistence, and direct reload on the root URL.

- [ ] **Step 4: Commit deployment configuration**

```bash
git add .nojekyll .github/workflows/deploy-pages.yml index.html
git commit -m "ci: deploy PadelScore to GitHub Pages"
```
