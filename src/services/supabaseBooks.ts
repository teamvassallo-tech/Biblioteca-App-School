import { Book } from '../types';
import { supabase, isSupabaseConfigured, getSupabaseConfigError, formatSupabaseError } from '../lib/supabase';

const BOOKS_TABLE = 'books';

interface SupabaseBookRow {
  id: string;
  school_id?: string | null;
  schoolId?: string | null;
  inventory_code?: string | null;
  inventoryCode?: string | null;
  isbn?: string | null;
  title?: string | null;
  authors?: string[] | string | null;
  publisher?: string | null;
  publication_year?: string | null;
  publicationYear?: string | null;
  genre?: string | null;
  age_group?: string | null;
  ageGroup?: string | null;
  collocazione?: string | null;
  cover_url?: string | null;
  coverUrl?: string | null;
  synopsis?: string | null;
  copies_total?: number | null;
  copiesTotal?: number | null;
  copies_available?: number | null;
  copiesAvailable?: number | null;
  status?: Book['status'] | string | null;
  page_count?: number | null;
  pageCount?: number | null;
  notes?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  updated_at?: string | null;
  updatedAt?: string | null;
}

function parseAuthors(raw: string[] | string | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return raw.map((a) => String(a).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((a) => String(a).trim()).filter(Boolean);
        }
      } catch {}
    }
    return trimmed
      .split(/[,;/]/)
      .map((a) => a.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeStatus(raw: string | null | undefined, copiesAvailable: number): Book['status'] {
  if (raw === 'Disponibile' || raw === 'In Prestito' || raw === 'Riservato' || raw === 'Danneggiato') {
    return raw;
  }
  return copiesAvailable > 0 ? 'Disponibile' : 'In Prestito';
}

function mapRowToBook(row: SupabaseBookRow): Book {
  const copiesTotal = Number(row.copies_total ?? row.copiesTotal ?? 1) || 1;
  const copiesAvailableRaw = row.copies_available ?? row.copiesAvailable;
  const copiesAvailable =
    copiesAvailableRaw !== null && copiesAvailableRaw !== undefined
      ? Math.max(0, Number(copiesAvailableRaw))
      : copiesTotal;

  const now = new Date().toISOString();
  const authors = parseAuthors(row.authors);

  return {
    id: String(row.id),
    schoolId: (row.school_id ?? row.schoolId ?? 'ic-erasmo') || 'ic-erasmo',
    inventoryCode: String(row.inventory_code ?? row.inventoryCode ?? ''),
    isbn: (row.isbn ?? undefined) || undefined,
    title: String(row.title ?? 'Senza titolo'),
    authors: authors.length > 0 ? authors : ['Autore sconosciuto'],
    publisher: (row.publisher ?? undefined) || undefined,
    publicationYear: (row.publication_year ?? row.publicationYear ?? undefined) || undefined,
    genre: String(row.genre ?? 'Narrativa'),
    ageGroup: String(row.age_group ?? row.ageGroup ?? 'Primaria (8-11 anni - 3ª/5ª)'),
    collocazione: String(row.collocazione ?? 'Scaffale Biblioteca'),
    coverUrl: (row.cover_url ?? row.coverUrl ?? undefined) || undefined,
    synopsis: (row.synopsis ?? undefined) || undefined,
    copiesTotal,
    copiesAvailable,
    status: normalizeStatus(row.status, copiesAvailable),
    pageCount: row.page_count ?? row.pageCount ?? undefined,
    notes: (row.notes ?? undefined) || undefined,
    createdAt: String(row.created_at ?? row.createdAt ?? now),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? now),
  };
}

function mapBookToRow(book: Book) {
  return {
    id: book.id,
    school_id: book.schoolId || 'ic-erasmo',
    inventory_code: book.inventoryCode,
    isbn: book.isbn || null,
    title: book.title,
    authors: Array.isArray(book.authors) && book.authors.length > 0 ? book.authors : ['Autore sconosciuto'],
    publisher: book.publisher || null,
    publication_year: book.publicationYear || null,
    genre: book.genre,
    age_group: book.ageGroup,
    collocazione: book.collocazione,
    cover_url: book.coverUrl || null,
    synopsis: book.synopsis || null,
    copies_total: Number(book.copiesTotal) || 1,
    copies_available: Math.max(0, Number(book.copiesAvailable) ?? 0),
    status: book.status || 'Disponibile',
    page_count: book.pageCount ?? null,
    notes: book.notes || null,
    created_at: book.createdAt,
    updated_at: book.updatedAt,
  };
}

