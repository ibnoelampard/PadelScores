import { normalizeState } from './storage.js';
export const MAX_BACKUP_BYTES = 2_000_000;
export function parseBackup(text) {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('backup_invalid');
  const parsed = JSON.parse(text);
  if (parsed?.format && (parsed.format !== 'padelscore' || parsed.version !== 1)) throw new Error('backup_invalid');
  const value = parsed?.format === 'padelscore' ? parsed.state : parsed;
  if (!value || !['empty','setup','players','schedule','finished'].includes(value.session?.status)
      || !['players','courts','schedule'].every(key=>Array.isArray(value[key]))) throw new Error('backup_invalid');
  const normalized = normalizeState(value);
  if (normalized.players.length>200 || normalized.courts.length>50 || normalized.schedule.length>5000 ||
      normalized.session.playerCount>200 || normalized.session.courtCount>50 || normalized.session.durationHours>1000 ||
      normalized.players.some(p=>p.name.length>200) || normalized.courts.some(c=>c.name.length>200)) throw new Error('backup_invalid');
  const players = new Set(normalized.players.map(p=>p.id));
  const courts = new Set(normalized.courts.map(c=>c.id));
  if (players.size !== value.players.length || courts.size !== value.courts.length ||
      new Set(normalized.schedule.map(m=>m.id)).size !== value.schedule.length) throw new Error('backup_invalid');
  for (const m of normalized.schedule) {
    if (!courts.has(m.courtId) || m.teamA.length!==2 || m.teamB.length!==2 ||
        new Set([...m.teamA,...m.teamB]).size!==4 || [...m.teamA,...m.teamB,...(m.bye||[])].some(id=>!players.has(id)) ||
        !Number.isInteger(m.slotIndex) || m.slotIndex<0 || !Number.isInteger(m.startMinute) || m.startMinute<0 ||
        [m.scoreA,m.scoreB].some(score=>score!=='' && !/^[0-9]{1,6}$/.test(score))) throw new Error('backup_invalid');
  }
  if (['schedule','finished'].includes(normalized.session.status) && (!normalized.courts.some(c=>!c.removed) || normalized.players.length<4)) throw new Error('backup_invalid');
  return normalized;
}
export function serializeBackup(state) {
  return JSON.stringify({format:'padelscore',version:1,exportedAt:new Date().toISOString(),state},null,2);
}
const recoveryKey = id => `padelscore-recovery-v1:${id}`;
export function readRecovery(storage,id) {
  try {
    const value=JSON.parse(storage.getItem(recoveryKey(id)) || 'null');
    if (!value || !Number.isInteger(value.revision) || value.revision<0) return null;
    return {...value,state:parseBackup(JSON.stringify(value.state))};
  } catch {return null;}
}
export function writeRecovery(storage,id,value) {
  if (value) storage.setItem(recoveryKey(id),JSON.stringify(value));
  else storage.removeItem(recoveryKey(id));
}
