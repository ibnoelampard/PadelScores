# Session Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan pemain dan durasi ke sesi yang sedang berjalan melalui menu `⋯`, dengan remix yang adil tanpa mengubah match yang sudah dimulai/selesai.

**Architecture:** Logika penambahan pemain dan slot baru dibuat sebagai fungsi pure di `src/mixer.js`, sehingga invariant jadwal dapat diuji tanpa DOM. `src/app.js` menangani menu mobile, modal, validasi, dan penyimpanan; `src/storage.js` memastikan state lama tetap kompatibel; `src/i18n.js` menyediakan label ID/EN. Jadwal lama diperlakukan immutable secara logis: hanya item pending yang boleh diganti oleh fitur tambah pemain, sedangkan tambah durasi selalu append slot dengan `slotIndex` baru.

**Tech Stack:** Vanilla JavaScript ES modules, HTML DOM API, CSS existing mobile-first, Node built-in test runner, `localStorage`.

## Global Constraints

- Interval pertandingan tetap 10 menit (`slotMinutes: 10`); input durasi tambahan memakai satuan jam.
- Match `started === true` atau `finished === true` tidak boleh berubah court, pasangan, skor, status, atau riwayat replacement.
- Match pending boleh di-remix mulai dari pending pertama sampai akhir sesi ketika pemain baru ditambahkan.
- Tambah durasi hanya boleh membuat item dengan `slotIndex` lebih besar dari slot terakhir.
- Nama pemain baru harus tidak kosong dan unik case-insensitive; nama pemain yang sudah ada tidak dapat diedit melalui feature ini.
- Semua perubahan state disimpan ke `localStorage` dan harus bertahan setelah refresh.
- Istilah yang terlihat di UI untuk `bye` adalah “Istirahat” pada Bahasa Indonesia dan “Resting” pada English.
- Header mobile hanya memakai satu tombol menu `⋯`; language switcher berada di dalam menu agar tidak bertabrakan dengan aksi lain.

---

### Task 1: Stabilkan model schedule dan siapkan API mixer untuk ekspansi

**Files:**
- Modify: `src/mixer.js`
- Modify: `src/storage.js`
- Test: `test/mixer.test.js`
- Test: `test/storage.test.js`

**Interfaces:**
- Existing: `generateSchedule({ players, courts, durationHours, previousSchedule = [] }) -> { schedule, byePlayerIds }`.
- Produce: `addPlayerAndRemixSchedule({ players, newPlayer, courts, schedule, changedAt? }) -> { players, schedule }`.
- Produce: `appendScheduleSlots({ players, courts, schedule, additionalHours }) -> { schedule, addedSlotCount }`.

- [ ] **Step 1: Tulis test failing untuk bentuk schedule yang konsisten.** Pastikan item yang dibuat generator selalu memiliki `replacements: []`, sehingga hasil remix tidak mengubah shape item lama secara tidak sengaja; tambahkan test bahwa `normalizeState` memberi default `replacements: []`, `started: false`, dan `finished: false` pada data lama.

- [ ] **Step 2: Tulis test failing untuk tambah pemain.** Gunakan sesi dengan sebagian item `started`/`finished`, simpan deep copy match terkunci, jalankan `addPlayerAndRemixSchedule`, lalu assert: ID/nama pemain baru masuk, semua match terkunci deep-equal dengan sebelum operasi, dan setidaknya satu match pending memakai pemain baru bila pending tersedia.

- [ ] **Step 3: Tulis test failing untuk validasi dan kasus tanpa pending.** Assert nama kosong atau ID duplikat ditolak oleh API dengan error yang stabil (`PLAYER_NAME_REQUIRED` atau `PLAYER_NAME_DUPLICATE`), dan ketika seluruh schedule terkunci API tidak mengubah match lama tetapi tetap mengembalikan roster baru.

- [ ] **Step 4: Tulis test failing untuk append durasi.** Untuk sesi 2 jam, dua court, panggil `appendScheduleSlots({ additionalHours: 1 })`; assert enam slot waktu baru per court, `slotIndex` baru dimulai setelah index maksimum lama, dan seluruh field item lama (termasuk skor/status/pasangan/court) deep-equal.

- [ ] **Step 5: Tulis test failing untuk fairness slot tambahan.** Sertakan pemain baru dan riwayat jumlah main/istirahat dari schedule lama; assert pemain baru dapat dipilih pada slot tambahan dan setiap match baru tetap berisi dua tim berisi dua pemain tanpa pemain ganda dalam satu slot.

