/**
 * Online Book Search & AI Service
 * Supports direct proxy calls, Gemini API fallback with multi-env key reading,
 * and public fallback APIs (Google Books API, Open Library) to ensure the user is never blocked.
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
 * Fallback Public API 1: Google Books API (CORS enabled, no API key strictly required)
 */
async function fetchFromGoogleBooks(isbn: string): Promise<Partial<BookLookupResult> | null> {
  const clean = cleanIsbn(isbn);
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}`;

  try {
    console.info(`[Ricerca Riserva - Google Books API] Chiamata a: ${url}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) {
      throw new Error(`Google Books HTTP ${resp.status}: ${resp.statusText}`);
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
          source: 'Google Books API (Riserva Pubblica)',
        };
      }
    }
    return null;
  } catch (err: any) {
    console.warn('[Ricerca Riserva - Google Books API] Fallimento recupero:', {
      isbn: clean,
      errorMessage: err?.message || String(err),
      error: err,
    });
    return null;
  }
}

/**
 * Fallback Public API 2: Open Library API (CORS enabled, no API key required)
 */
async function fetchFromOpenLibrary(isbn: string): Promise<Partial<BookLookupResult> | null> {
  const clean = cleanIsbn(isbn);
  try {
    console.info(`[Ricerca Riserva - Open Library API] Chiamata per ISBN: ${clean}`);

    let title: string | undefined;
    let authors: string[] | undefined;
    let publisher: string | undefined;
    let publicationYear: string | undefined;
    let coverUrl: string | undefined;
    let pageCount: number | undefined;
    let categories: string[] | undefined;

    // 1. Direct Edition endpoint /isbn/{clean}.json
    try {
      const edUrl = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
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
        if (Array.isArray(edData.covers) && edData.covers.length > 0 && edData.covers[0] > 0) {
          coverUrl = `https://covers.openlibrary.org/b/id/${edData.covers[0]}-L.jpg`;
        }
      }
    } catch (edErr) {
      console.warn('[Ricerca Riserva - Open Library Edizione] Parziale:', edErr);
    }

    // 2. Open Library Search endpoint (ideal for author names and subjects)
    if (!title || !authors || !coverUrl) {
      try {
        const sUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(clean)}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`;
        const sResp = await fetch(sUrl);
        if (sResp.ok) {
          const sData = await sResp.json();
          if (sData.docs && Array.isArray(sData.docs) && sData.docs.length > 0) {
            const doc = sData.docs[0];
            title = title || doc.title;
            if (!authors && Array.isArray(doc.author_name)) {
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
      } catch (sErr) {
        console.warn('[Ricerca Riserva - Open Library Search] Parziale:', sErr);
      }
    }

    // Fallback direct ISBN cover
    if (!coverUrl) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`;
    }

    if (title || (authors && authors.length > 0)) {
      return {
        title,
        authors,
        publisher,
        publicationYear,
        description: undefined,
        categories,
        pageCount,
        coverUrl,
        source: 'Open Library (Riserva Pubblica)',
      };
    }

    return null;
  } catch (err: any) {
    console.warn('[Ricerca Riserva - Open Library] Fallimento recupero:', {
      isbn: clean,
      errorMessage: err?.message || String(err),
      error: err,
    });
    return null;
  }
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

  // Resilient models list (aligned with gemini-api skill)
  const models = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

  for (const model of models) {
    try {
      console.info(`[Ricerca Gemini AI] Interrogazione modello ${model} per ISBN: ${clean}...`);
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
        const errBody = await resp.text();
        console.warn(`[Ricerca Gemini AI] Modello ${model} ha risposto con status ${resp.status}:`, errBody);
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
            source: 'Gemini AI (Ricerca Diretta)',
          };
        }
      }
    } catch (err) {
      console.warn(`[Ricerca Gemini AI] Modello ${model} errore:`, err);
    }
  }

  return null;
}

