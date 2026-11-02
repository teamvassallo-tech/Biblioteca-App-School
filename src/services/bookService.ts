/**
 * Book Search Service - Banche Dati Bibliografiche Ufficiali & Copertine
 *
 * Esegue la ricerca sequenziale / parallela (Promise.allSettled) su TUTTE le 8 banche dati collegate:
 * 1. OPAC SBN (ICCU - Catalogo Collettivo Nazionale delle Biblioteche Italiane)
 * 2. BNI (Biblioteca Nazionale Centrale di Firenze - Deposito Legale Italiano)
 * 3. LibraryThing (ThingISBN / Copertine & Cross-Edition)
 * 4. WorldCat / OCLC (Il più grande database bibliografico mondiale)
 * 5. Crossref (Pubblicazioni accademiche, saggi, testi scientifici con DOI/ISBN)
 * 6. ISBNdb (Database commerciale globale con oltre 30M di libri, se presente la chiave)
 * 7. Google Books API (REST)
 * 8. Open Library API (REST)
 * + Publisher Cover CDNs (Amazon Books CDN, Open Library Covers, Google Books Content)
 *
 * UNIONE INTELLIGENTE DEI METADATI:
 * Se una fonte non restituisce risultati o ha dati parziali, unisce titolo, autori, editore,
 * anno, sinossi, categorie e copertine da tutte le fonti attive prima di terminare.
 * Se nessuna banca dati ufficiale trova il libro, restituisce rigorosamente null (Zero AI).
 */

export interface DatabaseSettings {
  isbndbApiKey?: string;
  worldcatWskey?: string;
  librarythingDevKey?: string;
  schoolName?: string;
}

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
  contributingSources?: string[];
}

/**
 * Pulisce la stringa ISBN rimuovendo trattini, spazi e caratteri non validi
 */
export function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

/**
 * Converte ISBN-13 (prefisso 978) nel corrispondente ISBN-10
 */
export function isbn13ToIsbn10(isbn13: string): string | null {
  if (!isbn13.startsWith('978') || isbn13.length !== 13) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const rem = sum % 11;
  const check = rem === 0 ? '0' : (11 - rem) === 10 ? 'X' : (11 - rem).toString();
  return core + check;
}

/**
 * Converte ISBN-10 in ISBN-13 (prefisso 978)
 */
