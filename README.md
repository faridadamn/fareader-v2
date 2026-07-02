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

### Iterasi 4 — Pengalaman Perpustakaan

- Waktu: 2026-07-02 13:01 WIB
- Tujuan: Memperbaiki pengalaman halaman Perpustakaan agar pencarian, filter, sort, loading, empty state, dan kartu buku lebih jelas dipakai.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga kondisi live belum bisa diklaim terverifikasi dari tool.
  - Inspect `docs/index.html` menunjukkan kategori sudah tersedia, tetapi belum ada kontrol sort atau reset filter.
  - Inspect `docs/app.js` menunjukkan pencarian sudah mencakup judul, author, deskripsi, dan kategori, namun hasil belum bisa diurutkan oleh pengguna.
  - Inspect empty state sebelumnya hanya menyarankan kata kunci/kategori lain, belum menyediakan aksi reset langsung.
- Perubahan:
  - Menambahkan dropdown sort Perpustakaan: `Terbaru`, `A–Z`, `Paling singkat`, dan `Paling panjang`.
  - Menambahkan tombol `Reset` untuk mengosongkan pencarian, kategori, dan sort.
  - Menambahkan loading state awal pada `bookList` dan metadata katalog saat data production sedang dimuat.
  - Empty state hasil pencarian sekarang menyertakan tombol `Reset filter`.
  - Hero stat ketiga diubah dari teks statis `Sedang dibaca` menjadi hitungan `Siap dibaca` berdasarkan jumlah buku yang punya section.
  - Menambahkan styling `.library-controls` agar filter/sort/reset rapi di desktop dan mobile.
  - Tidak ada perubahan pada endpoint backend, database, status buku, atau filter publik `published`.
- Hasil:
  - Katalog sekarang lebih operasional untuk browse: pengguna bisa mencari, memilih kategori, mengurutkan, lalu reset tanpa reload halaman.
  - Perubahan sudah dicommit ke `main`.
- Risiko/temuan:
  - Sort `Terbaru` memakai urutan asli dari API karena backend sudah mengurutkan `published_at/created_at desc`; tidak ada timestamp tambahan diekspos ke frontend.
  - Verifikasi visual live masih perlu dilakukan dari browser lokal atau setelah akses web tool ke Vercel berhasil.
- Langkah berikutnya:
  - Iterasi 5 fokus ke Reader premium: typography, whitespace, paragraph/bullet rendering, section navigation, dan mobile readability.
- Commit: `a1d42418c247580470737465c5b375b34eb2df53`, `08fb631d87434284522c8b310b5b79f380174cd3`, `256460747cc543abdeca38fd6ed923afaf42386d`

### Iterasi 5 — Reader Premium UX

- Waktu: 2026-07-02 15:01 WIB
- Tujuan: Memperbaiki pengalaman baca agar typography, whitespace, paragraph/list rendering, navigasi section, dan mobile readability lebih layak untuk beta production.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga visual live belum bisa diklaim terverifikasi dari tool.
  - Mencoba membuka `/api/health` dan `/api/books?limit=1`; web tool menolak URL turunan karena hanya mengizinkan URL persis dari pesan pengguna.
  - Inspect `docs/app.js` sebelum perubahan menunjukkan setiap section reader dirender sebagai satu `<p>` besar dengan `white-space: pre-line`, sehingga bullet, numbered list, dan blockquote tidak mendapat struktur HTML yang layak.
  - Inspect `docs/styles.css` sebelum perubahan menunjukkan reader sudah punya dasar tipografi, tetapi belum ada styling khusus untuk prose paragraph/list/blockquote, footer section, dan navigasi prev/next.
