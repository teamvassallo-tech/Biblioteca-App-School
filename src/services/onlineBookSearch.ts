/**
 * Online Book Search Service
 * Exclusively queries official library and bibliographic databases:
 * - OPAC SBN & BNI (Catalogo Collettivo Nazionale ICCU / Deposito Legale BNCF Firenze)
 * - LibraryThing & ThingISBN
 * - Google Books API (REST)
 * - Open Library API (REST)
 * - Publisher Cover CDNs (Amazon Books CDN, Open Library Covers, Google Books Content)
 *
 * Strictly NO generative AI in the book search flow: no hallucinations, no invented data.
 */

import { Book } from '../types';

export interface BookLookupResult {
  found: boolean;
  source: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publicationYear?: string;
  isbn?: string;
  description?: string;
  categories?: string[];
  pageCount?: number;
  coverUrl?: string;
  coverCandidates?: Array<{ source: string; url: string }>;
  genre?: string;
  ageGroup?: string;
  message?: string;
}

/**
 * Clean ISBN string
 */
export function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

/**
 * Check if a search query looks like an ISBN (10 or 13 digits, or digits with hyphens)
 */
export function isIsbnLike(query: string): boolean {
  const clean = cleanIsbn(query);
  return (clean.length === 10 || clean.length === 13) && /^(\d{9}[\dX]|\d{13})$/i.test(clean);
}

/**
 * Convert ISBN-13 (978...) to ISBN-10
 */
export function isbn13ToIsbn10(isbn13: string): string | null {
  if (!isbn13.startsWith('978') || isbn13.length !== 13) return null;
  const core = isbn13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(core[i], 10) * (10 - i);
  }
  const remainder = (11 - (sum % 11)) % 11;
  const checkDigit = remainder === 10 ? 'X' : String(remainder);
  return core + checkDigit;
}

/**
 * Convert ISBN-10 to ISBN-13
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
 * Generate real publisher book cover candidate URLs from authoritative CDNs
 */
export function getRealCoverCandidates(
  rawIsbn: string,
  preferredCover?: string
): Array<{ source: string; url: string }> {
  const clean = cleanIsbn(rawIsbn);
  const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);
  const candidates: Array<{ source: string; url: string }> = [];

  if (preferredCover && preferredCover.trim().length > 0 && !preferredCover.startsWith('data:')) {
    candidates.push({ source: 'Copertina Originale (Banca Dati)', url: preferredCover.trim() });
  }

  if (clean.length >= 10) {
    // 1. Amazon Books Authentic Publisher Cover CDN (Very reliable for Italian books)
    candidates.push({
      source: 'Copertina Originale Editore (Amazon Books CDN)',
      url: `https://images-na.ssl-images-amazon.com/images/P/${clean}.01.LZZZZZZZ.jpg`,
    });

    if (isbn10 && isbn10 !== clean) {
      candidates.push({
        source: 'Copertina Originale Editore (ISBN-10)',
        url: `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`,
      });
    }

    // 2. Open Library High-Res Cover CDN
    candidates.push({
      source: 'Open Library (Alta Risoluzione)',
      url: `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
    });

    // 3. Google Books Official Cover CDN
    candidates.push({
      source: 'Google Books (Copertina Ufficiale)',
      url: `https://books.google.com/books/content?vid=ISBN${clean}&printsec=frontcover&img=1&zoom=1`,
    });
  }

  return candidates;
}

/**
 * 1. Official REST API: OPAC SBN & BNI (Catalogo Collettivo Nazionale ICCU)
 */
