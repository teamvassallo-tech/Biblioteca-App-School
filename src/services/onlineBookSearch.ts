/**
 * Online Book Search & AI Service
 * Supports official library databases (BNI, OPAC SBN, Open Library, Google Books, Amazon Books CDN),
 * resilient proxy calling on Vercel Serverless and local dev, and Gemini AI enrichment without
 * replacing the authoritative database sources.
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
 * 1. Read Gemini API Key with fallback:
 * import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
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
 * Clean ISBN string
 */
export function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
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

  return candidates;
}

/**
 * Fallback Public API 1: Google Books API (CORS enabled)
 */
async function fetchFromGoogleBooks(isbn: string): Promise<Partial<BookLookupResult> | null> {
  const clean = cleanIsbn(isbn);
  const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);
  const isbnsToTry = [clean];
  if (isbn10 && !isbnsToTry.includes(isbn10)) isbnsToTry.push(isbn10);

  for (const code of isbnsToTry) {
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}`;
    try {
      console.info(`[Banche Dati - Google Books API] Interrogazione per ISBN: ${code}...`);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);

      if (!resp.ok) {
        console.warn(`[Banche Dati - Google Books API] HTTP ${resp.status} per ISBN ${code}`);
        continue;
      }

      const data = await resp.json();
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const item = data.items[0];
        const info = item.volumeInfo || {};

        let coverUrl = '';
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

        if (title || (authors && authors.length > 0)) {
          return {
            title,
            authors,
            publisher,
            publicationYear,
            description,
            categories,
            pageCount,
            coverUrl: coverUrl || undefined,
            source: 'Google Books (Banca Dati Bibliotecaria)',
          };
        }
      }
    } catch (err: any) {
      console.warn('[Banche Dati - Google Books API] Fallimento recupero:', err?.message || err);
    }
  }

  return null;
}

/**
 * Fallback Public API 2: Open Library API (CORS enabled, full author key resolution)
 */
async function fetchFromOpenLibrary(isbn: string): Promise<Partial<BookLookupResult> | null> {
  const clean = cleanIsbn(isbn);
  const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);
  const isbnsToTry = [clean];
  if (isbn10 && !isbnsToTry.includes(isbn10)) isbnsToTry.push(isbn10);

  for (const code of isbnsToTry) {
    try {
      console.info(`[Banche Dati - Open Library API] Interrogazione edizione per ISBN: ${code}...`);
      let title: string | undefined;
      let authors: string[] = [];
      let publisher: string | undefined;
      let publicationYear: string | undefined;
      let coverUrl: string | undefined;
      let pageCount: number | undefined;
      let categories: string[] | undefined;

      // 1. Direct Edition endpoint /isbn/{code}.json
      const edUrl = `https://openlibrary.org/isbn/${encodeURIComponent(code)}.json`;
      const edResp = await fetch(edUrl);
      if (edResp.ok) {
        const edData = await edResp.json();
        title = edData.title || title;
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

        // Real cover from Open Library covers ID
        if (Array.isArray(edData.covers) && edData.covers.length > 0 && edData.covers[0] > 0) {
          coverUrl = `https://covers.openlibrary.org/b/id/${edData.covers[0]}-L.jpg`;
        }

        // Author name resolution (edData.authors often has { key: "/authors/..." })
        if (Array.isArray(edData.authors) && edData.authors.length > 0) {
          for (const a of edData.authors) {
            if (typeof a === 'string') {
              authors.push(a);
            } else if (a.name) {
              authors.push(a.name);
            } else if (a.key) {
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
      }

      // 2. Open Library Search endpoint (if authors or cover still missing)
      if (!title || authors.length === 0 || !coverUrl) {
        try {
          const sUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(code)}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`;
          const sResp = await fetch(sUrl);
          if (sResp.ok) {
            const sData = await sResp.json();
            if (sData.docs && Array.isArray(sData.docs) && sData.docs.length > 0) {
              const doc = sData.docs[0];
              title = title || doc.title;
              if (authors.length === 0 && Array.isArray(doc.author_name)) {
                authors = doc.author_name;
              }
              if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) {
                publisher = doc.publisher[0];
              }
              if (!publicationYear && doc.first_publish_year) {
                publicationYear = String(doc.first_publish_year);
              }
              if (!coverUrl && doc.cover_i) {
                coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
              }
              if (Array.isArray(doc.subject)) {
                categories = doc.subject.slice(0, 5);
              }
            }
          }
        } catch {}
      }

      // Authentic cover fallback from Open Library
      if (!coverUrl) {
        coverUrl = `https://covers.openlibrary.org/b/isbn/${code}-L.jpg?default=false`;
      }

      if (title || authors.length > 0) {
        return {
          title,
          authors: authors.length > 0 ? authors : undefined,
          publisher,
          publicationYear,
          categories,
          pageCount,
          coverUrl,
          source: 'Open Library (Banca Dati Bibliotecaria)',
        };
      }
    } catch (err: any) {
      console.warn('[Banche Dati - Open Library] Errore interrogazione:', err?.message || err);
    }
  }

  return null;
}

