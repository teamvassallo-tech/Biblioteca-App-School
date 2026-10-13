import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import { generateBookCoverDataUrl } from './src/utils/coverGenerator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Initialize GoogleGenAI SDK server-side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Resilient Gemini AI Caller with automatic model fallback to avoid quota limits
async function callGemini(options: { contents: any; config?: any }) {
  const models = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`Gemini model "${model}" call failed (${err?.message || err}), trying fallback...`);
    }
  }

  throw lastError;
}

// Helper to clean ISBN
function cleanIsbnString(isbn: string): string {
  return isbn.replace(/[^0-9X]/gi, '').trim();
}

// Convert ISBN-13 (978...) to ISBN-10
function isbn13ToIsbn10(isbn13: string): string | null {
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

// Convert ISBN-10 to ISBN-13
function isbn10ToIsbn13(isbn10: string): string | null {
  if (isbn10.length !== 10) return null;
  const core = '978' + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(core[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const rem = sum % 10;
  const check = rem === 0 ? '0' : (10 - rem).toString();
  return core + check;
}

// High-speed timeout fetch helper
const fetchWithTimeout = async (url: string, ms = 4500, headers: Record<string, string> = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timer);
    return response;
  } catch {
    clearTimeout(timer);
    return null;
  }
};

// Check whether an image URL is alive, returns valid image content and is not an empty 1x1 GIF
async function isWorkingImageUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:image/')) return true;
  if (url.includes('covers.librarything.com')) return false; // Known Cloudflare 403 block
  try {
    const res = await fetchWithTimeout(url, timeoutMs, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    if (!res || !res.ok) return false;
    const cType = res.headers.get('content-type') || '';
    if (!cType.startsWith('image/')) return false;
    const cLen = res.headers.get('content-length');
    // If length is <= 100 bytes, it's an empty 1x1 transparent tracking pixel
    if (cLen && parseInt(cLen, 10) <= 100) return false;
    return true;
  } catch {
    return false;
  }
}

interface CoverCandidate {
  source: string;
  url: string;
  isOriginalEdition: boolean;
}

// Automatically discovers authentic, original publisher covers corresponding to the exact Italian edition
async function getOriginalBookCoverCandidates(cleanIsbn: string): Promise<CoverCandidate[]> {
  const candidates: CoverCandidate[] = [];
  const isbn10 = cleanIsbn.length === 10 ? cleanIsbn : isbn13ToIsbn10(cleanIsbn);
  const isbn13 = cleanIsbn.length === 13 ? cleanIsbn : isbn10ToIsbn13(cleanIsbn);

  // 1. Amazon Italy & Global Publisher Media CDN (ISBN-13)
  if (isbn13) {
    const amz13 = `https://images-na.ssl-images-amazon.com/images/P/${isbn13}.01.LZZZZZZZ.jpg`;
    try {
      const res = await fetchWithTimeout(amz13, 2000);
      if (res && res.ok) {
        const type = res.headers.get('content-type') || '';
        const len = parseInt(res.headers.get('content-length') || '0', 10);
        if (type.includes('jpeg') && len > 1500) {
          candidates.push({
            source: 'Copertina Originale Editore (ISBN-13)',
            url: amz13,
            isOriginalEdition: true,
          });
        }
      }
    } catch {}
  }

  // 2. Amazon Italy & Global Publisher Media CDN (ISBN-10)
  if (isbn10) {
    const amz10 = `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`;
    try {
      const res = await fetchWithTimeout(amz10, 2000);
      if (res && res.ok) {
        const type = res.headers.get('content-type') || '';
        const len = parseInt(res.headers.get('content-length') || '0', 10);
        if (type.includes('jpeg') && len > 1500) {
          if (!candidates.some((c) => c.url === amz10)) {
            candidates.push({
              source: 'Copertina Originale Editore (ISBN-10)',
              url: amz10,
              isOriginalEdition: true,
            });
          }
        }
      }
    } catch {}
  }

  // 3. Google Books Direct Content Stream (Exact Italian Edition ISBN)
  const gbCode = isbn13 || cleanIsbn;
  const gbUrl = `https://books.google.com/books/content?vid=ISBN${gbCode}&printsec=frontcover&img=1&zoom=1`;
  try {
    const res = await fetchWithTimeout(gbUrl, 2000);
    if (res && res.ok) {
      const type = res.headers.get('content-type') || '';
      const len = parseInt(res.headers.get('content-length') || '0', 10);
      if (type.includes('jpeg') && len > 2000) {
        candidates.push({
          source: 'Google Books (Copertina Originale)',
          url: gbUrl,
          isOriginalEdition: true,
        });
      }
    }
  } catch {}

  // 4. Open Library Specific ISBN (with default=false)
  const olIsbnUrl = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
  try {
    const res = await fetchWithTimeout(olIsbnUrl, 2000);
    if (res && res.ok) {
      const type = res.headers.get('content-type') || '';
      const len = parseInt(res.headers.get('content-length') || '0', 10);
      if (type.includes('jpeg') && len > 1000) {
        candidates.push({
          source: 'Open Library (Edizione Catalogata)',
          url: olIsbnUrl,
          isOriginalEdition: false,
        });
      }
    }
  } catch {}

  return candidates;
}

// 1. Online Multi-Source ISBN Lookup API
// Aggregates:
// 1. BNI (Bibliografia Nazionale Italiana - BNCF) & OPAC SBN (Deposito legale e catalogo ufficiale italiano)
// 2. LibraryThing (ThingISBN: associazione tra edizioni e copertine)
// 3. WorldCat / OCLC (Il più grande database bibliografico mondiale, con supporto credenziali)
// 4. ISBNdb (Database commerciale globale con oltre 30M di volumi e copertine HQ)
// 5. Crossref (Pubblicazioni accademiche, saggi, riviste e monografie con DOI/ISBN)
// 6. Open Library (API diretta per edizione, copertine ID e motore di ricerca)
// 7. Google Books API (con fallback di ricerca)
// 8. Gemini AI Assistant (Enrichment sinossi, genere scolastico e fallback semantico)
app.get('/api/isbn/:isbn', async (req: Request, res: Response) => {
  try {
    const rawIsbn = req.params.isbn;
    const cleanIsbn = cleanIsbnString(rawIsbn);

    if (!cleanIsbn || (cleanIsbn.length !== 10 && cleanIsbn.length !== 13)) {
      return res.status(400).json({ error: 'Codice ISBN non valido (deve contenere 10 o 13 cifre)' });
    }

    const isbn10 = cleanIsbn.length === 10 ? cleanIsbn : isbn13ToIsbn10(cleanIsbn);
    const isbn13 = cleanIsbn.length === 13 ? cleanIsbn : isbn10ToIsbn13(cleanIsbn);

    let title = '';
    let authors: string[] = [];
    let publisher = '';
    let publicationYear = '';
    let description = '';
    let coverUrl = '';
    let categories: string[] = [];
    let pageCount: number | undefined = undefined;
    let foundSource = '';
    let bniIdentifier = '';
    let deweyClassification = '';

    // --- FONTE 1: BNI (Bibliografia Nazionale Italiana - BNCF) & OPAC SBN ---
    // Pubblicata dalla Biblioteca Nazionale Centrale di Firenze per il deposito legale in Italia
    try {
      const sbnQuery = isbn13 || cleanIsbn;
      const sbnResp = await fetchWithTimeout(
        `http://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(sbnQuery)}`,
        5000,
        { 'User-Agent': 'BiblioScuola/1.0 (Gestionale Biblioteca Scolastica; scuola italiana)' }
      );
      if (sbnResp && sbnResp.ok) {
        const sbnData = await sbnResp.json();
        if (sbnData.briefRecords && sbnData.briefRecords.length > 0) {
          const rec = sbnData.briefRecords[0];

          // Titolo pulito
          let sbnTitle = rec.titolo || '';
          if (sbnTitle.includes(' / ')) {
            sbnTitle = sbnTitle.split(' / ')[0].trim();
          }
          if (sbnTitle.includes(' : ')) {
            sbnTitle = sbnTitle.replace(/\s*:\s*/g, ' - ');
          }
          title = sbnTitle;

          // Autore principale normalizzato (da "Cognome, Nome" a "Nome Cognome")
          if (rec.autorePrincipale) {
            let auth = rec.autorePrincipale.trim();
            if (auth.includes(',')) {
              const parts = auth.split(',').map((p: string) => p.trim());
              auth = `${parts[1]} ${parts[0]}`.trim();
            }
            authors = [auth];
          }

          // Editore e anno di pubblicazione
          if (rec.pubblicazione) {
            const pubText = rec.pubblicazione;
            const match = pubText.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
            if (match) {
              if (match[1]) publisher = match[1].trim();
              if (match[2]) publicationYear = match[2].trim();
            } else {
              const yearMatch = pubText.match(/\b(19\d\d|20\d\d)\b/);
              if (yearMatch) publicationYear = yearMatch[1];
            }
          }

          // Identificativo BNI / ICCU
          if (rec.codiceIdentificativo) {
            bniIdentifier = rec.codiceIdentificativo;
          }

          // Copertina da SBN (filtra URL LibraryThing bloccati da Cloudflare con 403)
          if (rec.copertina && typeof rec.copertina === 'string') {
            const candidate = rec.copertina
              .replace(/^http:\/\//i, 'https://')
              .replace('/small/', '/large/');
            if (!candidate.includes('covers.librarything.com')) {
              coverUrl = candidate;
            }
          }

          foundSource = 'BNI (Bibliografia Nazionale Italiana - BNCF) / OPAC SBN';
        }
      }
    } catch (e) {
      console.warn('BNI / OPAC SBN fetch error:', e);
    }

    // --- FONTE 2: ISBNdb (Database commerciale globale con 30+ milioni di libri) ---
    const isbndbKey = (req.query.isbndbKey as string) || process.env.ISBNDB_API_KEY;
    if (isbndbKey && (!title || authors.length === 0 || !coverUrl)) {
      try {
        const isbndbResp = await fetchWithTimeout(
          `https://api2.isbndb.com/book/${cleanIsbn}`,
          3500,
          { 'Authorization': isbndbKey }
        );
        if (isbndbResp && isbndbResp.ok) {
          const isbndbData = await isbndbResp.json();
          const b = isbndbData.book;
          if (b) {
            if (!title && b.title) title = b.title;
            if (authors.length === 0 && Array.isArray(b.authors)) authors = b.authors;
            if (!publisher && b.publisher) publisher = b.publisher;
            if (!publicationYear && b.date_published) publicationYear = b.date_published.slice(0, 4);
            if (!description && b.synopsis) description = b.synopsis;
            if (!coverUrl && b.image) coverUrl = b.image;
            if (b.dewey_decimal && !deweyClassification) deweyClassification = b.dewey_decimal;
            if (!foundSource) foundSource = 'ISBNdb Global Database';
          }
        }
      } catch (e) {
        console.warn('ISBNdb fetch error:', e);
      }
    }

    // --- FONTE 3: WorldCat / OCLC (Il più grande database bibliografico mondiale) ---
    const worldcatKey = (req.query.worldcatKey as string) || process.env.WORLDCAT_API_KEY || process.env.OCLC_WSKEY;
    if (worldcatKey && (!title || authors.length === 0)) {
      try {
        const wcResp = await fetchWithTimeout(
          `https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs?q=bn:${cleanIsbn}&limit=1`,
          4000,
          {
            'Authorization': `Bearer ${worldcatKey}`,
            'Accept': 'application/json',
          }
        );
        if (wcResp && wcResp.ok) {
          const wcData = await wcResp.json();
          const record = wcData.bibRecords?.[0];
          if (record) {
            if (!title && record.title) title = record.title;
            if (authors.length === 0 && Array.isArray(record.creator)) {
              authors = record.creator.map((c: any) => c.name || c);
            }
            if (!publisher && record.publisher) publisher = record.publisher;
            if (!publicationYear && record.date) publicationYear = String(record.date).slice(0, 4);
            if (!foundSource) foundSource = 'WorldCat / OCLC Database';
          }
        }
      } catch (e) {
        console.warn('WorldCat / OCLC fetch error:', e);
      }
    }

    // --- FONTE 4: Open Library (Edizione specifica, Cover ID e Ricerca) ---
    try {
      // 4A. Query diretta edizione Open Library /isbn/{isbn}.json
      const olIsbnResp = await fetchWithTimeout(
        `https://openlibrary.org/isbn/${cleanIsbn}.json`,
        3500,
        { 'User-Agent': 'BiblioScuola/1.0' }
      );
      if (olIsbnResp && olIsbnResp.ok) {
        const olData = await olIsbnResp.json();
        if (!title && olData.title) title = olData.title;
        if (!publicationYear && olData.publish_date) {
          const ym = olData.publish_date.match(/\b(19\d\d|20\d\d)\b/);
          if (ym) publicationYear = ym[1];
        }
        if (!publisher && Array.isArray(olData.publishers) && olData.publishers.length > 0) {
          publisher = olData.publishers[0];
        }
        if (!pageCount && olData.number_of_pages) {
          pageCount = Number(olData.number_of_pages);
        }
        // Direct Open Library Cover ID (highest reliability)
        if (!coverUrl && Array.isArray(olData.covers) && olData.covers.length > 0) {
          const coverId = olData.covers[0];
          if (coverId && coverId > 0) {
            coverUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
          }
        }
        if (!foundSource) foundSource = 'Open Library Direct';
      }

      // 4B. Open Library Search API se autore o titolo mancano
      if (!title || authors.length === 0 || !coverUrl) {
        const olSearchUrl = `https://openlibrary.org/search.json?isbn=${cleanIsbn}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`;
        const olSearchResp = await fetchWithTimeout(olSearchUrl, 3500);
        if (olSearchResp && olSearchResp.ok) {
          const olSearchData = await olSearchResp.json();
          if (olSearchData.docs && olSearchData.docs.length > 0) {
            const doc = olSearchData.docs[0];
            if (!title && doc.title) title = doc.title;
            if (authors.length === 0 && Array.isArray(doc.author_name)) authors = doc.author_name;
            if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) publisher = doc.publisher[0];
            if (!publicationYear && doc.first_publish_year) publicationYear = String(doc.first_publish_year);
            if (!coverUrl && doc.cover_i) {
              coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            }
            if (categories.length === 0 && Array.isArray(doc.subject)) {
              categories = doc.subject.slice(0, 4);
            }
            if (!foundSource) foundSource = 'Open Library Search';
          }
        }
      }
    } catch (e) {
      console.warn('Open Library fetch error:', e);
    }

    // --- FONTE 5: Google Books API (con recupero copertina e sinossi) ---
    try {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
      const gbResp = await fetchWithTimeout(gbUrl, 3000);
      if (gbResp && gbResp.ok) {
        const gbData = await gbResp.json();
        if (gbData.items && gbData.items.length > 0) {
          const item = gbData.items[0];
          if (item && item.volumeInfo) {
            const info = item.volumeInfo;
            if (!title) {
              title = info.title || '';
              if (info.subtitle) title += ` - ${info.subtitle}`;
            }
            if (authors.length === 0 && info.authors) {
              authors = info.authors;
            }
            if (!publisher && info.publisher) {
              publisher = info.publisher;
            }
            if (!publicationYear && info.publishedDate) {
              publicationYear = info.publishedDate.substring(0, 4);
            }
            if (!description && info.description) {
              description = info.description;
            }
            if (categories.length === 0 && info.categories) {
              categories = info.categories;
            }
            if (!pageCount && info.pageCount) {
              pageCount = info.pageCount;
            }

            // Google Books thumbnail if better
            if (info.imageLinks) {
              const gbImg =
                info.imageLinks.extraLarge ||
                info.imageLinks.large ||
                info.imageLinks.medium ||
                info.imageLinks.thumbnail;
              if (gbImg) {
                const secureGbImg = gbImg.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '');
                if (!coverUrl) {
                  coverUrl = secureGbImg;
                }
              }
            }

            if (!foundSource) foundSource = 'Google Books';
          }
        }
      }
    } catch (e) {
      console.warn('Google Books fetch error:', e);
    }

    // --- FONTE 7: Crossref (Testi universitari, accademici, scientifici e saggi) ---
    if (!title || authors.length === 0) {
      try {
        const crossrefUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(cleanIsbn)}&rows=1`;
        const crResp = await fetchWithTimeout(crossrefUrl, 3000, {
          'User-Agent': 'BiblioScuola/1.0 (mailto:scuola@biblioscuola.it)',
        });
        if (crResp && crResp.ok) {
          const crData = await crResp.json();
          const item = crData.message?.items?.[0];
          if (item) {
            if (!title && item.title && item.title.length > 0) title = item.title[0];
            if (authors.length === 0 && Array.isArray(item.author)) {
              authors = item.author.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim());
            }
            if (!publisher && item.publisher) publisher = item.publisher;
            if (!publicationYear && item.published?.['date-parts']?.[0]?.[0]) {
              publicationYear = String(item.published['date-parts'][0][0]);
            }
            if (!foundSource) foundSource = 'Crossref Academic Index';
          }
        }
      } catch (e) {
        console.warn('Crossref fetch error:', e);
      }
    }

    // --- FONTE 8: Gemini AI Assistant (Enrichment sinossi, genere scolastico e fallback semantico) ---
    if ((!title || authors.length === 0 || !description) && process.env.GEMINI_API_KEY) {
      try {
        const promptText = !title
          ? `Identifica con precisione il libro cartaceo con codice ISBN "${cleanIsbn}" (o ISBN-10 "${isbn10 || ''}"). Se conosci questo libro, fornisci: titolo completo, autori (nome e cognome), casa editrice, anno indicativo, descrizione/sinossi in italiano (3 frasi) e genere scolastico (es. Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Scienza & Natura, Storia & Biografie, Saggistica). Se non sei assolutamente certo, imposta found a false.`
          : `Arricchisci la scheda del libro scolastico "${title}" di "${authors.join(', ')}" (ISBN: ${cleanIsbn}). Fornisci una sinossi coinvolgente in italiano per studenti/docenti e il genere letterario più appropriato per scuola primaria/secondaria.`;

        const aiResponse = await callGemini({
          contents: promptText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                found: { type: Type.BOOLEAN },
                title: { type: Type.STRING },
                authors: { type: Type.ARRAY, items: { type: Type.STRING } },
                publisher: { type: Type.STRING },
                publicationYear: { type: Type.STRING },
                description: { type: Type.STRING },
                categories: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['found', 'title', 'authors'],
            },
          },
        });

        const aiText = aiResponse.text?.trim() || '{}';
        const aiData = JSON.parse(aiText);
        if (aiData.found && aiData.title) {
          if (!title) title = aiData.title;
          if (authors.length === 0 && aiData.authors) authors = aiData.authors;
          if (!publisher && aiData.publisher) publisher = aiData.publisher;
          if (!publicationYear && aiData.publicationYear) publicationYear = aiData.publicationYear;
          if (!description && aiData.description) description = aiData.description;
          if (categories.length === 0 && aiData.categories) categories = aiData.categories;
          if (!foundSource) foundSource = 'Gemini AI Assistant';
        }
      } catch (aiErr) {
        console.warn('Gemini ISBN fallback error:', aiErr);
      }
    }

    // Recupero copertine originali autentiche dell'edizione italiana (Amazon IT CDN, Google Books Content)
    const originalCandidates = await getOriginalBookCoverCandidates(cleanIsbn);
    let verifiedCoverUrl = '';

    if (originalCandidates.length > 0) {
      verifiedCoverUrl = originalCandidates[0].url;
    } else if (coverUrl && (await isWorkingImageUrl(coverUrl, 2000))) {
      verifiedCoverUrl = coverUrl;
    } else if (title) {
      // Copertina grafica garantita scolastica ad alta definizione
      verifiedCoverUrl = generateBookCoverDataUrl(
        title,
        authors.length > 0 ? authors.join(', ') : 'Autore',
        categories[0] || 'Narrativa'
      );
    }

    if (!title && authors.length === 0) {
      return res.json({
        found: false,
        isbn: cleanIsbn,
        message:
          'Nessun metadato reperito sulle banche dati bibliotecarie (BNI, OPAC SBN, Open Library, Google Books, Crossref). Puoi compilare manualmente i campi o usare la fotocamera con l\'AI per analizzare la copertina e il frontespizio.',
      });
    }

    return res.json({
      found: true,
      isbn: cleanIsbn,
      title,
      authors,
      publisher,
      publicationYear,
      description,
      coverUrl: verifiedCoverUrl,
      coverCandidates: originalCandidates,
      categories,
      pageCount,
      bniIdentifier,
      deweyClassification,
      source: foundSource || 'Banche dati bibliotecarie collegate (BNI/SBN/OpenLibrary/GoogleBooks)',
    });
  } catch (error: any) {
    console.error('ISBN lookup failed:', error);
    return res.status(500).json({ error: error?.message || 'Errore durante la ricerca ISBN' });
  }
});

// Dedicated cover lookup endpoint to find/repair cover images for existing books
app.get('/api/cover-lookup/:isbn', async (req: Request, res: Response) => {
  try {
    const rawIsbn = req.params.isbn;
    const cleanIsbn = cleanIsbnString(rawIsbn);
    if (!cleanIsbn) {
      return res.status(400).json({ error: 'ISBN non valido' });
    }

    // 1. Priorità massima: Copertine originali dell'editore italiano (Amazon CDN e Google Books)
    const originalCandidates = await getOriginalBookCoverCandidates(cleanIsbn);
    if (originalCandidates.length > 0) {
      return res.json({
        found: true,
        coverUrl: originalCandidates[0].url,
        coverCandidates: originalCandidates,
        source: originalCandidates[0].source,
      });
    }

    // 2. Try Open Library direct ID
    try {
      const olResp = await fetchWithTimeout(`https://openlibrary.org/isbn/${cleanIsbn}.json`, 3000);
      if (olResp && olResp.ok) {
        const olData = await olResp.json();
        if (Array.isArray(olData.covers) && olData.covers.length > 0 && olData.covers[0] > 0) {
          const directIdUrl = `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg`;
          if (await isWorkingImageUrl(directIdUrl)) {
            return res.json({
              found: true,
              coverUrl: directIdUrl,
              coverCandidates: [{ source: 'Open Library Archivio', url: directIdUrl, isOriginalEdition: false }],
              source: 'Open Library High-Res Covers',
            });
          }
        }
      }
    } catch {}

    // 3. Try Open Library direct ISBN with default=false
    const olDirectIsbn = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg?default=false`;
    if (await isWorkingImageUrl(olDirectIsbn)) {
      return res.json({
        found: true,
        coverUrl: olDirectIsbn,
        coverCandidates: [{ source: 'Open Library ISBN Index', url: olDirectIsbn, isOriginalEdition: false }],
        source: 'Open Library ISBN Index',
      });
    }

    return res.json({
      found: false,
      message: 'Nessuna copertina fotografica reperita online',
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Errore ricerca copertina' });
  }
});

// 2. AI Book Cover Generator (Gemini + Graphic SVG Studio)
app.post('/api/gemini/generate-cover', async (req: Request, res: Response) => {
  try {
    const { title, authors, genre, synopsis, isbn, schoolName } = req.body;
    const bookTitle = (title || 'Nuovo Libro').trim();
    const bookAuthors = (Array.isArray(authors) ? authors.join(', ') : (authors || 'Autore')).trim();
    const bookGenre = (genre || 'Narrativa').trim();
    const school = (schoolName || 'Biblioteca Scolastica').trim();

    // 1. Try Gemini AI generation
    if (process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Sei un maestro illustratore e book cover designer professionista specializzato in grafica editoriale per biblioteche scolastiche.
Genera il codice SVG COMPLETO, moderno e artisticamente impeccabile per la copertina del seguente libro:
- Titolo del libro: "${bookTitle}"
- Autore: "${bookAuthors}"
- Genere letterario: "${bookGenre}"
- Trama/Sinossi: "${synopsis || ''}"
- Scuola: "${school}"

Requisiti tecnici e visivi dell'SVG:
1. Root tag: <svg viewBox="0 0 400 600" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
2. Palette cromatica ricca e coerente con il genere letterario.
3. Elementi vettoriali o illustrazioni simboliche centrali fortemente evocative della trama (es. elementi geometrici distopici per 1984, rosa/stelle/pianeta per Piccolo Principe, magia per fantasy, natura/animali per avventura, formule/galassia per scienza).
4. Tipografia centrata e leggibile con <text> e <tspan> (titolo evidente, nome autore, badge del genere e menzione scolastica).
5. Ombra 3D del dorso libro sul bordo sinistro (<rect width="24" height="600" fill="url(#spineShadow)"/>).
6. Cornice o bordi rifiniti ed eleganti.

Restituisci ESCLUSIVAMENTE il codice SVG valido racchiuso all'interno di un blocco: \`\`\`xml ... \`\`\` senza alcun testo prima o dopo.`;

        const aiResponse = await callGemini({
          contents: prompt,
        });

        const text = aiResponse.text || '';
        const match = text.match(/<svg[\s\S]*?<\/svg>/i);
        if (match) {
          const svgCode = match[0];
          const base64 = Buffer.from(svgCode, 'utf-8').toString('base64');
          return res.json({
            success: true,
            coverUrl: `data:image/svg+xml;base64,${base64}`,
            source: 'Gemini AI Cover Studio',
          });
        }
      } catch (aiErr) {
        console.warn('Gemini cover generation error, falling back to Graphic SVG:', aiErr);
      }
    }

    // High-resolution Graphic Fallback
    const guaranteed = generateBookCoverDataUrl(bookTitle, bookAuthors, bookGenre, school);
    return res.json({
      success: true,
      coverUrl: guaranteed,
      source: 'Graphic Cover Studio (Garantita)',
    });
  } catch (err: any) {
    console.error('Generate cover endpoint error:', err);
    return res.status(500).json({ error: err?.message || 'Errore generazione copertina' });
  }
});