async function fetchFromOpacSbnDirect(
  query: string,
  isIsbn: boolean
): Promise<Partial<BookLookupResult> | null> {
  try {
    const clean = isIsbn ? cleanIsbn(query) : query.trim();
    const urlsToTry: string[] = [];

    if (isIsbn) {
      urlsToTry.push(`https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(clean)}`);
      const isbn10 = clean.length === 13 ? isbn13ToIsbn10(clean) : null;
      if (isbn10) {
        urlsToTry.push(`https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(isbn10)}`);
      }
    } else {
      urlsToTry.push(`https://opac.sbn.it/opacmobilegw/search.json?title=${encodeURIComponent(clean)}&rows=5`);
      urlsToTry.push(`https://opac.sbn.it/opacmobilegw/search.json?author=${encodeURIComponent(clean)}&rows=5`);
    }

    for (const url of urlsToTry) {
      try {
        console.info(`[Banche Dati - OPAC SBN / BNI] Interrogazione: ${url}...`);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4500);
        const resp = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'BiblioScuola/1.0 (Gestionale Biblioteca Scolastica)' },
        });
        clearTimeout(timer);

        if (!resp.ok) continue;
        const data = await resp.json();
        const records = data.briefRecords;
        if (Array.isArray(records) && records.length > 0) {
          const rec = records.find((r: any) => r.isbn) || records[0];

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

          const foundIsbn = rec.isbn ? cleanIsbn(rec.isbn) : (isIsbn ? clean : undefined);

          if (title || authors.length > 0) {
            return {
              title,
              authors,
              publisher,
              publicationYear,
              isbn: foundIsbn,
              coverUrl,
              source: 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)',
            };
          }
        }
      } catch (err) {
        console.warn('[Banche Dati - OPAC SBN] Errore richiesta:', err);
      }
    }
  } catch (e) {
    console.warn('[Banche Dati - OPAC SBN] Errore generale:', e);
  }

  return null;
}

/**
 * 2. Official REST API: Google Books API (CORS enabled)
 */