- Perubahan:
  - Menambahkan renderer `renderRichText()` untuk memecah konten section menjadi paragraf, unordered list, ordered list, dan blockquote sederhana.
  - Reader section sekarang memakai wrapper `.reader-prose`, bukan satu paragraf besar.
  - Menambahkan tombol `Section sebelumnya` dan `Section berikutnya` di footer tiap section.
  - Navigasi section sekarang memakai label heading bila tersedia dan menyimpan state aktif saat tombol navigasi dipakai.
  - Memperbesar ruang baca, memperbaiki line-height, max-width prose, scroll margin, sticky section nav, blockquote styling, dan responsivitas mobile reader.
  - Perubahan juga diterapkan ke tampilan topic/Knowledge agar poin penting dirender sebagai list.
  - Tidak ada perubahan pada backend, database, status buku, schema Supabase, domain, DNS, atau filter publik `published`.
- Hasil:
  - Reader sekarang lebih nyaman untuk bacaan panjang dan lebih aman untuk konten yang berisi bullet/numbered list.
  - Perubahan sudah dicommit ke `main`.
  - Verifikasi runtime live tetap perlu dilakukan setelah Vercel redeploy dan akses browser/API berhasil.
- Risiko/temuan:
  - Renderer hanya mendukung format ringan berbasis baris (`-`, `*`, `•`, angka, dan `>`). Markdown kompleks belum didukung.
  - Active state section nav baru berubah saat tombol nav/prev/next dipakai, belum otomatis mengikuti scroll manual.
  - Karena live Vercel belum bisa diakses dari tool, belum ada bukti visual production setelah deploy.
- Langkah berikutnya:
  - Iterasi 6 fokus pada bookmark dan progress local-first: pastikan bookmark stabil, lalu tambahkan progress/lanjut baca hanya jika bisa dilakukan tanpa auth dan tanpa perubahan schema.
- Commit: `6aa949f7d5972ed084e8c5f1357a302f283399fd`, `f5fe88d4c872620f4c8757317931feeacdb6ec6e`

### Iterasi 6 — Bookmark dan Progress Local-First

- Waktu: 2026-07-02 15:59 WIB
- Tujuan: Memastikan bookmark tetap stabil dan menambahkan progress baca local-first tanpa auth, tanpa schema baru, dan tanpa mengubah data production.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga live production belum bisa diklaim terverifikasi dari tool.
  - Inspect `docs/app.js` menunjukkan bookmark sudah memakai `localStorage` key `fareader-v2:bookmarks`, sehingga simpanan bersifat lokal per browser dan tidak membutuhkan auth.
  - Inspect `docs/app.js` juga menunjukkan belum ada penyimpanan progress baca, belum ada state buku aktif, dan tombol kartu selalu membuka reader dari awal.
  - Inspect perubahan memastikan progress baru memakai `localStorage` key `fareader-v2:progress`, bukan database, bukan Supabase schema, dan bukan endpoint baru.
- Perubahan:
  - Menambahkan state `progress`, `currentBookSlug`, dan `currentSectionsTotal` di frontend.
  - Menambahkan helper `progressFor()`, `progressText()`, `markProgress()`, `saveProgress()`, dan `cleanProgress()`.
  - Tombol kartu buku sekarang berubah menjadi `Lanjut membaca` jika buku punya progress lokal.
  - Metadata kartu menampilkan posisi terakhir, misalnya `Lanjut section 2/5`.
  - `openBook()` sekarang menerima parameter section awal dan menyimpan section terakhir saat buku dibuka.
  - Navigasi section sebelumnya/berikutnya dan tombol section nav sekarang memperbarui progress lokal.
  - Progress lama untuk slug yang sudah tidak ada di katalog akan dibersihkan setelah katalog production berhasil dimuat.
  - Tidak ada perubahan pada backend, database, status buku, schema Supabase, domain, DNS, atau filter publik `published`.
- Hasil:
  - Bookmark tetap local-first dan tidak diubah format penyimpanannya.
  - Progress baca sekarang tersedia local-first, bisa dipakai untuk lanjut membaca tanpa login.
  - Perubahan sudah dicommit ke `main`.
  - Verifikasi visual production masih menunggu akses Vercel yang berhasil atau deploy selesai dari platform.
- Risiko/temuan:
  - Progress hanya akurat saat pengguna membuka buku atau memakai tombol navigasi section; belum otomatis mengikuti scroll manual.
  - Progress tersimpan per browser/per device karena belum ada auth dan sinkronisasi akun.
  - Jika user membersihkan localStorage browser, bookmark dan progress akan hilang.