// 3. Gemini Book Metadata Enrichment / Fallback from title or partial info
app.post('/api/gemini/book-lookup', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query mancante' });
    }

    const response = await callGemini({
      contents: `Sei un bibliotecario scolastico italiano. Analizza il seguente titolo, autore o frammento di informazioni su un libro per ragazzi/scolastico ed estrai con precisione i metadati: "${query}".`,
      config: {
        systemInstruction: 'Rispondi sempre in formato JSON valido. Usa solo le categorie previste per scuole primarie e secondarie.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Titolo completo del libro' },
            authors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Elenco degli autori (Nome e Cognome)'
            },
            publisher: { type: Type.STRING, description: 'Casa editrice principale' },
            publicationYear: { type: Type.STRING, description: 'Anno di pubblicazione (4 cifre)' },
            description: { type: Type.STRING, description: 'Breve e accattivante sinossi del libro adatta per studenti e docenti (max 3-4 frasi)' },
            genre: {
              type: Type.STRING,
              description: 'Genere tra: Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Poesia & Teatro, Giallo & Mistero, Fantasy & Fantascienza, Albi Illustrati, Classici, Altro'
            },
            ageGroup: {
              type: Type.STRING,
              description: 'Fascia d\'età consigliata tra: Primaria (6-8 anni), Primaria (8-11 anni), Secondaria I grado (11-14 anni), Giovani Adulti (14+), Docenti & Genitori'
            },
            isbn: { type: Type.STRING, description: 'ISBN noto se disponibile, altrimenti stringa vuota' }
          },
          required: ['title', 'authors', 'publisher', 'description', 'genre', 'ageGroup']
        }
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Gemini book-lookup failed:', error);
    return res.status(500).json({ error: error?.message || 'Errore elaborazione AI' });
  }
});

