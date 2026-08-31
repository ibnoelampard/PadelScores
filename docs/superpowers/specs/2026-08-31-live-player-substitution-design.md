# PadelScore — Penggantian Pemain dan Remix Jadwal Langsung

## Tujuan

Memungkinkan satu lapangan meneruskan pertandingan tanpa menunggu lapangan lain selesai. Admin dapat mengganti pemain pada pertandingan yang belum dimulai dengan pemain yang sedang istirahat, lalu aplikasi menyusun ulang pertandingan setelahnya agar adil dan tanpa pemain bermain di dua lapangan pada waktu yang sama.

## Cakupan dan Aturan Produk

- Penggantian hanya tersedia untuk pertandingan berstatus **belum dimulai**.
- Pertandingan berstatus **sedang bermain** dan **selesai** terkunci; susunan pemainnya tidak dapat diubah.
- Admin memilih satu pemain yang keluar dari pertandingan target dan satu pemain pengganti secara manual.
- Pemain pengganti hanya dapat dipilih bila tidak sedang bermain pada pertandingan aktif di lapangan mana pun dan belum berada di pertandingan target.
- Setelah konfirmasi, pertandingan target memakai susunan baru. Semua pertandingan setelah target yang belum dimulai dibuat ulang.
- Pertandingan yang telah dimulai atau selesai tidak berubah, termasuk peserta, skor, dan hasilnya.
- Klasemen tetap hanya memakai pertandingan yang selesai, dengan susunan peserta yang tercatat pada pertandingan tersebut.

## Alur Admin

1. Pada kartu pertandingan belum dimulai, admin menekan **Ganti pemain**.
2. Panel menampilkan empat posisi pemain pada pertandingan tersebut; admin memilih pemain yang akan keluar.
3. Panel menampilkan pemain yang tersedia/istirahat sebagai kandidat pengganti.
4. Sebelum menyimpan, aplikasi menjelaskan bahwa jadwal setelahnya akan di-mix ulang dan pertandingan berjalan/selesai tidak berubah.
5. Admin menekan **Simpan & Remix**.
6. Aplikasi memperbarui pertandingan target, membuat ulang jadwal yang tersisa, menyimpan state, lalu menampilkan notifikasi berhasil.

Jika tidak tersedia kandidat yang valid, aksi simpan tidak dapat dilakukan dan panel menjelaskan alasannya.

## Model Data

Setiap item `schedule` mempertahankan `teamA`, `teamB`, skor, `started`, dan `finished`. Tambahkan riwayat penggantian agar perubahan dapat ditelusuri:

```js
replacements: [
  {
    outPlayerId: "p3",
    inPlayerId: "p7",
    changedAt: "ISO-8601 timestamp"
  }
]
```

State lama tanpa `replacements` dinormalisasi ke array kosong agar sesi yang telah tersimpan tetap dapat dibuka.

## Remix yang Adil

1. Kumpulkan semua pertandingan yang mulai atau selesai sebagai fakta tetap, ditambah pertandingan target setelah penggantian.
2. Hitung jumlah main, bye, pasangan, dan lawan dari pertandingan tetap tersebut.
3. Tentukan pemain yang sedang bermain dari seluruh pertandingan `started && !finished` dan keluarkan mereka dari kandidat pertandingan baru.
4. Buat ulang hanya pertandingan belum dimulai setelah target, menggunakan prioritas fairness yang sudah ada: jumlah main paling sedikit, prioritas bye, pengulangan pasangan, dan pengulangan lawan.
5. Pastikan pemain hanya berada pada satu pertandingan di setiap slot baru dan tidak ditempatkan pada pertandingan ketika ia masih aktif di lapangan lain.

Pemain yang digantikan tidak dihapus dari sesi. Ia kembali tersedia untuk dipertimbangkan pada remix berikutnya, selama tidak sedang bermain.

## Antarmuka

- Kartu pertandingan belum dimulai mendapat tombol sekunder **Ganti pemain**.
- Panel penggantian memuat pilihan pemain keluar, pilihan pengganti, peringatan dampak remix, serta tombol **Batal** dan **Simpan & Remix**.
- Tombol tidak ditampilkan pada pertandingan aktif atau selesai.
- Setelah berhasil, kartu target menampilkan nama baru dan notifikasi singkat bahwa jadwal berikutnya telah diperbarui.

## Error Handling

- Tolak penggantian pada pertandingan yang bukan berstatus belum dimulai.
- Tolak kandidat yang sedang bermain atau sudah menjadi peserta pertandingan target.
- Jika state berubah sebelum penyimpanan (misalnya pertandingan target baru dimulai), batalkan operasi dan tampilkan pesan agar admin membuka ulang jadwal.
- Jika remix tidak dapat menghasilkan pertandingan valid, state semula dipertahankan dan admin diberi pesan kesalahan; tidak ada perubahan parsial.

## Pengujian

- Penggantian pada pertandingan belum dimulai memperbarui peserta dan mencatat riwayat.
- Pertandingan aktif dan selesai tidak dapat diganti.
- Daftar kandidat tidak memuat pemain aktif atau pemain yang sudah ada di pertandingan target.
- Remix tidak mengubah pertandingan aktif/selesai dan tidak mengubah skor atau hasilnya.
- Jadwal hasil remix tidak menempatkan pemain lebih dari sekali pada slot yang sama.
- Jadwal hasil remix tidak memakai pemain yang sedang aktif di lapangan lain.
- Klasemen memakai peserta yang benar-benar bermain pada pertandingan selesai.
- State lama tanpa riwayat penggantian dapat dimuat dengan aman.

## Di Luar Cakupan

- Penggantian pemain pada pertandingan yang sedang berjalan atau selesai.
- Penjadwalan otomatis berbasis jam nyata atau sensor lapangan.
- Menambah/menghapus pemain dari sesi setelah jadwal dibuat.
