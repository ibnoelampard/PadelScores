# PadelScore — Desain Antarmuka Bilingual

## Tujuan

Menyediakan antarmuka yang konsisten dalam Bahasa Indonesia dan English. Bahasa awal mengikuti bahasa browser, sementara pengguna dapat menggantinya melalui tombol di pojok kanan atas. Pilihan manual diingat pada perangkat yang sama.

## Cakupan

- Bahasa yang didukung: `id` dan `en`.
- Default bahasa: bahasa Indonesia apabila `navigator.language` diawali `id`; English untuk bahasa lain atau ketika bahasa browser tidak tersedia.
- Pilihan manual pengguna selalu mengalahkan default browser dan disimpan di `localStorage`.
- Tombol bahasa tersedia pada seluruh layar aplikasi di header kanan atas.
- Pergantian bahasa merender ulang tampilan aktif tanpa mengubah sesi, jadwal, skor, maupun status pertandingan.
- Semua teks yang terlihat pengguna diterjemahkan: judul, subtitle, tombol, label, placeholder, status, pesan validasi, pesan konfirmasi, hitungan dinamis, dan label lapangan bawaan.

## Arsitektur

Tambahkan `src/i18n.js` sebagai satu-satunya sumber teks antarmuka.

Modul ini menyediakan:

- Kamus string untuk `id` dan `en`, dengan key semantik seperti `setup.createMatch`, bukan teks sumber sebagai key.
- Fungsi `resolveLanguage(browserLanguage, storedLanguage)` untuk menentukan bahasa awal.
- Fungsi `setLanguage(language)` dan `getLanguage()` yang memvalidasi bahasa, menyimpan pilihan manual, dan memperbarui atribut `lang` pada elemen HTML.
- Fungsi `t(key, variables)` untuk mengambil string dan mengisi nilai dinamis.
- Helper untuk membuat nama lapangan bawaan dari nomor lapangan sesuai bahasa aktif (`Lapangan 1` atau `Court 1`).

Bahasa dan preferensinya tidak dimasukkan ke state sesi PadelScore. Ia memakai key `localStorage` terpisah, sehingga reset sesi tidak menghapus preferensi bahasa dan perubahan format state sesi yang ada tidak diperlukan.

## Integrasi UI

`src/app.js` memakai `t()` untuk seluruh salinan UI. Fungsi `shell()` menambahkan tombol bahasa di header, berlabel bahasa aktif (`ID` atau `EN`) dan mempunyai nama aksesibel yang menerangkan aksi pengalihan.

Klik tombol mengganti bahasa ke pilihan lain, menyimpannya, lalu memanggil `render()`. Tampilan yang sedang aktif tetap sama. Nilai input yang belum tersimpan pada form tidak dijanjikan tetap ada karena render ulang sudah menjadi perilaku UI yang jelas dan pilihan bahasa dapat dilakukan sebelum pengisian dimulai.

Nama lapangan adalah label bawaan yang diturunkan dari nomor/id lapangan ketika dirender, bukan teks bahasa yang disimpan. Ini membuat sesi lama yang menyimpan `Court 1` ikut tampil sebagai `Lapangan 1` saat Bahasa Indonesia aktif. Nama pemain tetap data pengguna dan tidak diterjemahkan.

## Aksesibilitas dan Error Handling

- `document.documentElement.lang` diatur ke `id` atau `en` pada inisialisasi serta setiap pergantian bahasa.
- Tombol bahasa memakai elemen `button`, dapat dioperasikan dengan keyboard, dan memiliki `aria-label` yang dilokalkan.
- Key atau bahasa yang tidak valid menggunakan fallback English; aplikasi tidak gagal akibat localStorage preferensi yang rusak.
- Placeholder dan label input diterjemahkan bersamaan sehingga tidak ada salinan bahasa lama yang tertinggal.

## Testing dan Verifikasi

- Unit test `resolveLanguage()` memilih Indonesia untuk `id-ID` dan English untuk `en-US` atau bahasa yang tidak didukung.
- Unit test memastikan pilihan `id`/`en` valid dibaca dan ditulis pada key preferensi terpisah.
- Unit test memastikan nilai preferensi yang rusak kembali ke default bahasa browser.
- Pemeriksaan manual: semua layar (empty, setup, input pemain, dan jadwal) tampil sepenuhnya dalam satu bahasa setelah load dan setelah tombol bahasa ditekan.
- Pemeriksaan manual: ganti bahasa saat jadwal aktif tidak mengubah skor, status, tab lapangan aktif, atau data sesi.
- Jalankan semua tes jadwal dan storage yang ada untuk memastikan perilaku inti tidak berubah.

## Di Luar Cakupan

- Bahasa ketiga, regionalisasi format angka/waktu, serta terjemahan nama pemain.
- Pemilihan bahasa per sesi atau sinkronisasi preferensi antar perangkat.
