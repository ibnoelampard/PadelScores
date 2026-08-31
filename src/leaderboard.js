const score = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function calculateLeaderboard(players, schedule) {
  const standings = new Map(players.map(player => [player.id, {
    id: player.id,
    name: player.name,
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0
  }]));

  schedule.filter(match => match.finished).forEach(match => {
    const teamA = match.teamA || [];
    const teamB = match.teamB || [];
    const scoreA = score(match.scoreA);
    const scoreB = score(match.scoreB);
    [...teamA, ...teamB].forEach(id => {
      const player = standings.get(id);
      if (player) player.matches += 1;
    });
    if (scoreA === scoreB) {
      [...teamA, ...teamB].forEach(id => {
        const player = standings.get(id);
        if (player) player.draws += 1;
      });
      return;
    }
    const winners = scoreA > scoreB ? teamA : teamB;
    const losers = scoreA > scoreB ? teamB : teamA;
    winners.forEach(id => { const player = standings.get(id); if (player) player.wins += 1; });
    losers.forEach(id => { const player = standings.get(id); if (player) player.losses += 1; });
  });

  return [...standings.values()].sort((a, b) => b.wins - a.wins || b.matches - a.matches || a.name.localeCompare(b.name));
}
