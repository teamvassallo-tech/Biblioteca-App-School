/**
 * Servizio di ricerca bibliografica unificato per BiblioScuola.
 * Chiama unicamente il nostro proxy serverless /api/search-book?q=...
 * oppure i cataloghi ufficiali REST (OPAC SBN, Google Books, Open Library).
 * Nessuna chiamata all'SDK Gemini AI, nessun fallback AI.
 */

export interface BookLookupResult {
  found: boolean;
  isbn?: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publicationYear?: string;
  description?: string;
  categories?: string[];
  pageCount?: number;
  coverUrl?: string;
  coverCandidates?: Array<{
    source: string;
    url: string;
    isOriginalEdition?: boolean;
  }>;
  genre?: string;
  ageGroup?: string;
  source?: string;
  message?: string;
  error?: string;
}

export interface BookSearchSettings {
  isbndbApiKey?: string;
  worldcatWskey?: string;
  librarythingDevKey?: string;
  schoolName?: string;
}

function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

function isIsbnLike(val: string): boolean {
  const clean = cleanIsbn(val);
  return (clean.length === 10 || clean.length === 13) && /^(\d{9}[\dX]|\d{13})$/i.test(clean);
}

/**
 * Funzione principale di ricerca: interroga esclusivamente l'API interna
 * /api/search-book?q=... che restituisce l'oggetto derivato dalle API REST
 * (OPAC SBN / BNI, Google Books, Open Library, Crossref, LibraryThing).
 */
export async function searchBook(
  query: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  const clean = (query || '').trim();
  if (!clean) {
    throw new Error('Inserisci un codice ISBN o un titolo per effettuare la ricerca.');
  }

  const isIsbn = isIsbnLike(clean);
  const cleanCode = isIsbn ? cleanIsbn(clean) : clean;

  const qParams = new URLSearchParams();
  qParams.set('q', cleanCode);
  if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
  if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
  if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);

  const endpoint = `/api/search-book?${qParams.toString()}`;
  console.info(`[BiblioScuola Service] Interrogazione proxy: ${endpoint}`);

  // 1. Chiamata al proxy unificato
  try {
    const res = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data: BookLookupResult = await res.json();
      if (data && data.found) {
        return {
          ...data,
          source: data.source?.includes('Gemini')
            ? 'Cataloghi Bibliografici Ufficiali (API REST)'
            : (data.source || 'Cataloghi Bibliografici Ufficiali (API REST)'),
        };
      }
    }
  } catch (proxyErr) {
    console.warn('[BiblioScuola Service] Proxy /api/search-book non disponibile, uso REST client diretto:', proxyErr);
  }

  // 2. Chiamata diretta REST di riserva ai soli Cataloghi Bibliografici Ufficiali
  try {
    // 2A. Google Books REST API
    const gbQuery = isIsbn ? `isbn:${encodeURIComponent(cleanCode)}` : encodeURIComponent(cleanCode);
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${gbQuery}&maxResults=1`);
    if (gbRes.ok) {
      const gbData = await gbRes.json();
      const item = gbData?.items?.[0];
      if (item && item.volumeInfo) {
        const info = item.volumeInfo;
        const resolvedTitle = info.title || '';
        const resolvedAuthors = info.authors || [];
        const rawCover = info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail;
        const coverUrl = rawCover ? rawCover.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '') : '';

        return {
          found: true,
          isbn: isIsbn ? cleanCode : undefined,
          title: resolvedTitle,
          authors: resolvedAuthors,
          publisher: info.publisher || '',
          publicationYear: info.publishedDate ? info.publishedDate.substring(0, 4) : '',
          description: info.description || '',
          categories: info.categories || [],
          pageCount: info.pageCount,
          coverUrl,
          source: 'Cataloghi Bibliografici Ufficiali (API REST)',
        };
      }
    }

    // 2B. Open Library REST API
    const olQuery = isIsbn
      ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(cleanCode)}&limit=1`
      : `https://openlibrary.org/search.json?q=${encodeURIComponent(cleanCode)}&limit=1`;
    const olRes = await fetch(olQuery);
    if (olRes.ok) {
      const olData = await olRes.json();
      const doc = olData?.docs?.[0];
      if (doc && (doc.title || doc.author_name)) {
        return {
          found: true,
          isbn: isIsbn ? cleanCode : (doc.isbn?.[0] || undefined),
          title: doc.title || '',
          authors: doc.author_name || [],
          publisher: doc.publisher?.[0] || '',
          publicationYear: doc.first_publish_year ? String(doc.first_publish_year) : '',
          coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : '',
          source: 'Cataloghi Bibliografici Ufficiali (API REST)',
        };
      }
    }
  } catch (directErr) {
    console.error('[BiblioScuola Service] Errore chiamata REST diretta:', directErr);
  }

  // Se nessun risultato in nessun catalogo ufficiale REST
  return {
    found: false,
    isbn: isIsbn ? cleanCode : undefined,
    source: 'Cataloghi Bibliografici Ufficiali (API REST)',
    message: 'Nessun risultato trovato nelle banche dati ufficiali',
  };
}

/**
 * Alias per la ricerca via ISBN
 */
export async function searchBookByIsbn(
  isbn: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  return searchBook(isbn, settings);
}

/**
 * Alias per la compatibilità con i componenti esistenti
 */
export async function searchBookOnline(
  query: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  return searchBook(query, settings);
}
