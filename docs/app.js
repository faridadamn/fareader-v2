const state = {
  active: 'library',
  books: [],
  topics: [],
  categories: [],
  bookmarks: new Set(JSON.parse(localStorage.getItem('fareader-v2:bookmarks') || '[]'))
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));
const initials = title => String(title || 'FA').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
const isReadableBook = book => Number(book.section_count || 0) > 0;

async function api(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Gagal memuat data');
  return data;
}

function renderRichText(content) {
  const lines = String(content || '').split(/\r?\n/);
  let html = '';
  let listType = null;
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    const quote = line.match(/^>\s+(.+)$/);

    if (bullet) {
      if (listType !== 'ul') {
        closeList();
        html += '<ul>';
        listType = 'ul';
      }
      html += `<li>${esc(bullet[1])}</li>`;
      continue;
    }

    if (numbered) {
      if (listType !== 'ol') {
        closeList();
        html += '<ol>';
        listType = 'ol';
      }
      html += `<li>${esc(numbered[1])}</li>`;
      continue;
    }

    closeList();
    html += quote ? `<blockquote>${esc(quote[1])}</blockquote>` : `<p>${esc(line)}</p>`;
  }

  closeList();
  return html || '<p>Konten section belum tersedia.</p>';
}

function saveBookmarks() {
  localStorage.setItem('fareader-v2:bookmarks', JSON.stringify([...state.bookmarks]));
  $('#savedCount').textContent = state.bookmarks.size;
}

function setView(view) {
  state.active = view;
  $$('.view').forEach(element => element.classList.remove('active-view'));
  const el = $(`#${view}View`);
  if (el) el.classList.add('active-view');
  $$('[data-view]').forEach(element => element.classList.toggle('active', element.dataset.view === view));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function tags(values = []) {
  return values.length ? values.map(value => `<span class="tag">${esc(value)}</span>`).join('') : '<span class="tag">Tanpa kategori</span>';
}

function bookMeta(book) {
  const parts = [];
  if (book.reading_time_minutes) parts.push(`${book.reading_time_minutes} menit baca`);
  if (book.word_count) parts.push(`${Number(book.word_count).toLocaleString('id-ID')} kata`);
  parts.push(isReadableBook(book) ? `${book.section_count} section` : 'Belum ada section');
  return `<p class="reader-meta">${esc(parts.join(' · '))}</p>`;
}

function bookCard(book) {
  const saved = state.bookmarks.has(book.slug);
  const readable = isReadableBook(book);
  return `<article class="book-card ${readable ? '' : 'is-incomplete'}"><div class="cover">${initials(book.title)}</div><div><p class="eyebrow">${esc(book.original_author || 'FA Reader')}</p><h3>${esc(book.title)}</h3><p>${esc(book.description || 'Deskripsi buku belum tersedia.')}</p>${bookMeta(book)}${tags(book.categories)}<div class="card-actions">${readable ? `<button class="primary-button" onclick="openBook('${encodeURIComponent(book.slug)}')">Baca ringkasan</button>` : '<button class="primary-button" disabled>Belum siap dibaca</button>'}<button class="ghost-button" onclick="bookmark('${encodeURIComponent(book.slug)}')">${saved ? 'Tersimpan' : 'Simpan'}</button></div></div></article>`;
}

function topicCard(topic) {
  return `<article class="book-card"><div class="cover">${initials(topic.title)}</div><div><p class="eyebrow">LEXIS KNOWLEDGE</p><h3>${esc(topic.title)}</h3><p>${esc((topic.points || [])[0] || topic.note_content || 'Insight tersimpan di Lexis Library.')}</p>${tags(topic.categories)}<div class="card-actions"><button class="primary-button" onclick="openTopic('${encodeURIComponent(topic.id)}')">Buka insight</button></div></div></article>`;
}

function sortBooks(list) {
  const mode = $('#sortFilter')?.value || 'default';
  return [...list].sort((a, b) => {
    if (mode === 'title-asc') return String(a.title || '').localeCompare(String(b.title || ''), 'id');
    if (mode === 'shortest') return Number(a.reading_time_minutes || 9999) - Number(b.reading_time_minutes || 9999);
    if (mode === 'longest') return Number(b.reading_time_minutes || 0) - Number(a.reading_time_minutes || 0);
    return 0;
  });
}

function filteredBooks() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const cat = $('#categoryFilter').value;
  return state.books.filter(book => {
    const haystack = [book.title, book.original_author, book.description, ...(book.categories || [])].join(' ').toLowerCase();
    return (!q || haystack.includes(q)) && (!cat || (book.categories || []).includes(cat));
  });
}

