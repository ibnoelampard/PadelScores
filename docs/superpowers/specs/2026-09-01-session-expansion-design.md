# PadelScore — Dynamic Session Expansion Design

## Tujuan

Memungkinkan sesi padel yang sedang berjalan menerima pemain baru dan menambah durasi tanpa mengubah pertandingan yang sudah dimulai atau selesai.

## Entry Point UI

Halaman jadwal tetap memiliki tombol menu `⋯` di pojok kanan atas. Menu ini menjadi satu-satunya tempat untuk aksi tambahan agar header mobile tidak penuh atau bertabrakan dengan language switcher.

Isi menu:

- **Tambah pemain / Add player**
- **Tambah durasi / Extend duration**
- **Bahasa: ID / EN / Language: ID / EN**

Language switcher berada di dalam menu, pilihannya disimpan ke `localStorage`, dan semua label feature baru memiliki terjemahan Indonesia serta English. Nama pemain, nama lapangan, skor, dan waktu tidak diterjemahkan.

## Tambah Pemain Saat Sesi Berjalan

User memilih Tambah pemain, memasukkan satu nama baru, lalu menekan Tambah. Nama harus tidak kosong dan tidak duplikat case-insensitive.

Pemain baru langsung masuk ke daftar sesi. Sistem kemudian hanya me-remix pertandingan yang berstatus **Belum Mulai**. Pertandingan berstatus **Sedang Bermain** atau **Selesai** mempertahankan court, pasangan, skor, dan statusnya tanpa perubahan.

Jadwal pending di-remix mulai dari slot pending pertama sampai akhir sesi menggunakan pemain lama dan pemain baru. Algoritma memprioritaskan pemain baru untuk mendapat kesempatan bermain, lalu menyeimbangkan total jumlah main, istirahat, pengulangan pasangan, dan pengulangan lawan. Jika tidak ada jadwal pending, pemain baru masuk ke jadwal tambahan hanya jika durasi diperpanjang.

## Tambah Durasi

User memilih Tambah durasi, mengisi tambahan jam, lalu menekan Tambah. Nilai tambahan harus lebih besar dari 0.

Jadwal lama tidak diubah. Sistem membuat slot baru setelah slot terakhir menggunakan interval 10 menit dan daftar pemain terbaru. Slot tambahan mempertimbangkan riwayat jumlah main, istirahat, pasangan, dan lawan dari jadwal lama, sehingga pemain baru atau pemain yang paling sedikit bermain mendapat prioritas secara adil.

Contoh: sesi 2 jam memiliki 12 slot. Jika ditambah 1 jam, sistem menambahkan 6 slot baru sehingga total menjadi 18 slot per lapangan.

## State dan Invariants

Session state menyimpan `durationHours` terbaru. Schedule item memiliki `started` dan `finished`.

- `started === true` berarti pasangan dan court terkunci.
- `finished === true` berarti pertandingan selesai; skor masih editable.
- Re-mix tidak boleh mengubah item `started` atau `finished`.
- Extend duration hanya boleh menambah item dengan `slotIndex` lebih besar dari slot terakhir yang sudah ada.
- Pemain baru memiliki ID unik dan nama tetap setelah ditambahkan.
- Semua perubahan langsung dipersist ke `localStorage` agar aman saat refresh.

## Error Handling

- Nama kosong atau duplikat menampilkan error inline.
- Durasi tambahan nol/negatif atau bukan angka menampilkan error inline.
- Jika semua jadwal sudah dimulai/selesai, tambah pemain tetap disimpan tetapi tidak mengubah jadwal lama; user diberi informasi bahwa pemain akan diprioritaskan pada slot tambahan berikutnya.
- State lama tanpa field baru dinormalisasi agar tetap bisa dibuka.

## Testing

- Menu `⋯` membuka tiga aksi: tambah pemain, tambah durasi, dan bahasa.
- Tambah pemain baru mempertahankan semua match started/finished secara deep equality.
- Tambah pemain baru masuk ke minimal satu match pending jika slot pending tersedia.
- Nama pemain baru menolak kosong dan duplikat.
- Tambah 1 jam pada sesi 2 jam menghasilkan 6 slot baru per lapangan.
- Slot lama, skor, status, court, dan pasangan tidak berubah setelah extend duration.
- Pemain baru dapat masuk ke slot tambahan.
- Pilihan ID/EN tersimpan setelah refresh dan label modal berubah.
- Semua test lama tetap lulus.
