# PadelScore — rancangan integrasi Supabase

Status: rancangan untuk ditinjau sebelum implementasi.

## Tujuan

Sesi permainan dapat dibuka kembali dari HP atau laptop dengan akun Google yang sama. PostgreSQL menjadi sumber data utama. Tampilan dan algoritme rotasi yang sudah ada tetap digunakan.

## Infrastruktur yang disiapkan

- Frontend: https://padel-scores.vercel.app/
- Repository: ibnoelampard/PadelScores.
- Supabase project: nonmknuojmcqndmlxjhz.
- Google OAuth provider terlihat Enabled; pengguna melaporkan Site URL dan redirect URL sudah disimpan. Login ujung ke ujung belum diuji.
- Publishable key sudah diberikan untuk konfigurasi frontend. Secret key, database password, dan Google client secret tidak dimasukkan ke repository.

## Pilihan arsitektur

1. **Direkomendasikan: Supabase dengan tabel relasional dan transaksi RPC.** Menggunakan Auth, PostgreSQL, dan Realtime yang sudah disiapkan. Memerlukan perubahan alur simpan dari sinkron menjadi asinkron.
2. Satu dokumen JSON per akun: perubahan kode lebih sedikit, tetapi pelaporan lintas pertandingan dan validasi relasi lebih terbatas.
3. Backend khusus: dapat mengendalikan seluruh API, tetapi menambah deployment dan pemeliharaan yang belum dibutuhkan proyek pribadi ini.

## Batas versi pertama

- Login Google, logout, dan satu sesi aktif per akun, mengikuti batas aplikasi saat ini.
- Setiap akun hanya boleh membaca dan mengubah sesi miliknya. Pengguna lain tidak mendapat akses hanya karena mengetahui ID sesi.
- Akses antarperangkat menggunakan akun yang sama.
- Belum ada tautan penonton publik, undangan pengelola lain, atau riwayat banyak sesi; fitur tersebut membutuhkan rancangan hak akses dan antarmuka tambahan.
- Operasi penyimpanan membutuhkan internet. Tidak ada penggabungan perubahan offline otomatis.
- Reset sesi tetap memakai konfirmasi dan mengikuti perilaku aplikasi saat ini. Pengguna dapat mengekspor sesi sebelum reset.

## Database

- `sessions`: UUID, owner_id yang merujuk auth.users, status, jumlah pemain/lapangan, durasi, slot_minutes, revision, updated_at. Batas unik owner_id untuk satu sesi per akun.
- `session_players`: session_id, ID pemain lokal, nama, status removed. ID lokal unik dalam sesi, bukan lintas akun.
- `courts`: session_id, ID lapangan lokal, nama, status removed.
- `matches`: session_id, ID pertandingan lokal, lapangan, slot/waktu yang digunakan model saat ini, skor, started, finished, dan informasi bye yang diperlukan algoritme.
- `match_players`: session_id, match_id, player_id, tim A/B, urutan anggota tim.
- `match_replacements`: session_id, match_id, pemain keluar/masuk, waktu dan urutan penggantian.
- Statistik leaderboard dihitung dari pertandingan seperti sekarang agar tidak ada penghitung duplikat yang berbeda hasil.

## Hak akses dan transaksi

- Aktifkan RLS pada semua tabel. Semua pembacaan memeriksa kepemilikan sesi melalui auth.uid(). Role anon tidak memiliki akses data pertandingan.
- Penulisan dilakukan dalam fungsi database yang memeriksa autentikasi dan pemilik; owner_id selalu diturunkan dari auth.uid(), bukan dipercaya dari input browser.
- Simpan sesi dan seluruh data turunannya dalam satu transaksi. Kegagalan validasi membatalkan seluruh transaksi.
- Fungsi menolak expected_revision yang kedaluwarsa dan menaikkan revision setiap penulisan berhasil. Dua perangkat tidak boleh diam-diam saling menimpa.
- Hak eksekusi fungsi diberikan hanya kepada authenticated; fungsi privileged harus memakai search_path tetap dan nama objek yang lengkap.
- Validasi bentuk input, status, skor nonnegatif, referensi pemain/lapangan, keanggotaan tim, dan ukuran payload dilakukan di server selain validasi UI.
- Jangan mengaktifkan akses publik untuk mempermudah tes.