function renderBooks() {
  const list = sortBooks(filteredBooks());
  const readable = list.filter(isReadableBook).length;
  const incomplete = list.length - readable;
  $('#bookList').innerHTML = list.length ? list.map(bookCard).join('') : `<div class="reader-empty"><h2>Belum ada buku yang cocok</h2><p>Coba kata kunci lain, pilih semua kategori, atau tekan Reset.</p><button class="ghost-button" type="button" onclick="resetLibraryFilters()">Reset filter</button></div>`;
  $('#resultMeta').textContent = `${list.length} dari ${state.books.length} buku tersedia · ${readable} siap dibaca${incomplete ? ` · ${incomplete} perlu section` : ''}.`;
  $('#readingCount').textContent = readable;
}

function renderBookmarks() {
  const list = state.books.filter(book => state.bookmarks.has(book.slug));
  $('#bookmarkList').innerHTML = list.length ? list.map(bookCard).join('') : '<div class="reader-empty"><h2>Belum ada bookmark</h2><p>Simpan buku dari perpustakaan agar muncul di sini.</p></div>';
}

function renderTopics() {
  const box = $('#knowledgeView .book-grid');
  if (box) box.innerHTML = state.topics.length ? state.topics.map(topicCard).join('') : '<div class="reader-empty"><h2>Belum ada insight</h2><p>Knowledge akan tampil saat data tersedia.</p></div>';
}

function resetLibraryFilters() {
  $('#searchInput').value = '';
  $('#categoryFilter').value = '';
  $('#sortFilter').value = 'default';
  renderBooks();
}

function bookmark(encoded) {
  const slug = decodeURIComponent(encoded);
  state.bookmarks.has(slug) ? state.bookmarks.delete(slug) : state.bookmarks.add(slug);
  saveBookmarks();
  renderBooks();
  renderBookmarks();
}

function scrollToReaderSection(index) {
  const target = document.getElementById(`section-${index}`);
  if (!target) return;
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $$('.reader-nav button').forEach(button => button.classList.toggle('active', Number(button.dataset.sectionIndex) === index));
}

function sectionNavLabel(section, index) {
  if (section.heading_label) return section.heading_label;
  return index === 0 ? 'Pengantar' : `Bagian ${index}`;
}

function sectionArticle(section, index, total) {
  const previousButton = index > 0 ? `<button class="ghost-button" onclick="scrollToReaderSection(${index - 1})">← Section sebelumnya</button>` : '';
  const nextButton = index < total - 1 ? `<button class="primary-button" onclick="scrollToReaderSection(${index + 1})">Section berikutnya →</button>` : '';
  return `<article id="section-${index}" class="reader-section"><p class="eyebrow">${esc(section.heading_label || (index === 0 ? 'PENGANTAR' : `BAGIAN ${index}`))}</p><h2>${esc(section.title || sectionNavLabel(section, index))}</h2><div class="reader-prose">${renderRichText(section.content)}</div><div class="reader-section-footer"><span>${index + 1} dari ${total} section</span><div>${previousButton}${nextButton}</div></div></article>`;
}

