const pairKey = (a, b) => [a, b].sort().join("|");

export function generateSchedule({ players, courts, durationHours, previousSchedule = [] }) {
  const slots = Math.floor(Number(durationHours) * 60 / 10);
  const playCounts = Object.fromEntries(players.map(player => [player.id, player.matches || 0]));
  const byeCounts = Object.fromEntries(players.map(player => [player.id, player.byes || 0]));
  const partnerCounts = new Map();
  const opponentCounts = new Map();
  const schedule = [];
  let previousByes = new Set(previousSchedule.filter(item => item.bye).flatMap(item => item.bye));
  const ranked = (list) => [...list].sort((a, b) => ((previousByes.has(a.id) ? -100 : 0) + playCounts[a.id] * 10 + byeCounts[a.id]) - ((previousByes.has(b.id) ? -100 : 0) + playCounts[b.id] * 10 + byeCounts[b.id]) || a.id.localeCompare(b.id));
  for (let slotIndex = 0; slotIndex < slots; slotIndex += 1) {
    const activeCount = Math.min(players.length, courts.length * 4);
    const active = ranked(players).slice(0, activeCount);
    const bye = players.filter(player => !active.includes(player)).map(player => player.id);
    const shuffled = [...active].sort((a, b) => { const scoreA = [...active].filter(p => p !== a).reduce((sum, p) => sum + (partnerCounts.get(pairKey(a.id, p.id)) || 0), 0); const scoreB = [...active].filter(p => p !== b).reduce((sum, p) => sum + (partnerCounts.get(pairKey(b.id, p.id)) || 0), 0); return scoreA - scoreB || a.id.localeCompare(b.id); });
    const groups = Array.from({ length: courts.length }, (_, courtIndex) => shuffled.slice(courtIndex * 4, courtIndex * 4 + 4));
    groups.forEach((group, courtIndex) => {
      if (group.length < 4) return;
      const teamA = [group[0].id, group[1].id]; const teamB = [group[2].id, group[3].id];
      [teamA, teamB].forEach(team => partnerCounts.set(pairKey(...team), (partnerCounts.get(pairKey(...team)) || 0) + 1));
      teamA.forEach(a => teamB.forEach(b => opponentCounts.set(pairKey(a, b), (opponentCounts.get(pairKey(a, b)) || 0) + 1)));
      group.forEach(player => { playCounts[player.id] += 1; });
      schedule.push({ id: `s${slotIndex + 1}-${courts[courtIndex].id}`, slotIndex, startMinute: slotIndex * 10, courtId: courts[courtIndex].id, teamA, teamB, scoreA: "", scoreB: "", finished: false, bye });
    });
    bye.forEach(id => { byeCounts[id] += 1; }); previousByes = new Set(bye);
  }
  return { schedule, byePlayerIds: [...previousByes] };
}