- [ ] **Step 6: Jalankan test mixer/storage untuk memastikan test baru gagal karena API belum ada.**

Run: `node --test test/mixer.test.js test/storage.test.js`

Expected: FAIL hanya pada assertion/API baru, tanpa error syntax pada test lama.

- [ ] **Step 7: Implementasikan helper internal berbasis data existing.** Reuse `chooseTeams`, `chooseMatches`, `addMatchHistory`, dan ranking fairness yang sudah ada; jangan mutasi input `schedule`. Untuk add player, remix hanya item `!started && !finished` mulai slot pending pertama, sambil memulai history dari item locked dan memprioritaskan `newPlayer.id`. Untuk append, lanjutkan history dari semua item lama, buat `Math.floor(additionalHours * 60 / 10)` slot per court, dan gunakan ID `s${slotIndex + 1}-${court.id}`.

- [ ] **Step 8: Tambahkan normalisasi field baru tanpa merusak state lama.** Pastikan `normalizeState` mengisi `session.durationHours`, `session.slotMinutes`, roster counters, `started`, `finished`, `scoreA`, `scoreB`, `bye`, dan `replacements` dengan nilai aman; sinkronkan `session.playerCount` dengan roster hanya pada alur add player di app, bukan mengubah data lama diam-diam saat load.

- [ ] **Step 9: Jalankan test dan perbaiki kontrak shape yang ditemukan.**

Run: `node --test test/mixer.test.js test/storage.test.js`

Expected: PASS seluruh test mixer/storage, termasuk test replacement lama dan invariant input tidak termutasi.

- [ ] **Step 10: Commit perubahan logika dan model.**

```bash
git add src/mixer.js src/storage.js test/mixer.test.js test/storage.test.js
git commit -m "feat: add safe schedule expansion primitives"
```

### Task 2: Tambahkan copy bilingual untuk menu dan modal

**Files:**
- Modify: `src/i18n.js`
- Test: `test/i18n.test.js`

**Interfaces:**
- Existing: `createI18n().t(key, variables)` and `setLanguage(language)`.
- Produce message keys consumed by `src/app.js`: `session.actions`, `session.addPlayer`, `session.extendDuration`, `session.language`, `playerAdd.title`, `playerAdd.description`, `playerAdd.name`, `playerAdd.submit`, `durationAdd.title`, `durationAdd.description`, `durationAdd.hours`, `durationAdd.submit`, `validation.playerRequired`, `validation.playerDuplicate`, `validation.durationInvalid`, `playerAdd.success`, `playerAdd.noPending`, `durationAdd.success`, `durationAdd.error`.

- [ ] **Step 1: Tambahkan test ID/EN untuk semua key feature baru dan placeholder jam/nama.** Pastikan key tidak fallback ke nama key dan `t()` mengganti `{name}`, `{hours}`, atau `{count}`.

- [ ] **Step 2: Jalankan test i18n untuk melihat kegagalan key baru.**

Run: `node --test test/i18n.test.js`

Expected: FAIL pada key feature expansion yang belum ada.

- [ ] **Step 3: Tambahkan pasangan terjemahan ID/EN.** Gunakan istilah “Tambah pemain”, “Tambah durasi”, “Bahasa”, “Istirahat”, dan copy yang menjelaskan match berjalan/selesai tetap tidak berubah.

- [ ] **Step 4: Jalankan test i18n sampai PASS.**

- [ ] **Step 5: Commit copy bilingual.**

```bash
git add src/i18n.js test/i18n.test.js
git commit -m "feat: add bilingual session expansion copy"
```

