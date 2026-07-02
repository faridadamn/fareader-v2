# FA Reader V2 — Auth Readiness

Dokumen ini adalah proposal kesiapan auth untuk FA Reader V2. Belum ada login yang diaktifkan, belum ada migrasi schema, dan belum ada perubahan permission database.

## Status saat ini

FA Reader V2 masih berjalan sebagai katalog read-only:

- Buku production dibaca dari tabel `books`, `book_sections`, `book_categories`, dan `categories`.
- Knowledge dibaca dari tabel `topics` dan `notes`.
- Bookmark memakai `localStorage` key `fareader-v2:bookmarks`.
- Progress baca memakai `localStorage` key `fareader-v2:progress`.
- Tidak ada token user, session, cookie auth, atau endpoint write untuk data user.

## Tujuan auth nanti

Auth sebaiknya hanya ditambahkan bila ada kebutuhan sinkronisasi lintas device atau fitur personal yang tidak cukup disimpan lokal.

Kandidat fitur setelah auth aktif:

1. Sinkronisasi bookmark lintas device.
2. Sinkronisasi progress baca lintas device.
3. Riwayat buku yang sedang dibaca.
4. Preferensi tampilan reader.
5. Koleksi pribadi atau daftar baca.

## Skema data yang mungkin dibutuhkan

Belum boleh dibuat tanpa persetujuan eksplisit. Ini hanya rancangan awal:

- `reader_profiles`
  - `id`
  - `user_id`
  - `display_name`
  - `created_at`
  - `updated_at`

- `reader_bookmarks`
  - `id`
  - `user_id`
  - `book_slug`
  - `created_at`

- `reader_progress`
  - `id`
  - `user_id`
  - `book_slug`
  - `section_index`
  - `total_sections`
  - `updated_at`

- `reader_preferences`
  - `id`
  - `user_id`
  - `preference_key`
  - `preference_value`
  - `updated_at`

## Prinsip keamanan

- Public catalog tetap read-only.
- Endpoint public tetap hanya membaca buku `published`.
- Session user tidak boleh membuka akses ke buku `ready_for_review` di production public.
- Endpoint write user harus scoped ke `user_id` milik session aktif.
- Jangan pernah expose `DATABASE_URL`, service role key, atau secret lain ke frontend.
- Jika memakai Supabase Auth, frontend hanya boleh menerima public anon key; operasi sensitif tetap lewat policy/endpoint yang benar.

## UX placeholder yang aman

Sebelum auth aktif, UI boleh menampilkan informasi non-interaktif seperti:

- "Bookmark tersimpan di perangkat ini."
- "Progress baca belum disinkronkan lintas device."
- "Login/sinkronisasi belum tersedia di beta ini."

Jangan menampilkan form login palsu atau tombol yang memberi kesan fitur sudah aktif.

## Migrasi dari local-first ke synced

Ketika auth nanti disetujui:

1. Pertahankan localStorage sebagai fallback.
2. Setelah user login, tawarkan impor bookmark/progress lokal ke akun.
3. Jika konflik, gunakan progress dengan `updated_at` terbaru.
4. Jangan hapus data lokal sebelum sinkronisasi sukses.
5. Sediakan status sinkronisasi yang eksplisit.

## Blocker sebelum implementasi

- Provider auth belum dipilih secara eksplisit.
- Policy/RLS Supabase belum dirancang.
- Tabel user-specific belum disetujui.
- Belum ada keputusan apakah sinkronisasi dilakukan langsung ke Supabase atau lewat API server.
- Belum ada UX final untuk login, merge data lokal, dan logout.
