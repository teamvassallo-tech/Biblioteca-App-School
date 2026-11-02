function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

function isIsbnLike(val: string): boolean {
  const clean = cleanIsbn(val);
  return (clean.length === 10 || clean.length === 13) && /^(\d{9}[\dX]|\d{13})$/i.test(clean);
}

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

async function fetchWithTimeout(url: string, timeoutMs = 4500, headers: Record<string, string> = {}): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BiblioScuola/1.0 (Gestionale Biblioteca Scolastica; scuola italiana)',
        ...headers,
      },
    });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  // Configurazione CORS per chiamate dal frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Estrazione parametro 'q' (con supporto fallback per 'isbn', 'title', 'query')
    const rawQuery = (
      req.query?.q as string ||
      req.query?.isbn as string ||
      req.query?.query as string ||
      req.query?.title as string ||
      ''
    ).trim();

    if (!rawQuery) {
      return res.status(400).json({
        found: false,
        error: 'Parametro di ricerca "q" mancante. Inserisci un codice ISBN o un titolo.',
      });
    }

    const isIsbn = isIsbnLike(rawQuery);
    const clean = isIsbn ? cleanIsbn(rawQuery) : rawQuery;
    const isbn10 = isIsbn && clean.length === 10 ? clean : (isIsbn ? isbn13ToIsbn10(clean) : null);
    const isbn13 = isIsbn && clean.length === 13 ? clean : (isIsbn && isbn10 ? isbn10ToIsbn13(isbn10) : null);

    let title = '';
    let authors: string[] = [];
    let publisher = '';
    let publicationYear = '';
    let description = '';
    let coverUrl = '';
    let categories: string[] = [];
    let pageCount: number | undefined = undefined;
    let foundIsbn = isIsbn ? clean : '';
    let foundSource = '';

    // =========================================================================
    // 1. OPAC SBN & BNI (Catalogo Collettivo Nazionale ICCU / BNCF Deposito Legale)
    // =========================================================================
    try {
      const sbnUrl = isIsbn
        ? `https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(clean)}`
        : `https://opac.sbn.it/opacmobilegw/search.json?title=${encodeURIComponent(rawQuery)}&rows=5`;

      const sbnResp = await fetchWithTimeout(sbnUrl, 4500);
      if (sbnResp && sbnResp.ok) {
        const sbnData = await sbnResp.json();
        const records = sbnData.briefRecords || [];
        if (records.length > 0) {
          const rec = records.find((r: any) => r.isbn) || records[0];

          let sbnTitle = rec.titolo || '';
          if (sbnTitle.includes(' / ')) sbnTitle = sbnTitle.split(' / ')[0].trim();
          if (sbnTitle.includes(' : ')) sbnTitle = sbnTitle.replace(/\s*:\s*/g, ' - ');
          title = sbnTitle;

          if (rec.autorePrincipale) {
            let auth = rec.autorePrincipale.trim();
            if (auth.includes(',')) {
              const parts = auth.split(',').map((p: string) => p.trim());
              auth = `${parts[1]} ${parts[0]}`.trim();
            }
            authors = [auth];
          }

          if (rec.pubblicazione) {
            const pubText = rec.pubblicazione;
            const match = pubText.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
            if (match) {
              if (match[1]) publisher = match[1].trim();
              if (match[2]) publicationYear = match[2].trim();
            } else {
              const ym = pubText.match(/\b(19\d\d|20\d\d)\b/);
              if (ym) publicationYear = ym[1];
            }
          }

          if (rec.isbn && !foundIsbn) {
            foundIsbn = cleanIsbn(rec.isbn);
          }

          if (rec.copertina && typeof rec.copertina === 'string') {
            const candidate = rec.copertina.replace(/^http:\/\//i, 'https://').replace('/small/', '/large/');
            if (!candidate.includes('covers.librarything.com')) {
              coverUrl = candidate;
            }
          }

          foundSource = 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)';
        }
      }
    } catch (e) {
      console.warn('OPAC SBN / BNI error:', e);
    }

    // Se ricerca testuale e non trovato per titolo, prova OPAC SBN per autore
    if (!isIsbn && !title && authors.length === 0) {
      try {
        const sbnAuthUrl = `https://opac.sbn.it/opacmobilegw/search.json?author=${encodeURIComponent(rawQuery)}&rows=5`;
        const authResp = await fetchWithTimeout(sbnAuthUrl, 4000);
        if (authResp && authResp.ok) {
          const authData = await authResp.json();
          const records = authData.briefRecords || [];
          if (records.length > 0) {
            const rec = records.find((r: any) => r.isbn) || records[0];
            let sbnTitle = rec.titolo || '';
            if (sbnTitle.includes(' / ')) sbnTitle = sbnTitle.split(' / ')[0].trim();
            if (sbnTitle.includes(' : ')) sbnTitle = sbnTitle.replace(/\s*:\s*/g, ' - ');
            title = sbnTitle;

            if (rec.autorePrincipale) {
              let auth = rec.autorePrincipale.trim();
              if (auth.includes(',')) {
                const parts = auth.split(',').map((p: string) => p.trim());
                auth = `${parts[1]} ${parts[0]}`.trim();
              }
              authors = [auth];
            }
            if (rec.isbn && !foundIsbn) foundIsbn = cleanIsbn(rec.isbn);
            foundSource = 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)';
          }
        }
      } catch (e) {
        console.warn('OPAC SBN author error:', e);
      }
    }

    // =========================================================================
    // 2. LibraryThing (Integrazione ufficiale metadati & ISBN)
    // =========================================================================
    const ltKey = (req.query?.librarythingKey as string) || process.env.LIBRARYTHING_DEVKEY;
    if (ltKey && isIsbn && (!title || authors.length === 0)) {
      try {
        const ltUrl = `https://www.librarything.com/services/rest/1.1/?method=librarything.ck.getwork&isbn=${encodeURIComponent(clean)}&apikey=${encodeURIComponent(ltKey)}`;
        const ltResp = await fetchWithTimeout(ltUrl, 3500);
        if (ltResp && ltResp.ok) {
          const ltXml = await ltResp.text();
          const titleMatch = ltXml.match(/<title>([^<]+)<\/title>/i);
          const authorMatch = ltXml.match(/<author[^>]*>([^<]+)<\/author>/i);
          if (!title && titleMatch) title = titleMatch[1].trim();
          if (authors.length === 0 && authorMatch) authors = [authorMatch[1].trim()];
          if (!foundSource) foundSource = 'LibraryThing Catalog';
        }
      } catch (e) {
        console.warn('LibraryThing fetch error:', e);
      }
    }

    // =========================================================================
    // 3. Crossref (Pubblicazioni accademiche, saggi e testi scolastici)
    // =========================================================================
    if (!title || authors.length === 0) {
      try {
        const crQuery = isIsbn ? encodeURIComponent(clean) : encodeURIComponent(rawQuery);
        const crUrl = `https://api.crossref.org/works?query.bibliographic=${crQuery}&rows=1`;
        const crResp = await fetchWithTimeout(crUrl, 3500, {
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
            if (!foundIsbn && Array.isArray(item.ISBN) && item.ISBN.length > 0) {
              foundIsbn = cleanIsbn(item.ISBN[0]);
            }
            if (!foundSource) foundSource = 'Crossref Academic Index';
          }
        }
      } catch (e) {
        console.warn('Crossref error:', e);
      }
    }

    // =========================================================================
    // 4. Google Books API (con metadati, sinossi e copertina)
    // =========================================================================
    try {
      const gbQuery = isIsbn ? `isbn:${encodeURIComponent(clean)}` : encodeURIComponent(rawQuery);
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${gbQuery}&maxResults=1`;
      const gbResp = await fetchWithTimeout(gbUrl, 3500);
      if (gbResp && gbResp.ok) {
        const gbData = await gbResp.json();
        const item = gbData?.items?.[0];
        if (item && item.volumeInfo) {
          const info = item.volumeInfo;
          if (!title) {
            title = info.title || '';
            if (info.subtitle) title += ` - ${info.subtitle}`;
          }
          if (authors.length === 0 && Array.isArray(info.authors)) authors = info.authors;
          if (!publisher && info.publisher) publisher = info.publisher;
          if (!publicationYear && info.publishedDate) publicationYear = info.publishedDate.substring(0, 4);
          if (!description && info.description) description = info.description;
          if (categories.length === 0 && Array.isArray(info.categories)) categories = info.categories;
          if (!pageCount && info.pageCount) pageCount = info.pageCount;
          if (!foundIsbn && Array.isArray(info.industryIdentifiers)) {
            const isbnId = info.industryIdentifiers.find((id: any) => id.type === 'ISBN_13' || id.type === 'ISBN_10');
            if (isbnId?.identifier) foundIsbn = cleanIsbn(isbnId.identifier);
          }
          if (!coverUrl && info.imageLinks) {
            const raw = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail;
            if (raw) coverUrl = raw.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '');
          }
          if (!foundSource) foundSource = 'Google Books (Banca Dati Bibliotecaria)';
        }
      }
    } catch (e) {
      console.warn('Google Books error:', e);
    }

    // =========================================================================
    // 5. Open Library (Edizione e Ricerca Libri)
    // =========================================================================
    if (!title || authors.length === 0 || !coverUrl) {
      try {
        if (isIsbn) {
          const olUrl = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
          const olResp = await fetchWithTimeout(olUrl, 3000);
          if (olResp && olResp.ok) {
            const olData = await olResp.json();
            if (!title && olData.title) title = olData.title;
            if (!publisher && Array.isArray(olData.publishers) && olData.publishers.length > 0) publisher = olData.publishers[0];
            if (!publicationYear && olData.publish_date) {
              const ym = String(olData.publish_date).match(/\b(19\d\d|20\d\d)\b/);
              if (ym) publicationYear = ym[1];
            }
            if (!coverUrl && Array.isArray(olData.covers) && olData.covers.length > 0 && olData.covers[0] > 0) {
              coverUrl = `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg`;
            }
            if (!foundSource) foundSource = 'Open Library';
          }
        }

        const olSearchUrl = isIsbn
          ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(clean)}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`
          : `https://openlibrary.org/search.json?q=${encodeURIComponent(rawQuery)}&fields=title,author_name,publisher,first_publish_year,cover_i,isbn,subject&limit=1`;

        const olSearchResp = await fetchWithTimeout(olSearchUrl, 3500);
        if (olSearchResp && olSearchResp.ok) {
          const sData = await olSearchResp.json();
          const doc = sData?.docs?.[0];
          if (doc) {
            if (!title && doc.title) title = doc.title;
            if (authors.length === 0 && Array.isArray(doc.author_name)) authors = doc.author_name;
            if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) publisher = doc.publisher[0];
            if (!publicationYear && doc.first_publish_year) publicationYear = String(doc.first_publish_year);
            if (!foundIsbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) foundIsbn = cleanIsbn(doc.isbn[0]);
            if (!coverUrl && doc.cover_i) coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            if (categories.length === 0 && Array.isArray(doc.subject)) categories = doc.subject.slice(0, 4);
            if (!foundSource) foundSource = 'Open Library';
          }
        }
      } catch (e) {
        console.warn('Open Library error:', e);
      }
    }

    // =========================================================================
    // Recupero Copertine Originali da CDN Ufficiali (Amazon CDN, Open Library, Google)
    // =========================================================================
    const coverCandidates: Array<{ source: string; url: string; isOriginalEdition: boolean }> = [];
    if (coverUrl) {
      coverCandidates.push({ source: 'Copertina Originale (Banca Dati)', url: coverUrl, isOriginalEdition: true });
    }

    const targetIsbn = foundIsbn || (isIsbn ? clean : '');
    if (targetIsbn) {
      coverCandidates.push({
        source: 'Copertina Originale Editore (Amazon Books CDN)',
        url: `https://images-na.ssl-images-amazon.com/images/P/${targetIsbn}.01.LZZZZZZZ.jpg`,
        isOriginalEdition: true,
      });

      const opt10 = targetIsbn.length === 10 ? targetIsbn : isbn13ToIsbn10(targetIsbn);
      if (opt10 && opt10 !== targetIsbn) {
        coverCandidates.push({
          source: 'Copertina Originale Editore (ISBN-10)',
          url: `https://images-na.ssl-images-amazon.com/images/P/${opt10}.01.LZZZZZZZ.jpg`,
          isOriginalEdition: true,
        });
      }

      coverCandidates.push({
        source: 'Open Library (Alta Risoluzione)',
        url: `https://covers.openlibrary.org/b/isbn/${targetIsbn}-L.jpg?default=false`,
        isOriginalEdition: false,
      });

      coverCandidates.push({
        source: 'Google Books (Copertina Ufficiale)',
        url: `https://books.google.com/books/content?vid=ISBN${targetIsbn}&printsec=frontcover&img=1&zoom=1`,
        isOriginalEdition: true,
      });
    }

    const finalCover = coverUrl || coverCandidates[0]?.url;

    // Se il libro non è stato trovato in nessuna banca dati ufficiale
    if (!title && authors.length === 0) {
      return res.status(200).json({
        found: false,
        query: rawQuery,
        isbn: targetIsbn || undefined,
        message: 'Nessun risultato trovato nelle banche dati ufficiali',
      });
    }

    return res.status(200).json({
      found: true,
      isbn: targetIsbn || undefined,
      title,
      authors,
      publisher,
      publicationYear,
      description,
      categories,
      pageCount,
      coverUrl: finalCover,
      coverCandidates,
      source: foundSource || 'Cataloghi Bibliografici Ufficiali (API REST)',
    });
  } catch (err: any) {
    console.error('api/search-book error:', err);
    return res.status(500).json({
      found: false,
      error: err?.message || 'Errore durante la ricerca del libro nel proxy server',
    });
  }
}
