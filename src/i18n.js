export const LANGUAGE_STORAGE_KEY = "padelscore-language-v1";

const messages = {
  id: {
    "language.switch": "Ganti bahasa ke English",
    "empty.title": "Match kamu",
    "empty.subtitle": "Atur rotasi padel dengan mudah",
    "empty.heading": "Belum ada match",
    "empty.description": "Buat sesi baru untuk mulai mix pemain dan menyusun jadwal pertandingan.",
    "empty.create": "＋  Buat Match",
    "setup.title": "Buat Match",
    "setup.subtitle": "Langkah 1 dari 3 · Atur sesi",
    "setup.players": "Jumlah pemain",
    "setup.courts": "Jumlah lapangan",
    "setup.duration": "Durasi sesi (jam)",
    "setup.examplePlayers": "Contoh: 12",
    "setup.exampleCourts": "Contoh: 2",
    "setup.exampleDuration": "Contoh: 2",
    "setup.rotation": "Rotasi otomatis setiap 10 menit",
    "setup.create": "Buat Match",
    "common.cancel": "Batal",
    "validation.setup": "Isi jumlah pemain minimal 4, lapangan minimal 1, dan durasi lebih dari 0.",
    "players.title": "Nama Pemain",
    "players.subtitle": "{count} pemain · Langkah 2 dari 3",
    "players.placeholder": "Nama pemain {number}",
    "players.create": "Buat Jadwal Pertandingan",
    "players.heading": "Isi semua nama pemain",
    "players.count": "{count} nama",
    "validation.namesRequired": "Semua nama pemain harus diisi.",
    "validation.namesDuplicate": "Nama pemain tidak boleh duplikat.",
    "schedule.title": "Jadwal Pertandingan",
    "schedule.subtitle": "{hours} jam",
    "schedule.chooseCourt": "Pilih lapangan",
    "schedule.matches": "{count} pertandingan",
    "schedule.bye": "Istirahat slot ini: {names}",
    "schedule.saved": "Tersimpan otomatis",
    "schedule.reset": "Reset sesi",
    "schedule.resetConfirm": "Hapus sesi dan semua jadwal?",
    "session.chooseTab": "Pilih tampilan sesi",
    "session.schedule": "Jadwal",
    "session.leaderboard": "Klasemen",
    "leaderboard.title": "Klasemen Pemain",
    "leaderboard.subtitle": "Hasil pertandingan yang selesai",
    "leaderboard.heading": "Statistik pemain",
    "leaderboard.matchesFinished": "{count} pertandingan selesai",
    "leaderboard.player": "Pemain",
    "leaderboard.matches": "Main",
    "leaderboard.wins": "Menang",
    "leaderboard.draws": "Seri",
    "leaderboard.losses": "Kalah",
    "court.label": "Lapangan {number}",
    "status.finished": "✓ Selesai",
    "status.playing": "● Sedang bermain",
    "score.label": "SKOR",
    "score.left": "Skor tim kiri",
    "score.right": "Skor tim kanan",
    "match.edit": "Edit",
    "match.start": "Mulai",
    "match.finish": "✓ Selesai"
  },
  en: {
    "language.switch": "Switch language to Indonesian",
    "empty.title": "Your matches",
    "empty.subtitle": "Set up padel rotations with ease",
    "empty.heading": "No matches yet",
    "empty.description": "Create a new session to mix players and build the match schedule.",
    "empty.create": "＋  Create Match",
    "setup.title": "Create Match",
    "setup.subtitle": "Step 1 of 3 · Set up your session",
    "setup.players": "Number of players",
    "setup.courts": "Number of courts",
    "setup.duration": "Session duration (hours)",
    "setup.examplePlayers": "Example: 12",
    "setup.exampleCourts": "Example: 2",
    "setup.exampleDuration": "Example: 2",
    "setup.rotation": "Automatic rotation every 10 minutes",
    "setup.create": "Create Match",
    "common.cancel": "Cancel",
    "validation.setup": "Enter at least 4 players, 1 court, and a duration greater than 0.",
    "players.title": "Player Names",
    "players.subtitle": "{count} players · Step 2 of 3",
    "players.placeholder": "Player name {number}",
    "players.create": "Create Match Schedule",
    "players.heading": "Enter every player's name",
    "players.count": "{count} names",
    "validation.namesRequired": "Every player name is required.",
    "validation.namesDuplicate": "Player names must be unique.",
    "schedule.title": "Match Schedule",
    "schedule.subtitle": "{hours} hours",
    "schedule.chooseCourt": "Choose a court",
    "schedule.matches": "{count} matches",
    "schedule.bye": "Resting this slot: {names}",
    "schedule.saved": "Saved automatically",
    "schedule.reset": "Reset session",
    "schedule.resetConfirm": "Delete this session and all its matches?",
    "session.chooseTab": "Choose a session view",
    "session.schedule": "Schedule",
    "session.leaderboard": "Leaderboard",
    "leaderboard.title": "Player Leaderboard",
    "leaderboard.subtitle": "Completed match results",
    "leaderboard.heading": "Player statistics",
    "leaderboard.matchesFinished": "{count} matches finished",
    "leaderboard.player": "Player",
    "leaderboard.matches": "Played",
    "leaderboard.wins": "Wins",
    "leaderboard.draws": "Draws",
    "leaderboard.losses": "Losses",
    "court.label": "Court {number}",
    "status.finished": "✓ Finished",
    "status.playing": "● Playing now",
    "score.label": "SCORE",
    "score.left": "Left team score",
    "score.right": "Right team score",
    "match.edit": "Edit",
    "match.start": "Start",
    "match.finish": "✓ Finish"
  }
};

export function resolveLanguage(browserLanguage, storedLanguage) {
  if (storedLanguage === "id" || storedLanguage === "en") return storedLanguage;
  return String(browserLanguage || "").toLowerCase().startsWith("id") ? "id" : "en";
}

export function createI18n({ storage = globalThis.localStorage, browserLanguage = globalThis.navigator?.language, root = globalThis.document?.documentElement } = {}) {
  let language = resolveLanguage(browserLanguage, storage?.getItem(LANGUAGE_STORAGE_KEY));
  const applyDocumentLanguage = () => root?.setAttribute("lang", language);
  applyDocumentLanguage();

  return {
    getLanguage: () => language,
    setLanguage(nextLanguage) {
      language = resolveLanguage(browserLanguage, nextLanguage);
      storage?.setItem(LANGUAGE_STORAGE_KEY, language);
      applyDocumentLanguage();
    },
    t(key, variables = {}) {
      const template = messages[language][key] || messages.en[key] || key;
      return template.replace(/\{(\w+)\}/g, (_, name) => String(variables[name] ?? ""));
    }
  };
}
