const pairKey = (a, b) => [a, b].sort().join("|");
const idsIn = match => [...(match.teamA || []), ...(match.teamB || [])];
const activePlayers = players => players.filter(player => !player.removed);
const activeCourts = courts => courts.filter(court => !court.removed);

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
      schedule.push({ id: `s${slotIndex + 1}-${courts[courtIndex].id}`, slotIndex, startMinute: slotIndex * 10, courtId: courts[courtIndex].id, teamA, teamB, scoreA: "", scoreB: "", started: false, finished: false, bye, replacements: [] });
    });
    bye.forEach(id => { byeCounts[id] += 1; }); previousByes = new Set(bye);
    const partnershipTotal = players.length * (players.length - 1) / 2;
    if (partnerCounts.size === partnershipTotal) partnerCounts = new Map();
  }
  return { schedule, byePlayerIds: [...previousByes] };
}

function cloneMatch(match) {
  return { ...match, teamA: [...(match.teamA || [])], teamB: [...(match.teamB || [])], bye: [...(match.bye || [])], replacements: [...(match.replacements || [])] };
}

function historyFromSchedule(schedule, players) {
  const playCounts = Object.fromEntries(players.map(player => [player.id, 0]));
  const byeCounts = Object.fromEntries(players.map(player => [player.id, 0]));
  const partnerCounts = new Map();
  const opponentCounts = new Map();
  schedule.forEach(match => {
    addMatchHistory(match, playCounts, partnerCounts, opponentCounts);
    (match.bye || []).forEach(id => { byeCounts[id] = (byeCounts[id] || 0) + 1; });
  });
  return { playCounts, byeCounts, partnerCounts, opponentCounts, previousByes: new Set(schedule.filter(match => match.bye).sort((a, b) => b.slotIndex - a.slotIndex)[0]?.bye || []) };
}

function createSlot({ players, courts, slotIndex, state, priorityId, templates = null }) {
  const activeCount = Math.floor(Math.min(players.length, courts.length * 4) / 4) * 4;
  const ranked = list => [...list].sort((a, b) => {
    const priority = player => player.id === priorityId ? -1000 : 0;
    return (priority(a) + (state.previousByes.has(a.id) ? -100 : 0) + state.playCounts[a.id] * 10 + state.byeCounts[a.id]) - (priority(b) + (state.previousByes.has(b.id) ? -100 : 0) + state.playCounts[b.id] * 10 + state.byeCounts[b.id]) || a.id.localeCompare(b.id);
  });
  const fixedIds = new Set(templates?.flatMap(template => template.fixedIds || []) || []);
  const available = players.filter(player => !fixedIds.has(player.id));
  const active = ranked(available).slice(0, Math.max(0, activeCount - fixedIds.size));
  const selected = [...players.filter(player => fixedIds.has(player.id)), ...active];
  const teams = chooseTeams(selected, state.partnerCounts);
  const matches = chooseMatches(teams, state.opponentCounts);
  const bye = players.filter(player => !selected.includes(player)).map(player => player.id);
  const byCourt = templates || courts.map(court => ({ courtId: court.id }));
  const result = byCourt.map((template, index) => {
    const [leftTeam, rightTeam] = matches[index];
    return {
      ...(template.match || {}),
      id: template.match?.id || `s${slotIndex + 1}-${template.courtId || courts[index].id}`,
      slotIndex,
      startMinute: slotIndex * 10,
      courtId: template.match?.courtId || template.courtId || courts[index].id,
      teamA: leftTeam.map(player => player.id),
      teamB: rightTeam.map(player => player.id),
      scoreA: template.match?.scoreA || "",
      scoreB: template.match?.scoreB || "",
      started: template.match?.started || false,
      finished: template.match?.finished || false,
      bye,
      replacements: template.match?.replacements ? [...template.match.replacements] : []
    };
  });
  result.forEach(match => addMatchHistory(match, state.playCounts, state.partnerCounts, state.opponentCounts));
  bye.forEach(id => { state.byeCounts[id] = (state.byeCounts[id] || 0) + 1; });
  state.previousByes = new Set(bye);
  return result;
}

