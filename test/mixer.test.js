import test from "node:test";
import assert from "node:assert/strict";
import { availableReplacementPlayers, generateSchedule, replaceAndRemixSchedule } from "../src/mixer.js";

const players = Array.from({ length: 12 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}`, matches: 0, byes: 0 }));
const courts = [{ id: "c1", name: "Court 1" }, { id: "c2", name: "Court 2" }];
test("creates twelve ten-minute slots and four byes for twelve players on two courts", () => { const result = generateSchedule({ players, courts, durationHours: 2 }); assert.equal(result.schedule.length, 24); for (const slot of Array.from({ length: 12 }, (_, i) => result.schedule.filter(item => item.slotIndex === i))) { assert.equal(slot.length, 2); assert.equal(new Set(slot.flatMap(item => [...item.teamA, ...item.teamB])).size, 8); assert.equal(slot[0].bye.length, 4); } });
test("prioritizes the previous slot's bye players next", () => { const result = generateSchedule({ players, courts, durationHours: 1 }); const slotOne = result.schedule.filter(item => item.slotIndex === 0); const slotTwo = result.schedule.filter(item => item.slotIndex === 1); const activeOne = new Set(slotOne.flatMap(item => [...item.teamA, ...item.teamB])); const activeTwo = new Set(slotTwo.flatMap(item => [...item.teamA, ...item.teamB])); assert.ok(slotOne[0].bye.every(id => activeTwo.has(id))); assert.notDeepEqual([...activeOne].sort(), [...activeTwo].sort()); });
test("each match has two teams of two", () => { const result = generateSchedule({ players: players.slice(0, 4), courts: [courts[0]], durationHours: 1 }); assert.equal(result.schedule.length, 6); assert.ok(result.schedule.every(item => item.teamA.length === 2 && item.teamB.length === 2)); });
test("creates every match as not started so admins can edit before play", () => { const result = generateSchedule({ players, courts, durationHours: 1 }); assert.equal(result.schedule.filter(item => item.started).length, 0); });
test("uses every partnership once before starting the partnership cycle again", () => {
  const result = generateSchedule({ players: players.slice(0, 4), courts: [courts[0]], durationHours: 40 / 60 });
  const partnerships = result.schedule.map(item => [item.teamA, item.teamB].map(team => team.slice().sort().join("|"))).flat();

  assert.equal(new Set(partnerships.slice(0, 6)).size, 6);
  assert.deepEqual(partnerships.slice(6, 8), partnerships.slice(0, 2));
});
test("replacement candidates exclude active and target players", () => {
  const schedule = generateSchedule({ players, courts, durationHours: 1 }).schedule;
  schedule.find(match => match.id === "s1-c1").started = true;
  const target = schedule.find(match => match.id === "s2-c2");
  const candidates = availableReplacementPlayers({ players, schedule, targetMatchId: target.id });
  const blocked = new Set([...target.teamA, ...target.teamB, ...schedule.filter(match => match.started && !match.finished).flatMap(match => [...match.teamA, ...match.teamB])]);
  assert.ok(candidates.every(player => !blocked.has(player.id)));
  assert.ok(candidates.length > 0);
});
test("replaces a pending player and preserves active matches", () => {
  const schedule = generateSchedule({ players, courts, durationHours: 1 }).schedule;
  schedule.find(match => match.id === "s1-c1").started = true;
  const target = schedule.find(match => match.id === "s2-c2");
  const activeBefore = JSON.parse(JSON.stringify(schedule.filter(match => match.started && !match.finished)));
  const replacement = availableReplacementPlayers({ players, schedule, targetMatchId: target.id })[0];
  const result = replaceAndRemixSchedule({ players, courts, schedule, targetMatchId: target.id, outPlayerId: target.teamA[0], inPlayerId: replacement.id, changedAt: "2026-08-31T00:00:00.000Z" });
  const changed = result.schedule.find(match => match.id === target.id);
  assert.ok(changed.teamA.includes(replacement.id));
  assert.equal(changed.replacements.length, 1);
  assert.deepEqual(result.schedule.filter(match => match.started && !match.finished), activeBefore);
  for (const slotIndex of new Set(result.schedule.map(match => match.slotIndex))) {
    const ids = result.schedule.filter(match => match.slotIndex === slotIndex).flatMap(match => [...match.teamA, ...match.teamB]);
    assert.equal(new Set(ids).size, ids.length);
  }
  assert.deepEqual(schedule, generateSchedule({ players, courts, durationHours: 1 }).schedule);
});
test("cannot replace a playing or completed match", () => {
  const schedule = generateSchedule({ players, courts, durationHours: 1 }).schedule;
  const target = schedule[0];
  target.started = true;
  assert.throws(() => replaceAndRemixSchedule({ players, courts, schedule, targetMatchId: target.id, outPlayerId: target.teamA[0], inPlayerId: "p12" }), /MATCH_LOCKED/);
});
