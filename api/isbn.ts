function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
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

async function fetchWithTimeout(
  url: string,
  timeoutMs = 4500,
  headers: Record<string, string> = {}
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BiblioScuola/1.0 (Gestionale Biblioteca Scolastica; scuola italiana)',
        ...headers,
      },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractIsbnFromRequest(req: any): string {
  const qIsbn = req.query?.isbn;
  if (typeof qIsbn === 'string' && qIsbn.trim()) {
    return qIsbn.trim();
  }
  if (Array.isArray(qIsbn) && qIsbn[0]) {
    return String(qIsbn[0]).trim();
  }

  // Extract from path e.g. /api/isbn/9788809950900 or /api/isbn/9788809950900?foo=bar
  const rawUrl = (req.url || '') as string;
  const pathname = rawUrl.split('?')[0];
  const match = pathname.match(/\/api\/isbn\/([^/]+)$/i);
  if (match && match[1]) {
    return decodeURIComponent(match[1]).trim();
  }

  return '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    const rawIsbn = extractIsbnFromRequest(req);
    const clean = cleanIsbn(rawIsbn);

    if (!clean || (clean.length !== 10 && clean.length !== 13)) {
      return res.status(400).json({
        found: false,
        error: 'Codice ISBN non valido (deve contenere 10 o 13 cifre)',
      });
    }

    const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);
    const isbn13 = clean.length === 13 ? clean : isbn10ToIsbn13(clean);

    let title = '';
    let authors: string[] = [];
    let publisher = '';
    let publicationYear = '';
    let description = '';
    let coverUrl = '';
    let categories: string[] = [];
    let foundSource = '';

    // 1. OPAC SBN & BNI (Catalogo Collettivo Nazionale ICCU / Deposito Legale BNCF)
    try {
      const sbnQuery = isbn13 || clean;
      const sbnResp = await fetchWithTimeout(
        `https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(sbnQuery)}`,
        4500
      );
      if (sbnResp && sbnResp.ok) {
        const sbnData = await sbnResp.json();
        const records = sbnData.briefRecords || [];
        if (records.length > 0) {
          const rec = records[0];
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

          if (rec.copertina && typeof rec.copertina === 'string') {
            const candidate = rec.copertina.replace(/^http:\/\//i, 'https://').replace('/small/', '/large/');
            if (!candidate.includes('covers.librarything.com')) {
              coverUrl = candidate;
            }
          }

          foundSource = 'BNI (Bibliografia Nazionale Italiana - BNCF) / OPAC SBN';
        }
      }
    } catch (e) {
      console.warn('OPAC SBN error in serverless:', e);
    }

    // 2. Open Library Direct Edition & Search
    try {
      const olUrl = `https://openlibrary.org/isbn/${encodeURIComponent(clean)}.json`;
      const olResp = await fetchWithTimeout(olUrl, 3500);
      if (olResp && olResp.ok) {
        const olData = await olResp.json();
        if (!title && olData.title) title = olData.title;
        if (!publisher && Array.isArray(olData.publishers) && olData.publishers.length > 0) {
          publisher = olData.publishers[0];
        }
        if (!publicationYear && olData.publish_date) {
          const ym = String(olData.publish_date).match(/\b(19\d\d|20\d\d)\b/);
          if (ym) publicationYear = ym[1];
        }
        if (!coverUrl && Array.isArray(olData.covers) && olData.covers.length > 0 && olData.covers[0] > 0) {
          coverUrl = `https://covers.openlibrary.org/b/id/${olData.covers[0]}-L.jpg`;
        }
        if (!foundSource) foundSource = 'Open Library (Banca Dati Bibliotecaria)';
      }

      if (!title || authors.length === 0 || !coverUrl) {
        const sUrl = `https://openlibrary.org/search.json?isbn=${encodeURIComponent(clean)}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`;
        const sResp = await fetchWithTimeout(sUrl, 3500);
        if (sResp && sResp.ok) {
          const sData = await sResp.json();
          const doc = sData?.docs?.[0];
          if (doc) {
            if (!title && doc.title) title = doc.title;
            if (authors.length === 0 && Array.isArray(doc.author_name)) authors = doc.author_name;
            if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) publisher = doc.publisher[0];
            if (!publicationYear && doc.first_publish_year) publicationYear = String(doc.first_publish_year);
            if (!coverUrl && doc.cover_i) coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
            if (categories.length === 0 && Array.isArray(doc.subject)) categories = doc.subject.slice(0, 4);
            if (!foundSource) foundSource = 'Open Library (Banca Dati Bibliotecaria)';
          }
        }
      }
    } catch (e) {
      console.warn('Open Library error in serverless:', e);
    }

    // 3. Google Books REST API
    try {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(clean)}&maxResults=1`;
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
          if (!coverUrl && info.imageLinks) {
            const raw = info.imageLinks.extraLarge || info.imageLinks.large || info.imageLinks.medium || info.imageLinks.thumbnail;
            if (raw) coverUrl = raw.replace(/^http:\/\//i, 'https://').replace(/&edge=curl/gi, '');
          }
          if (!foundSource) foundSource = 'Google Books (Banca Dati Bibliotecaria)';
        }
      }
    } catch (e) {
      console.warn('Google Books error in serverless:', e);
    }

    // 4. Crossref Accademico
    if (!title || authors.length === 0) {
      try {
        const crUrl = `https://api.crossref.org/works?filter=isbn:${encodeURIComponent(clean)}&rows=1`;
        const crResp = await fetchWithTimeout(crUrl, 3000, {
          'User-Agent': 'BiblioScuola/1.0 (mailto:scuola@biblioscuola.it)',
        });
        if (crResp && crResp.ok) {
          const crData = await crResp.json();
          const item = crData?.message?.items?.[0];
          if (item) {
            if (!title && Array.isArray(item.title) && item.title.length > 0) title = item.title[0];
            if (authors.length === 0 && Array.isArray(item.author)) {
              authors = item.author.map((a: any) => (a.given && a.family ? `${a.given} ${a.family}` : a.name || a.family || ''));
            }
            if (!publisher && item.publisher) publisher = item.publisher;
            const dateParts = item.created?.['date-parts']?.[0] || item['published-print']?.['date-parts']?.[0];
            if (!publicationYear && dateParts && dateParts[0]) publicationYear = String(dateParts[0]);
            if (categories.length === 0 && Array.isArray(item.subject)) categories = item.subject.slice(0, 4);
            if (!foundSource) foundSource = 'Crossref Accademico';
          }
        }
      } catch (e) {
        console.warn('Crossref error in serverless:', e);
      }
    }

    // Authentic Cover Candidates from Publisher CDNs (excluding Cloudflare-blocked URLs)
    const coverCandidates: Array<{ source: string; url: string }> = [];
    if (coverUrl) {
      coverCandidates.push({ source: 'Copertina Originale (Banca Dati)', url: coverUrl });
    }
    coverCandidates.push({
      source: 'Copertina Originale Editore (Amazon Books CDN)',
      url: `https://images-na.ssl-images-amazon.com/images/P/${clean}.01.LZZZZZZZ.jpg`,
    });
    if (isbn10 && isbn10 !== clean) {
      coverCandidates.push({
        source: 'Copertina Originale Editore (ISBN-10)',
        url: `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`,
      });
    }
    coverCandidates.push({
      source: 'Open Library (Alta Risoluzione)',
      url: `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
    });
    coverCandidates.push({
      source: 'Google Books (Copertina Ufficiale)',
      url: `https://books.google.com/books/content?vid=ISBN${clean}&printsec=frontcover&img=1&zoom=1`,
    });

    const finalCover = coverUrl || coverCandidates[0]?.url;

    if (!title && authors.length === 0) {
      return res.status(200).json({
        found: false,
        isbn: clean,
        message: 'Nessun risultato trovato nelle banche dati ufficiali',
      });
    }

    return res.status(200).json({
      found: true,
      isbn: clean,
      title,
      authors,
      publisher,
      publicationYear,
      description,
      coverUrl: finalCover,
      coverCandidates,
      categories,
      source: foundSource || 'Cataloghi Bibliografici Ufficiali (API REST)',
    });
  } catch (err: any) {
    console.error('api/isbn error:', err);
    return res.status(500).json({
      found: false,
      error: err?.message || 'Errore ricerca ISBN',
    });
  }
}
