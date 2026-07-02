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

## Deploy Render

1. Buat Web Service baru di Render dan hubungkan repo ini.
2. Pilih blueprint `render.yaml` atau gunakan perintah build `npm install` dan start `npm start`.
3. Tambahkan environment variable `DATABASE_URL` dari project Supabase Lexis. Jangan pernah commit nilai ini ke GitHub.
4. Biarkan `PREVIEW_CATALOG=0` untuk production.
5. Setelah health check `/api/health` hijau, uji halaman utama, pencarian, halaman buku, dan Knowledge.
6. Arahkan subdomain baru seperti `v2.fareader.io` setelah pengujian selesai. Jangan mengganti domain V1 sebelum V2 lolos uji.

## Local

```bash
npm install
DATABASE_URL='postgresql://...' npm start
```
