import test from "node:test";
import assert from "node:assert/strict";
import { calculateLeaderboard } from "../src/leaderboard.js";

test("calculates matches, wins, draws, and losses from finished matches only", () => {
  const players = ["Ana", "Budi", "Citra", "Deni", "Eka"].map((name, index) => ({ id: `p${index + 1}`, name }));
  const schedule = [
    { finished: true, teamA: ["p1", "p2"], teamB: ["p3", "p4"], scoreA: "6", scoreB: "4" },
    { finished: true, teamA: ["p1", "p3"], teamB: ["p2", "p4"], scoreA: "5", scoreB: "5" },
    { finished: false, teamA: ["p2", "p3"], teamB: ["p4", "p5"], scoreA: "6", scoreB: "0" }
  ];

  assert.deepEqual(calculateLeaderboard(players, schedule), [
    { id: "p1", name: "Ana", matches: 2, wins: 1, draws: 1, losses: 0 },
    { id: "p2", name: "Budi", matches: 2, wins: 1, draws: 1, losses: 0 },
    { id: "p3", name: "Citra", matches: 2, wins: 0, draws: 1, losses: 1 },
    { id: "p4", name: "Deni", matches: 2, wins: 0, draws: 1, losses: 1 },
    { id: "p5", name: "Eka", matches: 0, wins: 0, draws: 0, losses: 0 }
  ]);
});