- Langkah berikutnya:
  - Iterasi 7 fokus ke Lexis Knowledge: uji topics/notes nyata, perbaiki daftar/detail/pencarian dan empty state tanpa mengubah konten sumber.
- Commit: `21a8d9f3c451dc511cafc079f18fdafd3414d0d9`

### Iterasi 7 — Lexis Knowledge Search dan Notes

- Waktu: 2026-07-02 16:58 WIB
- Tujuan: Memperbaiki dasar Knowledge agar pencarian topics/notes lebih andal tanpa mengubah isi Lexis, database, schema, atau status buku.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga kondisi live Vercel belum bisa diklaim terverifikasi dari tool.
  - Mencoba membuka endpoint turunan `/api/health`, `/api/books`, dan `/api/topics`; web tool menolak URL turunan karena pembatasan safe-open terhadap URL yang tidak persis dari pesan pengguna.
  - Inspect `server.mjs` menunjukkan `/api/topics?q=` sebelumnya mengambil daftar topic terbaru dengan `limit`, lalu baru memfilter hasil di JavaScript. Ini berisiko membuat pencarian Knowledge tidak menemukan topic lama yang cocok.
  - Inspect `server.mjs` juga menunjukkan join `topics` ke `notes` belum menggabungkan beberapa note per topic, sehingga topic berpotensi duplikat di list atau detail hanya mengambil satu baris note.
  - Inspect `docs/app.js` mengonfirmasi UI Knowledge sudah memakai data dari `/api/topics?limit=60`, kartu topic, detail topic, dan renderer `renderRichText()` untuk points/note.
- Perubahan:
  - Query `/api/topics` sekarang menerapkan filter `q` di SQL sebelum `limit`, sehingga pencarian topic, kategori, points, dan notes tidak terbatas pada batch terbaru saja.
  - Notes per topic sekarang digabung dengan `string_agg(...)` pada list dan detail topic, bukan mengambil satu baris join arbitrer.
  - `topicDetail()` sekarang memakai agregasi note dan `group by t.id` agar detail topic tetap satu record per topic.
  - Tidak ada perubahan pada isi topics/notes, Supabase schema, database permission, domain, DNS, endpoint buku, atau filter publik `published`.
- Hasil:
  - Backend Knowledge lebih siap untuk pencarian dan pembacaan note nyata dari Lexis Library.
  - Perubahan sudah dicommit ke `main`.
  - Verifikasi data live masih menunggu akses Vercel/API yang berhasil dari browser lokal atau run berikutnya.
- Risiko/temuan:
  - Jika kolom `notes.created_at` tidak tersedia di schema Supabase, urutan agregasi note perlu disesuaikan ke kolom lain atau tanpa explicit order.
  - UI Knowledge belum punya search box khusus; saat ini pencarian Knowledge bergantung pada endpoint dan daftar awal yang dimuat frontend.
  - Karena live endpoint belum bisa diakses dari tool, hasil query terhadap data nyata belum dapat diklaim hijau.
- Langkah berikutnya:
  - Iterasi 8 fokus ke relasi buku dan insight: cek apakah data memungkinkan discovery buku–tema–insight secara read-only, atau dokumentasikan blocker data dengan jelas.
- Commit: `8d1d51642cb58471ec74cf11e7535a3c636ca4e6`

### Iterasi 8 — Relasi Buku dan Insight Read-Only

- Waktu: 2026-07-02 17:58 WIB
- Tujuan: Membuat hubungan ringan buku–insight sebagai discovery read-only berdasarkan kategori yang sudah tersedia, tanpa schema baru dan tanpa mengubah konten sumber.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga halaman live belum bisa diklaim terverifikasi dari tool.
  - Mencoba membuka `/api/health`, `/api/dashboard`, `/api/books?limit=3`, `/api/categories`, dan `/api/topics?limit=3`; web tool menolak URL turunan karena pembatasan safe-open terhadap URL yang tidak persis dari pesan pengguna.
  - Inspect kode frontend menunjukkan `state.books` dan `state.topics` sudah dimuat saat `init()`, dan keduanya membawa `categories`, sehingga relasi read-only dapat dibuat di browser tanpa endpoint baru.
  - Inspect kode backend menunjukkan production default tetap memakai `published`; iterasi ini tidak menyentuh filter `allowedStatuses()` maupun query buku.
