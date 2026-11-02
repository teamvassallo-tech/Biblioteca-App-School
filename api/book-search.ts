
function cleanIsbn(isbn: string): string {
  return (isbn || '').replace(/[^0-9X]/gi, '').trim();
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawQuery = (req.query.query as string || req.query.q as string || '').trim();
    if (!rawQuery) {
      return res.status(400).json({ error: 'Termine di ricerca mancante' });
    }

    const clean = cleanIsbn(rawQuery);
    const isIsbn = (clean.length === 10 || clean.length === 13) && /^(\d{9}[\dX]|\d{13})$/i.test(clean);

    if (isIsbn) {
      // Direct redirect to isbn handler
      const redirectUrl = `/api/isbn?isbn=${encodeURIComponent(clean)}`;
      return res.redirect(307, redirectUrl);
    }

    let title = '';
    let authors: string[] = [];
    let publisher = '';
    let publicationYear = '';
    let description = '';
    let coverUrl = '';
    let categories: string[] = [];
    let foundIsbn = '';
    let foundSource = '';

    // 1. OPAC SBN by Title
    try {
      const opacResp = await fetch(
        `https://opac.sbn.it/opacmobilegw/search.json?title=${encodeURIComponent(rawQuery)}&rows=5`,
        { headers: { 'User-Agent': 'BiblioScuola/1.0' } }
      );
      if (opacResp.ok) {
        const opacData = await opacResp.json();
        const records = opacData.briefRecords || [];
        if (records.length > 0) {
          const bestRec = records.find((r: any) => r.isbn) || records[0];
          let sbnTitle = bestRec.titolo || '';
          if (sbnTitle.includes(' / ')) sbnTitle = sbnTitle.split(' / ')[0].trim();
          if (sbnTitle.includes(' : ')) sbnTitle = sbnTitle.replace(/\s*:\s*/g, ' - ');
          title = sbnTitle;

          if (bestRec.autorePrincipale) {
            let auth = bestRec.autorePrincipale.trim();
            if (auth.includes(',')) {
              const parts = auth.split(',').map((p: string) => p.trim());
              auth = `${parts[1]} ${parts[0]}`.trim();
            }
            authors = [auth];
          }

          if (bestRec.pubblicazione) {
            const pubText = bestRec.pubblicazione;
            const match = pubText.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
            if (match) {
              if (match[1]) publisher = match[1].trim();
              if (match[2]) publicationYear = match[2].trim();
            }
          }

          if (bestRec.isbn) foundIsbn = cleanIsbn(bestRec.isbn);

          if (bestRec.copertina && typeof bestRec.copertina === 'string') {
            const c = bestRec.copertina.replace(/^http:\/\//i, 'https://').replace('/small/', '/large/');
            if (!c.includes('covers.librarything.com')) coverUrl = c;
          }

          foundSource = 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)';
        }
      }
    } catch (e) {
      console.warn('OPAC SBN title error in serverless:', e);
    }

    // 2. OPAC SBN by Author
    if (!title && authors.length === 0) {
      try {
        const opacResp = await fetch(
          `https://opac.sbn.it/opacmobilegw/search.json?author=${encodeURIComponent(rawQuery)}&rows=5`,
          { headers: { 'User-Agent': 'BiblioScuola/1.0' } }
        );
        if (opacResp.ok) {
          const opacData = await opacResp.json();
          const records = opacData.briefRecords || [];
          if (records.length > 0) {
            const bestRec = records.find((r: any) => r.isbn) || records[0];
            let sbnTitle = bestRec.titolo || '';
            if (sbnTitle.includes(' / ')) sbnTitle = sbnTitle.split(' / ')[0].trim();
            if (sbnTitle.includes(' : ')) sbnTitle = sbnTitle.replace(/\s*:\s*/g, ' - ');
            title = sbnTitle;

            if (bestRec.autorePrincipale) {
              let auth = bestRec.autorePrincipale.trim();
              if (auth.includes(',')) {
                const parts = auth.split(',').map((p: string) => p.trim());
                auth = `${parts[1]} ${parts[0]}`.trim();
              }
              authors = [auth];
            }

            if (bestRec.pubblicazione) {
              const pubText = bestRec.pubblicazione;
              const match = pubText.match(/:\s*([^,0-9]+),?\s*(\d{4})?/);
              if (match && match[1]) publisher = match[1].trim();
            }

            if (bestRec.isbn) foundIsbn = cleanIsbn(bestRec.isbn);
            foundSource = 'OPAC SBN / BNI (Catalogo Bibliotecario Nazionale)';
          }
        }
      } catch (e) {
        console.warn('OPAC SBN author error in serverless:', e);
      }
    }

    // 3. Open Library Search
    try {
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(rawQuery)}&limit=1&fields=title,author_name,publisher,first_publish_year,cover_i,isbn,subject`;
      const olResp = await fetch(olUrl);
      if (olResp.ok) {
        const olData = await olResp.json();
        const doc = olData?.docs?.[0];
        if (doc) {
          if (!title && doc.title) title = doc.title;
          if (authors.length === 0 && Array.isArray(doc.author_name)) authors = doc.author_name;
          if (!publisher && Array.isArray(doc.publisher) && doc.publisher.length > 0) publisher = doc.publisher[0];
          if (!publicationYear && doc.first_publish_year) publicationYear = String(doc.first_publish_year);
          if (!foundIsbn && Array.isArray(doc.isbn) && doc.isbn.length > 0) foundIsbn = cleanIsbn(doc.isbn[0]);
          if (!coverUrl && doc.cover_i) coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          if (categories.length === 0 && Array.isArray(doc.subject)) categories = doc.subject.slice(0, 4);
          if (!foundSource) foundSource = 'Open Library (Banca Dati Bibliotecaria)';
        }
      }
    } catch (e) {
      console.warn('Open Library error in serverless:', e);
    }

    // 4. Google Books API
    try {
      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(rawQuery)}&maxResults=1`;
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
          if (!foundSource) foundSource = 'Google Books (Banca Dati Bibliotecaria)';
        }
      }
    } catch (e) {
      console.warn('Google Books error in serverless:', e);
    }

    if (!title && authors.length === 0) {
      return res.status(200).json({
        found: false,
        message: 'Nessun risultato trovato nelle banche dati ufficiali',
      });
    }

    return res.status(200).json({
      found: true,
      isbn: foundIsbn || undefined,
      title,
      authors,
      publisher,
      publicationYear,
      description,
      coverUrl: coverUrl || (foundIsbn ? `https://images-na.ssl-images-amazon.com/images/P/${foundIsbn}.01.LZZZZZZZ.jpg` : undefined),
      categories,
      source: foundSource || 'Banche dati bibliotecarie collegate (OPAC SBN / Open Library / Google Books)',
    });
  } catch (err: any) {
    console.error('api/book-search error:', err);
    return res.status(500).json({ error: err?.message || 'Errore ricerca libro' });
  }
}
