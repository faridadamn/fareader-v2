import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = path.dirname(fileURLToPath(import.meta.url));
const staticDirectory = path.join(root, "docs");
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || "0.0.0.0";
const previewMode = process.env.PREVIEW_CATALOG === "1";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi.");

const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 5,
  connect_timeout: 20,
  idle_timeout: 30,
});

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function normalizeJsonArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
  } catch {
    return value.split("|").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function allowedStatuses() {
  return previewMode ? ["published", "ready_for_review"] : ["published"];
}

async function serveStatic(response, pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(staticDirectory, relative);
  if (!filePath.startsWith(path.resolve(staticDirectory))) return false;
  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath);
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[extension] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "public, max-age=300" });
    response.end(content);
    return true;
  } catch {
    return false;
  }
}

async function dashboard() {
  const statuses = allowedStatuses();
  const [[bookCount], [topicCount]] = await Promise.all([
    sql`select count(*)::int as total from public.books where status = any(${statuses})`,
    sql`select count(*)::int as total from public.topics`,
  ]);
  return { bookCount: bookCount.total, topicCount: topicCount.total, preview: previewMode };
}

async function listCategories() {
  const statuses = allowedStatuses();
  const rows = await sql`
    select c.slug, c.name, count(distinct b.id)::int as book_count
    from public.categories c
    join public.book_categories bc on bc.category_id = c.id
    join public.books b on b.id = bc.book_id and b.status = any(${statuses})
    group by c.id
    order by c.name
  `;
  return { items: rows };
}

async function listBooks(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();
  const limit = Math.min(60, Math.max(6, Number(url.searchParams.get("limit") || 24)));
  const pattern = `%${q}%`;
  const statuses = allowedStatuses();
  const rows = await sql`
    select
      b.slug, b.title, b.original_author, b.description, b.word_count, b.reading_time_minutes,
      coalesce(array_agg(distinct c.name) filter (where c.id is not null), array[]::text[]) as categories,
      count(distinct bs.id)::int as section_count
    from public.books b
    left join public.book_sections bs on bs.book_id = b.id
    left join public.book_categories bc on bc.book_id = b.id
    left join public.categories c on c.id = bc.category_id
    where b.status = any(${statuses})
      and (${q} = '' or b.title ilike ${pattern} or coalesce(b.original_author, '') ilike ${pattern} or coalesce(b.description, '') ilike ${pattern})
      and (${category} = '' or exists (
        select 1 from public.book_categories bc2 join public.categories c2 on c2.id = bc2.category_id
        where bc2.book_id = b.id and c2.slug = ${category}
      ))
    group by b.id
    order by coalesce(b.published_at, b.created_at) desc, b.title
    limit ${limit}
  `;
  return { items: rows, preview: previewMode };
}

async function bookDetail(slug) {
  const statuses = allowedStatuses();
  const [book] = await sql`
    select
      b.id, b.slug, b.title, b.original_author, b.summary_publisher, b.description,
      b.word_count, b.reading_time_minutes,
      coalesce(array_agg(distinct c.name) filter (where c.id is not null), array[]::text[]) as categories
    from public.books b
    left join public.book_categories bc on bc.book_id = b.id
    left join public.categories c on c.id = bc.category_id
    where b.slug = ${slug} and b.status = any(${statuses})
    group by b.id
  `;
  if (!book) return null;
  const sections = await sql`
    select order_index, title, heading_label, content, word_count
    from public.book_sections
    where book_id = ${book.id}
    order by order_index
  `;
  delete book.id;
  return { ...book, sections };
}

async function listTopics(url) {
  const q = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(100, Math.max(8, Number(url.searchParams.get("limit") || 40)));
  const pattern = `%${q}%`;
  const rows = await sql`
    select
      t.id,
      t.title,
      t.categories,
      t.points,
      t.created_at,
      coalesce(string_agg(n.content, E'\n\n' order by n.created_at desc nulls last), '') as note_content
    from public.topics t
    left join public.notes n on n.topic_id = t.id
    where ${q} = ''
      or t.title ilike ${pattern}
      or coalesce(t.categories::text, '') ilike ${pattern}
      or coalesce(t.points::text, '') ilike ${pattern}
      or exists (
        select 1 from public.notes n2
        where n2.topic_id = t.id and n2.content ilike ${pattern}
      )
    group by t.id
    order by t.created_at desc nulls last, t.id desc
    limit ${limit}
  `;
  const items = rows.map((row) => ({
    ...row,
    categories: normalizeJsonArray(row.categories),
    points: normalizeJsonArray(row.points),
  }));
  return { items };
}

async function topicDetail(id) {
  const [row] = await sql`
    select
      t.id,
      t.title,
      t.categories,
      t.points,
      t.created_at,
      coalesce(string_agg(n.content, E'\n\n' order by n.created_at desc nulls last), '') as note_content
    from public.topics t
    left join public.notes n on n.topic_id = t.id
    where t.id = ${id}
    group by t.id
  `;
  if (!row) return null;
  return { ...row, categories: normalizeJsonArray(row.categories), points: normalizeJsonArray(row.points) };
}

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathname = url.pathname;
    if (request.method !== "GET") return sendJson(response, 405, { error: "Method not allowed" });
    if (pathname === "/api/health") return sendJson(response, 200, { ok: true, app: "FA Reader V2", preview: previewMode });
    if (pathname === "/api/dashboard") return sendJson(response, 200, await dashboard());
    if (pathname === "/api/categories") return sendJson(response, 200, await listCategories());
    if (pathname === "/api/books") return sendJson(response, 200, await listBooks(url));
    if (pathname.startsWith("/api/books/")) {
      const item = await bookDetail(decodeURIComponent(pathname.slice(11)));
      return sendJson(response, item ? 200 : 404, item || { error: "Book not found" });
    }
    if (pathname === "/api/topics") return sendJson(response, 200, await listTopics(url));
    if (pathname.startsWith("/api/topics/")) {
      const item = await topicDetail(decodeURIComponent(pathname.slice(12)));
      return sendJson(response, item ? 200 : 404, item || { error: "Topic not found" });
    }
    if (await serveStatic(response, pathname)) return;
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
}

if (!process.env.VERCEL) {
  const server = createServer(handler);
  server.listen(port, host, () => console.log(`FA Reader V2 running on http://${host}:${port}`));
}
