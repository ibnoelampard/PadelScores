import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyState, normalizeState } from "../src/storage.js";

test("empty state uses ten-minute slots", () => { const state = createEmptyState(); assert.equal(state.session.status, "empty"); assert.equal(state.session.slotMinutes, 10); });
test("invalid persisted counts normalize safely", () => { const state = normalizeState({ session: { playerCount: -2, courtCount: 0, slotMinutes: 60 } }); assert.equal(state.session.playerCount, 0); assert.equal(state.session.courtCount, 0); assert.equal(state.session.slotMinutes, 10); });
