# FA Reader V2

FA Reader V2 mempertahankan pola aplikasi FA Reader dan menambahkan Lexis Knowledge dalam satu aplikasi.

## Production runtime

Aplikasi memakai Node.js dan PostgreSQL read-only:

- `GET /api/health`
- `GET /api/dashboard`
- `GET /api/categories`
- `GET /api/books?q=&category=`
- `GET /api/books/:slug`
- `GET /api/topics?q=`
- `GET /api/topics/:id`

Secara default, production hanya menampilkan `books.status = published`. Set `PREVIEW_CATALOG=1` hanya pada environment review untuk turut melihat `ready_for_review`.

## Deploy Vercel

1. Hubungkan repo ini ke Vercel.
2. Tambahkan environment variable `DATABASE_URL` dari project Supabase Lexis. Jangan pernah commit nilainya ke GitHub.
3. Biarkan `PREVIEW_CATALOG=0` untuk production.
4. Uji `/api/health`, halaman utama, pencarian, reader, dan Knowledge setelah deploy.
5. Jangan mengganti `fareader.io` V1 sebelum V2 lolos uji production.

## Local

```bash
npm install
DATABASE_URL='postgresql://...' npm start
```

## Automated Production Iteration Log

Automation menjalankan maksimal 12 iterasi per jam untuk memperbaiki FA Reader V2 production. Setiap laporan menuliskan: tujuan iterasi, pengujian, perubahan yang dibuat, hasil, risiko, dan langkah berikutnya.

<!-- ITERATION_REPORTS_START -->

### Iterasi 1 — Production Smoke Test

- Waktu: 2026-07-02 10:02 WIB
- Tujuan: Memeriksa kesiapan awal production FA Reader V2 tanpa melakukan perubahan fitur besar.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasilnya gagal dengan `Cache miss`, sehingga halaman live belum bisa diverifikasi dari tool tersebut.
  - Mencoba membuka turunan endpoint `/api/health`, `/api/dashboard`, `/api/categories`, `/api/books`, dan `/api/topics`; web tool menolak URL turunan karena pembatasan keamanan open URL.
  - Inspect kode backend menunjukkan endpoint wajib tersedia: `/api/health`, `/api/dashboard`, `/api/categories`, `/api/books`, `/api/books/:slug`, `/api/topics`, dan `/api/topics/:id`.
  - Inspect kode backend mengonfirmasi production default hanya menampilkan status `published`, sedangkan `ready_for_review` hanya ikut tampil saat `PREVIEW_CATALOG=1`.
- Perubahan:
  - Memperbaiki copy fallback frontend agar sesuai deployment Vercel, bukan lagi menyebut GitHub Pages/Render.
  - `modeBadge` saat API gagal diubah menjadi `API belum terhubung`.
  - Pesan error API mengarahkan pengecekan ke environment database Vercel.
- Hasil:
  - Perubahan kecil sudah dicommit.
  - Belum ada klaim endpoint production hijau karena akses live dari tool tidak berhasil.
- Risiko/temuan:
  - Smoke test live masih perlu diverifikasi dari browser lokal atau run berikutnya dengan akses HTTP yang berhasil.
  - Struktur aplikasi masih memakai Node server `server.mjs`; audit runtime Vercel perlu menjadi fokus Iterasi 2.
- Langkah berikutnya:
  - Iterasi 2 harus fokus pada audit Vercel runtime/routing, termasuk apakah `server.mjs` benar-benar berjalan sebagai deployment Vercel atau perlu adaptasi ke route/serverless.
- Commit: `1f90e26953928d0cb360b7d7defbd4c6843ec729`

### Iterasi 2 — Audit Vercel Runtime dan Routing

- Waktu: 2026-07-02 10:58 WIB
- Tujuan: Memastikan struktur runtime cocok dengan Vercel dan mencegah blocker deployment karena aplikasi sebelumnya hanya menjalankan Node server biasa.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, jadi status live Vercel belum bisa diklaim hijau dari tool ini.
  - Mencoba membuka endpoint `/api/health`, `/api/books`, dan `/api/topics`; web tool menolak URL turunan karena hanya mengizinkan URL persis dari pesan pengguna.
  - Inspect `package.json` menunjukkan hanya ada script `start: node server.mjs`, tanpa konfigurasi build Vercel khusus.
  - Inspect repo menunjukkan `vercel.json` belum ada sebelum iterasi ini.
  - Inspect `server.mjs` menunjukkan server selalu menjalankan `createServer(...).listen(...)`, pola yang cocok untuk server Node biasa tetapi rawan tidak jalan sebagai Vercel Serverless Function.