- Perubahan:
  - Menambahkan helper frontend `categoryKey()`, `sharedCategories()`, `relatedTopicsForBook()`, dan `relatedBooksForTopic()`.
  - Halaman reader buku sekarang dapat menampilkan section `Insight terkait` berdasarkan kategori buku dan kategori Lexis Knowledge yang sama.
  - Halaman detail Knowledge sekarang dapat menampilkan section `Buku terkait` berdasarkan kategori topic dan kategori buku yang sama.
  - Discovery memakai data yang sudah ada di `state.books` dan `state.topics`; tidak ada schema baru, endpoint baru, query database baru, atau perubahan isi editorial.
  - Perubahan juga memasukkan hotfix sebelumnya untuk `/api/topics` agar agregasi notes tidak bergantung pada `notes.created_at` jika kolom itu tidak tersedia.
- Hasil:
  - Relasi buku–tema–insight kini tersedia sebagai discovery ringan dan aman, selama kategori buku dan topic punya irisan nama yang sama.
  - Perubahan sudah dicommit ke `main`.
  - Tidak ada perubahan pada V1, DNS, domain, Supabase schema, data, secret, atau filter publik `published`.
- Risiko/temuan:
  - Relasi masih bersifat heuristik berdasarkan kesamaan kategori, bukan relasi editorial eksplisit.
  - Karena daftar awal topics dibatasi `limit=60`, insight terkait hanya memakai topic yang sudah dimuat frontend. Relasi penuh membutuhkan endpoint discovery khusus atau tabel relasi, tetapi itu sengaja tidak dibuat pada iterasi ini.
  - Perlu verifikasi visual dari browser lokal setelah Vercel selesai redeploy.
- Langkah berikutnya:
  - Iterasi 9 fokus pada auth readiness: audit kebutuhan skema dan UX login/sinkronisasi tanpa mengaktifkan auth atau menjalankan migrasi schema.
- Commit: `9b26a436bc8270e5699b168503826edfbda5f0d1`, `1d3e8a8eb7fb367d4356886ca35bfca8b9161b2e`

### Iterasi 9 — Auth Readiness Tanpa Aktivasi Login

- Waktu: 2026-07-02 19:01 WIB
- Tujuan: Mengaudit kesiapan login/sinkronisasi akun tanpa mengaktifkan auth, tanpa migrasi schema, dan tanpa mengubah permission database.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga halaman live belum bisa diverifikasi dari tool ini.
  - Mencoba membuka `/api/health`, `/api/dashboard`, `/api/books?limit=3`, dan `/api/topics?limit=3`; web tool menolak URL turunan karena pembatasan safe-open terhadap URL yang tidak persis dari pesan pengguna.
  - Inspect `package.json` menunjukkan dependency production hanya `postgres`; belum ada dependency auth client/server.
  - Inspect `server.mjs` menunjukkan endpoint masih read-only (`GET`) dan tidak ada endpoint user write, session, cookie auth, atau token handling.
  - Inspect `docs/app.js` menunjukkan bookmark dan progress masih local-first memakai `localStorage`, sehingga fitur personal saat ini tidak membutuhkan schema user.
- Perubahan:
  - Menambahkan `docs/AUTH_READINESS.md` sebagai proposal auth readiness yang aman.
  - Dokumen tersebut mencatat status local-first, kandidat fitur auth, rancangan tabel yang mungkin dibutuhkan, prinsip keamanan, UX placeholder yang aman, strategi migrasi localStorage ke sync, dan blocker sebelum implementasi.
  - Tidak menambahkan dependency auth, form login, endpoint write, cookie/session, migrasi schema, RLS policy, atau perubahan Supabase.
  - Tidak mengubah filter katalog publik; production tetap hanya boleh menampilkan buku `published` kecuali environment review eksplisit memakai `PREVIEW_CATALOG=1`.
