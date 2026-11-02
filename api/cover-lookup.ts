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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawIsbn = (req.query?.isbn as string) || '';
    const clean = cleanIsbn(rawIsbn);

    if (!clean) {
      return res.status(400).json({ error: 'ISBN non valido' });
    }

    const isbn10 = clean.length === 10 ? clean : isbn13ToIsbn10(clean);
    const isbn13 = clean.length === 13 ? clean : isbn10ToIsbn13(clean);

    const candidates: Array<{ source: string; url: string; isOriginalEdition: boolean }> = [];

    // Amazon ISBN-13
    if (isbn13) {
      candidates.push({
        source: 'Copertina Originale Editore (Amazon Books CDN)',
        url: `https://images-na.ssl-images-amazon.com/images/P/${isbn13}.01.LZZZZZZZ.jpg`,
        isOriginalEdition: true,
      });
    }

    // Amazon ISBN-10
    if (isbn10 && isbn10 !== isbn13) {
      candidates.push({
        source: 'Copertina Originale Editore (ISBN-10)',
        url: `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`,
        isOriginalEdition: true,
      });
    }

    // Google Books
    const gbCode = isbn13 || clean;
    candidates.push({
      source: 'Google Books (Copertina Originale)',
      url: `https://books.google.com/books/content?vid=ISBN${gbCode}&printsec=frontcover&img=1&zoom=1`,
      isOriginalEdition: true,
    });

    // Open Library
    candidates.push({
      source: 'Open Library (Alta Risoluzione)',
      url: `https://covers.openlibrary.org/b/isbn/${clean}-L.jpg?default=false`,
      isOriginalEdition: false,
    });

    return res.status(200).json({
      found: true,
      coverUrl: candidates[0]?.url,
      coverCandidates: candidates,
      source: candidates[0]?.source || 'CDN Ufficiali',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Errore ricerca copertina' });
  }
}