async function fetchFromGoogleBooksDirect(
  query: string,
  isIsbn: boolean
): Promise<Partial<BookLookupResult> | null> {
  try {
    const clean = isIsbn ? cleanIsbn(query) : query.trim();
    const qParam = isIsbn ? `isbn:${encodeURIComponent(clean)}` : encodeURIComponent(clean);
    const url = `https://www.googleapis.com/books/v1/volumes?q=${qParam}&maxResults=1`;

    console.info(`[Banche Dati - Google Books API] Interrogazione per: ${qParam}...`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`[Banche Dati - Google Books API] HTTP ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
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

      const authors = Array.isArray(info.authors) ? info.authors : undefined;
      const publisher = info.publisher || undefined;
      const publicationYear = info.publishedDate ? info.publishedDate.substring(0, 4) : undefined;
      const description = info.description || undefined;
      const categories = Array.isArray(info.categories) ? info.categories : undefined;
      const pageCount = typeof info.pageCount === 'number' ? info.pageCount : undefined;

      let foundIsbn = isIsbn ? clean : undefined;
      if (!foundIsbn && Array.isArray(info.industryIdentifiers)) {
        const idObj = info.industryIdentifiers.find((id: any) => id.type?.includes('ISBN'));
        if (idObj?.identifier) foundIsbn = cleanIsbn(idObj.identifier);
      }

      if (title || (authors && authors.length > 0)) {
        return {
          title,
          authors,
          publisher,
          publicationYear,
          isbn: foundIsbn,
          description,
          categories,
          pageCount,
          coverUrl,
          source: 'Google Books (Banca Dati Bibliotecaria)',
        };
      }
    }
  } catch (err: any) {
    console.warn('[Banche Dati - Google Books API] Errore:', err?.message || err);
  }

  return null;
}

/**
 * 3. Official REST API: Open Library API (CORS enabled, full author resolution)
 */
async function fetchFromOpenLibraryDirect(
  query: string,
  isIsbn: boolean
): Promise<Partial<BookLookupResult> | null> {
  const clean = isIsbn ? cleanIsbn(query) : query.trim();

  // If ISBN, first try direct edition endpoint /isbn/{code}.json
  if (isIsbn) {
    try {
      const edUrl = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
      const edResp = await fetch(edUrl);
      if (edResp.ok) {
        const edData = await edResp.json();
        let title = edData.title;
        let publicationYear: string | undefined;
        let publisher: string | undefined;
        let pageCount: number | undefined;
        let coverUrl: string | undefined;
        let authors: string[] = [];

        if (edData.publish_date) {
          const ym = String(edData.publish_date).match(/\b(19\d\d|20\d\d)\b/);
          if (ym) publicationYear = ym[1];
        }
        if (Array.isArray(edData.publishers) && edData.publishers.length > 0) {
          publisher = edData.publishers[0];
        }
        if (typeof edData.number_of_pages === 'number') {
          pageCount = edData.number_of_pages;
        }
        if (Array.isArray(edData.covers) && edData.covers.length > 0 && edData.covers[0] > 0) {
          coverUrl = `https://covers.openlibrary.org/b/id/${edData.covers[0]}-L.jpg`;
        }

        // Author name resolution
        if (Array.isArray(edData.authors) && edData.authors.length > 0) {
          for (const a of edData.authors) {
            if (typeof a === 'string') authors.push(a);
            else if (a.name) authors.push(a.name);
            else if (a.key) {
              try {
                const aResp = await fetch(`https://openlibrary.org${a.key}.json`);
                if (aResp.ok) {
                  const aData = await aResp.json();
                  if (aData.name) authors.push(aData.name);
                }
              } catch {}
            }
          }
        }

        if (title || authors.length > 0) {
          return {
            title,
            authors: authors.length > 0 ? authors : undefined,
            publisher,
            publicationYear,
            pageCount,
            coverUrl: coverUrl || `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
            source: 'Open Library (Banca Dati Bibliotecaria)',
          };
        }
      }
    } catch (e) {
      console.warn('[Banche Dati - Open Library] Errore edizione diretta:', e);
    }
  }

  // General Open Library Search endpoint
  try {
    const sParam = isIsbn ? `isbn=${encodeURIComponent(clean)}` : `q=${encodeURIComponent(clean)}`;
    const sUrl = `https://openlibrary.org/search.json?${sParam}&fields=title,author_name,publisher,first_publish_year,cover_i,isbn,subject&limit=1`;
    const sResp = await fetch(sUrl);
    if (sResp.ok) {
      const sData = await sResp.json();
      if (sData.docs && Array.isArray(sData.docs) && sData.docs.length > 0) {
        const doc = sData.docs[0];
        const title = doc.title;
        const authors = Array.isArray(doc.author_name) ? doc.author_name : [];
        const publisher = Array.isArray(doc.publisher) && doc.publisher.length > 0 ? doc.publisher[0] : undefined;
        const publicationYear = doc.first_publish_year ? String(doc.first_publish_year) : undefined;
        let coverUrl = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined;
        let foundIsbn = isIsbn ? clean : undefined;
        if (!foundIsbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) {
          foundIsbn = cleanIsbn(doc.isbn[0]);
        }
        if (!coverUrl && foundIsbn) {
          coverUrl = `https://covers.openlibrary.org/b/isbn/${foundIsbn}-L.jpg?default=false`;
        }

        const categories = Array.isArray(doc.subject) ? doc.subject.slice(0, 5) : undefined;

        if (title || authors.length > 0) {
          return {
            title,
            authors: authors.length > 0 ? authors : undefined,
            publisher,
            publicationYear,
            isbn: foundIsbn,
            categories,
            coverUrl,
            source: 'Open Library (Banca Dati Bibliotecaria)',
          };
        }
      }
    }
  } catch (err: any) {
    console.warn('[Banche Dati - Open Library] Errore ricerca:', err?.message || err);
  }

  return null;
}

/**
 * Unified Online Book Search function:
 * Searches exclusively through authoritative library & bibliographic databases
 * (OPAC SBN, BNI, LibraryThing, Google Books, Open Library) for ISBN, Title, or Author.
 *
 * If not found, strictly returns: "Nessun risultato trovato nelle banche dati ufficiali".
 * Zero AI calls.
 */
export async function searchBookOnline(
  rawQuery: string,
  settings?: {
    isbndbApiKey?: string;
    worldcatWskey?: string;
    librarythingDevKey?: string;
    schoolName?: string;
  }
): Promise<BookLookupResult> {
  const query = (rawQuery || '').trim();
  if (!query) {
    throw new Error('Inserisci un codice ISBN, un titolo o un autore per effettuare la ricerca.');
  }

  const isIsbn = isIsbnLike(query);
  const clean = isIsbn ? cleanIsbn(query) : query;

  console.info(`[Ricerca Banche Dati Ufficiali] Avvio interrogazione per "${clean}" (modalità: ${isIsbn ? 'ISBN' : 'Titolo/Autore'})...`);

  // TENTATIVO 1: Chiamata al server/Vercel serverless proxy (/api/isbn/:isbn o /api/book-search?query=...)
  try {
    const qParams = new URLSearchParams();
    if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
    if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
    if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);
    const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

    const proxyUrl = isIsbn
      ? `/api/isbn/${encodeURIComponent(clean)}${qStr}`
      : `/api/book-search?query=${encodeURIComponent(clean)}${qStr}`;

    console.info(`[Ricerca Banche Dati Ufficiali] Interrogazione proxy: ${proxyUrl}...`);
    const res = await fetch(proxyUrl);
    const contentType = res.headers.get('content-type') || '';

    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.found) {
        console.info('[Ricerca Banche Dati Ufficiali] Trovato con successo dal proxy server:', data.title, `(${data.source})`);

        const resolvedIsbn = data.isbn || (isIsbn ? clean : undefined);
        const candidates = (data.coverCandidates && Array.isArray(data.coverCandidates) && data.coverCandidates.length > 0)
          ? data.coverCandidates
          : (resolvedIsbn ? getRealCoverCandidates(resolvedIsbn, data.coverUrl) : []);

        return {
          found: true,
          isbn: resolvedIsbn,
          source: data.source || 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)',
          title: data.title,
          authors: data.authors || [],
          publisher: data.publisher,
          publicationYear: data.publicationYear,
          description: data.description,
          categories: data.categories,
          pageCount: data.pageCount,
          coverUrl: data.coverUrl || candidates[0]?.url,
          coverCandidates: candidates,
          genre: data.genre,
          ageGroup: data.ageGroup,
        };
      }
    } else {
      console.warn(`[Ricerca Banche Dati] Proxy status ${res.status}. Procedo con interrogazione diretta client alle banche dati REST.`);
    }
  } catch (proxyError: any) {
    console.warn('[Ricerca Banche Dati] Errore proxy server, procedo con chiamata diretta:', proxyError?.message || proxyError);
  }

  // TENTATIVO 2: Ricerca diretta sulle Banche Dati Ufficiali (OPAC SBN / BNI, Google Books, Open Library)
  console.info(`[Ricerca Banche Dati Ufficiali] Interrogazione diretta client alle banche dati per "${clean}"...`);
  try {
    const [opacRes, gbRes, olRes] = await Promise.allSettled([
      fetchFromOpacSbnDirect(clean, isIsbn),
      fetchFromGoogleBooksDirect(clean, isIsbn),
      fetchFromOpenLibraryDirect(clean, isIsbn),
    ]);

    const opacData = opacRes.status === 'fulfilled' ? opacRes.value : null;
    const gbData = gbRes.status === 'fulfilled' ? gbRes.value : null;
    const olData = olRes.status === 'fulfilled' ? olRes.value : null;

    // Priorità al catalogo nazionale italiano OPAC SBN / BNI, poi Google Books, poi Open Library
    const title = opacData?.title || gbData?.title || olData?.title;
    const authors =
      opacData?.authors && opacData.authors.length > 0
        ? opacData.authors
        : gbData?.authors && gbData.authors.length > 0
        ? gbData.authors
        : olData?.authors && olData.authors.length > 0
        ? olData.authors
        : [];
    const publisher = opacData?.publisher || gbData?.publisher || olData?.publisher;
    const publicationYear = opacData?.publicationYear || gbData?.publicationYear || olData?.publicationYear;
    const description = gbData?.description || olData?.description;
    const categories = gbData?.categories || olData?.categories || [];
    const pageCount = gbData?.pageCount || olData?.pageCount;
    const foundIsbn = opacData?.isbn || gbData?.isbn || olData?.isbn || (isIsbn ? clean : undefined);
    const coverUrl = gbData?.coverUrl || olData?.coverUrl || opacData?.coverUrl;

    if (title || authors.length > 0) {
      const source = opacData?.title
        ? 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)'
        : gbData?.title
        ? 'Google Books (Banca Dati Bibliotecaria)'
        : 'Open Library (Banca Dati Bibliotecaria)';

      const coverCandidates = foundIsbn ? getRealCoverCandidates(foundIsbn, coverUrl) : [];
      const resolvedCover = coverUrl || coverCandidates[0]?.url;

      console.info(`[Ricerca Banche Dati Ufficiali] Trovato: "${title}" (${source})`);
      return {
        found: true,
        isbn: foundIsbn,
        source,
        title,
        authors,
        publisher,
        publicationYear,
        description,
        categories,
        pageCount,
        coverUrl: resolvedCover,
        coverCandidates,
      };
    }
  } catch (dbError: any) {
    console.error('[Ricerca Banche Dati Ufficiali] Errore:', dbError);
  }

  // TENTATIVO 3: Nessun risultato nelle banche dati ufficiali -> Ritorna messaggio esatto SENZA AI
  console.info(`[Ricerca Banche Dati Ufficiali] Nessun risultato per "${clean}".`);
  return {
    found: false,
    isbn: isIsbn ? clean : undefined,
    source: 'Nessuna banca dati ufficiale',
    message: 'Nessun risultato trovato nelle banche dati ufficiali',
  };
}