- Perubahan:
  - `server.mjs` diubah agar mengekspor `handler(request, response)` sebagai default export untuk runtime Vercel.
  - Local runtime tetap dipertahankan dengan `createServer(handler).listen(...)` hanya saat `process.env.VERCEL` tidak aktif.
  - Menambahkan `vercel.json` dengan build `@vercel/node` untuk `server.mjs` dan route catch-all ke `/server.mjs`, sehingga static page dan API tetap ditangani oleh handler yang sama.
  - Tidak ada perubahan pada filter katalog publik; `published` tetap default production dan `ready_for_review` hanya aktif jika `PREVIEW_CATALOG=1`.
- Hasil:
  - Perbaikan runtime/routing sudah dicommit ke `main`.
  - Struktur sekarang lebih sesuai untuk deployment Vercel dibanding versi sebelumnya yang hanya mengandalkan long-running Node server.
  - Verifikasi live masih menunggu akses HTTP yang berhasil atau deploy Vercel selesai dari sisi platform.
- Risiko/temuan:
  - Jika project Vercel sebelumnya memakai konfigurasi build manual yang bertentangan dengan `vercel.json`, perlu dicek di dashboard Vercel.
  - Jika `DATABASE_URL` belum dipasang di Vercel, `/api/*` tetap akan gagal meskipun routing sudah benar.
  - Perlu smoke test ulang setelah Vercel melakukan redeploy dari commit terbaru.
- Langkah berikutnya:
  - Iterasi 3 perlu fokus audit katalog `published` setelah endpoint production bisa diakses, atau melakukan audit dari kode/query bila live tool masih terblokir.
- Commit: `220cddf9822d90ac1c267a691e7ac52704cc50ea`, `7016b82218232a698c81474b270afdb1cf686ba5`

### Iterasi 3 — Audit Katalog Published

- Waktu: 2026-07-02 12:00 WIB
- Tujuan: Mengecek risiko katalog publik, khususnya buku `published` yang metadata atau section-nya belum lengkap, tanpa mengubah isi editorial atau status data.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga data live Supabase/Vercel belum bisa diverifikasi langsung dari tool.
  - Inspect `server.mjs` mengonfirmasi `/api/books` tetap membatasi katalog dengan `b.status = any(${statuses})`, dan production default masih hanya `published`.
  - Inspect query `/api/books` mengonfirmasi setiap item sudah membawa `section_count`, `description`, `word_count`, `reading_time_minutes`, `slug`, author, dan kategori.
  - Inspect frontend menemukan bahwa `section_count = 0` sebelumnya tetap menampilkan tombol `Baca ringkasan`, sehingga buku published kosong bisa terlihat siap dibaca.
- Perubahan:
  - Frontend sekarang menandai buku tanpa section sebagai item belum lengkap.
  - Tombol `Baca ringkasan` dinonaktifkan untuk buku dengan `section_count = 0` dan diganti label `Belum siap dibaca`.
  - Kartu buku sekarang menampilkan metadata katalog: estimasi menit baca, jumlah kata bila ada, dan jumlah section.
  - Jika kategori kosong, kartu menampilkan label `Tanpa kategori`, bukan area kosong.
  - Ringkasan hasil filter menampilkan jumlah buku yang perlu section bila ada.
  - Tidak ada perubahan pada database, status buku, schema Supabase, atau filter publik `published`.
- Hasil:
  - Risiko UX untuk buku published tanpa section sudah dikurangi di sisi katalog.
  - Audit data faktual dari production masih belum lengkap karena live endpoint belum bisa diakses dari tool.
- Risiko/temuan:
  - Bila ada buku `published` tanpa section, sekarang terlihat sebagai masalah katalog, tetapi data sumber tetap perlu diperbaiki secara editorial di Supabase.
  - Query backend masih menghitung semua row `book_sections`; belum membedakan section yang row-nya ada tetapi `content` kosong. Ini bisa ditangani di iterasi berikutnya jika data live menunjukkan kasus tersebut.
- Langkah berikutnya:
  - Iterasi 4 fokus ke pengalaman Perpustakaan: pencarian, filter, empty/loading/error state, dan konsistensi kartu buku.
- Commit: `9681fd6187a9fca5647e1db6489c031f6aab5fb0`, `76d1e5bfe541dec126d34386b556e14aa27d86bc`

<!-- ITERATION_REPORTS_END -->
