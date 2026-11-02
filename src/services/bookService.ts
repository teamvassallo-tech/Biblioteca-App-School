/**
 * Book Search Service
 * Exclusively queries official public REST APIs:
 * 1. Google Books API (https://www.googleapis.com/books/v1/volumes?q=isbn:...)
 * 2. Open Library API (https://openlibrary.org/api/books?bibkeys=ISBN:...&format=json&jscmd=data)
 *
 * Strictly NO imports or calls to @google/genai or @google/generative-ai.
 * If not found, strictly returns null.
 */

export interface BookSearchResult {
  isbn: string;
  title: string;
  authors: string[];
  publisher?: string;
  publicationYear?: string;
  description?: string;
  coverUrl?: string;
  coverCandidates?: Array<{ source: string; url: string }>;
  categories?: string[];
  pageCount?: number;
  source: string;
}

/**
 * Clean ISBN string (removes hyphens, spaces, keeps numbers and check digit X)
 */
export function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

/**
 * Generate publisher cover candidate URLs from authoritative CDNs
 */
export function getCoverCandidates(cleanIsbn: string, preferredCover?: string): Array<{ source: string; url: string }> {
  const candidates: Array<{ source: string; url: string }> = [];

  if (preferredCover && preferredCover.trim().length > 0) {
    candidates.push({ source: 'Copertina Originale (Banca Dati)', url: preferredCover.trim() });
  }

  if (cleanIsbn.length >= 10) {
    candidates.push({
      source: 'Copertina Originale Editore (Amazon Books CDN)',
      url: `https://images-na.ssl-images-amazon.com/images/P/${cleanIsbn}.01.LZZZZZZZ.jpg`,
    });
    candidates.push({
      source: 'Open Library (Alta Risoluzione)',
      url: `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`,
    });
    candidates.push({
      source: 'Google Books (Copertina Ufficiale)',
      url: `https://books.google.com/books/content?vid=ISBN${cleanIsbn}&printsec=frontcover&img=1&zoom=1`,
    });
  }

  return candidates;
}

/**
 * Search book by ISBN exclusively via official public REST APIs
 * Priority:
 * 1. Google Books REST API (https://www.googleapis.com/books/v1/volumes?q=isbn:...)
 * 2. Open Library REST API (https://openlibrary.org/api/books?bibkeys=ISBN:...&format=json&jscmd=data)
 *
 * Returns BookSearchResult on success, or null if not found.
 */
export async function searchBook(isbn: string): Promise<BookSearchResult | null> {
  const clean = cleanIsbn(isbn);
  if (!clean || (clean.length !== 10 && clean.length !== 13)) {
    return null;
  }

  // 1. Google Books REST API
  try {
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const gbResp = await fetch(gbUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (gbResp.ok) {
      const gbData = await gbResp.json();
      if (gbData && Array.isArray(gbData.items) && gbData.items.length > 0) {
        const item = gbData.items[0];
        const info = item.volumeInfo || {};

        let coverUrl: string | undefined;
        if (info.imageLinks) {
          const raw =
            info.imageLinks.extraLarge ||
            info.imageLinks.large ||
            info.imageLinks.medium ||
            info.imageLinks.thumbnail ||
            info.imageLinks.smallThumbnail;
          if (raw) {
            coverUrl = raw.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '');
          }
        }

        let title = info.title || '';
        if (info.subtitle) {
          title = `${title} - ${info.subtitle}`;
        }

        const authors = Array.isArray(info.authors) ? info.authors : [];
        const publisher = info.publisher || undefined;
        const publicationYear = info.publishedDate ? info.publishedDate.substring(0, 4) : undefined;
        const description = info.description || undefined;
        const categories = Array.isArray(info.categories) ? info.categories : undefined;
        const pageCount = typeof info.pageCount === 'number' ? info.pageCount : undefined;

        if (title || authors.length > 0) {
          const candidates = getCoverCandidates(clean, coverUrl);
          return {
            isbn: clean,
            title: title || 'Senza Titolo',
            authors,
            publisher,
            publicationYear,
            description,
            coverUrl: coverUrl || candidates[0]?.url,
            coverCandidates: candidates,
            categories,
            pageCount,
            source: 'Google Books API',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[searchBook] Google Books API fallito, procedo con Open Library:', err);
  }

  // 2. Open Library REST API Fallback
  try {
    const olUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(clean)}&format=json&jscmd=data`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const olResp = await fetch(olUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (olResp.ok) {
      const olData = await olResp.json();
      const bookKey = `ISBN:${clean}`;
      const entry = olData && olData[bookKey];

      if (entry) {
        const title = entry.title || '';
        const authors: string[] = [];
        if (Array.isArray(entry.authors)) {
          for (const a of entry.authors) {
            if (typeof a === 'string') authors.push(a);
            else if (a && a.name) authors.push(a.name);
          }
        }

        let publisher: string | undefined;
        if (Array.isArray(entry.publishers) && entry.publishers.length > 0) {
          publisher = typeof entry.publishers[0] === 'string' ? entry.publishers[0] : entry.publishers[0]?.name;
        }

        let publicationYear: string | undefined;
        if (entry.publish_date) {
          const match = String(entry.publish_date).match(/\b(19\d\d|20\d\d)\b/);
          if (match) publicationYear = match[1];
        }

        let coverUrl: string | undefined;
        if (entry.cover) {
          coverUrl = entry.cover.large || entry.cover.medium || entry.cover.small;
        }
        if (!coverUrl) {
          coverUrl = `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`;
        }

        const categories: string[] = [];
        if (Array.isArray(entry.subjects)) {
          for (const s of entry.subjects.slice(0, 5)) {
            if (typeof s === 'string') categories.push(s);
            else if (s && s.name) categories.push(s.name);
          }
        }

        const pageCount = typeof entry.number_of_pages === 'number' ? entry.number_of_pages : undefined;

        if (title || authors.length > 0) {
          const candidates = getCoverCandidates(clean, coverUrl);
          return {
            isbn: clean,
            title: title || 'Senza Titolo',
            authors,
            publisher,
            publicationYear,
            coverUrl: coverUrl || candidates[0]?.url,
            coverCandidates: candidates,
            categories: categories.length > 0 ? categories : undefined,
            pageCount,
            source: 'Open Library API',
          };
        }
      }
    }
  } catch (err) {
    console.warn('[searchBook] Open Library API fallito:', err);
  }

  // 3. Not found in official REST APIs: return null without attempting any AI generation
  return null;
}
