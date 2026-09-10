# Menjalankan PadelScore dengan Supabase

Ikuti langkah ini setelah kode integrasi sudah dikirim ke Vercel. Aplikasi tidak akan menyimpan sesi ke cloud sampai migrasi SQL dijalankan.

## 1. Jalankan migrasi database

1. Buka proyek [padelscore di Supabase](https://supabase.com/dashboard/project/nonmknuojmcqndmlxjhz).
2. Pilih **SQL Editor** lalu **New query**.
3. Salin seluruh isi [migrasi SQL](../supabase/migrations/202609100001_padel.sql) ke editor.
4. Klik **Run** dan pastikan hasilnya tanpa error.

Migrasi membuat tabel untuk sesi, pemain, lapangan, pertandingan, anggota tim, dan riwayat penggantian. Aturan database hanya mengizinkan akun yang login membaca datanya sendiri. Browser tidak diberi key admin.

## 2. Konfirmasi URL login Google

Di **Authentication → URL Configuration**, pastikan nilai ini masih ada:

| Pengaturan | Nilai |
| --- | --- |
| Site URL | `https://padel-scores.vercel.app` |
| Redirect URLs | `https://padel-scores.vercel.app/` |

Di **Authentication → Providers → Google**, provider harus tetap **Enabled**. Google Cloud OAuth client harus memiliki origin `https://padel-scores.vercel.app` dan callback `https://nonmknuojmcqndmlxjhz.supabase.co/auth/v1/callback`.

## 3. Deploy di Vercel

Vercel membaca pengaturan proyek dari `vercel.json`:

| Pengaturan Vercel | Nilai |
| --- | --- |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Tidak ada environment variable atau secret yang perlu dimasukkan ke Vercel untuk versi ini. Publishable key Supabase adalah key publik untuk aplikasi browser; database tetap dilindungi oleh login dan RLS.

## 4. Uji aplikasi yang sudah online

1. Buka `https://padel-scores.vercel.app` dalam jendela incognito.
2. Klik **Masuk dengan Google** dan selesaikan login.
3. Buat sesi, isi pemain, buat jadwal, lalu ubah skor.
4. Refresh halaman dan pastikan sesi serta skor kembali.
5. Buka URL yang sama dari perangkat atau browser kedua, login dengan akun Google yang sama, lalu ubah skor. Perangkat pertama akan membaca pembaruan terbaru.
6. Login dengan akun Google lain. Aplikasi harus menampilkan sesi kosong, bukan data akun pertama.

Jika tampak pesan gagal simpan, aplikasi mempertahankan draf per akun di browser dan menyediakan ekspor. Jangan keluar atau menghapus data browser sebelum draf berhasil disimpan atau diekspor.

## Memindahkan sesi lama dari localStorage

Data localStorage terikat pada alamat browser. Data dari `localhost` tidak otomatis terlihat pada `padel-scores.vercel.app`.

1. Buka aplikasi lama pada alamat asalnya, atau buka `/legacy-backup.html` pada alamat asal itu.
2. Pilih **Ekspor data lokal lama** untuk membuat file JSON. Data lama tidak dihapus.
3. Buka aplikasi online, login, pilih **Impor file**, lalu pilih JSON tersebut.
4. Jika akun sudah memiliki sesi, ekspor dahulu sesi cloud bila ingin menyimpannya. Impor menggantikan sesi aktif pada akun itu.

## Catatan paket gratis

Supabase Free dapat menjeda proyek setelah periode tidak aktif. Jika login atau simpan pertama setelah jeda gagal, buka dashboard Supabase dan tunggu proyek aktif kembali, lalu tekan **Coba lagi** di aplikasi.