function mapPartialUpdatesToRow(updates: Partial<Book>, updatedAt: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    updated_at: updatedAt,
  };

  if (updates.schoolId !== undefined) payload.school_id = updates.schoolId;
  if (updates.inventoryCode !== undefined) payload.inventory_code = updates.inventoryCode;
  if (updates.isbn !== undefined) payload.isbn = updates.isbn || null;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.authors !== undefined) {
    payload.authors = Array.isArray(updates.authors) && updates.authors.length > 0
      ? updates.authors
      : ['Autore sconosciuto'];
  }
  if (updates.publisher !== undefined) payload.publisher = updates.publisher || null;
  if (updates.publicationYear !== undefined) payload.publication_year = updates.publicationYear || null;
  if (updates.genre !== undefined) payload.genre = updates.genre;
  if (updates.ageGroup !== undefined) payload.age_group = updates.ageGroup;
  if (updates.collocazione !== undefined) payload.collocazione = updates.collocazione;
  if (updates.coverUrl !== undefined) payload.cover_url = updates.coverUrl || null;
  if (updates.synopsis !== undefined) payload.synopsis = updates.synopsis || null;
  if (updates.copiesTotal !== undefined) payload.copies_total = Number(updates.copiesTotal) || 1;
  if (updates.copiesAvailable !== undefined) payload.copies_available = Math.max(0, Number(updates.copiesAvailable));
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.pageCount !== undefined) payload.page_count = updates.pageCount ?? null;
  if (updates.notes !== undefined) payload.notes = updates.notes || null;

  return payload;
}

function ensureClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(getSupabaseConfigError());
  }
  return supabase;
}

export async function fetchBooksBySchoolFromSupabase(schoolId: string): Promise<Book[]> {
  const client = ensureClient();
  const { data, error } = await client
    .from(BOOKS_TABLE)
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatSupabaseError(error, 'lettura catalogo'));
  }

  return (data || []).map((row) => mapRowToBook(row as SupabaseBookRow));
}

export async function insertBookToSupabase(book: Book): Promise<Book> {
  const client = ensureClient();
  const row = mapBookToRow(book);
  const { data, error } = await client
    .from(BOOKS_TABLE)
    .insert(row)
    .select('*')
    .single();

  if (error) {
    throw new Error(formatSupabaseError(error, 'inserimento libro'));
  }

  return data ? mapRowToBook(data as SupabaseBookRow) : book;
}

export async function updateBookInSupabase(
  id: string,
  schoolId: string,
  updates: Partial<Book>,
  updatedAt: string
): Promise<Book | null> {
  const client = ensureClient();
  const payload = mapPartialUpdatesToRow(updates, updatedAt);

  const { data, error } = await client
    .from(BOOKS_TABLE)
    .update(payload)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError(error, 'aggiornamento libro'));
  }

  return data ? mapRowToBook(data as SupabaseBookRow) : null;
}

export async function batchUpdateBooksInSupabase(
  updatesList: Array<{ id: string; changes: Partial<Book> }>,
  schoolId: string,
  updatedAt: string
): Promise<void> {
  const client = ensureClient();

  for (const item of updatesList) {
    const payload = mapPartialUpdatesToRow(item.changes, updatedAt);
    const { error } = await client
      .from(BOOKS_TABLE)
      .update(payload)
      .eq('id', item.id)
      .eq('school_id', schoolId);

    if (error) {
      throw new Error(formatSupabaseError(error, 'aggiornamento multiplo libri'));
    }
  }
}

export async function deleteBookFromSupabase(id: string, schoolId: string): Promise<void> {
  const client = ensureClient();
  const { error } = await client
    .from(BOOKS_TABLE)
    .delete()
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) {
    throw new Error(formatSupabaseError(error, 'eliminazione libro'));
  }
}

export async function deleteBooksBySchoolFromSupabase(schoolId: string): Promise<void> {
  const client = ensureClient();
  const { error } = await client
    .from(BOOKS_TABLE)
    .delete()
    .eq('school_id', schoolId);

  if (error) {
    throw new Error(formatSupabaseError(error, 'azzeramento catalogo scuola'));
  }
}

export async function deleteAllBooksFromSupabase(): Promise<void> {
  const client = ensureClient();
  const { error } = await client
    .from(BOOKS_TABLE)
    .delete()
    .neq('id', '');

  if (error) {
    throw new Error(formatSupabaseError(error, 'reset globale catalogo'));
  }
}

export async function upsertBooksToSupabase(books: Book[]): Promise<Book[]> {
  const client = ensureClient();
  if (books.length === 0) return [];

  const rows = books.map(mapBookToRow);
  const { data, error } = await client
    .from(BOOKS_TABLE)
    .upsert(rows, { onConflict: 'id' })
    .select('*');

  if (error) {
    throw new Error(formatSupabaseError(error, 'importazione libri'));
  }

  return (data || []).map((row) => mapRowToBook(row as SupabaseBookRow));
}