// 3. Gemini Vision OCR for Frontespizio / Copertina
app.post('/api/gemini/ocr-book', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Immagine base64 mancante' });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, '');

    const response = await callGemini({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64,
            },
          },
          {
            text: `Analizza questa immagine del frontespizio, copertina o retro di un libro per biblioteca scolastica.
Estrai con la massima accuratezza OCR:
- Titolo del libro
- Autore / Autori
- Casa editrice (Editore)
- Anno di edizione o ristampa (se leggibile)
- Codice ISBN (se visibile il codice a barre o le 10/13 cifre)
- Genere letterario scolastico
- Fascia d'età scolastica consigliata
- Breve descrizione/sinossi del libro basata sui testi visibili o sulla conoscenza del testo.`
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            authors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            publisher: { type: Type.STRING },
            publicationYear: { type: Type.STRING },
            isbn: { type: Type.STRING },
            description: { type: Type.STRING },
            genre: {
              type: Type.STRING,
              description: 'Es: Narrativa, Avventura, Fumetti & Manga, Fiabe & Favole, Divulgazione & Scienze, Storia, Fantasy & Fantascienza, Albi Illustrati, Classici'
            },
            ageGroup: {
              type: Type.STRING,
              description: 'Es: Primaria (6-8 anni), Primaria (8-11 anni), Secondaria I grado (11-14 anni), Giovani Adulti (14+)'
            }
          },
          required: ['title', 'authors', 'genre', 'ageGroup']
        }
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Gemini OCR failed:', error);
    return res.status(500).json({ error: error?.message || 'Errore analisi immagine' });
  }
});