/**
 * Main Book Search Function:
 * 1. Reads API key from import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
 * 2. Adds try/catch with detailed error logging in console
 * 3. Falls back seamlessly to Google Books API & Open Library API so the user is NEVER blocked
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

  // 1. Legge la chiave API con fallback corretto
  const geminiApiKey = getGeminiApiKey();
  if (geminiApiKey) {
    console.info(`[Ricerca Online] Chiave API Gemini rilevata (${geminiApiKey.substring(0, 6)}...); abilitati arricchimento e ricerca AI.`);
  } else {
    console.info('[Ricerca Online] Nessuna chiave Gemini in import.meta.env.VITE_GEMINI_API_KEY o process.env.GEMINI_API_KEY. Ricerca attiva tramite banche dati pubbliche.');
  }

  let finalResult: Partial<BookLookupResult> = {};
  let isFound = false;

  // TENTATIVO 1: Chiamata al proxy locale /api/isbn/:isbn (se attivo in ambiente server o dev)
  try {
    const qParams = new URLSearchParams();
    if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
    if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
    if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);
    const qStr = qParams.toString() ? `?${qParams.toString()}` : '';

    console.info(`[Ricerca Online] Tentativo chiamata server proxy: /api/isbn/${clean}${qStr}...`);
    const res = await fetch(`/api/isbn/${encodeURIComponent(clean)}${qStr}`);
    const contentType = res.headers.get('content-type') || '';

    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data && data.found) {
        console.info('[Ricerca Online] Trovato con successo dal proxy server:', data.title, `(${data.source})`);
        return {
          found: true,
          isbn: data.isbn || clean,
          source: data.source || 'Banche Dati Bibliotecarie',
          title: data.title,
          authors: data.authors || [],
          publisher: data.publisher,
          publicationYear: data.publicationYear,
          description: data.description,
          categories: data.categories,
          pageCount: data.pageCount,
          coverUrl: data.coverUrl,
          coverCandidates: data.coverCandidates,
          genre: data.genre,
          ageGroup: data.ageGroup,
        };
      }
    } else {
      console.warn(`[Ricerca Online] Proxy server non disponibile o non JSON (status: ${res.status}, content-type: ${contentType}). Passaggio a modalità client resiliente.`);
    }
  } catch (proxyError: any) {
    // 2. Blocco try/catch con messaggio di errore dettagliato visibile in console
    console.error('[Ricerca Online] ERRORE DETTAGLIATO CHIAMATA DIRETTA /api/isbn:', {
      endpoint: `/api/isbn/${clean}`,
      message: proxyError?.message || String(proxyError),
      stack: proxyError?.stack,
      name: proxyError?.name,
      note: 'Possibile deployment serverless/statico (es. Vercel) senza proxy Express attivo. Procedo automaticamente con API pubbliche di riserva.',
    });
  }

  // TENTATIVO 2 (RISERVA PUBBLICA): 3. Se la chiamata diretta fallisce, utilizza Google Books e Open Library
  console.info(`[Ricerca Online] Avvio interrogazione API pubbliche di riserva (Google Books & Open Library) per ISBN ${clean}...`);
  try {
    const [gbRes, olRes] = await Promise.allSettled([
      fetchFromGoogleBooks(clean),
      fetchFromOpenLibrary(clean),
    ]);

    const gbData = gbRes.status === 'fulfilled' ? gbRes.value : null;
    const olData = olRes.status === 'fulfilled' ? olRes.value : null;

    if (gbRes.status === 'rejected') {
      console.error('[Ricerca Online] Dettaglio errore riserva Google Books:', gbRes.reason);
    }
    if (olRes.status === 'rejected') {
      console.error('[Ricerca Online] Dettaglio errore riserva Open Library:', olRes.reason);
    }

    const title = gbData?.title || olData?.title;
    const authors =
      gbData?.authors && gbData.authors.length > 0
        ? gbData.authors
        : olData?.authors && olData.authors.length > 0
        ? olData.authors
        : [];
    const publisher = gbData?.publisher || olData?.publisher;
    const publicationYear = gbData?.publicationYear || olData?.publicationYear;
    const description = gbData?.description || olData?.description;
    const categories = gbData?.categories || olData?.categories || [];
    const pageCount = gbData?.pageCount || olData?.pageCount;
    const coverUrl = gbData?.coverUrl || olData?.coverUrl;

    if (title || authors.length > 0) {
      isFound = true;
      const src =
        gbData?.title && olData?.title
          ? 'Google Books & Open Library'
          : gbData?.title
          ? 'Google Books API (Riserva)'
          : 'Open Library (Riserva)';

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
      console.info(`[Ricerca Online] Trovato su riserva pubblica: "${title}" (${src})`);
    }
  } catch (publicError: any) {
    console.error('[Ricerca Online] ERRORE DETTAGLIATO INTERROGAZIONE BANCHE PUBBLICHE:', {
      message: publicError?.message || String(publicError),
      stack: publicError?.stack,
      error: publicError,
    });
  }

  // TENTATIVO 3: Se ancora non trovato O se manca la descrizione, e abbiamo la chiave Gemini, usiamo Gemini AI
  if ((!isFound || !finalResult.description) && geminiApiKey) {
    try {
      console.info(`[Ricerca Online] Tentativo con Gemini AI (chiave VITE_GEMINI_API_KEY o GEMINI_API_KEY attiva)...`);
      const aiData = await fetchWithGeminiDirect(clean, geminiApiKey);
      if (aiData) {
        if (!finalResult.title && aiData.title) {
          finalResult.title = aiData.title;
          isFound = true;
        }
        if ((!finalResult.authors || finalResult.authors.length === 0) && aiData.authors) {
          finalResult.authors = aiData.authors;
          isFound = true;
        }
        if (!finalResult.publisher && aiData.publisher) finalResult.publisher = aiData.publisher;
        if (!finalResult.publicationYear && aiData.publicationYear) finalResult.publicationYear = aiData.publicationYear;
        if (!finalResult.description && aiData.description) finalResult.description = aiData.description;
        if (aiData.genre) finalResult.genre = aiData.genre;
        if (aiData.ageGroup) finalResult.ageGroup = aiData.ageGroup;

        finalResult.source = finalResult.source
          ? `${finalResult.source} + Gemini AI`
          : 'Gemini AI (Ricerca Diretta)';
        console.info(`[Ricerca Online] Dati arricchiti con Gemini AI!`);
      }
    } catch (aiError: any) {
      console.error('[Ricerca Online] ERRORE DETTAGLIATO GEMINI DIRECT CALL:', {
        message: aiError?.message || String(aiError),
        error: aiError,
      });
    }
  }

  // Candidate cover URLs
  const coverCandidates: Array<{ source: string; url: string }> = [];
  if (finalResult.coverUrl) {
    coverCandidates.push({ source: 'Copertina Principale', url: finalResult.coverUrl });
  }
  coverCandidates.push({
    source: 'Open Library (Alta Risoluzione)',
    url: `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
  });
  coverCandidates.push({
    source: 'Open Library (Media Risoluzione)',
    url: `https://covers.openlibrary.org/b/isbn/${clean}-M.jpg?default=false`,
  });

  if (isFound && finalResult.title) {
    return {
      found: true,
      isbn: clean,
      source: finalResult.source || 'Banche Dati Pubbliche',
      title: finalResult.title,
      authors: finalResult.authors || [],
      publisher: finalResult.publisher,
      publicationYear: finalResult.publicationYear,
      description: finalResult.description,
      categories: finalResult.categories || [],
      pageCount: finalResult.pageCount,
      coverUrl: finalResult.coverUrl,
      coverCandidates,
      genre: finalResult.genre,
      ageGroup: finalResult.ageGroup,
    };
  }

  return {
    found: false,
    isbn: clean,
    source: 'Nessuna fonte',
    message: `Nessun libro trovato per il codice ISBN ${clean} su Google Books, Open Library o Gemini. Puoi inserire i dati manualmente o scattare una foto al frontespizio.`,
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
    console.warn('[OCR Book] Proxy /api/gemini/ocr-book non riuscito, tento chiamata diretta:', err?.message || err);
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