/**
 * Standard search by ISBN (alias wrapper for searchBookOnline)
 */
export async function searchBookByIsbn(
  rawIsbn: string,
  settings?: {
    isbndbApiKey?: string;
    worldcatWskey?: string;
    librarythingDevKey?: string;
    schoolName?: string;
  }
): Promise<BookLookupResult> {
  return searchBookOnline(rawIsbn, settings);
}

/**
 * Read Gemini API Key for Vision OCR or Catalog Assistant only
 */
export function getGeminiApiKey(): string {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_GEMINI_API_KEY) {
        const key = String(import.meta.env.VITE_GEMINI_API_KEY).trim();
        if (key && key !== 'undefined' && key !== 'null') return key;
      }
      if (import.meta.env.GEMINI_API_KEY) {
        const key = String(import.meta.env.GEMINI_API_KEY).trim();
        if (key && key !== 'undefined' && key !== 'null') return key;
      }
    }
  } catch (e) {
    console.warn('[Config] Errore lettura import.meta.env:', e);
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) {
        const key = String(process.env.VITE_GEMINI_API_KEY).trim();
        if (key && key !== 'undefined' && key !== 'null') return key;
      }
      if (process.env.GEMINI_API_KEY) {
        const key = String(process.env.GEMINI_API_KEY).trim();
        if (key && key !== 'undefined' && key !== 'null') return key;
      }
    }
  } catch (e) {
    console.warn('[Config] Errore lettura process.env:', e);
  }

  return '';
}

