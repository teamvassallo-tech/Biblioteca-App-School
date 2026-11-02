/**
 * Servizio di ricerca bibliografica unificato per BiblioScuola.
 * Chiama esclusivamente l'API interna serverless /api/search-book?q=...
 * Nessuna chiamata a modelli AI, nessuna dipendenza da chiavi API client e nessun problema CORS.
 */

export interface BookLookupResult {
  found: boolean;
  isbn?: string;
  title?: string;
  authors?: string[];
  publisher?: string;
  publicationYear?: string;
  description?: string;
  categories?: string[];
  pageCount?: number;
  coverUrl?: string;
  coverCandidates?: Array<{
    source: string;
    url: string;
    isOriginalEdition?: boolean;
  }>;
  genre?: string;
  ageGroup?: string;
  source?: string;
  message?: string;
  error?: string;
}

export interface BookSearchSettings {
  isbndbApiKey?: string;
  worldcatWskey?: string;
  librarythingDevKey?: string;
  schoolName?: string;
}

/**
 * Funzione principale di ricerca libro: interroga unicamente la nostra API interna /api/search-book?q=...
 * Accetta un codice ISBN, un Titolo o un Autore.
 */
export async function searchBook(
  query: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  const clean = (query || '').trim();
  if (!clean) {
    throw new Error('Inserisci un codice ISBN o un titolo per effettuare la ricerca.');
  }

  const qParams = new URLSearchParams();
  qParams.set('q', clean);
  if (settings?.isbndbApiKey) qParams.set('isbndbKey', settings.isbndbApiKey);
  if (settings?.worldcatWskey) qParams.set('worldcatKey', settings.worldcatWskey);
  if (settings?.librarythingDevKey) qParams.set('librarythingKey', settings.librarythingDevKey);

  const endpoint = `/api/search-book?${qParams.toString()}`;
  console.info(`[BiblioScuola Service] Interrogazione proxy interno: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (contentType.includes('application/json')) {
        const errJson = await res.json();
        return {
          found: false,
          error: errJson.error || `Errore server (${res.status})`,
          message: errJson.message || 'Errore durante la ricerca del libro nelle banche dati',
        };
      }
      throw new Error(`Risposta server HTTP ${res.status}`);
    }

    if (contentType.includes('application/json')) {
      const data: BookLookupResult = await res.json();
      return data;
    }

    throw new Error('Formato risposta non valido dal server (atteso JSON).');
  } catch (err: any) {
    console.error('[BiblioScuola Service] Errore connessione proxy:', err);
    return {
      found: false,
      error: err?.message || 'Errore di connessione al proxy bibliografico',
      message: 'Impossibile contattare il server proxy per la ricerca del libro.',
    };
  }
}

/**
 * Alias per la ricerca via ISBN
 */
export async function searchBookByIsbn(
  isbn: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  return searchBook(isbn, settings);
}

/**
 * Alias per la compatibilità con i componenti esistenti
 */
export async function searchBookOnline(
  query: string,
  settings?: BookSearchSettings
): Promise<BookLookupResult> {
  return searchBook(query, settings);
}