async function openBook(encoded) {
  try {
    const book = await api(`/api/books/${encoded}`);
    const sections = book.sections || [];
    setView('reader');
    const nav = sections.map((section, index) => `<button class="${index === 0 ? 'active' : ''}" data-section-index="${index}" onclick="scrollToReaderSection(${index})">${esc(sectionNavLabel(section, index))}</button>`).join('');
    $('#reader').innerHTML = `<div class="reader-shell"><div class="reader-top"><div><p class="eyebrow">${esc(book.summary_publisher || 'FA Reader')}</p><h1 class="reader-title">${esc(book.title)}</h1><p class="reader-meta">${esc(book.original_author || '')} · ${book.reading_time_minutes || 0} menit baca · ${sections.length} section</p>${tags(book.categories)}</div><button class="ghost-button" onclick="bookmark('${encoded}')">${state.bookmarks.has(book.slug) ? '★ Tersimpan' : '☆ Simpan'}</button></div>${sections.length ? `<div class="reader-nav" aria-label="Navigasi section">${nav}</div>` : ''}${sections.length ? sections.map((section, index) => sectionArticle(section, index, sections.length)).join('') : '<div class="reader-empty"><h2>Rangkuman belum memiliki section</h2></div>'}</div>`;
  } catch (error) {
    showReaderError(error.message);
  }
}

async function openTopic(encoded) {
  try {
    const topic = await api(`/api/topics/${encoded}`);
    setView('reader');
    const points = (topic.points || []).map(point => `- ${point}`).join('\n');
    $('#reader').innerHTML = `<div class="reader-shell"><p class="eyebrow">LEXIS KNOWLEDGE</p><h1 class="reader-title">${esc(topic.title)}</h1><p class="reader-meta">${tags(topic.categories)}</p><article class="reader-section"><h2>Poin penting</h2><div class="reader-prose">${renderRichText(points)}</div></article>${topic.note_content ? `<article class="reader-section"><h2>Catatan</h2><div class="reader-prose">${renderRichText(topic.note_content)}</div></article>` : ''}</div>`;
  } catch (error) {
    showReaderError(error.message);
  }
}

function showReaderError(message) {
  setView('reader');
  $('#reader').innerHTML = `<div class="reader-empty"><h2>Data belum bisa dimuat</h2><p>${esc(message)}. Pastikan aplikasi dibuka dari deployment Vercel yang memiliki environment database aktif.</p></div>`;
}

async function init() {
  try {
    const [dash, books, cats, topics] = await Promise.all([api('/api/dashboard'), api('/api/books?limit=60'), api('/api/categories'), api('/api/topics?limit=60')]);
    state.books = books.items || [];
    state.categories = cats.items || [];
    state.topics = topics.items || [];
    $('#totalBooks').textContent = dash.bookCount || state.books.length;
    $('#modeBadge').textContent = dash.preview ? 'Mode review' : 'Katalog publik';
    $('#categoryFilter').innerHTML = '<option value="">Semua kategori</option>' + state.categories.map(category => `<option>${esc(category.name)}</option>`).join('');
    renderBooks();
    renderBookmarks();
    renderTopics();
  } catch (error) {
    $('#modeBadge').textContent = 'API belum terhubung';
    $('#resultMeta').textContent = 'Katalog belum bisa dimuat dari API production.';
    $('#bookList').innerHTML = '<div class="reader-empty"><h2>API production belum terhubung</h2><p>Pastikan deployment Vercel sudah memiliki DATABASE_URL dan endpoint API aktif.</p></div>';
    $('#knowledgeView .book-grid').innerHTML = '';
    console.error(error);
  }
}

window.filterBooks = renderBooks;
window.resetLibraryFilters = resetLibraryFilters;
window.bookmark = bookmark;
window.openBook = openBook;
window.openTopic = openTopic;
window.scrollToReaderSection = scrollToReaderSection;
$$('[data-view]').forEach(element => element.addEventListener('click', () => setView(element.dataset.view)));
$('#searchInput').addEventListener('input', renderBooks);
$('#categoryFilter').addEventListener('change', renderBooks);
$('#sortFilter').addEventListener('change', renderBooks);
saveBookmarks();
init();
