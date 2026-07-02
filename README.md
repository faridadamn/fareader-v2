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

Belum ada iterasi yang dicatat.

<!-- ITERATION_REPORTS_END -->
