# Database Initialization Script

## Cara Menggunakan Script SQL di Supabase

1. Buka dashboard Supabase Anda
2. Pilih project yang sesuai
3. Buka SQL Editor di menu sidebar
4. Klik "New query" untuk membuat query baru
5. Salin seluruh isi dari file `init-db.sql`
6. Tempel ke SQL Editor
7. Klik "Run" untuk menjalankan script

## Apa yang Dilakukan oleh Script Ini?

Script ini akan membuat data awal yang diperlukan untuk aplikasi IPL:

### 1. User Admin
- Membuat user admin dengan email: `admin@example.com`
- Password: `admin123`
- Role: `ADMIN`

### 2. System User
- Membuat system user dengan email: `system@localhost`
- Digunakan untuk proses otomatis di sistem

### 3. Default Settings
- Membuat pengaturan pembayaran default:
  - Jumlah default: Rp 250.000
  - Tanggal jatuh tempo: tanggal 5 setiap bulannya
  - RW aktif: [12]
  - Informasi rekening bank:
    - Bank: BCA
    - Nomor rekening: 6050613567
    - Nama pemilik: YUPITHER BOUK

### 4. Sample Data
Script ini juga membuat data contoh untuk:
- RT/RW (5 contoh RT)
- Warga (5 contoh warga)
- Periode pembayaran (4 contoh periode)
- Jadwal pembayaran (1 contoh jadwal)
- Item jadwal pembayaran (5 contoh item)
- Pembayaran (2 contoh pembayaran)
- Bank mutations (2 contoh mutasi bank)
- Verifikasi pembayaran (2 contoh verifikasi)
- Bank aliases (2 contoh alias bank)
- Learning data (2 contoh data pembelajaran)
- Reminders (2 contoh pengingat)
- Bank mutation verifications (2 contoh verifikasi mutasi)
- Payment proofs (2 contoh bukti pembayaran)

## Catatan Penting

- Script ini menggunakan `ON CONFLICT DO NOTHING` untuk menghindari duplikasi data
- Jika data sudah ada, script akan melewatkannya dan melanjutkan ke data berikutnya
- Password untuk user admin di-hash menggunakan bcrypt dengan salt rounds 12
- Semua data contoh dapat diubah atau dihapus setelah proses inisialisasi

## Setelah Menjalankan Script

Setelah menjalankan script ini, Anda dapat:
1. Login ke aplikasi dengan email `admin@example.com` dan password `admin123`
2. Mengubah password admin melalui halaman profile
3. Mengubah pengaturan pembayaran melalui halaman settings
4. Menambah, mengubah, atau menghapus data contoh sesuai kebutuhan

## Troubleshooting: Masalah Login

Jika Anda mengalami error "email atau password tidak valid" saat login, kemungkinan hash password tidak sesuai. Untuk memperbaikinya:

1. Jalankan script [`update-admin-password.sql`](update-admin-password.sql) di SQL Editor Supabase
2. Script ini akan memperbarui hash password untuk user admin@example.com
3. Coba login kembali dengan email `admin@example.com` dan password `admin123`

Script update-admin-password.sql menggunakan hash password yang dihasilkan oleh Node.js dengan bcrypt yang sama seperti yang digunakan oleh aplikasi.