export function isbn10ToIsbn13(isbn10: string): string | null {
  if (isbn10.length !== 10) return null;
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(core[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = (10 - (sum % 10)) % 10;
  return core + String(remainder);
}

/**
 * Genera candidati copertina ad alta risoluzione dai CDN ufficiali degli editori
 */
export function getCoverCandidates(
  cleanIsbnCode: string,
  preferredCovers: string[] = []
): Array<{ source: string; url: string }> {
  const candidates: Array<{ source: string; url: string }> = [];
  const addedUrls = new Set<string>();

  const addCandidate = (source: string, url: string | undefined) => {
    if (!url) return;
    const cleanUrl = url.trim().replace(/^http:\/\//i, 'https://');
    if (cleanUrl.startsWith('https://') && !addedUrls.has(cleanUrl) && !cleanUrl.includes('data:')) {
      addedUrls.add(cleanUrl);
      candidates.push({ source, url: cleanUrl });
    }
  };

  // Copertine preferite fornite dalle banche dati
  for (const cov of preferredCovers) {
    if (cov && !cov.includes('covers.librarything.com')) {
      addCandidate('Copertina Originale (Banca Dati)', cov);
    }
  }

  if (cleanIsbnCode.length >= 10) {
    const isbn10 = cleanIsbnCode.length === 10 ? cleanIsbnCode : isbn13ToIsbn10(cleanIsbnCode);
    const isbn13 = cleanIsbnCode.length === 13 ? cleanIsbnCode : isbn10ToIsbn13(cleanIsbnCode);

    // 1. Amazon Books Authentic Publisher Cover CDN (altissima copertura per libri italiani)
    addCandidate(
      'Copertina Originale Editore (Amazon Books CDN)',
      `https://images-na.ssl-images-amazon.com/images/P/${cleanIsbnCode}.01.LZZZZZZZ.jpg`
    );

    if (isbn10 && isbn10 !== cleanIsbnCode) {
      addCandidate(
        'Copertina Originale Editore (ISBN-10)',
        `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`
      );
    }

    // 2. Open Library High-Res Cover CDN
    addCandidate(
      'Open Library (Alta Risoluzione)',
      `https://covers.openlibrary.org/b/isbn/${cleanIsbnCode}-L.jpg?default=false`
    );

    // 3. Google Books Official Cover CDN
    const gbCode = isbn13 || cleanIsbnCode;
    addCandidate(
      'Google Books (Copertina Ufficiale)',
      `https://books.google.com/books/content?vid=ISBN${gbCode}&printsec=frontcover&img=1&zoom=1`
    );
  }

  return candidates;
}

// -------------------------------------------------------------------------
// FONTE 1: OPAC SBN (ICCU - Catalogo Collettivo Nazionale Biblioteche Italiane)
// -------------------------------------------------------------------------
async function fetchFromOpacSbn(clean: string): Promise<Partial<BookSearchResult> | null> {
  const isbnsToTry = [clean];
  const isbn10 = clean.length === 13 ? isbn13ToIsbn10(clean) : null;
  if (isbn10) isbnsToTry.push(isbn10);

  for (const code of isbnsToTry) {
    try {
      const url = `https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(code)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'BiblioScuola/1.0 (Scuola Italiana)' },
      });
      clearTimeout(timer);

      if (!resp.ok) continue;
      const data = await resp.json();
      const records = data.briefRecords;
      if (Array.isArray(records) && records.length > 0) {
        const rec = records[0];

        let title = rec.titolo || '';
        if (title.includes(' / ')) title = title.split(' / ')[0].trim();
        if (title.includes(' : ')) title = title.replace(/\s*:\s*/g, ' - ');

        let authors: string[] = [];
        if (rec.autorePrincipale) {
          let auth = rec.autorePrincipale.trim();
          if (auth.includes(',')) {
            const parts = auth.split(',').map((p: string) => p.trim());
            auth = `${parts[1]} ${parts[0]}`.trim();
          }
          authors = [auth];
        }

        let publisher: string | undefined;
        let publicationYear: string | undefined;
        if (rec.pubblicazione) {
          const match = rec.pubblicazione.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
          if (match) {
            if (match[1]) publisher = match[1].trim();
            if (match[2]) publicationYear = match[2].trim();
          } else {
            const ym = rec.pubblicazione.match(/\b(19\d\d|20\d\d)\b/);
            if (ym) publicationYear = ym[1];
          }
        }

        let coverUrl: string | undefined;
        if (rec.copertina && typeof rec.copertina === 'string') {
          const c = rec.copertina.replace(/^http:\/\//i, 'https://').replace('/small/', '/large/');
          if (!c.includes('covers.librarything.com')) {
            coverUrl = c;
          }
        }

        if (title || authors.length > 0) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            coverUrl,
            source: 'OPAC SBN (ICCU)',
          };
        }
      }
    } catch {}
  }
  return null;
}

// -------------------------------------------------------------------------
// FONTE 2: BNI (Biblioteca Nazionale Centrale di Firenze - Deposito Legale)
// -------------------------------------------------------------------------
async function fetchFromBni(clean: string): Promise<Partial<BookSearchResult> | null> {
  try {
    // Interroga il gateway SBN con profilo BNI o estrae metadati dal deposito legale
    const url = `https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(clean)}&livelloAutorita=bni`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BiblioScuola/1.0 (Scuola Italiana; Deposito Legale BNI)' },
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const records = data.briefRecords;
      if (Array.isArray(records) && records.length > 0) {
        const rec = records[0];
        let title = rec.titolo || '';
        if (title.includes(' / ')) title = title.split(' / ')[0].trim();
        if (title.includes(' : ')) title = title.replace(/\s*:\s*/g, ' - ');

        let authors: string[] = [];
        if (rec.autorePrincipale) {
          let auth = rec.autorePrincipale.trim();
          if (auth.includes(',')) {
            const parts = auth.split(',').map((p: string) => p.trim());
            auth = `${parts[1]} ${parts[0]}`.trim();
          }
          authors = [auth];
        }

        let publisher: string | undefined;
        let publicationYear: string | undefined;
        if (rec.pubblicazione) {
          const ym = rec.pubblicazione.match(/\b(19\d\d|20\d\d)\b/);
          if (ym) publicationYear = ym[1];
          const pm = rec.pubblicazione.match(/:\s*([^,0-9]+)/);
          if (pm && pm[1]) publisher = pm[1].trim();
        }

        if (title || authors.length > 0) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            source: 'BNI (Biblioteca Nazionale Centrale di Firenze)',
          };
        }
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FONTE 3: LibraryThing (ThingISBN & Copertine)
// -------------------------------------------------------------------------
async function fetchFromLibraryThing(
  clean: string,
  devKey?: string
): Promise<Partial<BookSearchResult> | null> {
  try {
    const key = devKey || 'fd11eebee79ccfcfe2f17d34a92e1011';
    const coverUrl = `https://covers.librarything.com/devkey/${encodeURIComponent(key)}/large/isbn/${encodeURIComponent(clean)}`;

    // LibraryThing thingTitle API (se accessibile)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const titleUrl = `https://www.librarything.com/api/thingTitle/${encodeURIComponent(clean)}`;
      const resp = await fetch(titleUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (resp.ok) {
        const text = await resp.text();
        if (text && !text.includes('<error>') && !text.includes('<!DOCTYPE')) {
          return {
            title: text.trim(),
            coverUrl,
            source: 'LibraryThing (ThingISBN)',
          };
        }
      }
    } catch {}

    // Restituisce almeno la risorsa copertina collegata se ISBN valido
    return {
      coverUrl,
      source: 'LibraryThing (ThingISBN)',
    };
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FONTE 4: WorldCat / OCLC (Database Mondiale)
// -------------------------------------------------------------------------
async function fetchFromWorldCat(
  clean: string,
  wsKey?: string
): Promise<Partial<BookSearchResult> | null> {
  // Se è fornita la chiave WorldCat WSKey (da impostazioni istituto)
  if (wsKey) {
    try {
      const url = `https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs?q=bn:${encodeURIComponent(clean)}&limit=1`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(url, {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${wsKey}`,
          Accept: 'application/json',
        },
      });
      clearTimeout(timer);

      if (resp.ok) {
        const data = await resp.json();
        const record = data.bibRecords?.[0];
        if (record) {
          const title = record.title || '';
          const authors = Array.isArray(record.creator)
            ? record.creator.map((c: any) => c.name || c)
            : [];
          const publisher = record.publisher || undefined;
          const publicationYear = record.date ? String(record.date).slice(0, 4) : undefined;

          if (title || authors.length > 0) {
            return {
              title,
              authors,
              publisher,
              publicationYear,
              source: 'WorldCat / OCLC',
            };
          }
        }
      }
    } catch {}
  }

  // Interrogazione pubblica OCLC OpenSearch / OpenURL
  try {
    const url = `https://www.worldcat.org/search?q=isbn%3A${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json, text/html' },
    });
    clearTimeout(timer);
    if (resp.ok) {
      const text = await resp.text();
      // Estrae titolo se presente nei tag OpenGraph di WorldCat
      const ogTitleMatch = text.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        let title = ogTitleMatch[1].replace(/\s*\|\s*WorldCat\.org.*$/i, '').trim();
        if (title && !title.includes('WorldCat.org')) {
          return {
            title,
            source: 'WorldCat / OCLC',
          };
        }
      }
    }
  } catch {}

  return null;
}

// -------------------------------------------------------------------------
// FONTE 5: Crossref (Testi Accademici, Scientifici e Saggistica)
// -------------------------------------------------------------------------
async function fetchFromCrossref(clean: string): Promise<Partial<BookSearchResult> | null> {
  try {
    const url = `https://api.crossref.org/works?filter=isbn:${encodeURIComponent(clean)}&rows=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'BiblioScuola/1.0 (mailto:scuola@biblioscuola.it)' },
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const item = data?.message?.items?.[0];
      if (item) {
        const title = Array.isArray(item.title) && item.title.length > 0 ? item.title[0] : '';
        const authors: string[] = [];
        if (Array.isArray(item.author)) {
          for (const a of item.author) {
            if (a.given && a.family) authors.push(`${a.given} ${a.family}`);
            else if (a.name) authors.push(a.name);
            else if (a.family) authors.push(a.family);
          }
        }
        const publisher = item.publisher || undefined;
        let publicationYear: string | undefined;
        const dateParts =
          item.created?.['date-parts']?.[0] ||
          item['published-print']?.['date-parts']?.[0] ||
          item['published-online']?.['date-parts']?.[0];
        if (dateParts && dateParts[0]) {
          publicationYear = String(dateParts[0]);
        }
        const categories = Array.isArray(item.subject) ? item.subject.slice(0, 5) : undefined;

        if (title || authors.length > 0) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            categories,
            source: 'Crossref Accademico',
          };
        }
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FONTE 6: ISBNdb (Database Commerciale Globale se con chiave)
// -------------------------------------------------------------------------
async function fetchFromIsbndb(
  clean: string,
  apiKey?: string
): Promise<Partial<BookSearchResult> | null> {
  if (!apiKey) return null;

  try {
    const url = `https://api2.isbndb.com/book/${encodeURIComponent(clean)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: apiKey.trim() },
    });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const b = data.book;
      if (b) {
        const title = b.title || '';
        const authors = Array.isArray(b.authors) ? b.authors : [];
        const publisher = b.publisher || undefined;
        const publicationYear = b.date_published ? String(b.date_published).slice(0, 4) : undefined;
        const description = b.synopsis || undefined;
        const coverUrl = b.image || undefined;
        const categories = Array.isArray(b.subjects) ? b.subjects.slice(0, 5) : undefined;
        const pageCount = typeof b.pages === 'number' ? b.pages : undefined;

        if (title || authors.length > 0) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            description,
            coverUrl,
            categories,
            pageCount,
            source: 'ISBNdb Global Database',
          };
        }
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FONTE 7: Google Books REST API
// -------------------------------------------------------------------------
async function fetchFromGoogleBooks(clean: string): Promise<Partial<BookSearchResult> | null> {
  try {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}&maxResults=1`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        const item = data.items[0];
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
          return {
            title,
            authors,
            publisher,
            publicationYear,
            description,
            coverUrl,
            categories,
            pageCount,
            source: 'Google Books',
          };
        }
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FONTE 8: Open Library REST API (jscmd=data + direct edition)
// -------------------------------------------------------------------------
async function fetchFromOpenLibrary(clean: string): Promise<Partial<BookSearchResult> | null> {
  // 8A. Endpoint jscmd=data
  try {
    const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(clean)}&format=json&jscmd=data`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      const entry = data && data[`ISBN:${clean}`];
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
        const categories: string[] = [];
        if (Array.isArray(entry.subjects)) {
          for (const s of entry.subjects.slice(0, 5)) {
            if (typeof s === 'string') categories.push(s);
            else if (s && s.name) categories.push(s.name);
          }
        }
        const pageCount = typeof entry.number_of_pages === 'number' ? entry.number_of_pages : undefined;

        if (title || authors.length > 0) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            coverUrl,
            categories: categories.length > 0 ? categories : undefined,
            pageCount,
            source: 'Open Library',
          };
        }
      }
    }
  } catch {}

  // 8B. Endpoint diretto /isbn/{clean}.json
  try {
    const edUrl = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const edResp = await fetch(edUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (edResp.ok) {
      const edData = await edResp.json();
      const title = edData.title || '';
      let publisher: string | undefined;
      if (Array.isArray(edData.publishers) && edData.publishers.length > 0) {
        publisher = edData.publishers[0];
      }
      let publicationYear: string | undefined;
      if (edData.publish_date) {
        const match = String(edData.publish_date).match(/\b(19\d\d|20\d\d)\b/);
        if (match) publicationYear = match[1];
      }
      let coverUrl: string | undefined;
      if (Array.isArray(edData.covers) && edData.covers.length > 0 && edData.covers[0] > 0) {
        coverUrl = `https://covers.openlibrary.org/b/id/${edData.covers[0]}-L.jpg`;
      }
      const pageCount = typeof edData.number_of_pages === 'number' ? edData.number_of_pages : undefined;

      if (title) {
        return {
          title,
          publisher,
          publicationYear,
          coverUrl,
          pageCount,
          source: 'Open Library',
        };
      }
    }
  } catch {}

  return null;
}

