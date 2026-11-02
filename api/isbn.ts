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

export default async function handler(req: any, res: any) {
  // Enable CORS for frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawIsbn = (req.query?.isbn as string) || '';
    const clean = cleanIsbn(rawIsbn);

    if (!clean || (clean.length !== 10 && clean.length !== 13)) {
      return res.status(400).json({ error: 'Codice ISBN non valido (deve contenere 10 o 13 cifre)' });
    }

    const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);

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
      const sbnResp = await fetch(
        `https://opac.sbn.it/opacmobilegw/search.json?isbn=${encodeURIComponent(clean)}`,
        { headers: { 'User-Agent': 'BiblioScuola/1.0 (Scuola Italiana)' } }
      );
      if (sbnResp.ok) {
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
      const olResp = await fetch(olUrl);
      if (olResp.ok) {
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
        const sResp = await fetch(sUrl);
        if (sResp.ok) {
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
      const gbResp = await fetch(gbUrl);
      if (gbResp.ok) {
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
        }
      }
    } catch (e) {
      console.warn('Google Books error in serverless:', e);
    }

    // 4. Crossref Accademico
    if (!title || authors.length === 0) {
      try {
        const crUrl = `https://api.crossref.org/works?filter=isbn:${encodeURIComponent(clean)}&rows=1`;
        const crResp = await fetch(crUrl, {
          headers: { 'User-Agent': 'BiblioScuola/1.0 (mailto:scuola@biblioscuola.it)' },
        });
        if (crResp.ok) {
          const crData = await crResp.json();
          const item = crData?.message?.items?.[0];
          if (item) {
            if (!title && Array.isArray(item.title) && item.title.length > 0) title = item.title[0];
            if (authors.length === 0 && Array.isArray(item.author)) {
              authors = item.author.map((a: any) => a.given && a.family ? `${a.given} ${a.family}` : a.name || a.family || '');
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

    // 5. ISBNdb (se presente la chiave)
    const isbndbKey = (req.query?.isbndbKey as string) || process.env.ISBNDB_API_KEY;
    if (isbndbKey && (!title || authors.length === 0 || !coverUrl)) {
      try {
        const isbndbResp = await fetch(`https://api2.isbndb.com/book/${encodeURIComponent(clean)}`, {
          headers: { Authorization: isbndbKey.trim() },
        });
        if (isbndbResp.ok) {
          const isbndbData = await isbndbResp.json();
          const b = isbndbData?.book;
          if (b) {
            if (!title && b.title) title = b.title;
            if (authors.length === 0 && Array.isArray(b.authors)) authors = b.authors;
            if (!publisher && b.publisher) publisher = b.publisher;
            if (!publicationYear && b.date_published) publicationYear = String(b.date_published).slice(0, 4);
            if (!description && b.synopsis) description = b.synopsis;
            if (!coverUrl && b.image) coverUrl = b.image;
            if (categories.length === 0 && Array.isArray(b.subjects)) categories = b.subjects.slice(0, 4);
            if (!foundSource) foundSource = 'ISBNdb Global Database';
          }
        }
      } catch (e) {
        console.warn('ISBNdb error in serverless:', e);
      }
    }

    // 6. WorldCat / OCLC
    const worldcatKey = (req.query?.worldcatKey as string) || process.env.WORLDCAT_API_KEY || process.env.OCLC_WSKEY;
    if (worldcatKey && (!title || authors.length === 0)) {
      try {
        const wcResp = await fetch(`https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs?q=bn:${encodeURIComponent(clean)}&limit=1`, {
          headers: { Authorization: `Bearer ${worldcatKey}`, Accept: 'application/json' },
        });
        if (wcResp.ok) {
          const wcData = await wcResp.json();
          const rec = wcData?.bibRecords?.[0];
          if (rec) {
            if (!title && rec.title) title = rec.title;
            if (authors.length === 0 && Array.isArray(rec.creator)) {
              authors = rec.creator.map((c: any) => c.name || c);
            }
            if (!publisher && rec.publisher) publisher = rec.publisher;
            if (!publicationYear && rec.date) publicationYear = String(rec.date).slice(0, 4);
            if (!foundSource) foundSource = 'WorldCat / OCLC';
          }
        }
      } catch (e) {
        console.warn('WorldCat error in serverless:', e);
      }
    }

    // 7. LibraryThing Cover & Editions
    const ltKey = (req.query?.librarythingKey as string) || 'fd11eebee79ccfcfe2f17d34a92e1011';
    if (!coverUrl) {
      coverUrl = `https://covers.librarything.com/devkey/${ltKey}/large/isbn/${encodeURIComponent(clean)}`;
    }

    // Authentic Cover Candidates from Publisher CDNs
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
    return res.status(500).json({ error: err?.message || 'Errore ricerca ISBN' });
  }
}
