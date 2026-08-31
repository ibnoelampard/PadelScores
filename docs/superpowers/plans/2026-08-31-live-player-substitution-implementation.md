# Live Player Substitution Implementation Plan

**Goal:** Let an admin replace a player in a not-yet-started match and remix the remaining schedule while preserving completed and active matches.

**Architecture:** Keep schedule mutation and remixing in pure functions in `src/mixer.js`. The UI in `src/app.js` gathers a replacement choice and delegates it to the mixer; `src/storage.js` normalizes the new audit field. A remix freezes every started or finished match plus the edited target, and rebuilds every other unstarted match in the target slot and later slots.

**Tech stack:** Existing vanilla JavaScript app, `localStorage`, Node.js built-in test runner.

## File Map

- Modify: `src/storage.js` — normalize schedule status and replacement history.
- Modify: `src/mixer.js` — add deterministic replacement/remix helpers without DOM dependencies.
- Modify: `src/app.js` — render the replacement action and selection panel; save the returned schedule.
- Modify: `src/i18n.js` — Indonesian and English strings for the new flow and validation.
- Modify: `styles.css` — modal/panel and replacement controls.
- Modify: `test/storage.test.js` — migration coverage for state stored before this feature.
- Modify: `test/mixer.test.js` — mutation, fairness, and no-overlap invariants.

## Task 1: Define and normalize persisted schedule data

**Files:** `src/storage.js`, `test/storage.test.js`

- [ ] Add a failing test that loads a legacy schedule item without `replacements` and expects `replacements: []`, stable teams, scores, `started`, and `finished` defaults.
- [ ] Add tests that discard malformed replacement records while retaining only records with string `outPlayerId`, string `inPlayerId`, and string `changedAt`.
- [ ] Extend `normalizeState()` to normalize every schedule item, including `started`, `finished`, `teamA`, `teamB`, and `replacements`; do not alter legacy session data beyond safe defaults.
- [ ] Run `npm test` and confirm the storage suite passes.

## Task 2: Build pure candidate and remix logic

**Files:** `src/mixer.js`, `test/mixer.test.js`

- [ ] Add failing tests for `availableReplacementPlayers(...)`: exclude the four target participants and every player in a `started && !finished` match; include eligible resting players.
- [ ] Add a pure `replaceAndRemixSchedule({ players, courts, schedule, targetMatchId, outPlayerId, inPlayerId })` function. It must reject an unknown target, a target that has started or finished, an invalid outgoing player, and an ineligible incoming player without mutating its input.
- [ ] In the function, clone the schedule and replace the requested player in exactly one target team; append an ISO timestamp audit record.
- [ ] Treat all `started || finished` matches and the edited target as locked. Remove every other unstarted match whose `slotIndex >= target.slotIndex`.
- [ ] Rebuild the removed matches by slot using play/bye/partner/opponent counts derived from locked matches. For the target slot, exclude its four locked participants from the remaining court assignments. For every rebuilt slot, exclude players actively playing elsewhere; preserve each original match ID/court/slot identity where a match is regenerated.
- [ ] Reuse/refactor the existing fair team and matchup selection helpers rather than duplicating scoring logic. Return `{ schedule, changedMatchId }` only after all slots pass validity checks.
- [ ] Add tests proving: active/finished matches remain byte-for-byte unchanged; target participants change correctly; future unfinished matches are replaced; a player does not occur twice in a slot; an active player is not assigned to a remixed match; and invalid requests leave the input schedule unchanged.
- [ ] Run `npm test` and confirm the mixer suite passes.

## Task 3: Add the replacement UI flow

**Files:** `src/app.js`, `src/i18n.js`, `styles.css`

- [ ] Add Indonesian and English labels for `Ganti pemain`/`Replace player`, picker labels, `Simpan & Remix`/`Save & Remix`, cancel, confirmation copy, success copy, and the no-candidate/error states.
- [ ] Add local UI state for the currently open replacement panel and reset it whenever the court tab changes, the schedule rerenders, or the panel is cancelled.
- [ ] Render the **Ganti pemain** button only for `!item.started && !item.finished`; do not render it on live or completed cards.
- [ ] When opened, render a compact accessible panel with a select for the outgoing player, a select for an eligible replacement player from the pure candidate helper, explanatory copy, and cancel/save controls.
- [ ] On save, call `replaceAndRemixSchedule`. On success replace `state.schedule`, persist once, close the panel, keep the edited card expanded, and render a live-region success notice. On validation failure, retain the panel and show an alert message.
- [ ] Style the panel and controls for the existing mobile-first design, including visible focus states and no horizontal overflow at 320px.

## Task 4: Verify end-to-end behavior

**Files:** `test/mixer.test.js`, `test/storage.test.js`, `src/app.js`, `styles.css` as needed

- [ ] Run `npm test` and resolve all regressions.
- [ ] Start the static app locally and create a 12-player, 2-court session.
- [ ] Start a match on Court 1, finish Court 2's preceding match, open Court 2's next match, and verify Court 1's active players cannot be selected as replacements.
- [ ] Replace an eligible player, save/remix, and confirm the target card changes, all later unstarted cards are remixed, and Court 1's active match plus its score remain unchanged.
- [ ] Confirm the replacement action is absent from playing and finished cards; finish a replaced match and verify the leaderboard counts its actual four participants.
- [ ] Reload the page and verify the replacement history and remixed schedule persist.
- [ ] Run `git diff --check` and commit the completed implementation only after all automated and manual checks pass.