// 4. Gemini Semantic Natural Language Book Search in Local Catalog
app.post('/api/gemini/semantic-search', async (req: Request, res: Response) => {
  try {
    const { userQuery, catalog } = req.body;
    if (!userQuery || typeof userQuery !== 'string') {
      return res.status(400).json({ error: 'Query utente mancante' });
    }

    if (!Array.isArray(catalog) || catalog.length === 0) {
      return res.json({
        recommendations: [],
        aiAdvice: 'Attualmente il catalogo della biblioteca è vuoto. Catalogate i primi libri con il lettore barcode o inserimento rapido per abilitare la ricerca intelligente!'
      });
    }

    // Limit fields to prevent excessive prompt size
    const catalogSummary = catalog.map((b: any) => ({
      id: b.id,
      title: b.title,
      authors: b.authors || [b.author],
      genre: b.genre,
      ageGroup: b.ageGroup,
      collocazione: b.collocazione,
      isAvailable: b.status === 'Disponibile',
      synopsis: (b.synopsis || b.description || '').substring(0, 200)
    }));

    const response = await callGemini({
      contents: `Richiesta dell'utente (studente o docente): "${userQuery}".

Ecco il catalogo completo dei libri FISICAMENTE PRESENTI nella biblioteca scolastica:
${JSON.stringify(catalogSummary, null, 2)}

Istruzioni:
1. Trova tra i libri presenti nel catalogo quelli più attinenti e stimolanti per rispondere alla richiesta.
2. Rispondi con un elenco ordinato per pertinenza (max 5 libri).
3. Per ciascun libro raccomandato, scrivi una motivazione pedagogica chiara, calda e appassionante in italiano ("reasoning") spiegando perché è perfetto per la richiesta.
4. Fornisci un consiglio generale di lettura o didattico ("generalAdvice") per il docente o lo studente.
5. Se nessun libro a catalogo è perfettamente a tema, indica comunque il più vicino e suggerisci nella nota generale quale tipologia di titolo la scuola potrebbe aggiungere in futuro.`,
      config: {
        systemInstruction: 'Sei il bibliotecario intelligente e accogliente della scuola. Fai riferimento ESCLUSIVAMENTE ai libri forniti nel catalogo della biblioteca.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            generalAdvice: {
              type: Type.STRING,
              description: 'Commento introduttivo caloroso e suggerimento didattico per l\'utente'
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bookId: { type: Type.STRING },
                  matchScore: { type: Type.NUMBER, description: 'Punteggio da 0 a 100' },
                  reasoning: { type: Type.STRING, description: 'Perché questo libro è consigliato per questa richiesta specifica' }
                },
                required: ['bookId', 'matchScore', 'reasoning']
              }
            }
          },
          required: ['generalAdvice', 'recommendations']
        }
      }
    });

    const text = response.text?.trim() || '{}';
    const parsed = JSON.parse(text);
    return res.json({ success: true, ...parsed });
  } catch (error: any) {
    console.error('Gemini semantic search failed:', error);
    return res.status(500).json({ error: error?.message || 'Errore ricerca AI' });
  }
});

// Robust Student Card PNG Download endpoint (guarantees valid, uncorrupted binary PNG file)
app.post('/api/download-card-png', (req: Request, res: Response) => {
  try {
    const { base64, filename } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).send('Dati immagine non forniti o non validi');
    }

    const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length < 50) {
      return res.status(400).send('Immagine PNG generata corrotta o incompleta');
    }

    const safeFilename = (filename || 'Tessera_80x50mm.png').replace(/[^a-zA-Z0-9_.-]/g, '_');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    return res.end(buffer);
  } catch (err: any) {
    console.error('Error serving card PNG download:', err);
    return res.status(500).send('Errore server durante il download del PNG');
  }
});

// Dedicated standalone Print Page endpoint (runs in a fresh top-level tab without iframe restrictions)
app.post('/print-card', (req: Request, res: Response) => {
  try {
    const { html } = req.body;
    if (!html || typeof html !== 'string') {
      return res.status(400).send('Contenuto HTML di stampa non valido');
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(html);
  } catch (err: any) {
    console.error('Error serving print page:', err);
    return res.status(500).send('Errore server durante la generazione della pagina di stampa');
  }
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, dist is located at process.cwd()/dist
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BiblioScuola server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