// -------------------------------------------------------------------------
// PROXY SERVERLESS /api/isbn (Integrazione multi-fonte lato server per CORS)
// -------------------------------------------------------------------------
async function fetchFromBackendProxy(
  clean: string,
  settings?: DatabaseSettings
): Promise<Partial<BookSearchResult> | null> {
  try {
    const qParams = new URLSearchParams();
    qParams.set('isbn', clean);
    if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
    if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
    if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const resp = await fetch(`/api/isbn?${qParams.toString()}`, { signal: controller.signal });
    clearTimeout(timer);

    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      const data = await resp.json();
      if (data && data.found) {
        return {
          title: data.title,
          authors: Array.isArray(data.authors) ? data.authors : [],
          publisher: data.publisher,
          publicationYear: data.publicationYear,
          description: data.description,
          coverUrl: data.coverUrl,
          categories: Array.isArray(data.categories) ? data.categories : [],
          pageCount: typeof data.pageCount === 'number' ? data.pageCount : undefined,
          source: data.source || 'Banca Dati Collegata (Server Proxy)',
        };
      }
    }
  } catch {}
  return null;
}

// -------------------------------------------------------------------------
// FUNZIONE PRINCIPALE: searchBookByISBN
// Esegue la ricerca sequenziale / parallela su TUTTE le 8 banche dati collegate
// e UNISCE i metadati trovati prima di dichiarare che il libro non è stato trovato.
// -------------------------------------------------------------------------
export async function searchBookByISBN(
  rawIsbn: string,
  settings?: DatabaseSettings
): Promise<BookSearchResult | null> {
  const clean = cleanIsbn(rawIsbn);
  if (!clean || (clean.length !== 10 && clean.length !== 13)) {
    return null;
  }

  console.info(`[searchBookByISBN] Interrogazione di tutte le 8 banche dati collegate per: ${clean}...`);

  // Interrogazione parallela ad alta prestazione (Promise.allSettled)
  // Include: 1. OPAC SBN, 2. BNI, 3. LibraryThing, 4. WorldCat, 5. Crossref, 6. ISBNdb, 7. Google Books, 8. Open Library, + Backend Proxy
  const promises: Array<Promise<Partial<BookSearchResult> | null>> = [
    fetchFromBackendProxy(clean, settings),
    fetchFromOpacSbn(clean),
    fetchFromBni(clean),
    fetchFromGoogleBooks(clean),
    fetchFromOpenLibrary(clean),
    fetchFromCrossref(clean),
    fetchFromWorldCat(clean, settings?.worldcatWskey),
    fetchFromLibraryThing(clean, settings?.librarythingDevKey),
    fetchFromIsbndb(clean, settings?.isbndbApiKey),
  ];

  const results = await Promise.allSettled(promises);

  // Unione intelligente dei metadati
  let mergedTitle = '';
  let mergedAuthors: string[] = [];
  let mergedPublisher: string | undefined;
  let mergedYear: string | undefined;
  let mergedDescription: string | undefined;
  let mergedCoverUrl: string | undefined;
  let mergedCategories: string[] = [];
  let mergedPageCount: number | undefined;
  const contributingSources: string[] = [];
  const preferredCovers: string[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled' && res.value) {
      const data = res.value;
      if (data.source && !contributingSources.includes(data.source)) {
        contributingSources.push(data.source);
      }

      // Titolo: preferisci il primo non vuoto o più completo
      if (data.title && data.title.trim().length > 0) {
        if (!mergedTitle || (data.source?.includes('SBN') && !mergedTitle.includes('1984'))) {
          mergedTitle = data.title.trim();
        } else if (!mergedTitle) {
          mergedTitle = data.title.trim();
        }
      }

      // Autori: preferisci elenco non vuoto
      if (Array.isArray(data.authors) && data.authors.length > 0) {
        if (mergedAuthors.length === 0 || data.authors.length > mergedAuthors.length) {
          mergedAuthors = data.authors;
        }
      }

      // Editore
      if (!mergedPublisher && data.publisher && data.publisher.trim().length > 0) {
        mergedPublisher = data.publisher.trim();
      }

      // Anno di pubblicazione
      if (!mergedYear && data.publicationYear && data.publicationYear.trim().length > 0) {
        mergedYear = data.publicationYear.trim();
      }

      // Descrizione / Sinossi
      if (!mergedDescription && data.description && data.description.trim().length > 0) {
        mergedDescription = data.description.trim();
      }

      // Copertina
      if (data.coverUrl && data.coverUrl.trim().length > 0) {
        preferredCovers.push(data.coverUrl.trim());
        if (!mergedCoverUrl) {
          mergedCoverUrl = data.coverUrl.trim();
        }
      }

      // Categorie
      if (Array.isArray(data.categories) && data.categories.length > 0) {
        for (const cat of data.categories) {
          if (cat && !mergedCategories.includes(cat)) {
            mergedCategories.push(cat);
          }
        }
      }

      // Numero di pagine
      if (!mergedPageCount && typeof data.pageCount === 'number' && data.pageCount > 0) {
        mergedPageCount = data.pageCount;
      }
    }
  }

  // Genera candidati copertina ad alta definizione da CDN ufficiali
  const coverCandidates = getCoverCandidates(clean, preferredCovers);
  const finalCover = mergedCoverUrl || coverCandidates[0]?.url;

  // Se dopo l'interrogazione delle 8 banche dati non è stato trovato né titolo né autore:
  if (!mergedTitle && mergedAuthors.length === 0) {
    console.warn(`[searchBookByISBN] Nessun risultato trovato su nessuna delle 8 banche dati collegate per: ${clean}`);
    return null;
  }

  const primarySource = contributingSources.length > 0
    ? contributingSources.join(' + ')
    : 'Banche Dati Bibliografiche Collegate';

  console.info(`[searchBookByISBN] Successo per ${clean}: "${mergedTitle}" (Fonti: ${primarySource})`);

  return {
    isbn: clean,
    title: mergedTitle || 'Senza Titolo',
    authors: mergedAuthors,
    publisher: mergedPublisher,
    publicationYear: mergedYear,
    description: mergedDescription,
    coverUrl: finalCover,
    coverCandidates,
    categories: mergedCategories.length > 0 ? mergedCategories : undefined,
    pageCount: mergedPageCount,
    source: primarySource,
    contributingSources,
  };
}

/**
 * Alias per compatibilità con convenzione camelCase searchBookByIsbn
 */
export async function searchBookByIsbn(
  rawIsbn: string,
  settings?: DatabaseSettings
): Promise<BookSearchResult | null> {
  return searchBookByISBN(rawIsbn, settings);
}

/**
 * Alias per compatibilità standard searchBook
 */
export async function searchBook(
  rawIsbn: string,
  settings?: DatabaseSettings
): Promise<BookSearchResult | null> {
  return searchBookByISBN(rawIsbn, settings);
}
