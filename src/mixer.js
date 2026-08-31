const pairKey = (a, b) => [a, b].sort().join("|");

function partnershipCount(partnerCounts, team) {
  return partnerCounts.get(pairKey(team[0].id, team[1].id)) || 0;
}

function chooseTeams(active, partnerCounts) {
  let best = null;

  function visit(remaining, teams, score) {
    if (!remaining.length) {
      const key = teams.map(team => pairKey(team[0].id, team[1].id)).join(",");
      if (!best || score < best.score || (score === best.score && key < best.key)) best = { teams, score, key };
      return;
    }

    if (best && score > best.score) return;
    const [first, ...rest] = remaining;
    rest.forEach((partner, index) => {
      const team = [first, partner];
      visit([...rest.slice(0, index), ...rest.slice(index + 1)], [...teams, team], score + partnershipCount(partnerCounts, team));
    });
  }

  visit(active, [], 0);
  return best.teams;
}

function chooseMatches(teams, opponentCounts) {
  let best = null;

  function matchupCount(teamA, teamB) {
    return teamA.reduce((total, playerA) => total + teamB.reduce((sum, playerB) => sum + (opponentCounts.get(pairKey(playerA.id, playerB.id)) || 0), 0), 0);
  }

  function visit(remaining, matches, score) {
    if (!remaining.length) {
      const key = matches.map(([teamA, teamB]) => `${pairKey(teamA[0].id, teamA[1].id)}-${pairKey(teamB[0].id, teamB[1].id)}`).join(",");
      if (!best || score < best.score || (score === best.score && key < best.key)) best = { matches, score, key };
      return;
    }

    if (best && score > best.score) return;
    const [first, ...rest] = remaining;
    rest.forEach((opponent, index) => visit([...rest.slice(0, index), ...rest.slice(index + 1)], [...matches, [first, opponent]], score + matchupCount(first, opponent)));
  }

  visit(teams, [], 0);
  return best.matches;
}

export function generateSchedule({ players, courts, durationHours, previousSchedule = [] }) {
  const slots = Math.floor(Number(durationHours) * 60 / 10);
  const playCounts = Object.fromEntries(players.map(player => [player.id, player.matches || 0]));
  const byeCounts = Object.fromEntries(players.map(player => [player.id, player.byes || 0]));
  let partnerCounts = new Map();
  const opponentCounts = new Map();
  const schedule = [];
  let previousByes = new Set(previousSchedule.filter(item => item.bye).flatMap(item => item.bye));
  const ranked = (list) => [...list].sort((a, b) => ((previousByes.has(a.id) ? -100 : 0) + playCounts[a.id] * 10 + byeCounts[a.id]) - ((previousByes.has(b.id) ? -100 : 0) + playCounts[b.id] * 10 + byeCounts[b.id]) || a.id.localeCompare(b.id));
  for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
    const activeCount = Math.floor(Math.min(players.length, courts.length * 4) / 4) * 4;
    const active = ranked(players).slice(0, activeCount);
    const bye = players.filter(player => !active.includes(player)).map(player => player.id);
    const teams = chooseTeams(active, partnerCounts);
    const matches = chooseMatches(teams, opponentCounts);
    matches.forEach(([leftTeam, rightTeam], courtIndex) => {
      const teamA = leftTeam.map(player => player.id); const teamB = rightTeam.map(player => player.id);
      [teamA, teamB].forEach(team => partnerCounts.set(pairKey(...team), (partnerCounts.get(pairKey(...team)) || 0) + 1));
      teamA.forEach(a => teamB.forEach(b => opponentCounts.set(pairKey(a, b), (opponentCounts.get(pairKey(a, b)) || 0) + 1)));
      [...leftTeam, ...rightTeam].forEach(player => { playCounts[player.id] += 1; });
      schedule.push({ id: `s${slotIndex + 1}-${courts[courtIndex].id}`, slotIndex, startMinute: slotIndex * 10, courtId: courts[courtIndex].id, teamA, teamB, scoreA: "", scoreB: "", finished: false, bye });
    });
    bye.forEach(id => { byeCounts[id] += 1; }); previousByes = new Set(bye);
    const partnershipTotal = players.length * (players.length - 1) / 2;
    if (partnerCounts.size === partnershipTotal) partnerCounts = new Map();
  }
  return { schedule, byePlayerIds: [...previousByes] };
}