function remixPendingSchedule({ players, courts, schedule, priorityId, skipLiveSlots = false }) {
  const playablePlayers = activePlayers(players);
  const playableCourts = activeCourts(courts);
  let copied = schedule.map(cloneMatch);
  const pending = copied.filter(match => !match.started && !match.finished);
  if (!pending.length) return copied;
  const firstPendingSlot = Math.min(...pending.map(match => match.slotIndex));
  const state = historyFromSchedule(copied.filter(match => match.slotIndex < firstPendingSlot || match.started || match.finished), playablePlayers);
  const slotIndexes = [...new Set(pending.map(match => match.slotIndex))].sort((a, b) => a - b);
  const capacity = Math.floor(Math.min(playablePlayers.length, playableCourts.length * 4) / 4);

  slotIndexes.forEach(slotIndex => {
    const live = copied.some(match => match.slotIndex === slotIndex && match.started && !match.finished);
    if (skipLiveSlots && live) return;
    const locked = copied.filter(match => match.slotIndex === slotIndex && (match.started || match.finished));
    const desiredPending = Math.max(0, capacity - locked.length);
    const existing = copied.filter(match => match.slotIndex === slotIndex && !match.started && !match.finished && playableCourts.some(court => court.id === match.courtId)).sort((a, b) => a.courtId.localeCompare(b.courtId));
    const templates = existing.slice(0, desiredPending).map(match => ({ match }));
    const usedCourtIds = new Set([...locked, ...templates.map(template => template.match)].map(match => match.courtId));
    playableCourts.filter(court => !usedCourtIds.has(court.id)).slice(0, Math.max(0, desiredPending - templates.length)).forEach(court => templates.push({ courtId: court.id }));
    const fixedIds = locked.flatMap(idsIn);
    templates.forEach(template => { template.fixedIds = fixedIds; });
    const replacement = templates.length ? createSlot({ players: playablePlayers, courts: playableCourts, slotIndex, state, priorityId, templates }) : [];
    copied = [...copied.filter(match => !(match.slotIndex === slotIndex && !match.started && !match.finished)), ...replacement];
  });
  return copied;
}