/**
 * Direct Gemini OCR for book title page / cover (works on Vercel without proxy)
 */
export async function ocrBookImage(
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<{ success: boolean; data?: any; error?: string }> {
  // 1. Try server proxy if available
  try {
    const res = await fetch('/api/gemini/ocr-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success) return json;
    }
  } catch (err: any) {
    console.warn('[OCR Book] Proxy non riuscito, tento chiamata diretta:', err?.message || err);
  }

  // 2. Direct Gemini Vision call with API key fallback
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: 'Chiave API Gemini non configurata (imposta VITE_GEMINI_API_KEY o GEMINI_API_KEY).',
    };
  }

  try {
    const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/i, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt = `Analizza questa immagine del frontespizio, copertina o retro di un libro scolastico.
Estrai con precisione in JSON:
{
  "title": "Titolo",
  "authors": ["Nome Cognome"],
  "publisher": "Editore",
  "publicationYear": "Anno",
  "isbn": "ISBN se visibile",
  "description": "Sinossi breve",
  "genre": "Genere (es. Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Giallo & Mistero, Fantasy & Fantascienza, Classici, Altro)",
  "ageGroup": "Fascia d'eta (es. Primaria 6-8 anni, Primaria 8-11 anni, Secondaria 11-14 anni, Giovani Adulti 14+)"
}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: cleanBase64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[OCR Book] Errore chiamata diretta Gemini Vision:', resp.status, errText);
      return { success: false, error: `Errore Gemini Vision: status ${resp.status}` };
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const parsed = JSON.parse(text);
      return { success: true, data: parsed };
    }
    return { success: false, error: 'Nessun testo estratto' };
  } catch (err: any) {
    console.error('[OCR Book] Errore dettagliato OCR Gemini:', {
      message: err?.message || String(err),
      error: err,
    });
    return { success: false, error: err?.message || 'Errore elaborazione OCR' };
  }
}

/**
 * Natural language semantic search in catalog with Gemini or smart local fallback
 */
export async function searchCatalogAi(
  userQuery: string,
  catalog: Book[]
): Promise<{ success: boolean; generalAdvice?: string; recommendations?: any[]; error?: string }> {
  if (!catalog || catalog.length === 0) {
    return {
      success: true,
      generalAdvice: 'Il catalogo della biblioteca è attualmente vuoto.',
      recommendations: [],
    };
  }

  // 1. Try proxy server /api/gemini/semantic-search
  try {
    const res = await fetch('/api/gemini/semantic-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userQuery, catalog }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) return data;
    }
  } catch (err: any) {
    console.warn('[AI Search] Proxy /api/gemini/semantic-search fallito, tento fallback:', err?.message || err);
  }

  // 2. Direct Gemini call if key is present
  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const catalogSummary = catalog.slice(0, 100).map((b) => ({
        id: b.id,
        title: b.title,
        authors: b.authors || [],
        genre: b.genre,
        ageGroup: b.ageGroup,
        synopsis: b.synopsis || b.notes || '',
      }));

      const prompt = `Sei un bibliotecario scolastico. L'utente cerca: "${userQuery}".
Catalogo disponibile: ${JSON.stringify(catalogSummary)}

Rispondi esclusivamente in formato JSON:
{
  "generalAdvice": "Breve commento e consiglio pedagogico sul tema richiesto (2-3 frasi)",
  "recommendations": [
    {
      "bookId": "ID esatto del libro dal catalogo",
      "reason": "Perché questo libro è adatto alla richiesta (1-2 frasi)"
    }
  ]
}
Consiglia solo libri presenti nel catalogo. Se nessun libro è adatto, lascia recommendations vuoto.`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${encodeURIComponent(apiKey)}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          return {
            success: true,
            generalAdvice: parsed.generalAdvice,
            recommendations: parsed.recommendations || [],
          };
        }
      }
    } catch (directErr: any) {
      console.error('[AI Search] Errore dettagliato chiamata diretta Gemini:', directErr);
    }
  }

  // 3. Smart local keyword & semantic matching fallback (NEVER block the user!)
  console.info('[AI Search] Attivazione ricerca semantica locale su catalogo...');
  const tokens = userQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const scored = catalog.map((b) => {
    let score = 0;
    const fullText = `${b.title} ${b.authors.join(' ')} ${b.genre} ${b.ageGroup || ''} ${b.synopsis || ''} ${b.notes || ''}`.toLowerCase();
    for (const t of tokens) {
      if (b.title.toLowerCase().includes(t)) score += 5;
      if (b.genre.toLowerCase().includes(t)) score += 4;
      if (b.authors.some((a) => a.toLowerCase().includes(t))) score += 4;
      if (fullText.includes(t)) score += 2;
    }
    return { book: b, score };
  });

  const matches = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    success: true,
    generalAdvice:
      matches.length > 0
        ? `Ecco i volumi del catalogo scolastico più pertinenti al tema "${userQuery}".`
        : `Nessun libro del catalogo corrisponde direttamente a "${userQuery}". Puoi provare a cercare per genere, autore o parole chiave più ampie.`,
    recommendations: matches.map((m) => ({
      bookId: m.book.id,
      reason: `Corrispondenza tematica rilevata nel catalogo per genere "${m.book.genre}" o parole chiave collegate.`,
    })),
  };
}