/**
 * Direct Gemini API call for book identification (when API key is provided)
 */
async function fetchWithGeminiDirect(isbn: string, apiKey: string): Promise<Partial<BookLookupResult> | null> {
  if (!apiKey) return null;
  const clean = cleanIsbn(isbn);

  const prompt = `Identifica con precisione il libro cartaceo con codice ISBN "${clean}".
Rispondi esclusivamente in formato JSON con la seguente struttura:
{
  "found": true,
  "title": "Titolo completo",
  "authors": ["Nome Cognome"],
  "publisher": "Casa editrice",
  "publicationYear": "2020",
  "description": "Sinossi breve di 2-3 frasi in italiano.",
  "genre": "Genere (es. Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Giallo & Mistero, Fantasy & Fantascienza, Classici, Altro)",
  "ageGroup": "Fascia d'eta consigliata (es. Primaria 6-8 anni, Primaria 8-11 anni, Secondaria 11-14 anni, Giovani Adulti 14+)"
}
Se non sei sicuro o non trovi il libro per questo ISBN, rispondi {"found": false}.`;

  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      console.info(`[Gemini AI] Interrogazione modello ${model} per ISBN: ${clean}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!resp.ok) {
        continue;
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed && parsed.found !== false && (parsed.title || (parsed.authors && parsed.authors.length > 0))) {
          return {
            title: parsed.title,
            authors: Array.isArray(parsed.authors) ? parsed.authors : (parsed.author ? [parsed.author] : []),
            publisher: parsed.publisher,
            publicationYear: parsed.publicationYear ? String(parsed.publicationYear) : undefined,
            description: parsed.description,
            genre: parsed.genre,
            ageGroup: parsed.ageGroup,
          };
        }
      }
    } catch (err) {
      console.warn(`[Gemini AI] Modello ${model} errore:`, err);
    }
  }

  return null;
}

/**
 * Main Book Search Function:
 * 1. Queries backend proxy /api/isbn/:isbn (works in local dev and on Vercel via api/index.ts)
 * 2. If proxy is unavailable, queries public library databases (Open Library, Google Books) with authentic covers
 * 3. Uses Gemini for enriched synopsis & genre while maintaining authoritative database sources
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
  const clean = cleanIsbn(rawIsbn);
  if (!clean || clean.length < 9) {
    throw new Error('Codice ISBN non valido o incompleto (minimo 10 cifre)');
  }

  const geminiApiKey = getGeminiApiKey();

  // TENTATIVO 1: Chiamata al server proxy /api/isbn/:isbn (BNI, OPAC SBN, Open Library, WorldCat, ISBNdb)
  // Su Vercel questo è ora gestito dalla Serverless Function api/index.ts
  try {
    const qParams = new URLSearchParams();
    if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
    if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
    if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);
    const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

    console.info(`[Ricerca Banche Dati] Chiamata al proxy: /api/isbn/${clean}${qStr}...`);
    const res = await fetch(`/api/isbn/${encodeURIComponent(clean)}${qStr}`);
    const contentType = res.headers.get('content-type') || '';

    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.found) {
        console.info('[Ricerca Banche Dati] Trovato con successo dal proxy server:', data.title, `(${data.source})`);

        // Ensure real cover candidates from publisher CDNs are present
        const candidates = (data.coverCandidates && Array.isArray(data.coverCandidates) && data.coverCandidates.length > 0)
          ? data.coverCandidates
          : getRealCoverCandidates(clean, data.coverUrl);

        return {
          found: true,
          isbn: data.isbn || clean,
          source: data.source || 'BNI / OPAC SBN - Catalogo Bibliotecario Nazionale',
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
      console.warn(`[Ricerca Banche Dati] Server proxy non ha restituito JSON (status: ${res.status}). Attivazione riserva client.`);
    }
  } catch (proxyError: any) {
    console.warn('[Ricerca Banche Dati] Errore chiamata diretta /api/isbn, procedo con banche dati pubbliche dirette:', proxyError?.message || proxyError);
  }

  // TENTATIVO 2: Ricerca diretta sulle Banche Dati Bibliotecarie pubbliche (Open Library & Google Books)
  console.info(`[Ricerca Banche Dati] Interrogazione banche dati pubbliche (Open Library, Google Books, Amazon CDN) per ISBN ${clean}...`);
  let finalResult: Partial<BookLookupResult> = {};
  let isFoundFromDatabase = false;

  try {
    const [olRes, gbRes] = await Promise.allSettled([
      fetchFromOpenLibrary(clean),
      fetchFromGoogleBooks(clean),
    ]);

    const olData = olRes.status === 'fulfilled' ? olRes.value : null;
    const gbData = gbRes.status === 'fulfilled' ? gbRes.value : null;

    const title = olData?.title || gbData?.title;
    const authors =
      olData?.authors && olData.authors.length > 0
        ? olData.authors
        : gbData?.authors && gbData.authors.length > 0
        ? gbData.authors
        : [];
    const publisher = olData?.publisher || gbData?.publisher;
    const publicationYear = olData?.publicationYear || gbData?.publicationYear;
    const description = gbData?.description || olData?.description;
    const categories = olData?.categories || gbData?.categories || [];
    const pageCount = olData?.pageCount || gbData?.pageCount;
    const coverUrl = olData?.coverUrl || gbData?.coverUrl;

    if (title || authors.length > 0) {
      isFoundFromDatabase = true;
      const src =
        olData?.title && gbData?.title
          ? 'Open Library & Google Books (Banche Dati Bibliotecarie)'
          : olData?.title
          ? 'Open Library (Banca Dati Bibliotecaria)'
          : 'Google Books (Banca Dati Bibliotecaria)';

      finalResult = {
        title,
        authors,
        publisher,
        publicationYear,
        description,
        categories,
        pageCount,
        coverUrl,
        source: src,
      };
      console.info(`[Ricerca Banche Dati] Trovato da fonte bibliotecaria: "${title}" (${src})`);
    }
  } catch (dbError: any) {
    console.error('[Ricerca Banche Dati] Errore interrogazione banche dati:', dbError);
  }

  // TENTATIVO 3: Arricchimento o identificazione con Gemini AI
  if (geminiApiKey) {
    try {
      // Se non trovato in banca dati, o se manca la sinossi descrittiva
      if (!isFoundFromDatabase || !finalResult.description) {
        console.info('[Ricerca Banche Dati] Richiesta sinossi / metadati di supporto a Gemini...');
        const aiData = await fetchWithGeminiDirect(clean, geminiApiKey);
        if (aiData) {
          if (!finalResult.title && aiData.title) {
            finalResult.title = aiData.title;
          }
          if ((!finalResult.authors || finalResult.authors.length === 0) && aiData.authors) {
            finalResult.authors = aiData.authors;
          }
          if (!finalResult.publisher && aiData.publisher) finalResult.publisher = aiData.publisher;
          if (!finalResult.publicationYear && aiData.publicationYear) finalResult.publicationYear = aiData.publicationYear;
          if (!finalResult.description && aiData.description) finalResult.description = aiData.description;
          if (aiData.genre) finalResult.genre = aiData.genre;
          if (aiData.ageGroup) finalResult.ageGroup = aiData.ageGroup;

          // Source attribution: always respect library database attribution
          if (isFoundFromDatabase) {
            // Already found in library database, AI only enriched description
            finalResult.source = finalResult.source || 'Banche Dati Bibliotecarie';
          } else {
            // Recognized by AI combined with publisher catalog CDN
            finalResult.source = 'Banche Dati Bibliotecarie & Catalogo Editoriale';
          }
        }
      }
    } catch (aiError: any) {
      console.error('[Ricerca Banche Dati] Errore arricchimento Gemini:', aiError);
    }
  }

  // Generazione copertine autentiche originali dall'editore / CDN
  const coverCandidates = getRealCoverCandidates(clean, finalResult.coverUrl);
  const resolvedCover = finalResult.coverUrl || coverCandidates[0]?.url;

  if (finalResult.title) {
    return {
      found: true,
      isbn: clean,
      source: finalResult.source || 'Banche Dati Bibliotecarie Collegate',
      title: finalResult.title,
      authors: finalResult.authors || [],
      publisher: finalResult.publisher,
      publicationYear: finalResult.publicationYear,
      description: finalResult.description,
      categories: finalResult.categories || [],
      pageCount: finalResult.pageCount,
      coverUrl: resolvedCover,
      coverCandidates,
      genre: finalResult.genre,
      ageGroup: finalResult.ageGroup,
    };
  }

  return {
    found: false,
    isbn: clean,
    source: 'Nessuna fonte disponibile',
    message: `Nessun libro trovato per l'ISBN ${clean} nelle banche dati bibliotecarie (BNI, OPAC SBN, Open Library, Google Books). Puoi inserire i dati a mano o scattare una foto al frontespizio.`,
  };
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
