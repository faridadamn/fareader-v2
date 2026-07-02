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

<!-- ITERATION_REPORTS_END -->
