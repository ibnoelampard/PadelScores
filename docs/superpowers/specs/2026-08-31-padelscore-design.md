# PadelScore — Desain Versi Pertama

## Tujuan

PadelScore adalah aplikasi web mobile-first untuk membuat satu sesi match padel. Pengguna menentukan jumlah pemain, jumlah lapangan, dan durasi sesi; mengisi nama pemain; lalu aplikasi membuat jadwal rotasi otomatis setiap 10 menit sampai durasi sesi selesai.

## Keputusan Produk

- Aplikasi berbasis web, tanpa login dan tanpa backend.
- Data disimpan di `localStorage` dan tetap tersedia setelah refresh atau browser dibuka kembali pada perangkat yang sama.
- Satu sesi memiliki status `empty`, `setup`, `players`, `schedule`, atau `finished`.
- Jumlah pemain dinamis, minimal 4 orang.
- Jumlah lapangan dinamis, minimal 1, tanpa batas tetap di antarmuka.
- Durasi sesi diinput dalam jam.
- Durasi setiap slot jadwal ditetapkan 10 menit untuk memberi buffer dan membuat rotasi lebih sering.
- Pemain yang melebihi kapasitas lapangan pada suatu slot menjadi bye/istirahat dan diprioritaskan pada slot berikutnya.
- Setelah jadwal dibuat, nama pemain dan pasangan tidak dapat diedit. Skor tetap dapat diedit setelah pertandingan di-finish.

## Arah Visual

Antarmuka mobile-first menggunakan gaya clean green: dasar putih hangat dengan aksen hijau lapangan padel, ruang kosong yang cukup, kartu rounded, dan tombol besar yang mudah disentuh.

Palet warna:

- Background utama: `#F8FAF8`
- Hijau utama: `#168A5B`
- Hijau gelap: `#123C2E`
- Hijau muda: `#E8F5EF`
- Teks utama: `#17352A`
- Border: `#D7E6DD`
- Status bye/istirahat: `#FFF4D6`

## User Flow

### 1. Empty state

Jika belum ada sesi aktif, halaman hanya menampilkan pesan bahwa belum ada match dan tombol utama **Buat Match**.

### 2. Setup match

Tombol **Buat Match** membuka form dengan tiga input utama:

1. Jumlah pemain.
2. Jumlah lapangan.
3. Durasi sesi dalam jam.

Tombol **Create** menyimpan setup dan membuka halaman input nama pemain. Jumlah jadwal dihitung sebagai `floor(durasiJam × 60 / 10)`.

### 3. Input nama pemain

Aplikasi membuat input nama sebanyak jumlah pemain. Pengguna harus mengisi semua nama dan tidak boleh ada nama duplikat tanpa membedakan huruf besar-kecil. Setelah valid, tombol **Buat Jadwal Pertandingan** menjadi aktif.

### 4. Jadwal pertandingan

Saat tombol jadwal ditekan, sistem membuat semua slot dari durasi sesi sekaligus. Setiap slot berdurasi 10 menit dan memiliki maksimal 4 pemain per lapangan. Slot ditampilkan dalam tab berdasarkan lapangan, misalnya Court 1, Court 2, Court 3, dan seterusnya.

Setiap kartu jadwal berisi:

- Nomor atau waktu slot.
- Dua pasangan yang bertanding, dengan format `A + B` versus `C + D`.
- Kotak skor di tengah atau di antara kedua sisi pertandingan.
- Tombol **Finish** untuk menandai jadwal sudah dimainkan.
- Status `Belum dimainkan` atau `Selesai`.

Nama pemain dan susunan pasangan terkunci setelah jadwal dibuat. Skor dapat diubah kapan saja, termasuk setelah tombol Finish ditekan.

## Algoritma Rotasi Adil

Untuk setiap slot, sistem memilih pemain berdasarkan prioritas berikut:

1. Pemain yang bye pada slot sebelumnya.
2. Pemain dengan total jumlah main paling sedikit.
3. Pemain yang paling jarang bermain dengan pasangan yang sama.
4. Variasi acak kecil ketika beberapa pilihan memiliki nilai fairness yang sama.

Setelah pemain aktif dipilih, sistem membentuk pasangan dan membagi pasangan ke lapangan. Penilaian fairness meminimalkan selisih jumlah main, pengulangan pasangan, dan pengulangan lawan. Jika kombinasi ideal tidak mungkin, sistem tetap menghasilkan jadwal valid.

Contoh: 12 pemain dan 2 lapangan berarti 8 pemain aktif dan 4 pemain bye pada setiap slot. Pada slot berikutnya, empat pemain bye diprioritaskan agar jumlah main berimbang. Dengan durasi sesi 2 jam dan interval 10 menit, tersedia 12 slot rotasi per lapangan.

## Arsitektur dan Data

Aplikasi dibuat dengan HTML, CSS, dan JavaScript vanilla tanpa dependency atau backend. Modul logisnya:

- `state`: sesi aktif, konfigurasi, pemain, jadwal, dan skor.
- `storage`: persistensi `localStorage` dan pemulihan state setelah reload.
- `mixer`: pemilihan pemain, pembentukan pasangan, pembagian lapangan, dan bye.
- `render`: empty state, setup form, input pemain, tab lapangan, jadwal, dan status selesai.
- `events`: navigasi flow, validasi, pembuatan jadwal, Finish, edit skor, dan reset.

State minimal:

```js
{
  session: { status, playerCount, courtCount, durationHours, slotMinutes: 10 },
  players: [{ id, name, matches, wins, byes }],
  courts: [{ id, name }],
  schedule: [{ id, slotIndex, startMinute, courtId, teamA, teamB, scoreA, scoreB, finished }]
}
```

## Validasi dan Error Handling

- Jumlah pemain minimal 4.
- Jumlah lapangan minimal 1.
- Durasi sesi harus lebih besar dari 0.
- Semua nama harus terisi dan unik case-insensitive.
- Skor harus berupa bilangan bulat nol atau lebih.
- Jadwal tidak dapat dibuat sebelum semua nama valid.
- Finish tidak menghapus atau mengunci skor; tombol edit/revisi skor tetap tersedia.
- Data `localStorage` yang rusak diabaikan dengan aman dan aplikasi kembali ke empty state.
- Reset sesi membutuhkan konfirmasi dan menghapus sesi aktif dari perangkat.

## Testing dan Verifikasi

- Empty state menampilkan tombol Buat Match.
- Setup menyimpan jumlah pemain, lapangan, dan durasi.
- Input nama membuat jumlah field sesuai konfigurasi dan menolak duplikat.
- 12 pemain, 2 lapangan, 2 jam menghasilkan 12 slot per lapangan dengan 8 pemain aktif dan 4 bye pada setiap slot.
- Jumlah jadwal sesuai `floor(durasiJam × 60 / 10)`.
- Tidak ada pemain muncul dua kali dalam slot yang sama.
- Tidak ada lapangan berisi lebih dari 4 pemain.
- Pemain bye sebelumnya diprioritaskan di slot berikutnya.
- Finish mengubah status jadwal menjadi selesai, tetapi skor masih dapat diedit.
- Refresh dan membuka kembali browser mempertahankan sesi, nama, jadwal, status Finish, dan skor.
- Uji responsif pada lebar layar mobile.

## Di Luar Cakupan Versi Pertama

- Login, database, sinkronisasi antar perangkat, dan berbagi sesi melalui link.
- Edit nama pemain atau susunan pasangan setelah jadwal dibuat.
- Ekspor PDF/CSV dan mode turnamen bracket.