## Alur aplikasi dan kegagalan

- Saat membuka aplikasi: pulihkan login, lalu muat sesi akun. Jangan menampilkan data akun sebelumnya sambil menunggu hasil.
- Tambahkan status memuat, menyimpan, tersimpan, gagal, dan konflik. Klaim tersimpan hanya muncul setelah database mengonfirmasi.
- Perubahan skor disimpan dengan debounce dan antrean berurutan. Perubahan yang belum tersimpan diberi indikator serta peringatan saat meninggalkan halaman.
- Jika penyimpanan gagal, simpan salinan pemulihan lokal yang terikat akun, tampilkan kegagalan, dan sediakan coba lagi serta ekspor. Jangan menganggap salinan ini tersinkron.
- Jika terjadi konflik, hentikan penulisan, pertahankan salinan perubahan untuk ekspor, dan tawarkan muat data terbaru; jangan melakukan overwrite otomatis.
- Realtime berlangganan perubahan revision sesi milik akun. Perubahan remote dimuat otomatis jika tidak ada perubahan lokal; jika ada, gunakan alur konflik.
- Setelah Realtime tersambung kembali atau halaman kembali aktif, periksa revision dari server untuk menangkap pembaruan yang terlewat.
- Logout membersihkan tampilan dan subscription akun. Perubahan belum tersimpan harus diselesaikan atau diekspor sebelum logout.

## Migrasi lokal

- Tambahkan ekspor JSON sebelum mengubah penyimpanan.
- Baca data lama dari key padelscore-state-v1 hanya melalui alur impor yang eksplisit setelah login.
- Impor berasal dari browser dan origin tempat data lama disimpan. Data localhost tidak otomatis terlihat di domain Vercel; gunakan ekspor/impor file untuk perpindahan tersebut.
- Normalisasi dan validasi isi impor. Jangan menghapus sumber lokal setelah impor.
- Jika akun sudah memiliki sesi, jangan menimpa tanpa konfirmasi; pengguna mengekspor sesi tujuan terlebih dahulu bila ingin menggantinya.

## Susunan implementasi

1. Modul backup dan migrasi, beserta pengujian format data.
2. SQL migration untuk tabel, RLS, fungsi transaksi dan revision.
3. Modul client Supabase, Auth, dan repository sesi; konfigurasi hanya memakai URL dan publishable key.
4. Integrasi state asinkron, login, status simpan, pemulihan, dan Realtime ke UI bilingual yang ada.
5. Petunjuk menjalankan SQL di dashboard, pengujian pada proyek Supabase, dan deploy lewat repository Vercel yang sudah ada.

## Verifikasi sebelum dinyatakan selesai

- Semua tes mixer, leaderboard, i18n, dan penyimpanan lama tetap lulus.
- Tes baru memeriksa round-trip data, kegagalan simpan, antrean perubahan, konflik revision, dan pemisahan akun.
- Tes database nyata: anon ditolak; akun A tidak dapat membaca/menulis sesi B; payload tidak valid dibatalkan; revision kedaluwarsa ditolak; kegagalan transaksi tidak menghapus data lama.
- Tes browser: login Google dan redirect berhasil, impor data lama, buat sesi, ubah skor, refresh, buka dua konteks browser, konflik, logout, serta kegagalan jaringan.
- Penyiapan provider saja belum membuktikan login atau penyimpanan berhasil. Jika kredensial/akses tes tidak tersedia, laporkan bagian yang belum diverifikasi.

## Pembagian kerja

Saya menyiapkan kode, SQL, dan pengujian lokal. Pengguna menyelesaikan langkah akun yang membutuhkan identitasnya, menjalankan SQL bila akses langsung tidak tersedia, dan melakukan login Google untuk pengujian. Token GitHub CLI yang sebelumnya terdeteksi tidak valid perlu diperiksa kembali sebelum push.