### Task 3: Implementasikan menu `⋯`, modal tambah pemain, dan modal tambah durasi

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`

**Interfaces:**
- Consume: `addPlayerAndRemixSchedule` and `appendScheduleSlots` from `src/mixer.js`.
- Consume: all message keys from Task 2.
- Produce: schedule header action button with an accessible popover containing exactly three actions: add player, extend duration, language.

- [ ] **Step 1: Tambahkan state UI transient.** Buat state lokal untuk `sessionMenuOpen` dan `sessionModal` (`"add-player" | "extend-duration" | null`), reset menu/modal saat berpindah tab/court, dan jangan memasukkannya ke `localStorage`.

- [ ] **Step 2: Tambahkan testable DOM hooks dalam render session.** Header jadwal harus memuat tombol `⋯` di kanan atas dengan `aria-expanded`; popover harus memuat tiga button yang memakai label i18n. Jangan menambah tombol language terpisah di header session.

- [ ] **Step 3: Buat modal tambah pemain sebagai bottom-sheet mobile.** Sediakan satu input nama, pesan dampak bahwa match sedang bermain/selesai tetap, tombol Batal, tombol Tambah, focus awal ke input, dan tombol Escape/klik backdrop untuk menutup bila pola existing mendukungnya.

- [ ] **Step 4: Hubungkan submit tambah pemain.** Trim nama, validasi kosong dan case-insensitive duplicate terhadap `state.players`, buat ID `p${max numeric existing id + 1}` tanpa collision, panggil `addPlayerAndRemixSchedule`, update `state.players`, `state.session.playerCount`, tutup modal, set `sessionNotice`, `persist()`, lalu `render()`.

- [ ] **Step 5: Tangani kondisi tanpa pending.** Tetap simpan pemain baru, jangan ubah schedule lama, dan tampilkan notice i18n bahwa pemain akan diprioritaskan pada slot tambahan berikutnya.

- [ ] **Step 6: Buat modal tambah durasi sebagai bottom-sheet mobile.** Sediakan input number `min="0.1"`, `step="0.1"`, copy unit jam, tombol Batal, tombol Tambah, serta error inline.

- [ ] **Step 7: Hubungkan submit tambah durasi.** Validasi finite number > 0, panggil `appendScheduleSlots`, tambah nilai ke `state.session.durationHours`, gabungkan schedule hasil append, tutup modal, tampilkan jumlah slot yang ditambahkan, `persist()`, dan `render()`. Jika hasil slot nol karena pembulatan, tampilkan error dan jangan mengubah state.

- [ ] **Step 8: Hubungkan pilihan bahasa di popover.** Tampilkan pilihan/aksi ID dan EN di menu, gunakan `i18n.setLanguage`, tutup popover, dan render ulang; pastikan bahasa tersimpan oleh existing i18n storage key dan tetap setelah reload.

- [ ] **Step 9: Pastikan rendering tidak mengubah rule existing.** Schedule card tetap hanya expand untuk match aktif, item lain compact/elipsis, nama team tetap atas-bawah, score input tetap bisa diedit setelah finish, dan teks bye yang tampil tetap “Istirahat/Resting”.

- [ ] **Step 10: Commit UI dan behavior.**

```bash
git add src/app.js styles.css
git commit -m "feat: add in-session player and duration actions"
```

### Task 4: Verifikasi integrasi, mobile layout, dan deployment state

**Files:**
- Modify: `src/app.js` only when integration checks expose a wiring issue
- Modify: `styles.css` only when mobile verification exposes a layout issue
- Modify: `README.md` only when the run/deploy instructions are stale

**Interfaces:**
- Consume all APIs and UI behavior from Tasks 1–3.

- [ ] **Step 1: Verifikasi alur UI melalui preview browser mobile.** Repository ini hanya memiliki Node built-in test runner tanpa DOM dependency, jadi gunakan browser preview untuk membuka sesi seeded, klik `⋯`, dan pastikan exactly three actions tampil serta masing-masing modal dapat dibuka.

- [ ] **Step 2: Uji alur tambah pemain di preview browser.** Seed localStorage dengan satu match aktif, satu selesai, dan satu pending; submit nama unik; reload; pastikan pemain tersimpan, match locked tidak berubah, dan pending match ter-remix.

- [ ] **Step 3: Uji alur tambah durasi di preview browser.** Seed sesi 2 jam/2 court, submit tambahan 1 jam, reload; pastikan ada 6 slot tambahan per court dan 12 slot awal tetap sama.

- [ ] **Step 4: Jalankan seluruh pemeriksaan syntax dan test suite.**

Run: `node --check src/*.js && node --test`

Expected: PASS seluruh test, termasuk test lama untuk replacement/leaderboard/storage.

- [ ] **Step 5: Jalankan preview static lokal dan cek viewport mobile.** Buka `index.html` melalui server static yang sudah dipakai repository, cek 375–430px: tombol `⋯` tidak bertabrakan, bottom-sheet tidak overflow, nama team dua baris, score `10`/`11` utuh, hanya match aktif yang expanded.

- [ ] **Step 6: Jalankan `git diff --check` dan cek status.** Pastikan tidak ada file generated atau perubahan user lain ikut ter-commit.

Run: `git diff --check && git status --short --branch`

- [ ] **Step 7: Push ke branch `main` setelah user meminta publish.**

```bash
git push origin main
```

Expected: GitHub Pages workflow selesai sukses dan URL `https://ibnoelampard.github.io/PadelScores/` menampilkan versi baru.