- Hasil:
  - Kesiapan auth sekarang terdokumentasi sebagai proposal, bukan implementasi setengah jadi.
  - Tidak ada perubahan runtime yang dapat mengganggu production catalog atau data user lokal.
- Risiko/temuan:
  - Provider auth belum dipilih; Supabase Auth adalah opsi natural karena data sudah di Supabase, tetapi belum diputuskan.
  - Sinkronisasi bookmark/progress butuh tabel user-specific dan policy/RLS yang belum boleh dibuat tanpa persetujuan eksplisit.
  - UX merge data lokal ke akun perlu dirancang sebelum auth dinyalakan agar bookmark/progress lokal tidak hilang.
- Langkah berikutnya:
  - Iterasi 10 fokus security hardening: validasi input endpoint, header keamanan, error exposure, dan data leakage tanpa mengubah secret atau permission database.
- Commit: `4963c1d35826d8c8729939fc4192033f31c7e826`

### Iterasi 10 — Security Hardening Endpoint Read-Only

- Waktu: 2026-07-02 20:00 WIB
- Tujuan: Memperkeras endpoint dan response production secara rendah risiko: validasi input, header keamanan, error exposure, dan pencegahan akses file tersembunyi tanpa mengubah secret, permission database, schema, domain, atau filter publik.
- Pengujian:
  - Mencoba membuka `https://fareader-v2.vercel.app/` melalui web tool; hasil masih gagal dengan `Cache miss`, sehingga halaman live belum bisa diklaim terverifikasi dari tool ini.
  - Mencoba membuka `/api/health`, `/api/dashboard`, `/api/books?limit=3`, `/api/categories`, dan `/api/topics?limit=3`; web tool menolak URL turunan karena pembatasan safe-open terhadap URL yang tidak persis dari pesan pengguna.
  - Inspect `server.mjs` menunjukkan endpoint hanya menerima `GET`, SQL memakai parameter binding dari library `postgres`, dan catch utama hanya mengembalikan pesan generik `Internal server error` untuk error 500.
  - Inspect juga menemukan beberapa input query/path belum divalidasi eksplisit: `q`, `category`, `limit`, slug buku, dan id topic.
- Perubahan:
  - Menambahkan security headers non-breaking untuk JSON, text, dan static response: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, dan `Permissions-Policy`.
  - Menambahkan validasi `q`/`category` maksimum 120 karakter dan `limit` harus angka positif sebelum diclamping ke batas endpoint.
  - Menambahkan validasi path segment untuk slug buku dan id topic agar tidak menerima path kosong, slash tambahan, karakter kontrol, atau input terlalu panjang.
  - Menambahkan blokir akses static ke path dotfile/dot-directory dan mempertahankan proteksi path traversal dengan `path.resolve`.
  - Error 4xx validasi sekarang dikembalikan sebagai JSON terkontrol; error 5xx tetap generik dan tidak mengekspos detail internal.
  - Tidak menambahkan auth, tidak mengubah dependency, tidak mengubah secret/env, tidak mengubah Supabase schema/permission, dan tidak mengubah filter katalog publik `published`.
- Hasil:
  - Hardening read-only sudah dicommit ke `main`.
  - Permukaan API lebih ketat tanpa mengubah kontrak data normal untuk katalog, reader, categories, dashboard, dan Knowledge.
- Risiko/temuan:
  - CSP belum ditambahkan karena frontend masih memakai beberapa event handler inline; penerapan CSP ketat perlu refactor frontend agar tidak memblokir interaksi.
  - Verifikasi live dari tool masih terbatas; perlu tes browser/API setelah Vercel redeploy commit terbaru.
- Langkah berikutnya:
  - Iterasi 11 fokus performance dan mobile/PWA readiness: loading, asset, caching, responsive UI, dan offline/error fallback dengan perubahan rendah risiko.
- Commit: `20cfdd12d91ece885dbd28de75b450aeeb2f5758`

<!-- ITERATION_REPORTS_END -->