export function addPlayerAndRemixSchedule({ players, newPlayer, courts, schedule, changedAt = new Date().toISOString() }) {
  const name = String(newPlayer?.name || "").trim();
  if (!name) throw new Error("PLAYER_NAME_REQUIRED");
  if (players.some(player => player.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("PLAYER_NAME_DUPLICATE");
  if (!newPlayer?.id || players.some(player => player.id === newPlayer.id)) throw new Error("PLAYER_ID_DUPLICATE");
  const nextPlayers = [...players.map(player => ({ ...player })), { id: newPlayer.id, name, matches: 0, wins: 0, byes: 0 }];
  return { players: nextPlayers, schedule: remixPendingSchedule({ players: nextPlayers, courts, schedule, priorityId: newPlayer.id }), changedAt };
}

export function addCourtAndRemixSchedule({ players, courts, schedule, newCourt }) {
  if (!newCourt?.id || courts.some(court => court.id === newCourt.id)) throw new Error("COURT_ID_DUPLICATE");
  const nextCourts = [...courts.map(court => ({ ...court })), { ...newCourt }];
  return { courts: nextCourts, schedule: remixPendingSchedule({ players, courts: nextCourts, schedule, skipLiveSlots: true }) };
}

export function removePlayerAndRemixSchedule({ players, courts, schedule, playerId }) {
  const target = players.find(player => player.id === playerId && !player.removed);
  if (!target) throw new Error("PLAYER_NOT_FOUND");
  if (schedule.some(match => match.started && !match.finished && idsIn(match).includes(playerId))) throw new Error("PLAYER_ACTIVE");
  const nextPlayers = players.map(player => player.id === playerId ? { ...player, removed: true } : { ...player });
  return { players: nextPlayers, schedule: remixPendingSchedule({ players: nextPlayers, courts, schedule }) };
}

export function removeCourtAndRemixSchedule({ players, courts, schedule, courtId }) {
  const target = courts.find(court => court.id === courtId && !court.removed);
  if (!target) throw new Error("COURT_NOT_FOUND");
  if (schedule.some(match => match.courtId === courtId && match.started && !match.finished)) throw new Error("COURT_ACTIVE");
  const nextCourts = courts.map(court => court.id === courtId ? { ...court, removed: true } : { ...court });
  return { courts: nextCourts, schedule: remixPendingSchedule({ players, courts: nextCourts, schedule }) };
}

export function appendScheduleSlots({ players, courts, schedule, additionalHours }) {
  const hours = Number(additionalHours);
  if (!Number.isFinite(hours) || hours <= 0) throw new Error("DURATION_INVALID");
  const addedSlotCount = Math.floor(hours * 60 / 10);
  if (!addedSlotCount) throw new Error("DURATION_TOO_SHORT");
  const copied = schedule.map(cloneMatch);
  const lastSlot = copied.reduce((max, match) => Math.max(max, Number(match.slotIndex) || 0), -1);
  const state = historyFromSchedule(copied, players);
  const added = [];
  for (let offset = 1; offset <= addedSlotCount; offset += 1) {
    const slotIndex = lastSlot + offset;
    added.push(...createSlot({ players, courts, slotIndex, state }));
  }
  return { schedule: [...copied, ...added], addedSlotCount };
}

export function availableReplacementPlayers({ players, schedule, targetMatchId }) {
  const target = schedule.find(match => match.id === targetMatchId);
  if (!target) return [];
  const unavailable = new Set([...idsIn(target), ...schedule.filter(match => match.started && !match.finished).flatMap(idsIn)]);
  return activePlayers(players).filter(player => !unavailable.has(player.id));
}

function addMatchHistory(match, playCounts, partnerCounts, opponentCounts) {
  const left = match.teamA || [];
  const right = match.teamB || [];
  if (left.length !== 2 || right.length !== 2) return;
  [...left, ...right].forEach(id => { playCounts[id] = (playCounts[id] || 0) + 1; });
  [left, right].forEach(team => partnerCounts.set(pairKey(...team), (partnerCounts.get(pairKey(...team)) || 0) + 1));
  left.forEach(a => right.forEach(b => opponentCounts.set(pairKey(a, b), (opponentCounts.get(pairKey(a, b)) || 0) + 1)));
}

export function replaceAndRemixSchedule({ players, courts, schedule, targetMatchId, outPlayerId, inPlayerId, changedAt = new Date().toISOString() }) {
  const target = schedule.find(match => match.id === targetMatchId);
  if (!target) throw new Error("MATCH_NOT_FOUND");
  if (target.started || target.finished) throw new Error("MATCH_LOCKED");
  if (!idsIn(target).includes(outPlayerId)) throw new Error("OUT_PLAYER_INVALID");
  if (!availableReplacementPlayers({ players, schedule, targetMatchId }).some(player => player.id === inPlayerId)) throw new Error("IN_PLAYER_UNAVAILABLE");

  const copied = schedule.map(cloneMatch);
  const changed = copied.find(match => match.id === targetMatchId);
  changed.teamA = changed.teamA.map(id => id === outPlayerId ? inPlayerId : id);
  changed.teamB = changed.teamB.map(id => id === outPlayerId ? inPlayerId : id);
  changed.replacements.push({ outPlayerId, inPlayerId, changedAt });

  const activeIds = new Set(copied.filter(match => match.started && !match.finished).flatMap(idsIn));
  const locked = copied.filter(match => match.id === targetMatchId || match.started || match.finished);
  const playCounts = Object.fromEntries(players.map(player => [player.id, 0]));
  const byeCounts = Object.fromEntries(players.map(player => [player.id, 0]));
  const partnerCounts = new Map();
  const opponentCounts = new Map();
  locked.forEach(match => addMatchHistory(match, playCounts, partnerCounts, opponentCounts));
  const remixed = copied.filter(match => match.id !== targetMatchId && !match.started && !match.finished && match.slotIndex >= target.slotIndex);
  const preserved = copied.filter(match => !remixed.includes(match));
  const bySlot = new Map();
  remixed.forEach(match => bySlot.set(match.slotIndex, [...(bySlot.get(match.slotIndex) || []), match]));

  [...bySlot.keys()].sort((a, b) => a - b).forEach(slotIndex => {
    const templates = bySlot.get(slotIndex).sort((a, b) => a.courtId.localeCompare(b.courtId));
    const fixedHere = preserved.filter(match => match.slotIndex === slotIndex).flatMap(idsIn);
    const reserved = new Set([...activeIds, ...fixedHere]);
    const needed = templates.length * 4;
    const candidates = players.filter(player => !reserved.has(player.id));
    if (candidates.length < needed) throw new Error("NO_VALID_REMIX");
    const ranked = [...candidates].sort((a, b) => (playCounts[a.id] * 10 + byeCounts[a.id]) - (playCounts[b.id] * 10 + byeCounts[b.id]) || a.id.localeCompare(b.id));
    const selected = ranked.slice(0, needed);
    const teams = chooseTeams(selected, partnerCounts);
    const matchups = chooseMatches(teams, opponentCounts);
    const bye = players.filter(player => !selected.includes(player) && !fixedHere.includes(player.id)).map(player => player.id);
    templates.forEach((template, index) => {
      const [left, right] = matchups[index];
      template.teamA = left.map(player => player.id);
      template.teamB = right.map(player => player.id);
      template.scoreA = "";
      template.scoreB = "";
      template.bye = bye;
      addMatchHistory(template, playCounts, partnerCounts, opponentCounts);
    });
    bye.forEach(id => { byeCounts[id] = (byeCounts[id] || 0) + 1; });
  });
  return { schedule: copied, changedMatchId: targetMatchId };
}
