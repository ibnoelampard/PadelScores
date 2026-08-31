export const STORAGE_KEY = "padelscore-state-v1";

export function createEmptyState() {
  return { session: { status: "empty", playerCount: 0, courtCount: 0, durationHours: 0, slotMinutes: 10 }, players: [], courts: [], schedule: [] };
}

export function normalizeState(value) {
  if (!value || typeof value !== "object") return createEmptyState();
  const base = createEmptyState();
  const session = value.session && typeof value.session === "object" ? value.session : {};
  const playerCount = Math.max(0, Number.parseInt(session.playerCount, 10) || 0);
  const courtCount = Math.max(0, Number.parseInt(session.courtCount, 10) || 0);
  const durationHours = Math.max(0, Number(session.durationHours) || 0);
  const statuses = new Set(["empty", "setup", "players", "schedule", "finished"]);
  base.session = { status: statuses.has(session.status) ? session.status : "empty", playerCount, courtCount, durationHours, slotMinutes: 10 };
  base.players = Array.isArray(value.players) ? value.players.map((player, index) => ({ id: String(player.id || `p${index + 1}`), name: String(player.name || ""), matches: Number(player.matches) || 0, wins: Number(player.wins) || 0, byes: Number(player.byes) || 0 })) : [];
  base.courts = Array.isArray(value.courts) ? value.courts.map((court, index) => ({ id: String(court.id || `c${index + 1}`), name: String(court.name || `Court ${index + 1}`) })) : [];
  base.schedule = Array.isArray(value.schedule) ? value.schedule : [];
  return base;
}

export function saveState(state, storage = globalThis.localStorage) { storage.setItem(STORAGE_KEY, JSON.stringify(state)); }
export function loadState(storage = globalThis.localStorage) { try { return normalizeState(JSON.parse(storage.getItem(STORAGE_KEY) || "null")); } catch { return createEmptyState(); } }
